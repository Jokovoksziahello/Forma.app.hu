import { create } from 'zustand'
import type { Project, ProjectData } from './projects'
import { loadProjects, newProject, saveProjects } from './projects'
import {
  defaultFloorSettings,
  defaultInsulationSettings,
  defaultRoofSettings,
  defaultSunSettings,
} from './buildingOptions'

export type Vec2 = { x: number; y: number }

export type WallKind = 'load_bearing' | 'partition'

export type WallSegment = {
  id: string
  a: Vec2
  b: Vec2
  kind: WallKind
  thicknessM: number
  structuralWeak?: boolean
}

export type OpeningType = 'door' | 'window'

export type Opening = {
  id: string
  wallId: string
  type: OpeningType
  /** 0..1 position along the wall */
  t: number
  /** width in meters */
  widthM: number
  /** bottom offset from floor */
  sillM: number
  /** height in meters */
  heightM: number
}

const OPENING_LIMITS = {
  door: {
    width: { min: 0.7, max: 1.4 },
    height: { min: 1.9, max: 2.4 },
    sill: { min: 0, max: 0 },
  },
  window: {
    width: { min: 0.4, max: 4 },
    height: { min: 0.3, max: 2.2 },
    sill: { min: 0.2, max: 1.6 },
  },
} as const

export type RoomType =
  | 'konyha'
  | 'wc'
  | 'furdoszoba'
  | 'garazs'
  | 'nappali'
  | 'haloszoba'
  | 'eloter'
  | 'kamra'
  | 'dolgozo'
  | 'custom'

export type RoomLabel = {
  id: string
  type: RoomType
  pos: Vec2
  text?: string
}

type PlanSnapshot = {
  walls: WallSegment[]
  openings: Opening[]
  roomLabels: RoomLabel[]
}

type PlanState = {
  projectId: string | null
  projectName: string
  projects: Array<Pick<Project, 'id' | 'name' | 'updatedAt' | 'createdAt'>>

  wallHeightM: number
  wallThicknessM: number
  walls: WallSegment[]
  openings: Opening[]
  roomLabels: RoomLabel[]

  canUndo: boolean
  canRedo: boolean

  createProject: (name?: string, snapshot?: Partial<ProjectData>) => void
  saveProject: (snapshot?: Partial<ProjectData>) => void
  loadProject: (id: string) => Project | undefined
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  refreshProjects: () => void
  importProjectData: (data: ProjectData, name?: string) => void

  setWallHeightM: (v: number) => void
  setWallThicknessM: (v: number) => void
  addWall: (wall: Omit<WallSegment, 'id'> & { id?: string }) => void
  updateWall: (id: string, patch: Partial<Omit<WallSegment, 'id'>>) => void
  removeWall: (id: string) => void
  splitWall: (wallId: string, point: Vec2) => void

  addOpening: (o: Omit<Opening, 'id'> & { id?: string }) => void
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'wallId' | 'type'>>) => void
  removeOpening: (id: string) => void
  addRoomLabel: (l: Omit<RoomLabel, 'id'> & { id?: string }) => void
  removeRoomLabel: (id: string) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

function id() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
}

