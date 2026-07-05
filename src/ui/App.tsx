import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plan2DEditor } from './Plan2DEditor'
import { Plan3DView } from './Plan3DView'
import { PlanElevationView } from './PlanElevationView'
import { PlanSectionView } from './PlanSectionView'
import { AdvancedTools } from './AdvancedTools'
import { Tutorial } from './Tutorial'
import { BuildingReportPanel } from './BuildingReportPanel'
import { ProfessionalSidebar } from './ProfessionalSidebar'
import { usePlanStore } from '../world/planStore'
import type { ProjectData } from '../world/projects'
import {
  buildCostLines,
  calcBrickMortar,
  calcConcrete,
  calcWallTotals,
  defaultMaterialUnitPricesHuf,
  sumCostLines,
  type MaterialUnitPricesHuf,
} from '../world/materialEstimate'
import { computeBuildingFootprintBox } from '../world/footprintArea'
import {
  createRoofLayer,
  defaultInsulationSettings,
  defaultFloorLayerSettings,
  createFloorLayer,
  defaultFloorSettings,
  defaultRoofSettings,
  defaultSunSettings,
  type FloorLayerSettings,
  type FloorSettings,
  type InsulationSettings,
  type RoofLayerSettings,
  type RoofSettings,
  type SunSettings,
} from '../world/buildingOptions'
import {
  calculateBuildingReport,
} from '../world/buildingReportCalculations'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { deflateRaw, inflateRaw } from 'pako'
import { decompressFromEncodedURIComponent } from 'lz-string'

type ViewMode = '2d' | '3d' | 'elevation' | 'section'
export type ToolMode = 'wall' | 'door' | 'window' | 'room' | 'text'
type ToolTab = 'calc' | 'diag' | 'sun' | 'roof' | 'openings' | 'insulation' | 'report' | 'report'

const UI_TEXT = {
  hu: {
    fullscreenTitle: 'Teljes képernyős munkamód',
    fullscreenDesc: 'A FORMA tervező teljes képernyőn a legjobb. Kattints a belépéshez.',
    fullscreenEnter: 'Belépés teljes képernyőbe',
    newProject: '🆕 Új projekt',
    projects: '📁 Projektek',
    settings: '⚙️ Beállítások',
    save: '💾 Mentés',
    view3d: '🏠 3D nézet',
    viewElevation: '🏘️ Homlokzat',
    viewSection: '📐 Metszet',
    view2d: '📐 2D nézet',
    calc: '🧮 Kalkulátor',
    pdf: '📄 PDF',
    png: '🖼 PNG',
    help: '❓',
    clear: '✕ Törlés',
    pngDownloadTitle: 'PNG letöltés',
    pngAsk: 'Le akarod tölteni a PNG képet?',
    yesDownload: 'Igen, letöltöm',
    cancel: 'Mégse',
    close: 'Bezár',
    projectsTitle: 'Projektek',
    settingsTitle: 'Beállítások',
    appearanceTitle: 'Megjelenés',
    darkMode: '🌙 Sötét mód',
    lightMode: '☀️ Világos mód',
    appearanceHint: 'Világos módban a 2D vászon is fehér háttérrel jelenik meg.',
    languageTitle: 'Nyelv',
    threeDTitle: '3D beállítások',
    shadowsOn: '🌤 Árnyék: be',
    shadowsOff: '🌤 Árnyék: ki',
    shadowsHint: 'A 3D nézetben kapcsolja az árnyék megjelenítését.',
    helpOpen: '❓ Súgó megnyitása',
    langHu: '🇭🇺 Magyar',
    langEn: '🇬🇧 English',
    langHuShort: 'HU',
    langEnShort: 'EN',
    toolsTitle: 'Eszközök',
    calcOpenTitle: 'Kalkulátor megnyitása',
    saveError: 'Mentés hiba',
    savedAt: 'Mentve',
    newProjectNamed: 'Új projekt',
    undoTitle: 'Vissza (Ctrl+Z)',
    redoTitle: 'Előre (Ctrl+Y)',
    newProjectTitle: 'Új üres projekt indítása',
    projectsTitleButton: 'Eddigi projektek',
    saveTitle: 'Mentés',
    exportPdfTitle: 'Export PDF',
    exportPngTitle: 'PNG export',
    helpTitle: 'Súgó / Tutorial',
    clearTitle: 'Teljes törlés',
    create: 'Létrehoz',
    projectNamePlaceholder: 'Új terv neve',
    projectNameHint: 'Tipp: “Mentés” gombbal a jelenlegi terv felülírja a saját projektjét (vagy létrehoz újat, ha még nem volt).',
    noSavedProjects: 'Még nincs mentett projekt.',
    projectDefaultName: 'Új terv',
    jsonDownloaded: 'JSON letöltve ✓',
    csvDownloaded: 'CSV letöltve ✓',
    pdfDownloaded: 'PDF letöltve ✓',
    pdfExportError: 'PDF export hiba',
    pdfNeedsManual3dPng: 'Előbb ments 3D PNG-t, utána exportálj PDF-et.',
    exportUnavailable: 'Export nem elérhető',
    pngExportError: 'PNG export hiba',
    pngReady: 'PNG kész. Letöltöd?',
    pngDownloaded: 'PNG letöltve ✓',
    pngCanceled: 'PNG letöltés megszakítva',
    wallHeight: 'Fal magas. (m)',
    wallThickness: 'Fal vastags. (m)',
    wallColor: 'Fal szín',
    wallColorTitle: 'Fal színválasztó',
    doorColor: 'Ajtó szín',
    windowFrame: 'Ablak tok',
    floorColor: 'Padló szín',
    floorLayer: 'Padló réteg',
    floorLayerColor: 'Réteg szín',
    floorLayerOn: 'Padló: be',
    floorLayerOff: 'Padló: ki',
    floorThickness: 'Vast. (m)',
    floorLift: 'Emelés',
    floorWidthMul: 'Szél.×',
    floorLengthMul: 'Hossz×',
    openingTextureTitle: 'Ajtó és ablak textúra',
    openingTextureOn: '🪟 Textúra: be',
    openingTexture: '🪟 Textúra',
    addRoofPartTitle: 'Új tetőelem',
    addRoofPart: '+ Tető',
    restoreDeleted: 'Visszaállít törölt',
    roofItem: 'Tető',
    visibleOn: '👁 Be',
    visibleOff: '👁 Ki',
    roofTypeGable: 'Nyereg',
    roofTypeShed: 'Félnyereg',
    roofTypeFlat: 'Lapos',
    roofTypeHip: 'Kontyolt',
    roofTypeButterfly: 'Pillangó',
    roofColorTitle: 'Tető szín',
    roofHeight: 'Mag. (m)',
    roofScale: 'Skála',
    roofWidthMul: 'Szél.×',
    roofLengthMul: 'Hossz×',
    roofHeightMul: 'Magasság×',
    roofPitch: 'Dőlés°',
    roofLift: 'Emelés',
    roofOverhang: 'Túlnyúlás',
    roofOffsetX: 'X eltolás',
    roofOffsetZ: 'Z eltolás',
    roofRotation: 'Forgatás°',
    roofReset: 'Alaphelyzet',
    roofResetCuts: 'Vágások nullázása',
    delete: 'Törlés',
    rename: 'Átnevez',
    saveBtn: 'Ment',
    confirmDelete: 'Tényleg töröl',
    projectNameField: 'Projekt név',
    calcTab: 'Anyagkalkulátor',
    sunTab: 'Napszak / Árnyék',
    roofTab: 'Tető',
    openingsTab: 'Nyílászárók',
    insulationTab: 'Szigetelés',
    reportTab: '📋 Terv Dokumentáció',
    diagTab: 'Beázás / Repedés',
    mobileBlockedTitle: 'Mobil eszközön nem használható',
    addFloorPartTitle: 'Új padló elem',
    addFloorPart: '+ Padló',
    floorItem: 'Padló',
    mobileBlockedText: 'Ez az alkalmazás csak asztali vagy laptop nézetben érhető el.',
    rotationLabel: 'Forgatás (°)',
  },
  en: {
    fullscreenTitle: 'Fullscreen Workspace',
    fullscreenDesc: 'FORMA works best in fullscreen mode. Click to enter.',
    fullscreenEnter: 'Enter fullscreen',
    newProject: '🆕 New project',
    projects: '📁 Projects',
    settings: '⚙️ Settings',
    save: '💾 Save',
    view3d: '🏠 3D view',
    viewElevation: '🏘️ Elevation',
    viewSection: '📐 Section',
    view2d: '📐 2D view',
    calc: '🧮 Calculator',
    pdf: '📄 PDF',
    png: '🖼 PNG',
    help: '❓',
    clear: '✕ Clear',
    pngDownloadTitle: 'PNG download',
    pngAsk: 'Do you want to download the PNG image?',
    yesDownload: 'Yes, download',
    cancel: 'Cancel',
    close: 'Close',
    projectsTitle: 'Projects',
    settingsTitle: 'Settings',
    appearanceTitle: 'Appearance',
    darkMode: '🌙 Dark mode',
    lightMode: '☀️ Light mode',
    appearanceHint: 'In light mode, the 2D canvas uses a white background.',
    languageTitle: 'Language',
    threeDTitle: '3D settings',
    shadowsOn: '🌤 Shadows: on',
    shadowsOff: '🌤 Shadows: off',
    shadowsHint: 'Toggle shadow rendering in the 3D view.',
    helpOpen: '❓ Open help',
    langHu: '🇭🇺 Hungarian',
    langEn: '🇬🇧 English',
    langHuShort: 'HU',
    langEnShort: 'EN',
    toolsTitle: 'Tools',
    calcOpenTitle: 'Open calculator',
    saveError: 'Save failed',
    savedAt: 'Saved',
    newProjectNamed: 'New project',
    undoTitle: 'Undo (Ctrl+Z)',
    redoTitle: 'Redo (Ctrl+Y)',
    newProjectTitle: 'Start new empty project',
    projectsTitleButton: 'Previous projects',
    saveTitle: 'Save',
    exportPdfTitle: 'Export PDF',
    exportPngTitle: 'Export PNG',
    helpTitle: 'Help / Tutorial',
    clearTitle: 'Clear all',
    create: 'Create',
    projectNamePlaceholder: 'New project name',
    projectNameHint: 'Tip: the Save button overwrites the current project (or creates a new one if it was not saved yet).',
    noSavedProjects: 'No saved projects yet.',
    projectDefaultName: 'New plan',
    jsonDownloaded: 'JSON downloaded ✓',
    csvDownloaded: 'CSV downloaded ✓',
    pdfDownloaded: 'PDF downloaded ✓',
    pdfExportError: 'PDF export failed',
    pdfNeedsManual3dPng: 'Save a 3D PNG first, then export PDF.',
    exportUnavailable: 'Export unavailable',
    pngExportError: 'PNG export failed',
    pngReady: 'PNG ready. Download it?',
    pngDownloaded: 'PNG downloaded ✓',
    pngCanceled: 'PNG download cancelled',
    wallHeight: 'Wall height (m)',
    wallThickness: 'Wall thickness (m)',
    wallColor: 'Wall color',
    wallColorTitle: 'Wall color picker',
    doorColor: 'Door color',
    windowFrame: 'Window frame',
    floorColor: 'Floor color',
    floorLayer: 'Floor layer',
    floorLayerColor: 'Layer color',
    floorLayerOn: 'Floor: on',
    floorLayerOff: 'Floor: off',
    floorThickness: 'Thk. (m)',
    floorLift: 'Lift',
    floorWidthMul: 'Width×',
    floorLengthMul: 'Length×',
    openingTextureTitle: 'Door and window texture',
    openingTextureOn: '🪟 Texture: on',
    openingTexture: '🪟 Texture',
    addRoofPartTitle: 'New roof element',
    addRoofPart: '+ Roof',
    restoreDeleted: 'Restore deleted',
    roofItem: 'Roof',
    visibleOn: '👁 On',
    visibleOff: '👁 Off',
    roofTypeGable: 'Gable',
    roofTypeShed: 'Shed',
    roofTypeFlat: 'Flat',
    roofTypeHip: 'Hip',
    roofTypeButterfly: 'Butterfly',
    roofColorTitle: 'Roof color',
    roofHeight: 'Ht. (m)',
    roofScale: 'Scale',
    roofWidthMul: 'Width×',
    roofLengthMul: 'Length×',
    roofHeightMul: 'Height×',
    roofPitch: 'Pitch°',
    roofLift: 'Lift',
    roofOverhang: 'Overhang',
    roofOffsetX: 'Offset X',
    roofOffsetZ: 'Offset Z',
    roofRotation: 'Rotation°',
    addFloorPartTitle: 'New floor layer',
    addFloorPart: '+ Floor',
    floorItem: 'Floor',
    roofReset: 'Reset',
    roofResetCuts: 'Reset cuts',
    delete: 'Delete',
    rename: 'Rename',
    saveBtn: 'Save',
    confirmDelete: 'Confirm delete',
    projectNameField: 'Project name',
    calcTab: 'Materials',
    sunTab: 'Sun / Shadow',
    roofTab: 'Roof',
    openingsTab: 'Openings',
    insulationTab: 'Insulation',
    reportTab: '📋 Building Plan',
    diagTab: 'Leaks / Cracks',
    mobileBlockedTitle: 'Not Available On Mobile',
    mobileBlockedText: 'This application is available only on desktop or laptop view.',
    rotationLabel: 'Rotation (°)',
  },
} as const

function detectMobileBlock() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const mobileUa = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua)
  const smallScreen = window.matchMedia('(max-width: 900px)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  return mobileUa || (smallScreen && coarsePointer)
}

function detectViewOnlyFromQuery() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const flag = (params.get('view') ?? params.get('readonly') ?? '').toLowerCase().trim()
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'ro' || flag === 'view'
}

type SharedProjectPayloadDecoded = {
  name?: string
  data: ProjectData
}

type CompactSharedPayloadV2 = {
  v: 2
  n?: string
  d: {
    wh: number
    wt: number
    w: number[][]
    o: number[][]
    r: Array<[string, number, number, string?]>
    rf?: ProjectData['roof']
    fl?: ProjectData['floor']
    su?: ProjectData['sun']
    ins?: ProjectData['insulation']
    ot?: 0 | 1
    wc?: string
    dc?: string
    wfc?: string
    fc?: string
  }
}

type SharePayloadLevel = 'full' | 'core' | 'geometry'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64url.length + 3) % 4)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function roundTo(n: number, digits: number) {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function encodeSharedProjectPayload(name: string, data: ProjectData, level: SharePayloadLevel = 'full'): string | null {
  try {
    const wallIndexById = new Map<string, number>()
    const compactWalls = data.walls.map((w, idx) => {
      wallIndexById.set(w.id, idx)
      return [
        roundTo(w.a.x, 3),
        roundTo(w.a.y, 3),
        roundTo(w.b.x, 3),
        roundTo(w.b.y, 3),
        w.kind === 'load_bearing' ? 1 : 0,
        roundTo(w.thicknessM, 3),
      ]
    })

    const compactOpenings = data.openings
      .map((o) => {
        const wallIdx = wallIndexById.get(o.wallId)
        if (wallIdx === undefined) return null
        return [
          wallIdx,
          o.type === 'door' ? 1 : 0,
          roundTo(o.t, 4),
          roundTo(o.widthM, 3),
          roundTo(o.sillM, 3),
          roundTo(o.heightM, 3),
        ]
      })
      .filter(Boolean) as number[][]

    const compactRooms: Array<[string, number, number, string?]> = data.roomLabels.map((r) => [
      r.type,
      roundTo(r.pos.x, 3),
      roundTo(r.pos.y, 3),
      level === 'geometry' ? undefined : r.text,
    ])

    const includeRoofAndFloor = level !== 'geometry'
    const includeVisual = level === 'full'
    const includeInsulation = level === 'full'

    const payload: CompactSharedPayloadV2 = {
      v: 2,
      n: name,
      d: {
        wh: roundTo(data.wallHeightM, 3),
        wt: roundTo(data.wallThicknessM, 3),
        w: compactWalls,
        o: compactOpenings,
        r: compactRooms,
        rf: includeRoofAndFloor ? data.roof : undefined,
        fl: includeRoofAndFloor ? data.floor : undefined,
        su: includeRoofAndFloor ? data.sun : undefined,
        ins: includeInsulation ? data.insulation : undefined,
        ot: includeVisual ? (data.openingTexturesOn ? 1 : 0) : undefined,
        wc: includeVisual ? data.wallColor : undefined,
        dc: includeVisual ? data.doorColor : undefined,
        wfc: includeVisual ? data.windowFrameColor : undefined,
        fc: includeVisual ? data.floorColor : undefined,
      },
    }
    const json = JSON.stringify(payload)
    const inputBytes = new TextEncoder().encode(json)
    const compressed = deflateRaw(inputBytes, { level: 9 })
    return bytesToBase64Url(compressed)
  } catch {
    return null
  }
}

function decodeSharedProjectPayloadFromQuery(): SharedProjectPayloadDecoded | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('share')
  if (!encoded) return null
  try {
    let json: string | null = null
    try {
      const compressed = base64UrlToBytes(encoded)
      const inflated = inflateRaw(compressed)
      json = new TextDecoder().decode(inflated)
    } catch {
      // Backward compatibility for old lz-string links.
      json = decompressFromEncodedURIComponent(encoded)
    }
    if (!json) return null
    const parsed = JSON.parse(json) as any

    if (parsed?.v === 2 && parsed?.d) {
      const d = parsed.d as CompactSharedPayloadV2['d']
      const walls = (Array.isArray(d.w) ? d.w : []).map((w, i) => ({
        id: `sw-${i}`,
        a: { x: Number(w?.[0] ?? 0), y: Number(w?.[1] ?? 0) },
        b: { x: Number(w?.[2] ?? 0), y: Number(w?.[3] ?? 0) },
        kind: (Number(w?.[4] ?? 0) === 1 ? 'load_bearing' : 'partition') as 'load_bearing' | 'partition',
        thicknessM: Number(w?.[5] ?? 0.18),
      }))

      const openings = (Array.isArray(d.o) ? d.o : [])
        .map((o, i) => {
          const wallIdx = Number(o?.[0] ?? -1)
          const wall = walls[wallIdx]
          if (!wall) return null
          return {
            id: `so-${i}`,
            wallId: wall.id,
            type: Number(o?.[1] ?? 0) === 1 ? 'door' : 'window',
            t: Number(o?.[2] ?? 0.5),
            widthM: Number(o?.[3] ?? 1),
            sillM: Number(o?.[4] ?? 0),
            heightM: Number(o?.[5] ?? 1.2),
          }
        })
        .filter(Boolean)

      const roomLabels = (Array.isArray(d.r) ? d.r : []).map((r, i) => ({
        id: `sr-${i}`,
        type: String(r?.[0] ?? 'custom') as any,
        pos: { x: Number(r?.[1] ?? 0), y: Number(r?.[2] ?? 0) },
        text: typeof r?.[3] === 'string' ? r[3] : undefined,
      }))

      return {
        name: typeof parsed?.n === 'string' ? parsed.n : undefined,
        data: {
          walls,
          openings: openings as ProjectData['openings'],
          roomLabels,
          wallHeightM: Number(d.wh ?? 2.7),
          wallThicknessM: Number(d.wt ?? 0.18),
          roof: d.rf ?? { ...defaultRoofSettings },
          floor: d.fl ?? { ...defaultFloorSettings },
          sun: d.su ?? { ...defaultSunSettings },
          insulation: d.ins ?? { ...defaultInsulationSettings },
          openingTexturesOn: Number(d.ot ?? 0) === 1,
          wallColor: String(d.wc ?? '#e5e7eb'),
          doorColor: String(d.dc ?? '#8b5e3c'),
          windowFrameColor: String(d.wfc ?? '#eceff3'),
          floorColor: String(d.fc ?? '#ffffff'),
        },
      }
    }

    if (parsed?.v === 1 && parsed?.data) {
      return {
        name: typeof parsed?.name === 'string' ? parsed.name : undefined,
        data: parsed.data as ProjectData,
      }
    }

    return null
  } catch {
    return null
  }
}

