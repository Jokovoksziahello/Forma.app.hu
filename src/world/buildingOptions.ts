export type RoofType = 'gable' | 'shed' | 'flat' | 'hip' | 'butterfly'

export type RoofLayerSettings = {
  id: string
  type: RoofType
  colorHex: string
  rotationDeg: number
  pitchDeg: number
  overhangM: number
  tilePerM2: number
  tileWastePct: number
  tilePriceFt: number
  visible: boolean
  offsetXM: number
  offsetZM: number
  scale: number
  widthMultiplier: number
  heightMultiplier: number
  lengthMultiplier: number
  cutLeftM: number
  cutRightM: number
  cutFrontM: number
  cutBackM: number
  cornerCutFrontLeftM: number
  cornerCutFrontRightM: number
  cornerCutBackLeftM: number
  cornerCutBackRightM: number
  /** Ha > 0, ez adja a tető gerinc magasságát méterben (felülírja a pitchDeg-alapút) */
  ridgeHeightM: number
  offsetYM: number
}

export type RoofSettings = {
  layers: RoofLayerSettings[]
  selectedLayerId: string | null
}

export type SunSettings = {
  hour: number
  orientationDeg: number
  month: number
  shadows: boolean
}

export type FloorLayerSettings = {
  id: string
  visible: boolean
  colorHex: string
  thicknessM: number
  offsetYM: number
  offsetXM: number
  offsetZM: number
  widthMultiplier: number
  lengthMultiplier: number
  rotationDeg: number
}

export type FloorSettings = {
  layers: FloorLayerSettings[]
  selectedLayerId: string | null
}

export type InsulationSettings = {
  facadeThicknessCm: number
  atticThicknessCm: number
  facadeBoardM2: number
  atticRollM2: number
  facadePriceFtPerM2: number
  atticPriceFtPerM2: number
}

export function createRoofLayer(overrides: Partial<RoofLayerSettings> = {}): RoofLayerSettings {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'gable',
    colorHex: '#c57a5b',
    rotationDeg: 0,
    pitchDeg: 35,
    overhangM: 0.35,
    tilePerM2: 10.5,
    tileWastePct: 8,
    tilePriceFt: 620,
    visible: true,
    offsetXM: 0,
    offsetZM: 0,
    scale: 1,
    widthMultiplier: 1,
    heightMultiplier: 1,
    lengthMultiplier: 1,
    cutLeftM: 0,
    cutRightM: 0,
    cutFrontM: 0,
    cutBackM: 0,
    cornerCutFrontLeftM: 0,
    cornerCutFrontRightM: 0,
    cornerCutBackLeftM: 0,
    cornerCutBackRightM: 0,
    ridgeHeightM: 0,
    offsetYM: 0,
    ...overrides,
  }
}

export const defaultRoofSettings: RoofSettings = {
  layers: [],
  selectedLayerId: null,
}

export const defaultSunSettings: SunSettings = {
  hour: 12,
  orientationDeg: 0,
  month: 6,
  shadows: true,
}

export const defaultFloorLayerSettings: FloorLayerSettings = {
  id: 'default-floor-layer',
  visible: true,
  colorHex: '#d5c4a1',
  thicknessM: 0.12,
  offsetYM: 0,
  offsetXM: 0,
  offsetZM: 0,
  widthMultiplier: 1,
  lengthMultiplier: 1,
  rotationDeg: 0,
}

export function createFloorLayer(overrides: Partial<FloorLayerSettings> = {}): FloorLayerSettings {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    visible: true,
    colorHex: '#d5c4a1',
    thicknessM: 0.12,
    offsetYM: 0,
    offsetXM: 0,
    offsetZM: 0,
    widthMultiplier: 1,
    lengthMultiplier: 1,
    rotationDeg: 0,
    ...overrides,
  }
}

export const defaultFloorSettings: FloorSettings = {
  layers: [],
  selectedLayerId: null,
}

export const defaultInsulationSettings: InsulationSettings = {
  facadeThicknessCm: 15,
  atticThicknessCm: 25,
  facadeBoardM2: 0.72,
  atticRollM2: 5,
  facadePriceFtPerM2: 7800,
  atticPriceFtPerM2: 4200,
}