export const usePlanStore = create<PlanState>((set) => ({
  projectId: null,
  projectName: 'Nincs mentve',
  projects: [],

  wallHeightM: 2.7,
  wallThicknessM: 0.18,
  walls: [],
  openings: [],
  roomLabels: [],
  canUndo: false,
  canRedo: false,

  refreshProjects: () => {
    const ps = loadProjects()
    set({
      projects: ps
        .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })
  },

  importProjectData: (data, name) => {
    const normalizedName = name?.trim() || 'Megosztott terv'
    set((s0) => {
      const s = ensureHistory(s0)
      ;(s as any).past = []
      ;(s as any).future = []
      return {
        ...s,
        projectId: null,
        projectName: normalizedName,
        wallHeightM: clamp(data.wallHeightM, 2, 6),
        wallThicknessM: clamp(data.wallThicknessM, 0.05, 0.6),
        walls: Array.isArray(data.walls) ? data.walls : [],
        openings: Array.isArray(data.openings) ? data.openings : [],
        roomLabels: Array.isArray(data.roomLabels) ? data.roomLabels : [],
        canUndo: false,
        canRedo: false,
      }
    })
  },

  createProject: (name, snapshot) => {
    const p = newProject(name ?? 'Új terv', snapshot)
    const ps = [p, ...loadProjects()]
    saveProjects(ps)
    set({
      projectId: p.id,
      projectName: p.name,
      wallHeightM: p.data.wallHeightM,
      wallThicknessM: p.data.wallThicknessM,
      walls: p.data.walls,
      openings: p.data.openings,
      roomLabels: p.data.roomLabels,
      canUndo: false,
      canRedo: false,
      projects: ps
        .map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt, createdAt: x.createdAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })
  },

  saveProject: (snapshot) => {
    set((s0) => {
      const s = ensureHistory(s0)
      const ps = loadProjects()
      const now = Date.now()
      const nextName = s.projectName && s.projectName !== 'Nincs mentve' ? s.projectName : 'Új terv'
      const current: Project = {
        id: s.projectId ?? newProject(nextName, snapshot).id,
        name: nextName,
        createdAt: ps.find((p) => p.id === s.projectId)?.createdAt ?? now,
        updatedAt: now,
        data: buildProjectDataFromState(s, snapshot),
      }
      const merged = [current, ...ps.filter((p) => p.id !== current.id)]
      saveProjects(merged)
      return {
        ...s,
        projectId: current.id,
        projectName: current.name,
        projects: merged
          .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }
    })
  },

  loadProject: (id) => {
    const ps = loadProjects()
    const p = ps.find((x) => x.id === id)
    if (!p) return undefined
    set((s0) => {
      const s = ensureHistory(s0)
      // reset history on load
      ;(s as any).past = []
      ;(s as any).future = []
      return {
        ...s,
        projectId: p.id,
        projectName: p.name,
        wallHeightM: p.data.wallHeightM,
        wallThicknessM: p.data.wallThicknessM,
        walls: p.data.walls,
        openings: p.data.openings,
        roomLabels: p.data.roomLabels,
        canUndo: false,
        canRedo: false,
        projects: ps
          .map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt, createdAt: x.createdAt }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }
    })
    return p
  },

  renameProject: (id, name) => {
    const ps = loadProjects()
    const next = ps.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p))
    saveProjects(next)
    set((s) => ({
      ...s,
      projectName: s.projectId === id ? name : s.projectName,
      projects: next
        .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }))
  },

  deleteProject: (id) => {
    const ps = loadProjects()
    const next = ps.filter((p) => p.id !== id)
    saveProjects(next)
    set((s) => ({
      ...s,
      projectId: s.projectId === id ? null : s.projectId,
      projectName: s.projectId === id ? 'Nincs mentve' : s.projectName,
      projects: next
        .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }))
  },

  setWallHeightM: (v) => set({ wallHeightM: clamp(v, 2, 6) }),
  setWallThicknessM: (v) => set({ wallThicknessM: clamp(v, 0.05, 0.6) }),

  addWall: (wall) =>
    applyPlanChange(set, (s) => ({
      ...s,
      walls: [
        ...s.walls,
        {
          id: wall.id ?? id(),
          a: wall.a,
          b: wall.b,
          kind: wall.kind ?? inferWallKind(wall.thicknessM ?? s.wallThicknessM),
          thicknessM: clamp(wall.thicknessM ?? s.wallThicknessM, 0.05, 0.6),
        },
      ],
    })),

  updateWall: (id, patch) =>
    applyPlanChange(set, (s) => ({
      ...s,
      walls: s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  removeWall: (id) =>
    applyPlanChange(set, (s) => ({
      ...s,
      walls: s.walls.filter((w) => w.id !== id),
      openings: s.openings.filter((o) => o.wallId !== id),
    })),

  splitWall: (wallId, point) =>
    applyPlanChange(set, (s) => {
      const wall = s.walls.find((w) => w.id === wallId)
      if (!wall) return s

      const len = dist(wall.a, wall.b)
      if (len < 1e-6) return s

      const t = projectT(point, wall.a, wall.b)
      if (t <= 0.001 || t >= 0.999) return s

      const p = {
        x: wall.a.x + (wall.b.x - wall.a.x) * t,
        y: wall.a.y + (wall.b.y - wall.a.y) * t,
      }

      const len1 = dist(wall.a, p)
      const len2 = dist(p, wall.b)
      if (len1 < 0.05 || len2 < 0.05) return s

      const w1Id = id()
      const w2Id = id()

      const oldOpenings = s.openings.filter((o) => o.wallId === wallId)
      const keptOpenings = s.openings.filter((o) => o.wallId !== wallId)

      const movedOpenings: Opening[] = oldOpenings.map((o) => {
        const abs = o.t * len
        if (abs <= len1) {
          const nt = len1 < 1e-6 ? 0.5 : abs / len1
          return { ...o, wallId: w1Id, t: clamp(nt, 0.05, 0.95) }
        }
        const nt = len2 < 1e-6 ? 0.5 : (abs - len1) / len2
        return { ...o, wallId: w2Id, t: clamp(nt, 0.05, 0.95) }
      })

      return {
        ...s,
        walls: [
          ...s.walls.filter((w) => w.id !== wallId),
          { id: w1Id, a: wall.a, b: p, kind: wall.kind, thicknessM: wall.thicknessM },
          { id: w2Id, a: p, b: wall.b, kind: wall.kind, thicknessM: wall.thicknessM },
        ],
        openings: [...keptOpenings, ...movedOpenings],
      }
    }),
  addOpening: (o) =>
    applyPlanChange(set, (s) => ({
      ...s,
      openings: [
        ...s.openings,
        {
          id: o.id ?? id(),
          wallId: o.wallId,
          type: o.type,
          t: clamp(o.t, 0.05, 0.95),
          widthM: clampOpeningWidth(o.type, o.widthM),
          sillM: clampOpeningSill(o.type, o.sillM),
          heightM: clampOpeningHeight(o.type, o.heightM),
        },
      ],
    })),
  updateOpening: (id, patch) =>
    applyPlanChange(set, (s) => ({
      ...s,
      openings: s.openings.map((o) => {
        if (o.id !== id) return o
        return {
          ...o,
          t: patch.t !== undefined ? clamp(patch.t, 0.05, 0.95) : o.t,
          widthM: patch.widthM !== undefined ? clampOpeningWidth(o.type, patch.widthM) : o.widthM,
          sillM: patch.sillM !== undefined ? clampOpeningSill(o.type, patch.sillM) : o.sillM,
          heightM: patch.heightM !== undefined ? clampOpeningHeight(o.type, patch.heightM) : o.heightM,
        }
      }),
    })),
  removeOpening: (id) =>
    applyPlanChange(set, (s) => ({ ...s, openings: s.openings.filter((o) => o.id !== id) })),
  addRoomLabel: (l) =>
    applyPlanChange(set, (s) => ({
      ...s,
      roomLabels: [
        ...s.roomLabels,
        {
          id: l.id ?? id(),
          type: l.type,
          pos: l.pos,
          text: l.text,
        },
      ],
    })),
  removeRoomLabel: (id) =>
    applyPlanChange(set, (s) => ({ ...s, roomLabels: s.roomLabels.filter((r) => r.id !== id) })),

  undo: () => set((s) => undoReducer(s)),
  redo: () => set((s) => redoReducer(s)),

  clear: () =>
    applyPlanChange(set, (s) => ({
      ...s,
      walls: [],
      openings: [],
      roomLabels: [],
    })),
}))

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function projectT(p: Vec2, a: Vec2, b: Vec2) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const denom = abx * abx + aby * aby
  if (denom < 1e-8) return 0
  return (apx * abx + apy * aby) / denom
}