export function App() {
  const last3dPngForPdfRef = useRef<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('2d')
  const [mobileBlocked, setMobileBlocked] = useState(() => detectMobileBlock())
  const [isViewOnly, setIsViewOnly] = useState(() => detectViewOnlyFromQuery())
  const [uiLang, setUiLang] = useState<keyof typeof UI_TEXT>(() => {
    try {
      const saved = localStorage.getItem('forma.ui.lang')
      return saved === 'en' ? 'en' : 'hu'
    } catch {
      return 'hu'
    }
  })
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const [tool, setTool] = useState<ToolMode>('wall')
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [toolTab, setToolTab] = useState<ToolTab>('calc')
  const [active3dPanel, setActive3dPanel] = useState<'floor' | 'roof'>('floor')
  const [saveStatus, setSaveStatus] = useState('')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [pendingPngDownload, setPendingPngDownload] = useState<null | { dataUrl: string; filename: string; fromMode: ViewMode }>(null)
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null)
  const [renameProjectDraft, setRenameProjectDraft] = useState('')
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [creatingNewProject, setCreatingNewProject] = useState(false)
  const [newProjectDraft, setNewProjectDraft] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [topbarHeightPx, setTopbarHeightPx] = useState(() => {
    if (typeof window === 'undefined') return 96
    return window.innerWidth < 900 ? 96 : 108
  })
  const [isResizingTopbar, setIsResizingTopbar] = useState(false)
  const topbarResizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem('forma_tutorial_done') } catch { return true }
  })
  const closeTutorial = () => {
    try { localStorage.setItem('forma_tutorial_done', '1') } catch { /* ignore */ }
    setShowTutorial(false)
  }
  const [openingTexturesOn, setOpeningTexturesOn] = useState(false)
  const [wallColor, setWallColor] = useState('#e5e7eb')
  const [doorColor, setDoorColor] = useState('#8b5e3c')
  const [windowFrameColor, setWindowFrameColor] = useState('#eceff3')
  const [floorColor, setFloorColor] = useState('#ffffff')
  const [concreteM3, setConcreteM3] = useState(1)
  const [cementRatio, setCementRatio] = useState(1)
  const [aggregateRatio, setAggregateRatio] = useState(6)
  const [waterCement, setWaterCement] = useState(0.5)
  const [rebarKgPerM3, setRebarKgPerM3] = useState(90)
  const [contingencyPct, setContingencyPct] = useState(8)
  const [unitPrices, setUnitPrices] = useState<MaterialUnitPricesHuf>(() => ({ ...defaultMaterialUnitPricesHuf }))
  const [laborDraft, setLaborDraft] = useState(() => ({
    wallLaborFtPerM2: String(defaultMaterialUnitPricesHuf.wallLaborFtPerM2),
    concreteLaborFtPerM3: String(defaultMaterialUnitPricesHuf.concreteLaborFtPerM3),
    rebarLaborFtPerKg: String(defaultMaterialUnitPricesHuf.rebarLaborFtPerKg),
    doorInstallLaborFtPerPc: String(defaultMaterialUnitPricesHuf.doorInstallLaborFtPerPc),
    windowInstallLaborFtPerM2: String(defaultMaterialUnitPricesHuf.windowInstallLaborFtPerM2),
  }))
  const [roof, setRoofState] = useState<RoofSettings>(() => ({ ...defaultRoofSettings }))
  const [lastDeletedRoofLayer, setLastDeletedRoofLayer] = useState<RoofLayerSettings | null>(null)
  const [sun, setSunState] = useState<SunSettings>(() => ({ ...defaultSunSettings }))
  const [floor, setFloorState] = useState<FloorSettings>(() => ({ ...defaultFloorSettings }))
  const [lastDeletedFloorLayer, setLastDeletedFloorLayer] = useState<FloorLayerSettings | null>(null)
  const [insulation, setInsulationState] = useState<InsulationSettings>(() => ({ ...defaultInsulationSettings }))
  const {
    projectId,
    projectName,
    projects,
    refreshProjects,
    createProject,
    saveProject,
    loadProject,
    renameProject,
    deleteProject,
    importProjectData,
    wallHeightM,
    wallThicknessM,
    setWallHeightM,
    setWallThicknessM,
    clear,
    undo,
    redo,
    canUndo,
    canRedo,
    walls,
    openings,
    roomLabels,
  } = usePlanStore()

  const updateRoofLayers = useCallback(
    (updater: (layers: RoofSettings['layers']) => RoofSettings['layers']) =>
      setRoofState((current) => ({ ...current, layers: updater(current.layers) })),
    [setRoofState],
  )
  const selectedLayer = roof.layers.find((layer) => layer.id === roof.selectedLayerId) ?? roof.layers[0]
  const setSelectedLayer = useCallback(
    (layerId: string | null) => setRoofState((current) => ({ ...current, selectedLayerId: layerId })),
    [setRoofState],
  )
  const updateSelectedLayer = useCallback(
    (patch: Partial<RoofLayerSettings>) => {
      if (!selectedLayer) return
      updateRoofLayers((layers) => layers.map((layer) => (layer.id === selectedLayer.id ? { ...layer, ...patch } : layer)))
    },
    [selectedLayer, updateRoofLayers],
  )
  const setRoofFromTools = (patch: Partial<RoofLayerSettings>) => {
    if (selectedLayer) {
      updateSelectedLayer(patch)
      return
    }
    const layer = createRoofLayer({
      visible: true,
      offsetXM: 0,
      offsetZM: 0,
      scale: 1,
      ...patch,
    })
    setRoofState((current) => ({ ...current, layers: [...current.layers, layer], selectedLayerId: layer.id }))
  }
  const addRoofLayer = () => {
    const layer = createRoofLayer({ visible: true, offsetXM: 0, offsetZM: 0, scale: 1 })
    setRoofState((current) => ({ ...current, layers: [...current.layers, layer], selectedLayerId: layer.id }))
  }
  const deleteSelectedRoofLayer = () => {
    if (!selectedLayer) return
    setLastDeletedRoofLayer(selectedLayer)
    setRoofState((current) => {
      const remainingLayers = current.layers.filter((layer) => layer.id !== selectedLayer.id)
      const nextSelectedLayerId = remainingLayers.length > 0 ? remainingLayers[remainingLayers.length - 1].id : null
      return { ...current, layers: remainingLayers, selectedLayerId: nextSelectedLayerId }
    })
  }
  const restoreLastDeletedRoofLayer = () => {
    if (!lastDeletedRoofLayer) return
    const restored = { ...lastDeletedRoofLayer, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
    setRoofState((current) => ({
      ...current,
      layers: [...current.layers, restored],
      selectedLayerId: restored.id,
    }))
    setLastDeletedRoofLayer(null)
  }
  const resetSelectedRoofTransform = () => {
    if (!selectedLayer) return
    updateSelectedLayer({
      scale: 1,
      widthMultiplier: 1,
      lengthMultiplier: 1,
      heightMultiplier: 1,
      offsetXM: 0,
      offsetYM: 0,
      offsetZM: 0,
      rotationDeg: 0,
    })
  }
  const resetSelectedRoofCuts = () => {
    if (!selectedLayer) return
    updateSelectedLayer({
      cutLeftM: 0,
      cutRightM: 0,
      cutFrontM: 0,
      cutBackM: 0,
      cornerCutFrontLeftM: 0,
      cornerCutFrontRightM: 0,
      cornerCutBackLeftM: 0,
      cornerCutBackRightM: 0,
    })
  }
  const adjustRoof = useCallback(
    (updater: (current: RoofLayerSettings) => RoofLayerSettings) => {
      if (!selectedLayer) return
      updateRoofLayers((layers) => layers.map((layer) => (layer.id === selectedLayer.id ? updater(layer) : layer)))
    },
    [selectedLayer, updateRoofLayers],
  )
  // Floor layers (multiple)
  const updateFloorLayers = (updater: (layers: FloorSettings['layers']) => FloorSettings['layers']) =>
    setFloorState((current) => ({ ...current, layers: updater(current.layers) }))
  const selectedFloor = floor.layers.find((layer) => layer.id === floor.selectedLayerId) ?? floor.layers[0]
  const setSelectedFloor = (layerId: string | null) => setFloorState((current) => ({ ...current, selectedLayerId: layerId }))
  const updateSelectedFloor = (patch: Partial<FloorLayerSettings>) => {
    if (!selectedFloor) return
    updateFloorLayers((layers) => layers.map((layer) => (layer.id === selectedFloor.id ? { ...layer, ...patch } : layer)))
  }
  const floorLayer = selectedFloor ?? defaultFloorLayerSettings
  const addFloorLayer = () => {
    let nextOffsetY = 0
    if (floor.layers.length > 0) {
      // Find the topmost layer
      const topLayer = floor.layers.reduce((prev, current) => {
        const prevTop = prev.offsetYM + (prev.thicknessM ?? 0.12)
        const currentTop = current.offsetYM + (current.thicknessM ?? 0.12)
        return currentTop > prevTop ? current : prev
      })
      nextOffsetY = topLayer.offsetYM + (topLayer.thicknessM ?? 0.12) + 0.08
    }
    const layer = createFloorLayer({ visible: true, offsetXM: 0, offsetZM: 0, offsetYM: nextOffsetY })
    setFloorState((current) => ({ ...current, layers: [...current.layers, layer], selectedLayerId: layer.id }))
  }

  const selectOrAddFloorLayer = () => {
    addFloorLayer()
  }
  const deleteSelectedFloorLayer = () => {
    if (!selectedFloor) return
    setLastDeletedFloorLayer(selectedFloor)
    setFloorState((current) => {
      const remainingLayers = current.layers.filter((layer) => layer.id !== selectedFloor.id)
      const nextSelectedLayerId = remainingLayers.length > 0 ? remainingLayers[remainingLayers.length - 1].id : null
      return { ...current, layers: remainingLayers, selectedLayerId: nextSelectedLayerId }
    })
  }
  const restoreLastDeletedFloorLayer = () => {
    if (!lastDeletedFloorLayer) return
    const restored = { ...lastDeletedFloorLayer, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
    setFloorState((current) => ({ ...current, layers: [...current.layers, restored], selectedLayerId: restored.id }))
    setLastDeletedFloorLayer(null)
  }
  
  const updateLaborUnitPrice = (
    key:
      | 'wallLaborFtPerM2'
      | 'concreteLaborFtPerM3'
      | 'rebarLaborFtPerKg'
      | 'doorInstallLaborFtPerPc'
      | 'windowInstallLaborFtPerM2',
    raw: string,
  ) => {
    setLaborDraft((d) => ({ ...d, [key]: raw }))
    const normalized = raw.replace(',', '.').trim()
    if (normalized === '') return
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return
    setUnitPrices((p) => ({ ...p, [key]: Math.max(0, parsed) }))
  }
  const normalizeLaborUnitPrice = (
    key:
      | 'wallLaborFtPerM2'
      | 'concreteLaborFtPerM3'
      | 'rebarLaborFtPerKg'
      | 'doorInstallLaborFtPerPc'
      | 'windowInstallLaborFtPerM2',
  ) => {
    const raw = laborDraft[key].replace(',', '.').trim()
    if (raw === '') {
      const fallback = defaultMaterialUnitPricesHuf[key]
      setUnitPrices((p) => ({ ...p, [key]: fallback }))
      setLaborDraft((d) => ({ ...d, [key]: String(fallback) }))
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setLaborDraft((d) => ({ ...d, [key]: String(unitPrices[key]) }))
      return
    }
    const next = Math.max(0, parsed)
    setUnitPrices((p) => ({ ...p, [key]: next }))
    setLaborDraft((d) => ({ ...d, [key]: String(next) }))
  }
  const setSun = (patch: Partial<SunSettings>) => setSunState((current) => ({ ...current, ...patch }))
  const setFloorLayer = (patch: Partial<FloorLayerSettings>) => {
    if (selectedFloor) {
      updateSelectedFloor(patch)
      return
    }
    const layer = createFloorLayer({ ...patch })
    setFloorState((current) => ({ ...current, layers: [...current.layers, layer], selectedLayerId: layer.id }))
  }
  const setInsulation = (patch: Partial<InsulationSettings>) =>
    setInsulationState((current) => ({ ...current, ...patch }))

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  useEffect(() => {
    if (!saveStatus) return
    const timer = window.setTimeout(() => setSaveStatus(''), 2600)
    return () => window.clearTimeout(timer)
  }, [saveStatus])

  useEffect(() => {
    if (!exportMessage) return
    const timer = window.setTimeout(() => setExportMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [exportMessage])

  useEffect(() => {
    document.body.classList.toggle('theme-light', themeMode === 'light')
    return () => document.body.classList.remove('theme-light')
  }, [themeMode])

  useEffect(() => {
    try { localStorage.setItem('forma.ui.lang', uiLang) } catch { /* ignore */ }
    document.documentElement.lang = uiLang
  }, [uiLang])

  useEffect(() => {
    const updateMobileBlocked = () => setMobileBlocked(detectMobileBlock())
    updateMobileBlocked()
    window.addEventListener('resize', updateMobileBlocked)
    window.addEventListener('orientationchange', updateMobileBlocked)
    return () => {
      window.removeEventListener('resize', updateMobileBlocked)
      window.removeEventListener('orientationchange', updateMobileBlocked)
    }
  }, [])

  const t = UI_TEXT[uiLang]
  const shouldBlockMobile = mobileBlocked && !isViewOnly

  function getProjectSnapshot(): Partial<ProjectData> {
    return {
      roof,
      floor,
      sun,
      insulation,
      openingTexturesOn,
      wallColor,
      doorColor,
      windowFrameColor,
      floorColor,
    }
  }

  function applyProjectSnapshot(snapshot?: Partial<ProjectData> | null) {
    if (!snapshot) return
    setRoofState(snapshot.roof ? { ...defaultRoofSettings, ...snapshot.roof, layers: snapshot.roof.layers ?? [] } : { ...defaultRoofSettings })
    setFloorState(snapshot.floor ? { ...defaultFloorSettings, ...snapshot.floor, layers: snapshot.floor.layers ?? [] } : { ...defaultFloorSettings })
    setSunState(snapshot.sun ? { ...defaultSunSettings, ...snapshot.sun } : { ...defaultSunSettings })
    setInsulationState(snapshot.insulation ? { ...defaultInsulationSettings, ...snapshot.insulation } : { ...defaultInsulationSettings })
    setOpeningTexturesOn(snapshot.openingTexturesOn ?? false)
    setWallColor(snapshot.wallColor ?? '#e5e7eb')
    setDoorColor(snapshot.doorColor ?? '#8b5e3c')
    setWindowFrameColor(snapshot.windowFrameColor ?? '#eceff3')
    setFloorColor(snapshot.floorColor ?? '#ffffff')
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const projectFromQuery = params.get('project')
    const sharedPayload = decodeSharedProjectPayloadFromQuery()
    const readOnly = detectViewOnlyFromQuery()
    setIsViewOnly(readOnly)
    if (sharedPayload?.data) {
      importProjectData(sharedPayload.data, sharedPayload.name || params.get('name') || 'Megosztott terv')
      applyProjectSnapshot(sharedPayload.data)
    } else if (projectFromQuery) {
      const loaded = loadProject(projectFromQuery)
      if (loaded) {
        applyProjectSnapshot(loaded.data)
      }
    }
    if (readOnly) {
      setToolsOpen(false)
      setCreatingNewProject(false)
      setDeleteProjectId(null)
      setRenameProjectId(null)
    }
  }, [importProjectData, loadProject])

  function handleSaveProject() {
    if (isViewOnly) {
      setExportMessage(uiLang === 'en' ? 'View only mode: editing is disabled.' : 'Csak megtekintes mod: a szerkesztes le van tiltva.')
      return
    }
    try {
      saveProject(getProjectSnapshot())
      const time = new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
      setSaveStatus(`${t.savedAt}: ${time}`)
    } catch {
      setSaveStatus(t.saveError)
    }
  }

  function handleCreateNewProject() {
    if (isViewOnly) {
      setExportMessage(uiLang === 'en' ? 'View only mode: editing is disabled.' : 'Csak megtekintes mod: a szerkesztes le van tiltva.')
      return
    }
    setCreatingNewProject(true)
    const fallback = `${t.projectDefaultName} ${new Date().toLocaleDateString('hu-HU')}`
    setNewProjectDraft(fallback)
  }

  function confirmCreateNewProject() {
    if (isViewOnly) return
    const nextName = newProjectDraft.trim() || `${t.projectDefaultName} ${new Date().toLocaleDateString('hu-HU')}`
    createProject(nextName, getProjectSnapshot())
    setSaveStatus(`${t.newProjectNamed}: ${nextName}`)
    setCreatingNewProject(false)
    setNewProjectDraft('')
  }

  function cancelCreateNewProject() {
    setCreatingNewProject(false)
    setNewProjectDraft('')
  }

  function closeProjectsModal() {
    setProjectsOpen(false)
    setRenameProjectId(null)
    setRenameProjectDraft('')
    setDeleteProjectId(null)
    setCreatingNewProject(false)
    setNewProjectDraft('')
  }

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement))
    updateFullscreenState()
    document.addEventListener('fullscreenchange', updateFullscreenState)
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState)
  }, [])

  useEffect(() => {
    if (mode !== '3d') return

    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('copy', prevent)
    document.addEventListener('cut', prevent)
    document.addEventListener('selectstart', prevent)

    return () => {
      document.removeEventListener('copy', prevent)
      document.removeEventListener('cut', prevent)
      document.removeEventListener('selectstart', prevent)
    }
  }, [mode])

  useEffect(() => {
    if (!isResizingTopbar) return
    const handleMouseMove = (e: MouseEvent) => {
      const start = topbarResizeStartRef.current
      if (!start) return
      const nextHeight = Math.min(360, Math.max(60, start.startHeight + (e.clientY - start.startY)))
      setTopbarHeightPx(nextHeight)
    }
    const stopResize = () => {
      setIsResizingTopbar(false)
      topbarResizeStartRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
    }
  }, [isResizingTopbar])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInteractive = target && ['button', 'input', 'select', 'textarea', 'a'].includes(target.tagName.toLowerCase())
      if (e.key === 'Escape' && document.fullscreenElement && isInteractive) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable
      if (isTyping) return

      if (!isViewOnly && mode === '3d') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, offsetXM: current.offsetXM - 0.05 }))
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, offsetXM: current.offsetXM + 0.05 }))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, offsetZM: current.offsetZM - 0.05 }))
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, offsetZM: current.offsetZM + 0.05 }))
          return
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, scale: current.scale + 0.05 }))
          return
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          adjustRoof((current) => ({ ...current, scale: Math.max(0.01, current.scale - 0.05) }))
          return
        }
      }

      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      if (!isViewOnly && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (!isViewOnly && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, redo, undo, adjustRoof, isViewOnly])

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {
      // Ignore browser permission issues and keep the UI usable.
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void (exportJson)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void (exportMaterialsCsv)

  function exportJson() {
    const exportedAt = new Date().toISOString()
    const seal = createBrandSeal(`${projectId ?? ''}|${projectName ?? ''}|${exportedAt}`)
    const payload = {
      brand: {
        app: 'FORMA',
        logo: '/forma-logo.png',
        seal,
      },
      projectId,
      projectName,
      exportedAt,
      data: {
        wallHeightM,
        wallThicknessM,
        walls,
        openings,
        roomLabels,
        roof,
        floor,
        sun,
        insulation,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${safeFilename(projectName || 'terv')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setExportMessage(t.jsonDownloaded)
  }

  function downloadBlob(content: BlobPart, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function exportMaterialsCsv() {
    const exportedAt = new Date().toISOString()
    const seal = createBrandSeal(`${projectId ?? ''}|${projectName ?? ''}|${exportedAt}`)
    const header = ['Anyag', 'Mennyiség', 'Egység', 'Egységár (Ft)', 'Összesen (Ft)']
    const rows = calc.costLines.map((line) => [
      line.material,
      line.qtyLabel,
      line.unit,
      String(Math.round(line.unitPriceFt)),
      String(Math.round(line.totalFt)),
    ])
    rows.push(['Becsült összesen', '', '', '', String(Math.round(calc.totalCostFt))])
    const meta = [
      '# FORMA export',
      `# Exported at: ${exportedAt}`,
      `# Brand seal: ${seal}`,
    ].join('\n')
    const csvBody = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')
    const csv = `${meta}\n${csvBody}`
    downloadBlob(`\ufeff${csv}`, `${safeFilename(projectName || 'anyaglista')}-anyaglista.csv`, 'text/csv;charset=utf-8')
    setExportMessage(t.csvDownloaded)
  }

  async function exportPdf() {
    const modeBeforeExport = mode
    const themeBeforeExport = themeMode
    if (!last3dPngForPdfRef.current) {
      setExportMessage(t.pdfNeedsManual3dPng)
      return
    }
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pdfSafe = (text: string) =>
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
      const initialMode = modeBeforeExport
      let activeMode: ViewMode = initialMode
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

      // Exporting from light theme gives much clearer 2D plan snapshots in the PDF.
      if (themeBeforeExport !== 'light') {
        setThemeMode('light')
        await wait(160)
      }
      
      const ensureExporter = async (targetMode: ViewMode | '2d' | '3d') => {
        const keyMap: Record<string, string> = {
          '2d': '__plan2d_exportPng',
          '3d': '__plan3d_exportPng',
          'elevation': '__plan_elevation_exportPng',
          'section': '__plan_section_exportPng',
        }
        const key = keyMap[targetMode]
        if (!key) return
        for (let i = 0; i < 14; i++) {
          if (typeof (window as any)[key] === 'function') return
          await wait(70)
        }
      }
      
      const switchModeForCapture = async (targetMode: ViewMode | '2d' | '3d') => {
        if (activeMode === targetMode) {
          await ensureExporter(targetMode)
          return
        }
        setMode(targetMode)
        activeMode = targetMode
        await ensureExporter(targetMode)
        await wait(110)
      }
      
      const captureViewPng = async (targetMode: ViewMode | '2d' | '3d') => {
        await switchModeForCapture(targetMode)
        
        const keyMap: Record<string, string> = {
          '2d': '__plan2d_exportPng',
          '3d': '__plan3d_exportPng',
          'elevation': '__plan_elevation_exportPng',
          'section': '__plan_section_exportPng',
        }
        const key = keyMap[targetMode]
        if (!key) return null
        
        const fn = (window as any)[key] as undefined | (() => string | null | Promise<string | null>)
        if (!fn) return null
        const result = fn()
        if (result instanceof Promise) return await result
        return result
      }

      const plan2dUrl = await captureViewPng('2d')
      const plan3dUrl = last3dPngForPdfRef.current ?? await captureViewPng('3d')
      const elevationUrl = await captureViewPng('elevation')
      const sectionUrl = await captureViewPng('section')

      if (activeMode !== initialMode) {
        setMode(initialMode)
      }
      if (themeBeforeExport !== 'light') {
        setThemeMode(themeBeforeExport)
      }

      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const pad = 8
      const blue = [24, 84, 182] as const
      const darkBlue = [8, 33, 82] as const
      const border = [220, 228, 238] as const
      const pdfDebugMode = Boolean((import.meta as any)?.env?.DEV)
      const pdfMeta = {
        geometryEngine: 'v2.3.1',
        roomDetection: 'v4.0',
        validationRules: 'v3.2',
        regressionSuite: 'v1.8',
        build: String((import.meta as any)?.env?.VITE_GIT_COMMIT || 'n/a'),
        generated: formatPdfMetaTimestamp(new Date()),
      }
      const roomGeometry = calculateRoomGeometryFromWalls(walls, roomLabels)
      const areaM2 = roomGeometry.totalClosedAreaM2
      const roomSizeRows = roomGeometry.rows.map((room) => {
        const roomName = getRoomLabelDisplayName(room.room, room.sourceIndex)
        const sizeText = room.widthM !== null && room.lengthM !== null
          ? `${room.widthM.toFixed(2)} x ${room.lengthM.toFixed(2)} m`
          : 'Nem kerult kiszamitasra.'
        const debugText = `DBG poly=${room.polygonId} area=${room.areaM2.toFixed(2)} conf=${room.confidence.toFixed(1)}% label=(${room.labelPos.x.toFixed(2)},${room.labelPos.y.toFixed(2)}) pick=${room.selectionMethod} dims=${room.dimensionMethod}`
        return {
          text: `${roomName}: ${sizeText} = ${room.areaM2.toFixed(2)} m2`,
          debug: debugText,
        }
      })
      const rejectedRoomRows = pdfDebugMode
        ? roomGeometry.rejectedRows.map((room) => {
            const roomName = getRoomLabelDisplayName(room.room, room.sourceIndex)
            return {
              text: `${roomName}: Nem kerult kiszamitasra.`,
              debug: `DBG REJECTED poly=${room.polygonId} conf=${room.confidence.toFixed(1)}% reason=${room.debugError || 'unknown'}`,
            }
          })
        : []
      const roomRowsForPdf = [...roomSizeRows, ...rejectedRoomRows]

      const reportId = `FRM-${new Date().toISOString().slice(0, 10)}-${(projectId || '001').slice(0, 3).toUpperCase()}`
      const configuredShareBaseUrl = String((import.meta as any)?.env?.VITE_SHARE_BASE_URL || '').trim()
      const runtimeBaseUrl = (() => {
        if (typeof window === 'undefined') return ''
        const origin = window.location.origin || ''
        const path = window.location.pathname || '/'
        const basePath = path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/')
        return `${origin}${basePath}`
      })()
      const baseUrl = configuredShareBaseUrl || runtimeBaseUrl || 'https://forma.app/'
      const sharedData: ProjectData = {
        walls,
        openings,
        roomLabels,
        wallHeightM,
        wallThicknessM,
        roof,
        floor,
        sun,
        insulation,
        openingTexturesOn,
        wallColor,
        doorColor,
        windowFrameColor,
        floorColor,
      }
      const encodedShareGeometry = encodeSharedProjectPayload(projectName || 'Uj terv', sharedData, 'geometry')
      const encodedShareCore = encodeSharedProjectPayload(projectName || 'Uj terv', sharedData, 'core')
      const encodedShareFull = encodeSharedProjectPayload(projectName || 'Uj terv', sharedData, 'full')
      const shareCandidates = [encodedShareGeometry, encodedShareCore, encodedShareFull]
        .filter((value): value is string => Boolean(value))
        .map((value) => `${baseUrl}?view=1&share=${value}`)
      const shortFallbackLink = `${baseUrl}?view=1`
      let qrDataUrl: string | null = null
      const qrOptions = {
        width: 1200,
        margin: 4,
        errorCorrectionLevel: 'L' as const,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }
      for (const candidate of shareCandidates) {
        try {
          qrDataUrl = await QRCode.toDataURL(candidate, qrOptions)
          if (qrDataUrl) break
        } catch {
          // try shorter candidate next
        }
      }
      if (!qrDataUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(shortFallbackLink, qrOptions)
        } catch {
          qrDataUrl = null
        }
      }

      // Professional cover page
      doc.setFillColor(6, 11, 21)
      doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(20, 36, 63)
      doc.roundedRect(10, 10, pageW - 20, pageH - 20, 4, 4, 'F')
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(14, 14, pageW - 28, pageH - 28, 3, 3, 'F')

      doc.setTextColor(24, 84, 182)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      doc.text('FORMA', 22, 34)
      doc.setTextColor(51, 65, 85)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('CAD/BIM minosegu projektjelentes', 22, 42)

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text(pdfSafe(projectName || 'Uj terv'), 22, 60)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      doc.text(`Jelentes ID: ${reportId}`, 22, 68)
      doc.text(`Generalva: ${new Date().toLocaleString('hu-HU')}`, 22, 74)
      doc.text(`Build: ${pdfMeta.build}`, 22, 80)

      doc.setDrawColor(203, 213, 225)
      doc.line(22, 88, pageW - 22, 88)

      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Projekt osszegzes', 22, 98)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Alapterulet: ${areaM2 > 0 ? `${areaM2.toFixed(2)} m2` : 'Nem kerult kiszamitasra.'}`, 22, 106)
      doc.text(`Falak: ${walls.length} db | Nyilaszarok: ${openings.length} db`, 22, 112)
      doc.text(`Anyagkoltseg: ${formatInt(calc.totalCostFt)} Ft`, 22, 118)
      doc.text(`Munkadij: ${formatInt(calc.laborTotalFt)} Ft`, 22, 124)

      if (qrDataUrl) {
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(pageW - 72, 42, 50, 50, 2, 2, 'F')
        doc.addImage(qrDataUrl, 'PNG', pageW - 69, 45, 44, 44)
        doc.setTextColor(71, 85, 105)
        doc.setFontSize(8)
        doc.text('QR projekt link', pageW - 47, 95, { align: 'center' })
      }

      doc.setTextColor(100, 116, 139)
      doc.setFontSize(9)
      doc.text('www.forma.app', pageW / 2, pageH - 16, { align: 'center' })
      doc.text('Oldal 1', pageW - pad, pageH - 16, { align: 'right' })

      doc.addPage()

      const drawImagePage = (title: string, imageUrl: string | null, label: string, pageNo: number) => {
        doc.setFillColor(246, 248, 252)
        doc.rect(0, 0, pageW, pageH, 'F')

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(...border)
        doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')

        doc.setDrawColor(232, 238, 246)
        doc.line(pad + 1.5, 24, pageW - pad - 1.5, 24)

        doc.setTextColor(...blue)
        doc.setFontSize(13.5)
        doc.setFont('helvetica', 'bold')
        doc.text(title, pad + 6, 17)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(102, 112, 128)
        doc.setFontSize(8.6)
        doc.text(pdfSafe(`Projekt: ${projectName || 'Uj terv'} | ID: ${reportId}`), pageW - pad - 4, 17, { align: 'right' })

        const imageY = 28
        const imageW = pageW - pad * 2 - 4
        const imageH = pageH - imageY - 21
        drawPdfImageCard(doc, pad + 2, imageY, imageW, imageH, imageUrl, label)

        doc.setFillColor(...darkBlue)
        doc.rect(0, pageH - 10, pageW, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
        doc.text(`Oldal ${pageNo}`, pageW - pad, pageH - 4, { align: 'right' })
      }

      // PAGE 2-5: each image gets its own page
      drawImagePage('ALAPRAJZ', plan2dUrl, 'ALAPRAJZ (2D)', 2)
      doc.addPage()
      drawImagePage('3D NEZET', plan3dUrl, '3D KEP (MANUALIS PNG)', 3)
      doc.addPage()
      drawImagePage('HOMLOKZAT', elevationUrl, 'HOMLOKZAT (ELOL)', 4)
      doc.addPage()
      drawImagePage('METSZET', sectionUrl, 'METSZET', 5)

      // PAGE 5: Detailed Info & Materials
      doc.addPage()
      doc.setFillColor(246, 248, 252)
      doc.rect(0, 0, pageW, pageH, 'F')

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...border)
      doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')

      doc.setDrawColor(232, 238, 246)
      doc.line(pad + 1.5, 30, pageW - pad - 1.5, 30)

      doc.setTextColor(...blue)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('TERV ADATAI', pad + 6, 24)

      const infoY = 35
      doc.setTextColor(42, 52, 76)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      
      const infoItems = [
        { label: 'Projekt neve:', value: projectName || 'Új terv' },
        { label: 'Alapterület:', value: areaM2 > 0 ? `${areaM2.toFixed(2)} m²` : 'Nem kerult kiszamitasra.' },
        { label: 'Belmagasság:', value: `${wallHeightM.toFixed(2)} m` },
        { label: 'Falvastagság:', value: `${wallThicknessM.toFixed(2)} m` },
        { label: 'Falak száma:', value: `${walls.length} db` },
        { label: 'Ajtók/Ablakok:', value: `${openings.length} db` },
        { label: 'Anyag + nyílászáró + tartalék:', value: `${formatInt(calc.totalCostFt)} Ft` },
        { label: 'Megjegyzés:', value: 'Munkadíj és teljes kivitelezés nélkül' },
        { label: 'Dátum:', value: new Date().toLocaleDateString('hu-HU') },
      ]

      let currentY = infoY
      for (const item of infoItems) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(20, 45, 96)
        doc.text(item.label, pad + 6, currentY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 68, 80)
        doc.text(item.value, pad + 50, currentY)
        currentY += 7
      }

      // Material table header
      const tableTop = currentY + 8
      doc.setFillColor(...blue)
      doc.roundedRect(pad, tableTop, pageW - pad * 2, 8, 1.5, 1.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.text('ANYAGKIMUTATAS', pad + 4, tableTop + 5.6)

      const colX = [pad, pad + 66, pad + 98, pad + 132, pad + 160, pageW - pad]
      const rowH = 8.5
      let rowY = tableTop + 10

      doc.setFillColor(232, 238, 248)
      doc.rect(pad, rowY, pageW - pad * 2, rowH, 'F')
      doc.setTextColor(36, 45, 60)
      doc.setFontSize(8.2)
      doc.text('ANYAG', colX[0] + 2, rowY + 4.9)
      doc.text('MENNYISEG', colX[1] + 2, rowY + 4.9)
      doc.text('ARANY', colX[2] + 2, rowY + 4.9)
      doc.text('%', colX[3] + 2, rowY + 4.9)
      doc.text('OSSZESEN (FT)', colX[4] + 2, rowY + 4.9)

      rowY += rowH
      const lines = calc.costLines.slice(0, 12)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const materialLines = doc.splitTextToSize(pdfSafe(line.material), colX[1] - colX[0] - 4)
        const qtyLines = doc.splitTextToSize(pdfSafe(line.qtyLabel), colX[2] - colX[1] - 4)
        const lineCount = Math.max(materialLines.length, qtyLines.length, 1)
        const dynamicRowH = Math.max(rowH, 3.8 * lineCount + 2.8)
        if (i % 2 === 0) {
          doc.setFillColor(250, 251, 254)
          doc.rect(pad, rowY, pageW - pad * 2, dynamicRowH, 'F')
        }
        doc.setTextColor(45, 53, 67)
        doc.setFontSize(8)
        materialLines.forEach((txt: string, idx: number) => {
          doc.text(txt, colX[0] + 2, rowY + 4.6 + idx * 3.8)
        })
        qtyLines.forEach((txt: string, idx: number) => {
          doc.text(txt, colX[1] + 2, rowY + 4.6 + idx * 3.8)
        })
        const ratio = calc.totalCostFt > 0 ? line.totalFt / calc.totalCostFt : 0
        const barX = colX[2] + 2
        const barY = rowY + dynamicRowH / 2 - 1.2
        const barW = Math.max(10, colX[3] - colX[2] - 4)
        doc.setFillColor(231, 236, 244)
        doc.roundedRect(barX, barY, barW, 2.4, 1.2, 1.2, 'F')
        doc.setFillColor(...blue)
        doc.roundedRect(barX, barY, Math.max(0.8, barW * Math.min(1, ratio)), 2.4, 1.2, 1.2, 'F')
        doc.setTextColor(66, 74, 92)
        doc.text(`${(ratio * 100).toFixed(1)}%`, colX[3] + 2, rowY + dynamicRowH / 2 + 1.5)
        doc.setFont('helvetica', 'bold')
        doc.text(formatInt(line.totalFt), colX[5] - 2, rowY + dynamicRowH / 2 + 1.5, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        rowY += dynamicRowH
      }

      doc.setDrawColor(214, 221, 232)
      for (const x of colX) {
        doc.line(x, tableTop + 10, x, rowY)
      }
      doc.line(pad, rowY, pageW - pad, rowY)

      const totalY = rowY + 4
      const totalW = 88
      const totalX = pad
      doc.setFillColor(...darkBlue)
      doc.roundedRect(totalX, totalY, totalW, 20, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8.5)
      doc.text('ANYAG OSSZESEN', totalX + totalW / 2, totalY + 6.5, { align: 'center' })
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatInt(calc.totalCostFt)} Ft`, totalX + totalW / 2, totalY + 15, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(73, 82, 98)
      doc.setFontSize(7.4)
      doc.text('Nem tartalmazza: teljes munkadij, gepeszet, villamossag, kulcsrakesz tetel', totalX + totalW + 4, totalY + 7)

      // Footer for detailed data page
      doc.setFillColor(...darkBlue)
      doc.rect(0, pageH - 10, pageW, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
      doc.text('Oldal 6', pageW - pad, pageH - 4, { align: 'right' })

      // PAGE 7+: Integrált terv dokumentáció (nem külön PDF)
      const reportView = calculateBuildingReport(walls, openings, wallHeightM, roomLabels)

      const reportTitle = uiLang === 'en' ? 'BUILDING PLAN DOCUMENTATION' : 'TERV DOKUMENTÁCIÓ'
      const hasArchData = walls.length > 0
      const hasGroundArea = areaM2 > 0
      const hasPhysicsData = walls.length > 0 && wallHeightM > 0 && reportView.usableArea > 0
      const hasLoadBearing = hasArchData && reportView.loadBearingWalls > 0
      const hasHeatingPower = hasPhysicsData && reportView.heatingPower > 0.004
      const hasCoolingPower = hasPhysicsData && reportView.coolingPower > 0.004
      const hasPeakPower = hasPhysicsData && reportView.heatingPower + reportView.coolingPower > 0.004
      const sectionTitle = (text: string, y: number) => {
        doc.setTextColor(...blue)
        doc.setFontSize(12.5)
        doc.setFont('helvetica', 'bold')
        doc.text(pdfSafe(text), pad + 4, y)
        doc.setDrawColor(227, 234, 243)
        doc.line(pad + 4, y + 1.5, pageW - pad - 4, y + 1.5)
      }
      const kvRow = (label: string, value: string, y: number) => {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(43, 54, 74)
        doc.setFontSize(9.3)
        doc.text(pdfSafe(label), pad + 6, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(63, 73, 90)
        doc.text(pdfSafe(value), pad + 62, y)
      }

      doc.addPage()
      doc.setFillColor(246, 248, 252)
      doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...border)
      doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')

      doc.setTextColor(...blue)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(pdfSafe(reportTitle), pad + 6, 16)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(92, 101, 116)
      doc.setFontSize(8.5)
      doc.text(pdfSafe(uiLang === 'en' ? 'Calculated from current plan.' : 'Az aktualis tervbol szamolt adatok.'), pageW - pad - 4, 16, { align: 'right' })

      const drawRowsSection = (
        title: string,
        rows: Array<{ label: string; value: string; calculable: boolean }>,
        startY: number,
      ) => {
        const visibleRows = rows.filter((r) => r.calculable)
        if (!visibleRows.length) return startY
        let y = startY
        sectionTitle(title, y)
        y += 8
        for (const row of visibleRows) {
          kvRow(row.label, row.value, y)
          y += 5.8
        }
        return y + 4
      }

      let ry = 26
      ry = drawRowsSection(
        uiLang === 'en' ? 'Architecture + Structure' : 'Építészet + Statika',
        [
          { label: 'Alapterület / Ground area', value: `${areaM2.toFixed(2)} m²`, calculable: hasGroundArea },
          { label: 'Hasznos / Usable', value: `${reportView.usableArea.toFixed(1)} m²`, calculable: hasArchData },
          { label: 'Kerület / Perimeter', value: `${reportView.perimeter.toFixed(1)} m`, calculable: hasArchData },
          { label: 'Falak / Walls', value: `${reportView.wallCount} db`, calculable: hasArchData },
          { label: 'Nyílászárók / Openings', value: `${reportView.openingCount} db`, calculable: hasArchData },
          { label: 'Ajtók / Doors', value: `${reportView.doorCount} db`, calculable: hasArchData },
          { label: 'Ablakok / Windows', value: `${reportView.windowCount} db`, calculable: hasArchData },
          { label: 'Teherhordó / Load-bearing', value: `${reportView.loadBearingWalls} db`, calculable: hasLoadBearing },
        ],
        ry,
      )
      ry = drawRowsSection(
        uiLang === 'en' ? 'Physics + HVAC' : 'Épületfizika + Gépészet',
        [
          { label: 'U-fal / U-wall', value: `${reportView.uValueWall.toFixed(2)} W/m²K`, calculable: hasPhysicsData },
          { label: 'U-ablak / U-window', value: `${reportView.uValueWindow.toFixed(2)} W/m²K`, calculable: hasPhysicsData },
          { label: 'Fűtési igény / Heating', value: `${reportView.heatingDemand.toFixed(1)} kWh/m²/év`, calculable: hasPhysicsData },
          { label: 'Hűtési igény / Cooling', value: `${reportView.coolingDemand.toFixed(1)} kWh/m²/év`, calculable: hasPhysicsData },
          { label: 'Primer energia / Primary', value: `${reportView.primaryEnergy.toFixed(1)} kWh/m²/év`, calculable: hasPhysicsData },
          { label: 'CO₂', value: `${reportView.co2Emissions.toFixed(1)} kg/m²/év`, calculable: hasPhysicsData },
          { label: 'Fűtési telj. / Heating power', value: `${reportView.heatingPower.toFixed(2)} kW`, calculable: hasHeatingPower },
          { label: 'Hűtési telj. / Cooling power', value: `${reportView.coolingPower.toFixed(2)} kW`, calculable: hasCoolingPower },
        ],
        ry,
      )
      ry = drawRowsSection(
        uiLang === 'en' ? 'Electrical + Fire + Layers' : 'Villamosság + Tűzvédelem + Rétegrend',
        [
          {
            label: 'Csúcstelj. / Peak power',
            value: `${(reportView.heatingPower + reportView.coolingPower).toFixed(2)} kW`,
            calculable: hasPeakPower,
          },
        ],
        ry,
      )

      doc.setFillColor(...darkBlue)
      doc.rect(0, pageH - 10, pageW, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
      doc.text('Oldal 7', pageW - pad, pageH - 4, { align: 'right' })

      doc.addPage()
      doc.setFillColor(246, 248, 252)
      doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...border)
      doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')

      doc.setTextColor(...blue)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(pdfSafe(uiLang === 'en' ? 'Budget + Materials + Recommendations' : 'Koltsegvetes + Anyagok + Ajanlasok'), pad + 6, 16)

      const notCalculatedLabel = uiLang === 'en' ? 'Not calculated from plan.' : 'Nem kerult kiszamitasra.'
      const hasBudgetPerM2 = reportView.usableArea > 0 && calc.totalCostFt > 0
      const hasBrick = reportView.brickCount > 0
      const hasCement = reportView.cementNeeded > 0
      const hasSteel = reportView.steelNeeded > 0
      const hasInsulation = reportView.insulationArea > 0

      let reportY = 26
      reportY = drawRowsSection(
        uiLang === 'en' ? 'Budget + Materials' : 'Költségvetés + Anyagmennyiség',
        [
          {
            label: 'Ft/m²',
            value: hasBudgetPerM2 ? `${Math.round(calc.totalCostFt / reportView.usableArea).toLocaleString('hu-HU')} Ft` : notCalculatedLabel,
            calculable: hasBudgetPerM2,
          },
          { label: 'Tégla', value: `${Math.round(reportView.brickCount).toLocaleString('hu-HU')} db`, calculable: hasBrick },
          { label: 'Cement', value: `${Math.round(reportView.cementNeeded).toLocaleString('hu-HU')} kg`, calculable: hasCement },
          { label: 'Acél', value: `${Math.round(reportView.steelNeeded).toLocaleString('hu-HU')} kg`, calculable: hasSteel },
          { label: 'Szigetelés', value: `${reportView.insulationArea.toFixed(1)} m²`, calculable: hasInsulation },
        ],
        reportY,
      )

      doc.setFillColor(...darkBlue)
      doc.rect(0, pageH - 10, pageW, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
      doc.text('Oldal 8', pageW - pad, pageH - 4, { align: 'right' })

      // PAGE 9: room dimensions (only when realistic values are available)
      if (roomRowsForPdf.length > 0) {
        doc.addPage()
        doc.setFillColor(246, 248, 252)
        doc.rect(0, 0, pageW, pageH, 'F')
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(...border)
        doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')

        doc.setTextColor(...blue)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('HELYISEG MERETEK (BECSLES)', pad + 6, 16)

        let roomY = 26
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(55, 64, 78)
        doc.setFontSize(9)
        roomRowsForPdf.forEach((row, i) => {
          const wrapped = doc.splitTextToSize(pdfSafe(`${i + 1}. ${row.text}`), 176)
          wrapped.forEach((line: string) => {
            doc.text(line, pad + 6, roomY)
            roomY += 5.2
          })
          if (pdfDebugMode) {
            doc.setFontSize(7.2)
            doc.setTextColor(110, 118, 132)
            const debugWrapped = doc.splitTextToSize(pdfSafe(row.debug), 176)
            debugWrapped.forEach((line: string) => {
              doc.text(line, pad + 6, roomY)
              roomY += 4
            })
            doc.setFontSize(9)
            doc.setTextColor(55, 64, 78)
          }
          roomY += 1.2
        })

        if (pdfDebugMode && roomGeometry.debugLogs.length) {
          roomY += 2
          doc.setFontSize(7.2)
          doc.setTextColor(116, 88, 30)
          for (const msg of roomGeometry.debugLogs) {
            const wrapped = doc.splitTextToSize(pdfSafe(`DBG GLOBAL: ${msg}`), 176)
            wrapped.forEach((line: string) => {
              doc.text(line, pad + 6, roomY)
              roomY += 4
            })
          }
          doc.setFontSize(9)
          doc.setTextColor(55, 64, 78)
        }

        doc.setFont('helvetica', 'italic')
        doc.setTextColor(108, 116, 130)
        doc.setFontSize(8.2)
        doc.text('A meretek csak geometriailag megbizhato esetben jelennek meg.', pad + 6, pageH - 15)

        doc.setFillColor(...darkBlue)
        doc.rect(0, pageH - 10, pageW, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
        doc.text('Oldal 9', pageW - pad, pageH - 4, { align: 'right' })
      }

      // Automatic validation report at end of each PDF generation
      doc.addPage()
      doc.setFillColor(246, 248, 252)
      doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...border)
      doc.roundedRect(pad, pad, pageW - pad * 2, pageH - pad * 2, 2.5, 2.5, 'FD')
      doc.setTextColor(...blue)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('AUTOMATIKUS VALIDACIOS RIPORT', pad + 6, 16)

      const showMetaBlock = true || pdfDebugMode
      let metaBottomY = 22
      if (showMetaBlock) {
        const metaLines = [
          `Geometry Engine: ${pdfMeta.geometryEngine}`,
          `Room Detection: ${pdfMeta.roomDetection}`,
          `Validation Rules: ${pdfMeta.validationRules}`,
          `Regression Suite: ${pdfMeta.regressionSuite}`,
          `Build: ${pdfMeta.build}`,
          `Generated: ${pdfMeta.generated}`,
        ]
        const metaBoxY = 20
        const metaBoxH = 25
        doc.setFillColor(245, 248, 253)
        doc.setDrawColor(220, 228, 238)
        doc.roundedRect(pad + 4, metaBoxY, pageW - pad * 2 - 8, metaBoxH, 1.8, 1.8, 'FD')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.2)
        doc.setTextColor(58, 67, 81)
        let my = metaBoxY + 5.2
        for (const line of metaLines) {
          doc.text(line, pad + 6.5, my)
          my += 3.8
        }
        metaBottomY = metaBoxY + metaBoxH + 4
      }

      const vr = roomGeometry.validationReport
      let vy = metaBottomY
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.4)
      doc.setTextColor(43, 54, 74)
      doc.text('Feldolgozott helyisegek:', pad + 6, vy)
      doc.setFont('helvetica', 'normal')
      doc.text(String(vr.processedRooms), pad + 62, vy)
      vy += 6
      doc.setFont('helvetica', 'bold')
      doc.text('Elfogadott helyisegek:', pad + 6, vy)
      doc.setFont('helvetica', 'normal')
      doc.text(String(vr.acceptedRooms), pad + 62, vy)
      vy += 6
      doc.setFont('helvetica', 'bold')
      doc.text('Elutasitott helyisegek:', pad + 6, vy)
      doc.setFont('helvetica', 'normal')
      doc.text(String(vr.rejectedRooms), pad + 62, vy)
      vy += 6
      doc.setFont('helvetica', 'bold')
      doc.text('Atlagos konfidencia:', pad + 6, vy)
      doc.setFont('helvetica', 'normal')
      doc.text(`${vr.averageConfidence.toFixed(1)}%`, pad + 62, vy)
      vy += 8

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 45, 96)
      doc.text('Validacios hibak osszesitese:', pad + 6, vy)
      vy += 6
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 68, 80)
      if (!vr.errorSummary.length && !vr.globalErrors.length) {
        doc.text('Nincs hiba.', pad + 6, vy)
      } else {
        vr.errorSummary.forEach((entry) => {
          const wrapped = doc.splitTextToSize(`${entry.reason}: ${entry.count} db`, 176)
          wrapped.forEach((line: string) => {
            doc.text(line, pad + 6, vy)
            vy += 4.8
          })
        })
        vr.globalErrors.forEach((msg) => {
          const wrapped = doc.splitTextToSize(`Global: ${msg}`, 176)
          wrapped.forEach((line: string) => {
            doc.text(line, pad + 6, vy)
            vy += 4.8
          })
        })
      }

      doc.setFillColor(...darkBlue)
      doc.rect(0, pageH - 10, pageW, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('www.forma.app', pageW / 2, pageH - 4, { align: 'center' })
      doc.text('Validacios riport', pageW - pad, pageH - 4, { align: 'right' })

      doc.save(`${safeFilename(projectName || 'terv')}.pdf`)
      setExportMessage(t.pdfDownloaded)
    } catch {
      setMode(modeBeforeExport)
      setThemeMode(themeBeforeExport)
      setExportMessage(t.pdfExportError)
    }
  }


  function handleExportPng() {
    const exportFn = mode === '2d' 
      ? (window as any).__plan2d_exportPng 
      : (window as any).__plan3d_exportPng
    
    if (!exportFn) {
      setExportMessage(t.exportUnavailable)
      console.warn('Export function not found for mode:', mode)
      return
    }
    
    const result = exportFn()
    
    const handleDataUrl = async (dataUrl: string | null) => {
      if (!dataUrl) {
        setExportMessage(t.pngExportError)
        console.warn('Export returned no data')
        return
      }

      const brandedDataUrl = await applyPngBranding(dataUrl)
      if (!brandedDataUrl) {
        setExportMessage(t.pngExportError)
        return
      }

      // Keep last 3D snapshot for PDF even if user cancels PNG file download.
      if (mode === '3d') {
        last3dPngForPdfRef.current = brandedDataUrl
      }

      setPendingPngDownload({
        dataUrl: brandedDataUrl,
        filename: `${safeFilename(projectName || 'terv')}.png`,
        fromMode: mode,
      })
      setExportMessage(t.pngReady)
    }
    
    if (result instanceof Promise) {
      result.then((dataUrl: string | null) => {
        void handleDataUrl(dataUrl)
      })
    } else {
      void handleDataUrl(result)
    }
  }

  function confirmPendingPngDownload() {
    if (!pendingPngDownload) return

    const a = document.createElement('a')
    a.href = pendingPngDownload.dataUrl
    a.download = pendingPngDownload.filename
    a.click()

    setPendingPngDownload(null)
    setExportMessage(t.pngDownloaded)
  }

  function cancelPendingPngDownload() {
    setPendingPngDownload(null)
    setExportMessage(t.pngCanceled)
  }

  const calc = useMemo(() => {
    const totals = calcWallTotals(walls, wallHeightM)
    const footprint = computeBuildingFootprintBox(walls)
    const brick = calcBrickMortar(totals.totalVolumeM3)
    const concrete = calcConcrete(concreteM3, cementRatio, aggregateRatio, waterCement)
    const rebarKg = concreteM3 * rebarKgPerM3
    const baseLines = buildCostLines(brick, concrete, rebarKg, unitPrices)
    const wallAreaM2 = totals.totalLengthM * wallHeightM

    const doorCount = openings.filter((o) => o.type === 'door').length
    const windowAreaM2 = openings
      .filter((o) => o.type === 'window')
      .reduce((sum, o) => sum + o.widthM * o.heightM, 0)

    const openingLines = [
      {
        id: 'doors',
        material: uiLang === 'en' ? 'Doors (estimated installed price)' : 'Ajtók (becsült beépített ár)',
        quantity: doorCount,
        qtyLabel: formatInt(doorCount),
        unit: 'db',
        unitPriceFt: unitPrices.doorFtPerPc,
        totalFt: Math.round(doorCount * unitPrices.doorFtPerPc),
      },
      {
        id: 'windows',
        material: uiLang === 'en' ? 'Windows (estimated installed price)' : 'Ablakok (becsült beépített ár)',
        quantity: windowAreaM2,
        qtyLabel: windowAreaM2.toFixed(2).replace('.', ','),
        unit: 'm²',
        unitPriceFt: unitPrices.windowFtPerM2,
        totalFt: Math.round(windowAreaM2 * unitPrices.windowFtPerM2),
      },
    ]

    const laborLines = [
      {
        id: 'labor-wall',
        material: uiLang === 'en' ? 'Labor: masonry' : 'Munkadíj: falazás',
        quantity: wallAreaM2,
        qtyLabel: wallAreaM2.toFixed(2).replace('.', ','),
        unit: 'm²',
        unitPriceFt: unitPrices.wallLaborFtPerM2,
        totalFt: Math.round(wallAreaM2 * unitPrices.wallLaborFtPerM2),
      },
      {
        id: 'labor-concrete',
        material: uiLang === 'en' ? 'Labor: concrete work' : 'Munkadíj: betonozás',
        quantity: concreteM3,
        qtyLabel: concreteM3.toFixed(2).replace('.', ','),
        unit: 'm³',
        unitPriceFt: unitPrices.concreteLaborFtPerM3,
        totalFt: Math.round(concreteM3 * unitPrices.concreteLaborFtPerM3),
      },
      {
        id: 'labor-rebar',
        material: uiLang === 'en' ? 'Labor: rebar installation' : 'Munkadíj: vasalás szerelés',
        quantity: rebarKg,
        qtyLabel: formatInt(Math.round(rebarKg)),
        unit: 'kg',
        unitPriceFt: unitPrices.rebarLaborFtPerKg,
        totalFt: Math.round(rebarKg * unitPrices.rebarLaborFtPerKg),
      },
      {
        id: 'labor-door',
        material: uiLang === 'en' ? 'Labor: door installation' : 'Munkadíj: ajtó beépítés',
        quantity: doorCount,
        qtyLabel: formatInt(doorCount),
        unit: 'db',
        unitPriceFt: unitPrices.doorInstallLaborFtPerPc,
        totalFt: Math.round(doorCount * unitPrices.doorInstallLaborFtPerPc),
      },
      {
        id: 'labor-window',
        material: uiLang === 'en' ? 'Labor: window installation' : 'Munkadíj: ablak beépítés',
        quantity: windowAreaM2,
        qtyLabel: windowAreaM2.toFixed(2).replace('.', ','),
        unit: 'm²',
        unitPriceFt: unitPrices.windowInstallLaborFtPerM2,
        totalFt: Math.round(windowAreaM2 * unitPrices.windowInstallLaborFtPerM2),
      },
    ]

    const laborBreakdown = [
      {
        id: 'labor-wall',
        label: uiLang === 'en' ? 'Masonry' : 'Falazás',
        qtyLabel: wallAreaM2.toFixed(2).replace('.', ','),
        unit: 'm²',
        minFt: Math.round(wallAreaM2 * 9000),
        maxFt: Math.round(wallAreaM2 * 18000),
      },
      {
        id: 'labor-concrete',
        label: uiLang === 'en' ? 'Concrete work' : 'Betonozás',
        qtyLabel: concreteM3.toFixed(2).replace('.', ','),
        unit: 'm³',
        minFt: Math.round(concreteM3 * 22000),
        maxFt: Math.round(concreteM3 * 45000),
      },
      {
        id: 'labor-rebar',
        label: uiLang === 'en' ? 'Rebar installation' : 'Vasalás szerelés',
        qtyLabel: formatInt(Math.round(rebarKg)),
        unit: 'kg',
        minFt: Math.round(rebarKg * 180),
        maxFt: Math.round(rebarKg * 420),
      },
      {
        id: 'labor-door',
        label: uiLang === 'en' ? 'Door installation' : 'Ajtó beépítés',
        qtyLabel: formatInt(doorCount),
        unit: 'db',
        minFt: Math.round(doorCount * 30000),
        maxFt: Math.round(doorCount * 80000),
      },
      {
        id: 'labor-window',
        label: uiLang === 'en' ? 'Window installation' : 'Ablak beépítés',
        qtyLabel: windowAreaM2.toFixed(2).replace('.', ','),
        unit: 'm²',
        minFt: Math.round(windowAreaM2 * 22000),
        maxFt: Math.round(windowAreaM2 * 52000),
      },
    ]

    // Real-life oriented rough ranges (HU market ballpark, workmanship only)
    const laborRealLifeMinFt = laborBreakdown.reduce((sum, row) => sum + row.minFt, 0)
    const laborRealLifeMaxFt = laborBreakdown.reduce((sum, row) => sum + row.maxFt, 0)
    const laborTotalFt = sumCostLines(laborLines)

    // Final budget intentionally excludes labor. Labor is shown in a separate block.
    const subTotalFt = sumCostLines([...baseLines, ...openingLines])
    const reservePct = Math.max(0, Math.min(30, contingencyPct))
    const reserveFt = Math.round((subTotalFt * reservePct) / 100)
    const reserveLine = {
      id: 'reserve',
      material: uiLang === 'en' ? `Reserve / allowance (${reservePct}%)` : `Tartalék / ráhagyás (${reservePct}%)`,
      quantity: reservePct,
      qtyLabel: `${reservePct.toFixed(0)}%`,
      unit: '%',
      unitPriceFt: subTotalFt,
      totalFt: reserveFt,
    }

    const costLines = [...baseLines, ...openingLines, reserveLine]
      .map((line) => ({ ...line, material: translateAppLabel(line.material, uiLang) }))
    const totalCostFt = subTotalFt + reserveFt

    const roofLines = roof.layers.filter((layer) => layer.visible).map((layer) => {
      const roofCalc = calcRoofForBudget(footprint.widthM, footprint.lengthM, layer)
      return {
        id: layer.id,
        typeLabel: roofTypeLabel(layer.type, uiLang),
        areaM2: roofCalc.areaM2,
        tiles: roofCalc.tiles,
        materialFt: roofCalc.tileCostFt,
      }
    })
    const roofTotalFt = roofLines.reduce((sum, line) => sum + line.materialFt, 0)
    const roofTotalAreaM2 = roofLines.reduce((sum, line) => sum + line.areaM2, 0)
    const roofTotalTiles = roofLines.reduce((sum, line) => sum + line.tiles, 0)

    return {
      totals,
      brick,
      concrete,
      rebarKg,
      costLines,
      totalCostFt,
      subTotalFt,
      reserveFt,
      reservePct,
      laborTotalFt,
      laborRealLifeMinFt,
      laborRealLifeMaxFt,
      laborBreakdown,
      roofLines,
      roofTotalFt,
      roofTotalAreaM2,
      roofTotalTiles,
    }
  }, [
    aggregateRatio,
    cementRatio,
    contingencyPct,
    concreteM3,
    openings,
    roof.layers,
    rebarKgPerM3,
    unitPrices,
    wallHeightM,
    walls,
    waterCement,
    uiLang,
  ])

  const liveSummary = useMemo(() => {
    const report = calculateBuildingReport(walls, openings, wallHeightM, roomLabels)
    const doorCount = openings.filter((o) => o.type === 'door').length
    const windowCount = openings.filter((o) => o.type === 'window').length
    return {
      groundAreaM2: report.groundArea,
      usableAreaM2: report.usableArea,
      wallLengthM: calc.totals.totalLengthM,
      wallVolumeM3: calc.totals.totalVolumeM3,
      doorCount,
      windowCount,
      materialFt: calc.totalCostFt,
      laborFt: calc.laborTotalFt,
    }
  }, [calc.laborTotalFt, calc.totals.totalLengthM, calc.totals.totalVolumeM3, calc.totalCostFt, openings, roomLabels, wallHeightM, walls])

  const costAnalyzerItems = useMemo(() => {
    const group = (idMatch: RegExp) => calc.costLines
      .filter((line) => idMatch.test(line.id))
      .reduce((s, line) => s + line.totalFt, 0)
    return [
      { label: 'Falazas', valueFt: group(/brick|mortar|wall/i), color: '#3b82f6' },
      { label: 'Betonozas', valueFt: group(/concrete|cement|aggregate|water/i), color: '#14b8a6' },
      { label: 'Teto', valueFt: calc.roofTotalFt, color: '#f97316' },
      { label: 'Nyilaszarok', valueFt: group(/door|window/i), color: '#8b5cf6' },
      { label: 'Szigeteles', valueFt: group(/insulation/i), color: '#22c55e' },
      { label: 'Munkadij', valueFt: calc.laborTotalFt, color: '#eab308' },
      {
        label: 'Egyeb',
        valueFt: Math.max(0, calc.totalCostFt - (group(/brick|mortar|wall/i) + group(/concrete|cement|aggregate|water/i) + calc.roofTotalFt + group(/door|window/i) + group(/insulation/i) + calc.laborTotalFt)),
        color: '#64748b',
      },
    ]
  }, [calc.costLines, calc.laborTotalFt, calc.roofTotalFt, calc.totalCostFt])

  return (
    <div className={`app ${mode === '3d' ? 'app--3d' : ''} ${themeMode === 'light' ? 'app--light' : ''}`}>
      {shouldBlockMobile ? (
        <div className="fullscreenGate" role="dialog" aria-modal="true">
          <div className="fullscreenGate__card">
            <img src="/forma-logo.png" alt="FORMA" className="forma-logo-img" />
            <h2>{t.mobileBlockedTitle}</h2>
            <p>{t.mobileBlockedText}</p>
          </div>
        </div>
      ) : null}
      {shouldBlockMobile ? null : (
      <>
      {showTutorial && <Tutorial onClose={closeTutorial} lang={uiLang} />}
      {!isFullscreen && !isViewOnly && (
        <div className="fullscreenGate" role="dialog" aria-modal="true">
          <div className="fullscreenGate__card">
            <img src="/forma-logo.png" alt="FORMA" className="forma-logo-img" />
            <h2>{t.fullscreenTitle}</h2>
            <p>{t.fullscreenDesc}</p>
            <button className="btn btn--primary" onClick={toggleFullscreen}>
              {t.fullscreenEnter}
            </button>
          </div>
        </div>
      )}
      <header
        className={`topbar ${mode === '3d' ? 'topbar--compact' : ''} ${!isFullscreen ? 'topbar--resizable' : ''}`}
        style={isFullscreen ? undefined : { height: `${topbarHeightPx}px` }}
      >
        {isViewOnly && <div className="viewOnlyBadge">Csak olvashato nezet (QR)</div>}
        {/* Brand */}
        <div className="topbar__brand">
          <img src="/forma-logo.png" alt="FORMA" className="forma-logo-img" />
        </div>

        <div className="topbar__controls">
          {/* Project */}
          <div className="topbar__section">
            <button className="link" onClick={() => setProjectsOpen(true)} style={{ fontSize: 13, fontWeight: 600 }}>
              {projectName}
            </button>
          </div>

          {/* Core actions */}
          <div className="topbar__section">
            <button className="btn" onClick={handleCreateNewProject} title={t.newProjectTitle} disabled={isViewOnly}>{t.newProject}</button>
            <button className="btn" onClick={() => setProjectsOpen(true)} title={t.projectsTitleButton}>{t.projects}</button>
            <button className="btn" onClick={() => setSettingsOpen(true)} title={t.settingsTitle}>{t.settings}</button>
            <button className="btn" onClick={handleSaveProject} title={t.saveTitle} disabled={isViewOnly}>{t.save}</button>
            {saveStatus ? <span className="muted" style={{ fontSize: 12 }}>{saveStatus}</span> : null}
            <button disabled={isViewOnly || !canUndo} className="btn" onClick={() => undo()} title={t.undoTitle}>↩</button>
            <button disabled={isViewOnly || !canRedo} className="btn" onClick={() => redo()} title={t.redoTitle}>↪</button>
          </div>

          {/* Mode switch */}
          <div className="topbar__section">
            <button className={`btn btn--view ${mode === '2d' ? 'btn--active' : ''}`} onClick={() => setMode('2d')}>
              {t.view2d}
            </button>
            <button className={`btn btn--view ${mode === '3d' ? 'btn--active' : ''}`} onClick={() => setMode('3d')}>
              {t.view3d}
            </button>
            <button className={`btn btn--view ${mode === 'elevation' ? 'btn--active' : ''}`} onClick={() => setMode('elevation')}>
              {t.viewElevation}
            </button>
            <button className={`btn btn--view ${mode === 'section' ? 'btn--active' : ''}`} onClick={() => setMode('section')}>
              {t.viewSection}
            </button>
          </div>

          {/* 2D wall settings */}
          {mode === '2d' && (
            <div className="topbar__section">
              <div className="field">
                <label>{t.wallHeight}</label>
                <input type="number" min={2} max={6} step={0.1} value={wallHeightM}
                  onChange={(e) => setWallHeightM(Number(e.target.value))} disabled={isViewOnly} />
              </div>
              <div className="field">
                <label>{t.wallThickness}</label>
                <input type="number" min={0.05} max={0.6} step={0.01} value={wallThicknessM}
                  onChange={(e) => setWallThicknessM(Number(e.target.value))} disabled={isViewOnly} />
              </div>
            </div>
          )}

          {mode === '3d' && (
            <div className="topbar__section">
              <button
                className={`chip ${active3dPanel === 'floor' ? 'chip--active' : ''}`}
                onClick={() => setActive3dPanel('floor')}
              >
                {t.floorItem}
              </button>
              <button
                className={`chip ${active3dPanel === 'roof' ? 'chip--active' : ''}`}
                onClick={() => setActive3dPanel('roof')}
              >
                {t.roofItem}
              </button>
            </div>
          )}

          {mode === '3d' && active3dPanel === 'floor' && (
            <div className="topbar__section">
              <div className="field">
                <label>{t.wallColor}</label>
                <input type="color" value={wallColor} onChange={(e) => setWallColor(e.target.value)}
                  title={t.wallColorTitle} style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
              </div>
              <div className="field">
                <label>{t.doorColor}</label>
                <input type="color" value={doorColor} onChange={(e) => setDoorColor(e.target.value)}
                  style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
              </div>
              <div className="field">
                <label>{t.windowFrame}</label>
                <input type="color" value={windowFrameColor} onChange={(e) => setWindowFrameColor(e.target.value)}
                  style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
              </div>
              <div className="field">
                <label>{t.floorColor}</label>
                <input type="color" value={floorColor} onChange={(e) => setFloorColor(e.target.value)}
                  style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
              </div>
              <button className={`btn ${floorLayer.visible ? 'btn--active' : ''}`} onClick={() => setFloorLayer({ visible: !floorLayer.visible })} disabled={isViewOnly}>
                {floorLayer.visible ? t.floorLayerOn : t.floorLayerOff}
              </button>
              <div className="field">
                <label>{t.floorLayerColor}</label>
                <input type="color" value={floorLayer.colorHex} onChange={(e) => setFloorLayer({ colorHex: e.target.value })}
                  style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
              </div>
              <label className="miniField"><span>{t.rotationLabel}</span>
                <input type="number" min={-360} max={360} step={1} value={Math.round(floorLayer.rotationDeg ?? 0)}
                  onChange={(e) => setFloorLayer({ rotationDeg: Number(e.target.value) })} style={{ width: 80 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>{t.floorThickness}</span>
                <input type="number" min={0.02} max={0.6} step={0.01} value={floorLayer.thicknessM}
                  onChange={(e) => setFloorLayer({ thicknessM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>{t.floorLift}</span>
                <input type="number" step={0.01} value={floorLayer.offsetYM}
                  onChange={(e) => setFloorLayer({ offsetYM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>{t.floorWidthMul}</span>
                <input type="number" min={0.2} max={3} step={0.05} value={floorLayer.widthMultiplier}
                  onChange={(e) => setFloorLayer({ widthMultiplier: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>{t.floorLengthMul}</span>
                <input type="number" min={0.2} max={3} step={0.05} value={floorLayer.lengthMultiplier}
                  onChange={(e) => setFloorLayer({ lengthMultiplier: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>X</span>
                <input type="number" step={0.05} value={floorLayer.offsetXM}
                  onChange={(e) => setFloorLayer({ offsetXM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <label className="miniField"><span>Z</span>
                <input type="number" step={0.05} value={floorLayer.offsetZM}
                  onChange={(e) => setFloorLayer({ offsetZM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
              </label>
              <button
                className={`btn ${openingTexturesOn ? 'btn--active' : ''}`}
                onClick={() => setOpeningTexturesOn((v) => !v)}
                title={t.openingTextureTitle}
                disabled={isViewOnly}
              >
                {openingTexturesOn ? t.openingTextureOn : t.openingTexture}
              </button>
              <button className="btn" onClick={selectOrAddFloorLayer} title={t.addFloorPartTitle} disabled={isViewOnly}>{t.addFloorPart}</button>
              <button className="btn btn--small" disabled={isViewOnly || !lastDeletedFloorLayer} onClick={restoreLastDeletedFloorLayer}>
                {t.restoreDeleted}
              </button>
              {floor.layers.length > 0 && (
                <select className="select" value={selectedFloor?.id ?? ''} onChange={(e) => setSelectedFloor(e.target.value || null)} disabled={isViewOnly}>
                  {floor.layers.map((layer, index) => (
                    <option key={layer.id} value={layer.id}>{t.floorItem} {index + 1}</option>
                  ))}
                </select>
              )}
              {selectedFloor && (
                <>
                  <button className={`btn ${selectedFloor.visible ? 'btn--active' : ''}`} onClick={() => updateSelectedFloor({ visible: !selectedFloor.visible })} disabled={isViewOnly}>
                    {selectedFloor.visible ? t.visibleOn : t.visibleOff}
                  </button>
                  <button className="btn btn--small btn--danger" onClick={deleteSelectedFloorLayer} disabled={isViewOnly}>{t.delete}</button>
                </>
              )}
            </div>
          )}

          {mode === '3d' && active3dPanel === 'roof' && (
            <div className="topbar__section" style={{ flexWrap: 'wrap', gap: 6 }}>
              <button className="btn" onClick={addRoofLayer} title={t.addRoofPartTitle} disabled={isViewOnly}>{t.addRoofPart}</button>
              <button className="btn btn--small" disabled={isViewOnly || !lastDeletedRoofLayer} onClick={restoreLastDeletedRoofLayer}>
                {t.restoreDeleted}
              </button>
              {roof.layers.length > 0 && (
                <select className="select" value={selectedLayer?.id ?? ''}
                  onChange={(e) => setSelectedLayer(e.target.value || null)} disabled={isViewOnly}>
                  {roof.layers.map((layer, index) => (
                    <option key={layer.id} value={layer.id}>{t.roofItem} {index + 1}</option>
                  ))}
                </select>
              )}
              {selectedLayer && (
                <>
                  <button className={`btn ${selectedLayer.visible ? 'btn--active' : ''}`}
                    onClick={() => updateSelectedLayer({ visible: !selectedLayer.visible })} disabled={isViewOnly}>
                    {selectedLayer.visible ? t.visibleOn : t.visibleOff}
                  </button>
                  <select className="select" value={selectedLayer.type}
                    onChange={(e) => updateSelectedLayer({ type: e.target.value as typeof selectedLayer.type })} disabled={isViewOnly}>
                    <option value="gable">{t.roofTypeGable}</option>
                    <option value="shed">{t.roofTypeShed}</option>
                    <option value="flat">{t.roofTypeFlat}</option>
                    <option value="hip">{t.roofTypeHip}</option>
                    <option value="butterfly">{t.roofTypeButterfly}</option>
                  </select>
                  <input type="color" value={selectedLayer.colorHex}
                    onChange={(e) => updateSelectedLayer({ colorHex: e.target.value })}
                    title={t.roofColorTitle} style={{ width: 40, height: 32, padding: 2, borderRadius: 8 }} disabled={isViewOnly} />
                  <label className="miniField"><span>{t.roofHeight}</span>
                    <input type="number" min={0} step={0.1} value={selectedLayer.ridgeHeightM}
                      onChange={(e) => updateSelectedLayer({ ridgeHeightM: Number(e.target.value) })} style={{ width: 72 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofScale}</span>
                    <input type="number" min={0.01} step={0.05} value={selectedLayer.scale}
                      onChange={(e) => updateSelectedLayer({ scale: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofWidthMul}</span>
                    <input type="number" min={0.01} step={0.05} value={selectedLayer.widthMultiplier}
                      onChange={(e) => updateSelectedLayer({ widthMultiplier: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofLengthMul}</span>
                    <input type="number" min={0.01} step={0.05} value={selectedLayer.lengthMultiplier}
                      onChange={(e) => updateSelectedLayer({ lengthMultiplier: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofHeightMul}</span>
                    <input type="number" min={0.01} step={0.05} value={selectedLayer.heightMultiplier}
                      onChange={(e) => updateSelectedLayer({ heightMultiplier: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofPitch}</span>
                    <input type="number" min={0} max={60} step={1} value={selectedLayer.pitchDeg}
                      onChange={(e) => updateSelectedLayer({ pitchDeg: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofLift}</span>
                    <input type="number" step={0.1} value={selectedLayer.offsetYM}
                      onChange={(e) => updateSelectedLayer({ offsetYM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofOverhang}</span>
                    <input type="number" min={0} step={0.05} value={selectedLayer.overhangM}
                      onChange={(e) => updateSelectedLayer({ overhangM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofOffsetX}</span>
                    <input type="number" step={0.05} value={selectedLayer.offsetXM}
                      onChange={(e) => updateSelectedLayer({ offsetXM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofOffsetZ}</span>
                    <input type="number" step={0.05} value={selectedLayer.offsetZM}
                      onChange={(e) => updateSelectedLayer({ offsetZM: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <label className="miniField"><span>{t.roofRotation}</span>
                    <input type="number" step={1} value={selectedLayer.rotationDeg}
                      onChange={(e) => updateSelectedLayer({ rotationDeg: Number(e.target.value) })} style={{ width: 66 }} disabled={isViewOnly} />
                  </label>
                  <button className="btn btn--small" onClick={resetSelectedRoofTransform} disabled={isViewOnly}>{t.roofReset}</button>
                  <button className="btn btn--small" onClick={resetSelectedRoofCuts} disabled={isViewOnly}>{t.roofResetCuts}</button>
                  <button className="btn btn--small" onClick={deleteSelectedRoofLayer} disabled={isViewOnly}>{t.delete}</button>
                </>
              )}
            </div>
          )}

          {/* Calculator + Export + Help */}
          <div className="topbar__section">
            <button className="btn btn--calc"
              onClick={() => { if (!isViewOnly) { setToolTab('calc'); setToolsOpen(true) } }}
              title={t.calcOpenTitle}>
              {t.calc}
            </button>
            <button className="btn" onClick={() => exportPdf()} title={t.exportPdfTitle}>{t.pdf}</button>
            <button className="btn" onClick={handleExportPng} title={t.exportPngTitle}>{t.png}</button>
            <button className="btn" title={t.helpTitle}
              onClick={() => setShowTutorial(true)}>{t.help}</button>
            <button className="btn btn--danger" onClick={() => clear()} title={t.clearTitle} disabled={isViewOnly}>{t.clear}</button>
          </div>
        </div>
        {!isFullscreen && (
          <div
            className="topbar__resizeHandle"
            role="separator"
            aria-orientation="horizontal"
            title={uiLang === 'en' ? 'Drag to resize panel' : 'Húzd a panel magasságának állításához'}
            onMouseDown={(e) => {
              e.preventDefault()
              topbarResizeStartRef.current = { startY: e.clientY, startHeight: topbarHeightPx }
              setIsResizingTopbar(true)
            }}
          >
            <span>⇅</span>
          </div>
        )}
      </header>

      <div className="workspaceShell">
        <main className="main">
          {mode === '2d' ? (
            <Plan2DEditor tool={tool} onToolChange={setTool} lightMode={themeMode === 'light'} lang={uiLang} readOnly={isViewOnly} />
          ) : mode === '3d' ? (
            <Plan3DView
              roof={roof}
              sun={sun}
              wallColor={wallColor}
              showOpeningTextures={openingTexturesOn}
              doorColor={doorColor}
              windowFrameColor={windowFrameColor}
              floorColor={floorColor}
              floor={floor}
              lang={uiLang}
            />
          ) : mode === 'elevation' ? (
            <PlanElevationView lightMode={themeMode === 'light'} lang={uiLang} />
          ) : (
            <PlanSectionView lightMode={themeMode === 'light'} lang={uiLang} />
          )}
        </main>
        <ProfessionalSidebar
          mode={mode}
          tool={tool}
          readOnly={isViewOnly}
          summary={liveSummary}
          costItems={costAnalyzerItems}
          wallHeightM={wallHeightM}
          wallThicknessM={wallThicknessM}
          setWallHeightM={setWallHeightM}
          setWallThicknessM={setWallThicknessM}
          selectedRoof={selectedLayer}
          updateSelectedRoof={updateSelectedLayer}
          selectedFloor={selectedFloor}
          updateSelectedFloor={updateSelectedFloor}
        />
      </div>

      {pendingPngDownload && (
        <div className="modalOverlay" onMouseDown={cancelPendingPngDownload}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modalHeader">
              <div className="modalTitle">{t.pngDownloadTitle}</div>
            </div>
            <div className="modalSection">
              <div style={{ marginBottom: 14 }}>{t.pngAsk}</div>
              <div className="row">
                <button className="btn btn--primary" onClick={confirmPendingPngDownload}>{t.yesDownload}</button>
                <button className="btn" onClick={cancelPendingPngDownload}>{t.cancel}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {exportMessage && (
        <div 
          style={{ 
            position: 'fixed',
            top: 20,
            left: 20,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <div 
            className="modal" 
            style={{ 
              width: 'auto',
              minWidth: 280,
              maxWidth: 320,
              padding: '16px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))',
              color: 'white',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
              animation: 'toastSlideIn 0.3s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <div style={{ fontSize: 24, flexShrink: 0 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{exportMessage}</div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      {projectsOpen && (
        <div className="modalOverlay" onMouseDown={closeProjectsModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{t.projectsTitle}</div>
              <button className="btn btn--small" onClick={closeProjectsModal}>
                {t.close}
              </button>
            </div>

            <div className="modalSection">
              {creatingNewProject ? (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <input
                      autoFocus
                      className="text"
                      placeholder={t.projectNamePlaceholder}
                      value={newProjectDraft}
                      onChange={(e) => setNewProjectDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmCreateNewProject()
                        if (e.key === 'Escape') cancelCreateNewProject()
                      }}
                    />
                  </div>
                  <div className="row">
                    <button
                      className="btn"
                      onClick={confirmCreateNewProject}
                    >
                      {t.create}
                    </button>
                    <button
                      className="btn"
                      onClick={cancelCreateNewProject}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <button
                    className="btn btn--primary"
                    onClick={handleCreateNewProject}
                  >
                    {t.newProject}
                  </button>
                </div>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                {t.projectNameHint}
              </div>
            </div>

            <div className="modalSection">
              <div className="list">
                {projects.length === 0 ? (
                  <div className="muted">{t.noSavedProjects}</div>
                ) : (
                  projects.map((p) => (
                    <div key={p.id} className={`listItem ${p.id === projectId ? 'listItem--active' : ''}`}>
                      <button
                        className="link"
                        onClick={() => {
                          const loaded = loadProject(p.id)
                          if (loaded) {
                            applyProjectSnapshot(loaded.data)
                          }
                          closeProjectsModal()
                        }}
                      >
                        {p.name}
                      </button>
                      <div className="spacer" />
                      {renameProjectId === p.id ? (
                        <>
                          <input
                            className="text"
                            style={{ minWidth: 160, height: 32 }}
                            value={renameProjectDraft}
                            onChange={(e) => setRenameProjectDraft(e.target.value)}
                            placeholder={t.projectNameField}
                          />
                          <button
                            className="btn btn--small"
                            onClick={() => {
                              const next = renameProjectDraft.trim()
                              if (!next) return
                              renameProject(p.id, next)
                              setRenameProjectId(null)
                              setRenameProjectDraft('')
                            }}
                          >
                            {t.saveBtn}
                          </button>
                          <button
                            className="btn btn--small"
                            onClick={() => {
                              setRenameProjectId(null)
                              setRenameProjectDraft('')
                            }}
                          >
                            {t.cancel}
                          </button>
                        </>
                      ) : (
                          <button
                          className="btn btn--small"
                          onClick={() => {
                              if (isViewOnly) return
                            setRenameProjectId(p.id)
                            setRenameProjectDraft(p.name)
                            setDeleteProjectId(null)
                          }}
                            disabled={isViewOnly}
                        >
                          {t.rename}
                        </button>
                      )}
                      {deleteProjectId === p.id ? (
                        <>
                          <button
                            className="btn btn--danger btn--small"
                            onClick={() => {
                              if (isViewOnly) return
                              deleteProject(p.id)
                              setDeleteProjectId(null)
                              if (renameProjectId === p.id) {
                                setRenameProjectId(null)
                                setRenameProjectDraft('')
                              }
                            }}
                            disabled={isViewOnly}
                          >
                            {t.confirmDelete}
                          </button>
                          <button className="btn btn--small" onClick={() => setDeleteProjectId(null)}>
                            {t.cancel}
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn--danger btn--small"
                          onClick={() => {
                            if (isViewOnly) return
                            setDeleteProjectId(p.id)
                            setRenameProjectId(null)
                            setRenameProjectDraft('')
                          }}
                          disabled={isViewOnly}
                        >
                          {t.delete}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modalOverlay" onMouseDown={() => setSettingsOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{t.settingsTitle}</div>
              <button className="btn btn--small" onClick={() => setSettingsOpen(false)}>
                {t.close}
              </button>
            </div>

            <div className="modalSection">
              <div className="card">
                <div className="cardTitle">{t.appearanceTitle}</div>
                <div className="row">
                  <button
                    className={`btn ${themeMode === 'dark' ? 'btn--active' : ''}`}
                    onClick={() => setThemeMode('dark')}
                  >
                    {t.darkMode}
                  </button>
                  <button
                    className={`btn ${themeMode === 'light' ? 'btn--active' : ''}`}
                    onClick={() => setThemeMode('light')}
                  >
                    {t.lightMode}
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {t.appearanceHint}
                </div>
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <div className="cardTitle">{t.languageTitle}</div>
                <div className="row">
                  <button
                    className={`btn ${uiLang === 'hu' ? 'btn--active' : ''}`}
                    onClick={() => setUiLang('hu')}
                  >
                    {t.langHuShort}
                  </button>
                  <button
                    className={`btn ${uiLang === 'en' ? 'btn--active' : ''}`}
                    onClick={() => setUiLang('en')}
                  >
                    {t.langEnShort}
                  </button>
                </div>
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <div className="cardTitle">{t.threeDTitle}</div>
                <div className="row">
                  <button
                    className={`btn ${sun.shadows ? 'btn--active' : ''}`}
                    onClick={() => setSun({ shadows: !sun.shadows })}
                  >
                    {sun.shadows ? t.shadowsOn : t.shadowsOff}
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setShowTutorial(true)
                    }}
                  >
                    {t.helpOpen}
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {t.shadowsHint}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toolsOpen && !isViewOnly && (
        <div className="modalOverlay" onMouseDown={() => setToolsOpen(false)}>
          <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{t.toolsTitle}</div>
              <button className="btn btn--small" onClick={() => setToolsOpen(false)}>
                {t.close}
              </button>
            </div>

            <div className="row" style={{ paddingBottom: 10 }}>
              <button className={`chip ${toolTab === 'calc' ? 'chip--active' : ''}`} onClick={() => setToolTab('calc')}>
                {t.calcTab}
              </button>
              <button className={`chip ${toolTab === 'sun' ? 'chip--active' : ''}`} onClick={() => setToolTab('sun')}>
                {t.sunTab}
              </button>
              <button className={`chip ${toolTab === 'roof' ? 'chip--active' : ''}`} onClick={() => setToolTab('roof')}>
                {t.roofTab}
              </button>
              <button className={`chip ${toolTab === 'openings' ? 'chip--active' : ''}`} onClick={() => setToolTab('openings')}>
                {t.openingsTab}
              </button>
              <button className={`chip ${toolTab === 'insulation' ? 'chip--active' : ''}`} onClick={() => setToolTab('insulation')}>
                {t.insulationTab}
              </button>
              <button className={`chip ${toolTab === 'report' ? 'chip--active' : ''}`} onClick={() => setToolTab('report')}>
                {t.reportTab}
              </button>
              <button className={`chip ${toolTab === 'diag' ? 'chip--active' : ''}`} onClick={() => setToolTab('diag')}>
                {t.diagTab}
              </button>
            </div>

            {toolTab === 'calc' ? (
              <div className="modalSection calcModal">
                <div className="grid2">
                  <div className="card">
                    <div className="cardTitle">{uiLang === 'en' ? 'Walls (from the plan)' : 'Falak (a terv alapján)'}</div>
                    <div className="kv">
                      <div className="k">{uiLang === 'en' ? 'Total wall length' : 'Teljes falhossz'}</div>
                      <div className="v">{calc.totals.totalLengthM.toFixed(2)} m</div>
                      <div className="k">{uiLang === 'en' ? 'Wall volume (h × thickness × length)' : 'Fal térfogat (h × vastagság × hossz)'}</div>
                      <div className="v">{calc.totals.totalVolumeM3.toFixed(2)} m³</div>
                      <div className="k">{uiLang === 'en' ? 'Load-bearing wall length' : 'Teherhordó fal hossz'}</div>
                      <div className="v">{calc.totals.loadBearingLengthM.toFixed(2)} m</div>
                      <div className="k">{uiLang === 'en' ? 'Partition wall length' : 'Válaszfal hossz'}</div>
                      <div className="v">{calc.totals.partitionLengthM.toFixed(2)} m</div>
                    </div>
                    <div className="muted smallPrint">
                      {uiLang === 'en' ? 'Wall height and thickness are in the top bar; some wall thickness values can be changed in 2D after selecting a wall.' : 'Fal magasság és vastagság a felső sávban; egyes falak vastagsága 2D-ben kijelölve állítható.'}
                    </div>
                  </div>

                  <div className="card">
                    <div className="cardTitle">{uiLang === 'en' ? 'Concrete mix (manual estimate)' : 'Beton keverék (kézi becslés)'}</div>
                    <div className="row">
                      <div className="miniField">
                        <label>{uiLang === 'en' ? 'Concrete volume (m³)' : 'Beton térfogat (m³)'}</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={concreteM3}
                          onChange={(e) => setConcreteM3(Number(e.target.value))}
                        />
                      </div>
                      <div className="miniField">
                        <label>{uiLang === 'en' ? 'Cement ratio' : 'Cement arány'}</label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={cementRatio}
                          onChange={(e) => setCementRatio(Number(e.target.value))}
                        />
                      </div>
                      <div className="miniField">
                        <label>{uiLang === 'en' ? 'Aggregate ratio' : 'Sóder arány'}</label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={aggregateRatio}
                          onChange={(e) => setAggregateRatio(Number(e.target.value))}
                        />
                      </div>
                      <div className="miniField">
                        <label>{uiLang === 'en' ? 'Water / cement' : 'Víz / cement'}</label>
                        <input
                          type="number"
                          min={0.35}
                          max={0.7}
                          step={0.05}
                          value={waterCement}
                          onChange={(e) => setWaterCement(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="kv">
                      <div className="k">{uiLang === 'en' ? 'Cement' : 'Cement'}</div>
                      <div className="v">{formatInt(calc.concrete.cementKg)} kg</div>
                      <div className="k">{uiLang === 'en' ? 'Aggregate' : 'Sóder'}</div>
                      <div className="v">{formatInt(calc.concrete.aggregateKg)} kg</div>
                      <div className="k">{uiLang === 'en' ? 'Water (mixing)' : 'Víz (keveréshez)'}</div>
                      <div className="v">{formatInt(calc.concrete.waterL)} l</div>
                    </div>
                    <div className="muted smallPrint">
                      {uiLang === 'en' ? 'Mass is estimated from ratios; cement ~1440 kg/m³, aggregate ~1600 kg/m³. Water is not included in the price list.' : 'Arányból számolt tömeg; cement ~1440 kg/m³, sóder ~1600 kg/m³. A víz nincs az árlistában.'}
                    </div>
                  </div>
                </div>

                <div className="card card--wide">
                  <div className="cardTitle">{uiLang === 'en' ? 'Rebar (for concrete)' : 'Vasalás (betonhoz)'}</div>
                  <div className="row alignEnd">
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'kg steel / m³ concrete' : 'kg acél / m³ beton'}</label>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={rebarKgPerM3}
                        onChange={(e) => setRebarKgPerM3(Number(e.target.value))}
                      />
                    </div>
                    <div className="kv inline">
                      <div className="k">{uiLang === 'en' ? 'Estimated steel' : 'Becsült acél'}</div>
                      <div className="v">{formatInt(Math.round(calc.rebarKg))} kg</div>
                    </div>
                  </div>
                </div>

                <div className="card card--wide">
                  <div className="cardTitle">{uiLang === 'en' ? 'Labor information' : 'Munkadíj külön információ'}</div>
                  <div className="kv">
                    <div className="k">{uiLang === 'en' ? 'Custom labor total (based on your unit prices)' : 'Saját munkadíj (a beállított egységárak alapján)'}</div>
                    <div className="v">{formatInt(calc.laborTotalFt)} Ft</div>
                    <div className="k">{uiLang === 'en' ? 'Total labor cost (labor only)' : 'Teljes munkabér összesen (csak munkadíj)'}</div>
                    <div className="v">{formatInt(calc.laborTotalFt)} Ft</div>
                    <div className="k">{uiLang === 'en' ? 'Typical market range' : 'Irányár tartomány (reál kivitelezői piac)'}</div>
                    <div className="v">
                      {formatInt(calc.laborRealLifeMinFt)} Ft - {formatInt(calc.laborRealLifeMaxFt)} Ft
                    </div>
                  </div>
                  <div className="cardTitle" style={{ marginTop: 10 }}>{uiLang === 'en' ? 'Custom labor unit prices' : 'Saját munkadíj egységárak'}</div>
                  <div className="priceGrid">
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Masonry labor (Ft/m²)' : 'Falazás munkadíj (Ft/m²)'}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={laborDraft.wallLaborFtPerM2}
                        placeholder={`kb ${defaultMaterialUnitPricesHuf.wallLaborFtPerM2}`}
                        onChange={(e) => updateLaborUnitPrice('wallLaborFtPerM2', e.target.value)}
                        onBlur={() => normalizeLaborUnitPrice('wallLaborFtPerM2')}
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Concrete labor (Ft/m³)' : 'Betonozás munkadíj (Ft/m³)'}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={laborDraft.concreteLaborFtPerM3}
                        placeholder={`kb ${defaultMaterialUnitPricesHuf.concreteLaborFtPerM3}`}
                        onChange={(e) => updateLaborUnitPrice('concreteLaborFtPerM3', e.target.value)}
                        onBlur={() => normalizeLaborUnitPrice('concreteLaborFtPerM3')}
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Rebar labor (Ft/kg)' : 'Vasalás munkadíj (Ft/kg)'}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={laborDraft.rebarLaborFtPerKg}
                        placeholder={`kb ${defaultMaterialUnitPricesHuf.rebarLaborFtPerKg}`}
                        onChange={(e) => updateLaborUnitPrice('rebarLaborFtPerKg', e.target.value)}
                        onBlur={() => normalizeLaborUnitPrice('rebarLaborFtPerKg')}
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Door installation (Ft/pc)' : 'Ajtó beépítés (Ft/db)'}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={laborDraft.doorInstallLaborFtPerPc}
                        placeholder={`kb ${defaultMaterialUnitPricesHuf.doorInstallLaborFtPerPc}`}
                        onChange={(e) => updateLaborUnitPrice('doorInstallLaborFtPerPc', e.target.value)}
                        onBlur={() => normalizeLaborUnitPrice('doorInstallLaborFtPerPc')}
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Window installation (Ft/m²)' : 'Ablak beépítés (Ft/m²)'}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={laborDraft.windowInstallLaborFtPerM2}
                        placeholder={`kb ${defaultMaterialUnitPricesHuf.windowInstallLaborFtPerM2}`}
                        onChange={(e) => updateLaborUnitPrice('windowInstallLaborFtPerM2', e.target.value)}
                        onBlur={() => normalizeLaborUnitPrice('windowInstallLaborFtPerM2')}
                      />
                    </div>
                  </div>
                  <div className="tableWrap" style={{ marginTop: 10 }}>
                    <table className="costTable">
                      <thead>
                        <tr>
                          <th>{uiLang === 'en' ? 'Work stage' : 'Munkafázis'}</th>
                          <th>{uiLang === 'en' ? 'Quantity' : 'Mennyiség'}</th>
                          <th>{uiLang === 'en' ? 'Approx. min (Ft)' : 'Kb. ár tól (Ft)'}</th>
                          <th>{uiLang === 'en' ? 'Approx. max (Ft)' : 'Kb. ár ig (Ft)'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.laborBreakdown.map((row) => (
                          <tr key={row.id}>
                            <td>{row.label}</td>
                            <td className="num">{row.qtyLabel} {row.unit}</td>
                            <td className="num">{formatInt(row.minFt)}</td>
                            <td className="num strong">{formatInt(row.maxFt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="muted smallPrint">
                    {uiLang === 'en'
                      ? 'The market range is indicative only. It depends on region, contractor workload, structural complexity, and whether material handling, crane, or scaffolding is needed.'
                      : 'Az irányár tartomány tájékoztató jellegű, függ a régiótól, a szakember leterheltségétől, a szerkezeti bonyolultságtól és attól is, hogy anyagmozgatás/daru/állvány kell-e.'}
                  </div>
                </div>

                <div className="card card--wide">
                  <div className="cardTitle">{uiLang === 'en' ? 'Roof calculator (separate)' : 'Tető kalkulátor (külön)'}</div>
                  {calc.roofLines.length === 0 ? (
                    <div className="muted">{uiLang === 'en' ? 'No active roof element. Add a roof in 3D view with the + Roof button.' : 'Nincs aktív tetőelem. Adj hozzá tetőt a 3D nézetben a + Tetőelem gombbal.'}</div>
                  ) : (
                    <>
                      <div className="tableWrap">
                        <table className="costTable">
                          <thead>
                            <tr>
                              <th>{uiLang === 'en' ? 'Roof part' : 'Tetőelem'}</th>
                              <th>{uiLang === 'en' ? 'Type' : 'Típus'}</th>
                              <th>{uiLang === 'en' ? 'Area (m²)' : 'Felület (m²)'}</th>
                              <th>{uiLang === 'en' ? 'Tiles (pcs)' : 'Cserép (db)'}</th>
                              <th>{uiLang === 'en' ? 'Approx. material cost (Ft)' : 'Kb. anyagár (Ft)'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calc.roofLines.map((line, idx) => (
                              <tr key={line.id}>
                                <td>{uiLang === 'en' ? 'Roof' : 'Tető'} {idx + 1}</td>
                                <td>{line.typeLabel}</td>
                                <td className="num">{line.areaM2.toFixed(2).replace('.', ',')}</td>
                                <td className="num">{formatInt(line.tiles)}</td>
                                <td className="num strong">{formatInt(line.materialFt)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2}>{uiLang === 'en' ? 'Roof total' : 'Tető összesen'}</td>
                              <td className="num">{calc.roofTotalAreaM2.toFixed(2).replace('.', ',')} m²</td>
                              <td className="num">{formatInt(calc.roofTotalTiles)} db</td>
                              <td className="num totalFt">{formatInt(calc.roofTotalFt)} Ft</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="muted smallPrint">{uiLang === 'en' ? 'The roof calculator is a separate block and is not included in the final material total.' : 'A tető kalkulátor külön blokk, nem számolódik bele az anyag végösszegbe.'}</div>
                    </>
                  )}
                </div>

                <div className="card card--wide">
                  <div className="cardTitle">{uiLang === 'en' ? 'Unit prices (Ft, estimated market values — editable)' : 'Egységárak (Ft, becsült piaci — módosítható)'}</div>
                  <div className="priceGrid">
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Brick (Ft/pc)' : 'Tégla (Ft/db)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={unitPrices.brickFtPerPc}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, brickFtPerPc: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Mortar (Ft/m³)' : 'Habarcs (Ft/m³)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={unitPrices.mortarFtPerM3}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, mortarFtPerM3: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Cement bag 25 kg (Ft)' : 'Cement zsák 25 kg (Ft)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={unitPrices.cementBag25kgFt}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, cementBag25kgFt: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Aggregate (Ft/t)' : 'Sóder (Ft/t)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={unitPrices.aggregateFtPerTonne}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, aggregateFtPerTonne: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Steel (Ft/kg)' : 'Acél (Ft/kg)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={unitPrices.rebarFtPerKg}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, rebarFtPerKg: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Door (Ft/pc)' : 'Ajtó (Ft/db)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={unitPrices.doorFtPerPc}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, doorFtPerPc: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Window (Ft/m²)' : 'Ablak (Ft/m²)'}</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={unitPrices.windowFtPerM2}
                        onChange={(e) =>
                          setUnitPrices((p) => ({ ...p, windowFtPerM2: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="miniField">
                      <label>{uiLang === 'en' ? 'Reserve (%)' : 'Tartalék (%)'}</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        step={1}
                        value={contingencyPct}
                        onChange={(e) => setContingencyPct(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--small btn--ghost"
                    onClick={() => {
                      setUnitPrices({ ...defaultMaterialUnitPricesHuf })
                      setLaborDraft({
                        wallLaborFtPerM2: String(defaultMaterialUnitPricesHuf.wallLaborFtPerM2),
                        concreteLaborFtPerM3: String(defaultMaterialUnitPricesHuf.concreteLaborFtPerM3),
                        rebarLaborFtPerKg: String(defaultMaterialUnitPricesHuf.rebarLaborFtPerKg),
                        doorInstallLaborFtPerPc: String(defaultMaterialUnitPricesHuf.doorInstallLaborFtPerPc),
                        windowInstallLaborFtPerM2: String(defaultMaterialUnitPricesHuf.windowInstallLaborFtPerM2),
                      })
                    }}
                  >
                    {uiLang === 'en' ? 'Reset prices' : 'Árak visszaállítása'}
                  </button>
                </div>

                <div className="card card--wide">
                  <div className="cardTitle">{uiLang === 'en' ? 'Materials list and estimated cost' : 'Anyaglista és becsült költség'}</div>
                  <div className="tableWrap">
                    <table className="costTable">
                      <thead>
                        <tr>
                          <th>{uiLang === 'en' ? 'Material' : 'Anyag'}</th>
                          <th>{uiLang === 'en' ? 'Quantity' : 'Mennyiség'}</th>
                          <th>{uiLang === 'en' ? 'Unit' : 'Egység'}</th>
                          <th>{uiLang === 'en' ? 'Unit price (Ft)' : 'Egységár (Ft)'}</th>
                          <th>{uiLang === 'en' ? 'Total (Ft)' : 'Összesen (Ft)'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.costLines.map((line) => (
                          <tr key={line.id}>
                            <td>{line.material}</td>
                            <td className="num">{line.qtyLabel}</td>
                            <td>{line.unit}</td>
                            <td className="num">{formatInt(line.unitPriceFt)}</td>
                            <td className="num strong">{formatInt(line.totalFt)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>{uiLang === 'en' ? 'Estimated total (materials, indicative)' : 'Becsült összesen (anyag, tájékoztató)'}</td>
                          <td className="num totalFt">{formatInt(calc.totalCostFt)} Ft</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="muted smallPrint">
                    {uiLang === 'en'
                      ? 'Masonry uses a 25×12×6.5 cm module plus joints. Brick and mortar are derived from wall volume; concrete volume is entered manually. Door and window costs are listed separately, along with reserve allowance and labor rows.'
                      : 'Falazás: 25×12×6,5 cm modul + fugák. A tégla és habarcs a fal térfogatából; a beton térfogatát te adod meg. A táblában külön szerepel az ajtók és ablakok költsége, valamint a tartalék ráhagyás arra az esetre, ha kivitelezés közben plusz tétel merül fel. A munkadíjak is külön soron számolódnak.'}
                  </div>
                </div>
              </div>
            ) : toolTab === 'diag' ? (
              <div className="modalSection">
                <div className="grid2">
                  <div className="card">
                    <div className="cardTitle">{uiLang === 'en' ? 'Leaks → possible causes' : 'Beázás → lehetséges okok'}</div>
                    <ul className="bullets">
                      <li>{uiLang === 'en' ? 'Faulty or missing waterproofing (roof, terrace, plinth)' : 'Hibás/hiányos vízszigetelés (tető, terasz, lábazat)'}</li>
                      <li>{uiLang === 'en' ? 'Blocked gutter/downpipe, overflow' : 'Eltömődött eresz/lefolyó, túlfolyás'}</li>
                      <li>{uiLang === 'en' ? 'Thermal bridge → condensation (looks like mold)' : 'Hőhíd → páralecsapódás (penészedésnek látszik)'}</li>
                      <li>{uiLang === 'en' ? 'Faulty window/door joint (threshold/sill)' : 'Nyílászáró csatlakozás hibája (küszöb/párkány)'}</li>
                      <li>{uiLang === 'en' ? 'Crack in wall/plaster → rainwater ingress' : 'Repedés a falon / vakolaton → csapadék bejut'}</li>
                    </ul>
                    <div className="cardTitle" style={{ marginTop: 10 }}>{uiLang === 'en' ? 'Quick actions' : 'Gyors teendők'}</div>
                    <ul className="bullets">
                      <li>{uiLang === 'en' ? 'Locate the source (during/after rain, thermal camera/moisture reading)' : 'Forrás lokalizálása (esőben/utána, hőkamera/páramérés)'}</li>
                      <li>{uiLang === 'en' ? 'Check external drainage' : 'Külső vízelvezetés ellenőrzése'}</li>
                      <li>{uiLang === 'en' ? 'Inspect waterproofing build-up' : 'Szigetelési rétegrend felmérése'}</li>
                    </ul>
                  </div>
                  <div className="card">
                    <div className="cardTitle">{uiLang === 'en' ? 'Cracks → causes + solutions' : 'Repedés → okok + megoldások'}</div>
                    <ul className="bullets">
                      <li>{uiLang === 'en' ? 'Hairline plaster crack: repair filler/paint, add expansion joints' : 'Vakolatrepedés (hajszál): javító glett/festés, dilatáció'}</li>
                      <li>{uiLang === 'en' ? 'Shrinkage crack: better technology and curing' : 'Zsugorodási repedés: technológiai fegyelem, utókezelés'}</li>
                      <li>{uiLang === 'en' ? 'Settlement/load movement: structural review, foundation strengthening' : 'Süllyedés/tehermozgás: statikus vizsgálat, alap megerősítés'}</li>
                      <li>{uiLang === 'en' ? 'Thermal movement: expansion joints, flexible connections' : 'Hőmozgás: dilatációk, rugalmas csatlakozások'}</li>
                      <li>{uiLang === 'en' ? 'Moisture-related damage: waterproofing, drying, desalination' : 'Nedvesség miatti károk: szigetelés, szárítás, sótalanítás'}</li>
                    </ul>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {uiLang === 'en' ? 'If the crack is opening, diagonal, or runs around doors/windows, call a structural engineer.' : 'Ha a repedés “nyílik”, ferde, vagy ajtó/ablak körül fut: érdemes statikust hívni.'}
                    </div>
                  </div>
                </div>
              </div>
            ) : toolTab === 'report' ? (
              <div className="modalSection">
                <BuildingReportPanel lang={uiLang} lightMode={themeMode === 'light'} />
              </div>
            ) : (
              <AdvancedTools
                tab={toolTab}
                walls={walls}
                openings={openings}
                wallHeightM={wallHeightM}
                roof={selectedLayer ?? createRoofLayer()}
                setRoof={setRoofFromTools}
                sun={sun}
                setSun={setSun}
                insulation={insulation}
                setInsulation={setInsulation}
                lang={uiLang}
              />
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

let appLogoImagePromise: Promise<HTMLImageElement | null> | null = null

function loadAppLogoImage(): Promise<HTMLImageElement | null> {
  if (appLogoImagePromise) return appLogoImagePromise
  appLogoImagePromise = new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/forma-logo.png'
  })
  return appLogoImagePromise
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

async function applyPngBranding(dataUrl: string): Promise<string | null> {
  const [base, logo] = await Promise.all([loadImageFromDataUrl(dataUrl), loadAppLogoImage()])
  if (!base) return null

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(base.naturalWidth || base.width))
  canvas.height = Math.max(1, Math.floor(base.naturalHeight || base.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(base, 0, 0, canvas.width, canvas.height)

  // Faint diagonal repeating watermark to make automated cleanup harder.
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((-18 * Math.PI) / 180)
  const fontSize = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.045))
  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.09)'
  const stepX = Math.max(160, fontSize * 4.8)
  const stepY = Math.max(120, fontSize * 3.3)
  for (let y = -canvas.height; y <= canvas.height; y += stepY) {
    for (let x = -canvas.width; x <= canvas.width; x += stepX) {
      ctx.fillText('FORMA', x, y)
    }
  }
  ctx.restore()

  if (logo) {
    const pad = Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.02))
    const logoW = Math.max(120, Math.round(canvas.width * 0.18))
    const ratio = logo.naturalHeight > 0 ? logo.naturalWidth / logo.naturalHeight : 3
    const drawW = Math.min(logoW, canvas.width - pad * 2)
    const drawH = Math.max(26, Math.round(drawW / Math.max(1, ratio)))
    const x = canvas.width - drawW - pad
    const y = canvas.height - drawH - pad

    ctx.save()
    ctx.globalAlpha = 0.86
    ctx.fillStyle = 'rgba(10,10,10,0.28)'
    ctx.fillRect(x - 6, y - 5, drawW + 12, drawH + 10)
    ctx.drawImage(logo, x, y, drawW, drawH)
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}

function drawPdfImageCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  dataUrl: string | null,
  label: string,
  missingLabel = 'Előnézet nem elérhető',
) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(186, 198, 214)
  doc.roundedRect(x, y, w, h, 1.6, 1.6, 'FD')

  const labelH = 6
  const innerPad = 1.2
  const mediaX = x + innerPad
  const mediaY = y + innerPad
  const mediaW = w - innerPad * 2
  const mediaH = h - innerPad * 2 - labelH - 0.8

  doc.setFillColor(249, 251, 254)
  doc.roundedRect(mediaX, mediaY, mediaW, mediaH, 1, 1, 'F')

  if (dataUrl) {
    try {
      const props = doc.getImageProperties(dataUrl)
      const srcW = Math.max(1, Number(props.width) || 1)
      const srcH = Math.max(1, Number(props.height) || 1)
      const scale = Math.min(mediaW / srcW, mediaH / srcH)
      const drawW = Math.max(1, srcW * scale)
      const drawH = Math.max(1, srcH * scale)
      const drawX = mediaX + (mediaW - drawW) / 2
      const drawY = mediaY + (mediaH - drawH) / 2
      doc.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH)
    } catch {
      doc.setTextColor(120, 128, 140)
      doc.setFontSize(8.6)
      doc.text(missingLabel, x + w / 2, y + h / 2 - 2, { align: 'center' })
    }
  } else {
    doc.setTextColor(120, 128, 140)
    doc.setFontSize(8.6)
    doc.text(missingLabel, x + w / 2, y + h / 2 - 2, { align: 'center' })
  }

  doc.setFillColor(8, 33, 82)
  doc.roundedRect(x + 1.2, y + h - labelH - 1.2, w - 2.4, labelH, 0.9, 0.9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8.4)
  doc.text(label, x + w / 2, y + h - 3.1, { align: 'center' })
}

function calculateRoomGeometryFromWalls(
  walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>,
  roomLabels: Array<{ type: string; text?: string; pos: { x: number; y: number } }>,
) {
  type RoomValidationRow = {
    sourceIndex: number
    type: string
    text: string | undefined
    room: { type: string; text?: string; pos: { x: number; y: number } }
    widthM: number | null
    lengthM: number | null
    areaM2: number
    polygonId: number | null
    labelPos: { x: number; y: number }
    selectionMethod: string
    selectionScore: number
    dimensionMethod: string
    areaConsistencyError: number
    confidence: number
    debugError: string
  }

  const polygons = buildClosedRoomPolygons(walls).map((points, idx) => ({
    id: idx + 1,
    points,
    areaM2: polygonAreaAbs(points),
    centroid: polygonCentroid(points),
  }))
  const totalClosedAreaM2 = polygons.reduce((sum, polygon) => sum + polygon.areaM2, 0)
  const rawRows: Array<RoomValidationRow | null> = roomLabels
    .map((room, sourceIndex) => {
      const selected = selectRoomPolygonForLabel(room, polygons)
      if (!selected) {
        return {
          sourceIndex,
          type: room.type,
          text: room.text,
          room,
          widthM: null,
          lengthM: null,
          areaM2: 0,
          polygonId: null,
          labelPos: room.pos,
          selectionMethod: 'none',
          selectionScore: 10,
          dimensionMethod: 'hidden',
          areaConsistencyError: 1,
          confidence: 0,
          debugError: 'Nincs tartalmazo polygon',
        }
      }
      const polygon = selected.polygon
      const areaM2 = polygon.areaM2
      if (!(areaM2 > 0)) return null
      const dims = polygonPrincipalDimensions(polygon.points)
      const axisA = Math.min(dims.axisA, dims.axisB)
      const axisB = Math.max(dims.axisA, dims.axisB)
      if (!(axisA > 0 && axisB > 0)) return null

      const rectArea = axisA * axisB
      const fillRatio = rectArea > 0 ? areaM2 / rectArea : 0
      const showDims = fillRatio >= 0.62
      let widthM: number | null = null
      let lengthM: number | null = null
      let dimensionMethod = 'hidden'
      if (showDims) {
        const aspect = axisB / axisA
        widthM = Math.sqrt(areaM2 / aspect)
        lengthM = areaM2 / widthM
        dimensionMethod = 'principal-area-consistent'
      }

      return {
        sourceIndex,
        type: room.type,
        text: room.text,
        room,
        widthM,
        lengthM,
        areaM2,
        polygonId: polygon.id,
        labelPos: room.pos,
        selectionMethod: selected.method,
        selectionScore: selected.score,
        dimensionMethod,
        areaConsistencyError: showDims && widthM !== null && lengthM !== null
          ? Math.abs(widthM * lengthM - areaM2) / Math.max(0.0001, areaM2)
          : 0,
        confidence: 0,
        debugError: '',
      }
    })
  const rows: RoomValidationRow[] = rawRows.filter((row): row is RoomValidationRow => row !== null)

  const validation = validateRoomGeometry(rows, polygons, walls, totalClosedAreaM2)
  const acceptedRows = rows.flatMap((row, idx) => {
    const confidence = validation.confidenceByRoomIndex.get(idx) ?? 0
    const debugError = validation.errorsByRoomIndex.get(idx) || ''
    if (validation.invalidByRoomIndex.has(idx)) return []
    return [{ ...row, confidence, debugError }]
  })
  const rejectedRows = rows.flatMap((row, idx) => {
    if (!validation.invalidByRoomIndex.has(idx)) return []
    return [{
      ...row,
      confidence: validation.confidenceByRoomIndex.get(idx) ?? 0,
      debugError: validation.errorsByRoomIndex.get(idx) || '',
    }]
  })

  const avgConfidence = rows.length
    ? rows.reduce((s, _row, idx) => s + (validation.confidenceByRoomIndex.get(idx) ?? 0), 0) / rows.length
    : 0
  const validationReport = {
    processedRooms: rows.length,
    acceptedRooms: acceptedRows.length,
    rejectedRooms: rejectedRows.length,
    averageConfidence: avgConfidence,
    errorSummary: summarizeValidationErrors(validation.errorsByRoomIndex),
    globalErrors: validation.globalErrors,
  }

  return {
    totalClosedAreaM2,
    rows: acceptedRows,
    rejectedRows,
    debugLogs: validation.globalErrors,
    validationReport,
  }
}

function validateRoomGeometry(
  rows: Array<{
    sourceIndex: number
    type: string
    text: string | undefined
    room: { type: string; text?: string; pos: { x: number; y: number } }
    widthM: number | null
    lengthM: number | null
    areaM2: number
    polygonId: number | null
    labelPos: { x: number; y: number }
    selectionMethod: string
    selectionScore: number
    dimensionMethod: string
    areaConsistencyError: number
  }>,
  polygons: Array<{ id: number; points: Array<{ x: number; y: number }>; areaM2: number; centroid: { x: number; y: number } }>,
  walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>,
  totalClosedAreaM2: number,
) {
  const invalidByRoomIndex = new Set<number>()
  const errorsByRoomIndex = new Map<number, string>()
  const confidenceByRoomIndex = new Map<number, number>()
  const globalErrors: string[] = []

  const setInvalid = (idx: number, reason: string) => {
    invalidByRoomIndex.add(idx)
    if (!errorsByRoomIndex.has(idx)) errorsByRoomIndex.set(idx, reason)
  }

  const computeConfidence = (row: {
    type: string
    areaM2: number
    selectionMethod: string
    selectionScore: number
    areaConsistencyError: number
    widthM: number | null
    lengthM: number | null
  }) => {
    let c = 100
    if (row.selectionMethod !== 'point') c -= 8
    c -= Math.min(35, row.selectionScore * 12)
    c -= Math.min(40, row.areaConsistencyError * 300)
    if (row.widthM === null || row.lengthM === null) c -= 4
    if (!isRealisticRoomArea(row.type, row.areaM2)) c -= 35
    if (c < 0) c = 0
    if (c > 100) c = 100
    return c
  }

  rows.forEach((row, idx) => {
    let confidence = computeConfidence(row)
    if (row.polygonId === null) {
      setInvalid(idx, 'Nincs tartalmazo polygon')
      confidenceByRoomIndex.set(idx, 0)
      return
    }
    if (!isRealisticRoomArea(row.type, row.areaM2)) {
      confidence = Math.min(confidence, 40)
      setInvalid(idx, 'Irrealis helyiseg terulet')
    }
    if (row.widthM !== null && row.lengthM !== null && row.areaConsistencyError > 0.01) {
      confidence = Math.min(confidence, 45)
      setInvalid(idx, 'Meret-terulet inkonzisztencia >1%')
    }
    const polygon = polygons.find((p) => p.id === row.polygonId)
    if (!polygon) {
      confidence = 0
      setInvalid(idx, 'Hianyzo polygon')
      confidenceByRoomIndex.set(idx, confidence)
      return
    }
    const exactArea = polygonAreaAbs(polygon.points)
    const areaErr = Math.abs(exactArea - row.areaM2) / Math.max(0.0001, exactArea)
    if (areaErr > 0.0001) {
      confidence = Math.min(confidence, 50)
      setInvalid(idx, 'Polygon terulet elteres')
    }
    if (confidence < 85) {
      setInvalid(idx, 'Konfidencia 85% alatt')
    }
    confidenceByRoomIndex.set(idx, confidence)
  })

  const overlapPolygonIds = findOverlappingPolygonIds(polygons)
  if (overlapPolygonIds.size) {
    rows.forEach((row, idx) => {
      if (row.polygonId !== null && overlapPolygonIds.has(row.polygonId)) {
        setInvalid(idx, 'Atfedo polygon')
        confidenceByRoomIndex.set(idx, Math.min(confidenceByRoomIndex.get(idx) ?? 100, 35))
      }
    })
    globalErrors.push(`Atfedo polygonok: ${Array.from(overlapPolygonIds).join(', ')}`)
  }

  const internalWallIssues = validateInternalWallBoundaries(walls, polygons)
  if (internalWallIssues.length) {
    globalErrors.push(...internalWallIssues)
  }

  const usableAreaM2 = totalClosedAreaM2 * 0.84
  const validArea = rows
    .filter((_, idx) => !invalidByRoomIndex.has(idx))
    .reduce((s, r) => s + r.areaM2, 0)
  if (validArea > usableAreaM2 + Math.max(0.01, usableAreaM2 * 0.01)) {
    const sorted = rows
      .map((row, idx) => ({ row, idx }))
      .filter((x) => !invalidByRoomIndex.has(x.idx))
      .sort((a, b) => b.row.selectionScore - a.row.selectionScore)
    let current = validArea
    for (const item of sorted) {
      if (current <= usableAreaM2) break
      setInvalid(item.idx, 'Osszterulet > hasznos alapterulet')
      confidenceByRoomIndex.set(item.idx, Math.min(confidenceByRoomIndex.get(item.idx) ?? 100, 50))
      current -= item.row.areaM2
    }
    globalErrors.push('Helyiseg osszterulet meghaladta a hasznos alapteruletet, bizonytalan szobak elrejtve.')
  }

  return { invalidByRoomIndex, errorsByRoomIndex, confidenceByRoomIndex, globalErrors }
}

function findOverlappingPolygonIds(
  polygons: Array<{ id: number; points: Array<{ x: number; y: number }>; areaM2: number; centroid: { x: number; y: number } }>,
) {
  const ids = new Set<number>()
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (polygonsOverlap(polygons[i].points, polygons[j].points)) {
        ids.add(polygons[i].id)
        ids.add(polygons[j].id)
      }
    }
  }
  return ids
}

function polygonsOverlap(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>) {
  const eps = 1e-6
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i]
    const a1 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j]
      const b1 = b[(j + 1) % b.length]
      const hit = segmentIntersection({ a: a0, b: a1 }, { a: b0, b: b1 }, eps)
      if (!hit) continue
      const strict = hit.t1 > eps && hit.t1 < 1 - eps && hit.t2 > eps && hit.t2 < 1 - eps
      if (strict) return true
    }
  }

  const aInsideB = pointInPolygon(a[0], b, eps) && !pointOnPolygonBoundary(a[0], b, eps)
  const bInsideA = pointInPolygon(b[0], a, eps) && !pointOnPolygonBoundary(b[0], a, eps)
  return aInsideB || bInsideA
}

function pointOnPolygonBoundary(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>, eps: number) {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[i], polygon[j], eps)) return true
  }
  return false
}

function validateInternalWallBoundaries(
  walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>,
  polygons: Array<{ id: number; points: Array<{ x: number; y: number }>; areaM2: number; centroid: { x: number; y: number } }>,
) {
  const issues: string[] = []
  const sampleOffset = 0.04
  const edgeTol = 1e-5

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i]
    const dx = wall.b.x - wall.a.x
    const dy = wall.b.y - wall.a.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const nx = -dy / len
    const ny = dx / len
    const mx = (wall.a.x + wall.b.x) * 0.5
    const my = (wall.a.y + wall.b.y) * 0.5
    const pLeft = { x: mx + nx * sampleOffset, y: my + ny * sampleOffset }
    const pRight = { x: mx - nx * sampleOffset, y: my - ny * sampleOffset }

    const leftPoly = polygons.find((p) => pointInPolygon(pLeft, p.points, edgeTol))
    const rightPoly = polygons.find((p) => pointInPolygon(pRight, p.points, edgeTol))

    if (leftPoly && rightPoly && leftPoly.id === rightPoly.id) {
      issues.push(`Fal #${i + 1}: belso fal nem valaszt szet ket polygon-t.`)
    }
  }
  return issues
}

function buildClosedRoomPolygons(walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>) {
  const eps = 1e-6
  const minSegLen = 1e-4

  const segments = walls
    .map((wall) => ({ a: wall.a, b: wall.b }))
    .filter((segment) => dist2(segment.a, segment.b) > minSegLen * minSegLen)

  if (!segments.length) return [] as Array<Array<{ x: number; y: number }>>

  const splitParams: number[][] = segments.map(() => [0, 1])
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const hit = segmentIntersection(segments[i], segments[j], eps)
      if (!hit) continue
      splitParams[i].push(hit.t1)
      splitParams[j].push(hit.t2)
    }
  }

  type Node = { x: number; y: number }
  const nodes: Node[] = []
  const nodeByKey = new Map<string, number>()
  const nodeKey = (p: { x: number; y: number }) => `${Math.round(p.x * 10000)}:${Math.round(p.y * 10000)}`
  const getNodeId = (p: { x: number; y: number }) => {
    const key = nodeKey(p)
    const existing = nodeByKey.get(key)
    if (existing !== undefined) return existing
    const id = nodes.length
    nodes.push({ x: p.x, y: p.y })
    nodeByKey.set(key, id)
    return id
  }

  type UEdge = { a: number; b: number }
  const undirectedEdges: UEdge[] = []
  const edgeSet = new Set<string>()

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const params = Array.from(new Set(splitParams[i].map((t) => clamp01(t))))
      .sort((a, b) => a - b)
    for (let k = 0; k < params.length - 1; k++) {
      const t0 = params[k]
      const t1 = params[k + 1]
      if (t1 - t0 < 1e-6) continue
      const p0 = lerp(segment.a, segment.b, t0)
      const p1 = lerp(segment.a, segment.b, t1)
      if (dist2(p0, p1) <= minSegLen * minSegLen) continue
      const n0 = getNodeId(p0)
      const n1 = getNodeId(p1)
      if (n0 === n1) continue
      const a = Math.min(n0, n1)
      const b = Math.max(n0, n1)
      const key = `${a}:${b}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      undirectedEdges.push({ a, b })
    }
  }

  type DEdge = { from: number; to: number; rev: number; angle: number }
  const directed: DEdge[] = []
  const outgoing: number[][] = nodes.map(() => [])

  for (const edge of undirectedEdges) {
    const pA = nodes[edge.a]
    const pB = nodes[edge.b]
    const iAB = directed.length
    const iBA = directed.length + 1
    directed.push({ from: edge.a, to: edge.b, rev: iBA, angle: Math.atan2(pB.y - pA.y, pB.x - pA.x) })
    directed.push({ from: edge.b, to: edge.a, rev: iAB, angle: Math.atan2(pA.y - pB.y, pA.x - pB.x) })
    outgoing[edge.a].push(iAB)
    outgoing[edge.b].push(iBA)
  }

  for (const list of outgoing) {
    list.sort((ia, ib) => directed[ia].angle - directed[ib].angle)
  }

  const visited = new Array(directed.length).fill(false)
  const polygons: Array<Array<{ x: number; y: number }>> = []

  for (let i = 0; i < directed.length; i++) {
    if (visited[i]) continue
    const cycle: Array<{ x: number; y: number }> = []
    let current = i
    let guard = 0
    while (!visited[current] && guard < directed.length + 5) {
      guard++
      visited[current] = true
      const edge = directed[current]
      cycle.push(nodes[edge.from])

      const list = outgoing[edge.to]
      if (!list.length) break
      const revIdx = list.indexOf(edge.rev)
      if (revIdx < 0) break
      const nextIdx = (revIdx - 1 + list.length) % list.length
      current = list[nextIdx]
    }

    if (cycle.length < 3) continue
    const area = polygonAreaSigned(cycle)
    if (area <= 1e-4) continue
    polygons.push(removeNearDuplicatePoints(cycle, eps))
  }

  return polygons
}

function selectRoomPolygonForLabel(
  room: { type: string; pos: { x: number; y: number } },
  polygons: Array<{ id: number; points: Array<{ x: number; y: number }>; areaM2: number; centroid: { x: number; y: number } }>,
) {
  const probes = buildLabelProbes(room.pos)
  const candidates: Array<{ polygon: { id: number; points: Array<{ x: number; y: number }>; areaM2: number; centroid: { x: number; y: number } }; method: string; score: number }> = []

  for (const probe of probes) {
    for (const polygon of polygons) {
      if (!pointInPolygon(probe.p, polygon.points, 1e-5)) continue
      const dist = Math.hypot(room.pos.x - polygon.centroid.x, room.pos.y - polygon.centroid.y)
      const normDist = dist / Math.max(0.2, Math.sqrt(Math.max(polygon.areaM2, 0.001)))
      const realismPenalty = isRealisticRoomArea(room.type, polygon.areaM2) ? 0 : 30
      const score = probe.weight + normDist + polygon.areaM2 * 0.015 + realismPenalty
      candidates.push({ polygon, method: probe.method, score })
    }
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    if (a.polygon.id !== b.polygon.id) return a.polygon.id - b.polygon.id
    return a.method.localeCompare(b.method)
  })
  return { polygon: candidates[0].polygon, method: candidates[0].method, score: candidates[0].score }
}

function summarizeValidationErrors(errorsByRoomIndex: Map<number, string>) {
  const map = new Map<string, number>()
  for (const [, msg] of errorsByRoomIndex) {
    map.set(msg, (map.get(msg) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => ({ reason, count }))
}

function buildLabelProbes(point: { x: number; y: number }) {
  const r = 0.08
  return [
    { p: point, method: 'point', weight: 0 },
    { p: { x: point.x + r, y: point.y }, method: 'probe', weight: 0.35 },
    { p: { x: point.x - r, y: point.y }, method: 'probe', weight: 0.35 },
    { p: { x: point.x, y: point.y + r }, method: 'probe', weight: 0.35 },
    { p: { x: point.x, y: point.y - r }, method: 'probe', weight: 0.35 },
    { p: { x: point.x + 0.7 * r, y: point.y + 0.7 * r }, method: 'probe', weight: 0.45 },
    { p: { x: point.x - 0.7 * r, y: point.y + 0.7 * r }, method: 'probe', weight: 0.45 },
    { p: { x: point.x + 0.7 * r, y: point.y - 0.7 * r }, method: 'probe', weight: 0.45 },
    { p: { x: point.x - 0.7 * r, y: point.y - 0.7 * r }, method: 'probe', weight: 0.45 },
  ]
}

function segmentIntersection(
  s1: { a: { x: number; y: number }; b: { x: number; y: number } },
  s2: { a: { x: number; y: number }; b: { x: number; y: number } },
  eps: number,
) {
  const r = { x: s1.b.x - s1.a.x, y: s1.b.y - s1.a.y }
  const s = { x: s2.b.x - s2.a.x, y: s2.b.y - s2.a.y }
  const qp = { x: s2.a.x - s1.a.x, y: s2.a.y - s1.a.y }
  const den = cross2(r, s)
  if (Math.abs(den) < eps) {
    return null
  }
  const t = cross2(qp, s) / den
  const u = cross2(qp, r) / den
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) {
    return null
  }
  return { t1: clamp01(t), t2: clamp01(u) }
}

function polygonPrincipalDimensions(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return { axisA: Number.NaN, axisB: Number.NaN }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.x - cx
    const dy = p.y - cy
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)
  const vx = -uy
  const vy = ux

  let minU = Number.POSITIVE_INFINITY
  let maxU = Number.NEGATIVE_INFINITY
  let minV = Number.POSITIVE_INFINITY
  let maxV = Number.NEGATIVE_INFINITY

  for (const p of points) {
    const pu = p.x * ux + p.y * uy
    const pv = p.x * vx + p.y * vy
    if (pu < minU) minU = pu
    if (pu > maxU) maxU = pu
    if (pv < minV) minV = pv
    if (pv > maxV) maxV = pv
  }
  return { axisA: maxU - minU, axisB: maxV - minV }
}

function isRealisticRoomArea(type: string, areaM2: number) {
  if (!(areaM2 > 0.5 && areaM2 < 600)) return false
  if (type === 'wc') return areaM2 <= 20
  if (type === 'furdoszoba') return areaM2 <= 35
  return true
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>, eps = 0) {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (pointOnSegment(point, a, b, eps)) return true
  }

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-12) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function pointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps: number,
) {
  const ab = { x: b.x - a.x, y: b.y - a.y }
  const ap = { x: p.x - a.x, y: p.y - a.y }
  const cross = Math.abs(cross2(ab, ap))
  if (cross > eps * Math.max(1, Math.hypot(ab.x, ab.y))) return false

  const dot = ap.x * ab.x + ap.y * ab.y
  if (dot < -eps) return false
  const ab2 = ab.x * ab.x + ab.y * ab.y
  if (dot > ab2 + eps) return false
  return true
}

function polygonAreaSigned(points: Array<{ x: number; y: number }>) {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    s += a.x * b.y - b.x * a.y
  }
  return s * 0.5
}

function polygonAreaAbs(points: Array<{ x: number; y: number }>) {
  return Math.abs(polygonAreaSigned(points))
}

function polygonCentroid(points: Array<{ x: number; y: number }>) {
  let cx = 0
  let cy = 0
  let a2 = 0
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % points.length]
    const cross = p0.x * p1.y - p1.x * p0.y
    a2 += cross
    cx += (p0.x + p1.x) * cross
    cy += (p0.y + p1.y) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    const sx = points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length)
    const sy = points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.length)
    return { x: sx, y: sy }
  }
  const f = 1 / (3 * a2)
  return { x: cx * f, y: cy * f }
}

function removeNearDuplicatePoints(points: Array<{ x: number; y: number }>, eps: number) {
  if (!points.length) return points
  const out: Array<{ x: number; y: number }> = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || dist2(last, p) > eps * eps) {
      out.push(p)
    }
  }
  if (out.length > 2 && dist2(out[0], out[out.length - 1]) <= eps * eps) {
    out.pop()
  }
  return out
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function cross2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.y - a.y * b.x
}

function clamp01(v: number) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function getRoomLabelDisplayName(room: { type: string; text?: string }, idx: number) {
  const map: Record<string, string> = {
    konyha: 'Konyha',
    wc: 'WC',
    furdoszoba: 'Furdoszoba',
    garazs: 'Garazs',
    nappali: 'Nappali',
    haloszoba: 'Haloszoba',
    eloter: 'Eloter',
    kamra: 'Kamra',
    dolgozo: 'Dolgozo',
    custom: 'Egyedi',
  }
  if (room.type === 'custom') {
    const custom = (room.text || '').trim()
    return custom || `Egyedi ${idx + 1}`
  }
  const base = map[room.type] || 'Helyiseg'
  return `${base} ${idx + 1}`
}

function createBrandSeal(input: string) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `FORMA-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

function safeFilename(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

function formatPdfMetaTimestamp(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function formatInt(n: number) {
  return new Intl.NumberFormat('hu-HU').format(Math.round(n))
}

function calcRoofForBudget(widthM: number, lengthM: number, roof: RoofLayerSettings) {
  const width = Math.max(0, widthM + roof.overhangM * 2)
  const length = Math.max(0, lengthM + roof.overhangM * 2)
  const pitch = (Math.max(0, roof.pitchDeg) * Math.PI) / 180
  let areaM2 = width * length

  if (roof.type === 'gable') {
    const halfRun = width / 2
    const slopeLength = pitch === 0 ? halfRun : halfRun / Math.cos(pitch)
    areaM2 = slopeLength * length * 2
  }
  if (roof.type === 'shed') {
    areaM2 = pitch === 0 ? width * length : (width / Math.cos(pitch)) * length
  }
  if (roof.type === 'hip') {
    const run = Math.min(width, length) / 2
    const slope = pitch === 0 ? run : run / Math.cos(pitch)
    const perimeter = 2 * (width + length)
    areaM2 = Math.max(width * length, (perimeter * slope) / 2)
  }
  if (roof.type === 'butterfly') {
    const half = width / 2
    const slope = pitch === 0 ? half : half / Math.cos(pitch)
    areaM2 = slope * length * 2
  }

  const tiles = Math.ceil(areaM2 * roof.tilePerM2 * (1 + roof.tileWastePct / 100))
  return { areaM2, tiles, tileCostFt: tiles * roof.tilePriceFt }
}

function roofTypeLabel(type: RoofLayerSettings['type'], lang: 'hu' | 'en' = 'hu') {
  if (lang === 'en') {
    if (type === 'gable') return 'Gable'
    if (type === 'shed') return 'Shed'
    if (type === 'flat') return 'Flat'
    if (type === 'hip') return 'Hip'
    return 'Butterfly'
  }
  if (type === 'gable') return 'Nyereg'
  if (type === 'shed') return 'Félnyeregtető'
  if (type === 'flat') return 'Lapostető'
  if (type === 'hip') return 'Kontyolt'
  return 'Pillangó'
}

function translateAppLabel(label: string, lang: 'hu' | 'en') {
  if (lang === 'hu') return label
  const map: Array<[RegExp, string]> = [
    [/^Tégla \(falazóelem, becsült db\)$/i, 'Brick (masonry unit, estimated pcs)'],
    [/^Habarcs \(habarcsváltozat, becsült térfogat\)$/i, 'Mortar (estimated volume)'],
    [/^Cement \(25 kg zsák, ~.*\)$/i, 'Cement (25 kg bags)'],
    [/^Sóder \/ zúzottkő \(becsült tömeg\)$/i, 'Aggregate / crushed stone (estimated mass)'],
    [/^Betonacél \(becsült\)$/i, 'Rebar (estimated)'],
  ]
  for (const [pattern, replacement] of map) {
    if (pattern.test(label)) return replacement
  }
  return label
}
