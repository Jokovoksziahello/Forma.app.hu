import type { Opening, RoomLabel, WallSegment } from './planStore'
import {
  defaultFloorSettings,
  defaultInsulationSettings,
  defaultRoofSettings,
  defaultSunSettings,
  type FloorSettings,
  type InsulationSettings,
  type RoofSettings,
  type SunSettings,
} from './buildingOptions'

export type ProjectData = {
  walls: WallSegment[]
  openings: Opening[]
  roomLabels: RoomLabel[]
  wallHeightM: number
  wallThicknessM: number
  roof: RoofSettings
  floor: FloorSettings
  sun: SunSettings
  insulation: InsulationSettings
  openingTexturesOn: boolean
  wallColor: string
  doorColor: string
  windowFrameColor: string
  floorColor: string
}

export type Project = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  data: ProjectData
}

const KEY = 'haztervezo.projects.v1'

function createDefaultProjectData(): ProjectData {
  return {
    walls: [],
    openings: [],
    roomLabels: [],
    wallHeightM: 2.7,
    wallThicknessM: 0.18,
    roof: { ...defaultRoofSettings },
    floor: { ...defaultFloorSettings },
    sun: { ...defaultSunSettings },
    insulation: { ...defaultInsulationSettings },
    openingTexturesOn: false,
    wallColor: '#e5e7eb',
    doorColor: '#8b5e3c',
    windowFrameColor: '#eceff3',
    floorColor: '#ffffff',
  }
}

function normalizeProjectData(data?: Partial<ProjectData> | null): ProjectData {
  const defaults = createDefaultProjectData()
  const legacy = data ?? {}
  return {
    ...defaults,
    ...legacy,
    roof: { ...defaults.roof, ...(legacy.roof ?? {}) },
    floor: { ...defaults.floor, ...(legacy.floor ?? {}) },
    sun: { ...defaults.sun, ...(legacy.sun ?? {}) },
    insulation: { ...defaults.insulation, ...(legacy.insulation ?? {}) },
  }
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<Project> | null | undefined>
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((project) => ({
      ...project,
      id: project?.id ?? id(),
      name: project?.name ?? 'Új terv',
      createdAt: project?.createdAt ?? Date.now(),
      updatedAt: project?.updatedAt ?? Date.now(),
      data: normalizeProjectData(project?.data),
    })) as Project[]
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(projects))
}

export function newProject(name = 'Új terv', data?: Partial<ProjectData>): Project {
  const now = Date.now()
  return {
    id: id(),
    name,
    createdAt: now,
    updatedAt: now,
    data: normalizeProjectData(data),
  }
}

export function id() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
}