function inferWallKind(thicknessM: number): WallKind {
  // Very rough heuristic: 25cm+ tends to be structural in many houses.
  return thicknessM >= 0.25 ? 'load_bearing' : 'partition'
}

function clampOpeningWidth(type: OpeningType, v: number) {
  const lim = OPENING_LIMITS[type].width
  return clamp(v, lim.min, lim.max)
}

function clampOpeningHeight(type: OpeningType, v: number) {
  const lim = OPENING_LIMITS[type].height
  return clamp(v, lim.min, lim.max)
}

function clampOpeningSill(type: OpeningType, v: number) {
  const lim = OPENING_LIMITS[type].sill
  return clamp(v, lim.min, lim.max)
}

type HistoryState = {
  past: PlanSnapshot[]
  future: PlanSnapshot[]
}

function buildProjectDataFromState(
  s: Pick<PlanState, 'walls' | 'openings' | 'roomLabels' | 'wallHeightM' | 'wallThicknessM'>,
  snapshot?: Partial<ProjectData>,
): ProjectData {
  return {
    walls: s.walls,
    openings: s.openings,
    roomLabels: s.roomLabels,
    wallHeightM: s.wallHeightM,
    wallThicknessM: s.wallThicknessM,
    roof: snapshot?.roof ?? { ...defaultRoofSettings },
    floor: snapshot?.floor ?? { ...defaultFloorSettings },
    sun: snapshot?.sun ?? { ...defaultSunSettings },
    insulation: snapshot?.insulation ?? { ...defaultInsulationSettings },
    openingTexturesOn: snapshot?.openingTexturesOn ?? false,
    wallColor: snapshot?.wallColor ?? '#e5e7eb',
    doorColor: snapshot?.doorColor ?? '#8b5e3c',
    windowFrameColor: snapshot?.windowFrameColor ?? '#eceff3',
    floorColor: snapshot?.floorColor ?? '#ffffff',
  }
}

function snapshotFromState(s: Pick<PlanState, 'walls' | 'openings' | 'roomLabels'>): PlanSnapshot {
  return {
    walls: s.walls,
    openings: s.openings,
    roomLabels: s.roomLabels,
  }
}

function applySnapshot(s: PlanState, snap: PlanSnapshot): PlanState {
  return {
    ...s,
    walls: snap.walls,
    openings: snap.openings,
    roomLabels: snap.roomLabels,
  }
}

function ensureHistory(s: PlanState): PlanState & HistoryState {
  const hs = s as PlanState & Partial<HistoryState>
  if (!hs.past) (hs as any).past = []
  if (!hs.future) (hs as any).future = []
  return hs as PlanState & HistoryState
}

function applyPlanChange(set: (fn: (s: PlanState) => PlanState) => void, reducer: (s: PlanState) => PlanState) {
  set((s0) => {
    const s = ensureHistory(s0)
    const before = snapshotFromState(s)
    const next = reducer(s)
    const after = snapshotFromState(next)

    const changed =
      before.walls !== after.walls || before.openings !== after.openings || before.roomLabels !== after.roomLabels
    if (!changed) return s

    const past = [...s.past, before].slice(-200)
    const future: PlanSnapshot[] = []
    return {
      ...next,
      past,
      future,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    } as PlanState
  })
}

function undoReducer(s0: PlanState): PlanState {
  const s = ensureHistory(s0)
  if (s.past.length === 0) return { ...s, canUndo: false, canRedo: s.future.length > 0 }
  const prev = s.past[s.past.length - 1]
  const before = snapshotFromState(s)
  const past = s.past.slice(0, -1)
  const future = [before, ...s.future].slice(0, 200)
  const next = applySnapshot(s, prev)
  return {
    ...next,
    past,
    future,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  } as PlanState
}

function redoReducer(s0: PlanState): PlanState {
  const s = ensureHistory(s0)
  if (s.future.length === 0) return { ...s, canUndo: s.past.length > 0, canRedo: false }
  const nextSnap = s.future[0]
  const before = snapshotFromState(s)
  const future = s.future.slice(1)
  const past = [...s.past, before].slice(-200)
  const next = applySnapshot(s, nextSnap)
  return {
    ...next,
    past,
    future,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  } as PlanState
}

// Initialize project list on first import (best-effort)
try {
  const ps = loadProjects()
  if (ps.length === 0) {
    // no-op
  }
} catch {
  // ignore
}
