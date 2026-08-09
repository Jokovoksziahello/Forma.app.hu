import type { WallSegment } from './planStore'

export type WallTotals = {
  totalLengthM: number
  totalVolumeM3: number
  loadBearingLengthM: number
  partitionLengthM: number
}

export type BrickMortarEstimate = {
  bricks: number
  mortarM3: number
}

export type ConcreteMixEstimate = {
  cementKg: number
  aggregateKg: number
  waterL: number
}

export type MaterialUnitPricesHuf = {
  /** Tégla, db */
  brickFtPerPc: number
  /** Habarcs térfogat, m³ */
  mortarFtPerM3: number
  /** Cement 25 kg zsák */
  cementBag25kgFt: number
  /** Sóder / zúzottkő, tonna */
  aggregateFtPerTonne: number
  /** Betonacél, kg */
  rebarFtPerKg: number
  /** Beltéri/kültéri ajtó átlagár, db */
  doorFtPerPc: number
  /** Ablak átlagár, m² */
  windowFtPerM2: number
  /** Falazás munkadíj, m² fal felület */
  wallLaborFtPerM2: number
  /** Betonozás munkadíj, m³ */
  concreteLaborFtPerM3: number
  /** Vasalás szerelés munkadíj, kg */
  rebarLaborFtPerKg: number
  /** Ajtó beépítés munkadíj, db */
  doorInstallLaborFtPerPc: number
  /** Ablak beépítés munkadíj, m² */
  windowInstallLaborFtPerM2: number
}

export const defaultMaterialUnitPricesHuf: MaterialUnitPricesHuf = {
  brickFtPerPc: 320,
  mortarFtPerM3: 68000,
  cementBag25kgFt: 4300,
  aggregateFtPerTonne: 7800,
  rebarFtPerKg: 690,
  doorFtPerPc: 185000,
  windowFtPerM2: 125000,
  wallLaborFtPerM2: 12000,
  concreteLaborFtPerM3: 28000,
  rebarLaborFtPerKg: 260,
  doorInstallLaborFtPerPc: 45000,
  windowInstallLaborFtPerM2: 32000,
}

export type CostLine = {
  id: string
  material: string
  quantity: number
  qtyLabel: string
  unit: string
  unitPriceFt: number
  totalFt: number
}

export function calcWallTotals(walls: WallSegment[], heightM: number): WallTotals {
  let totalLengthM = 0
  let totalVolumeM3 = 0
  let loadBearingLengthM = 0
  let partitionLengthM = 0
  for (const w of walls) {
    const len = Math.hypot(w.a.x - w.b.x, w.a.y - w.b.y)
    totalLengthM += len
    const t = w.thicknessM ?? 0.18
    totalVolumeM3 += len * heightM * t
    if (w.kind === 'load_bearing') loadBearingLengthM += len
    else partitionLengthM += len
  }
  return { totalLengthM, totalVolumeM3, loadBearingLengthM, partitionLengthM }
}

/** Modul: 25×12×6.5 cm + fugák (~1 cm) */
export function calcBrickMortar(wallVolumeM3: number): BrickMortarEstimate {
  const moduleVol = 0.26 * 0.13 * 0.075
  const brickVol = 0.25 * 0.12 * 0.065
  const bricks = wallVolumeM3 <= 0 ? 0 : Math.round(wallVolumeM3 / moduleVol)
  const mortarM3 = Math.max(0, wallVolumeM3 - bricks * brickVol)
  return { bricks, mortarM3 }
}

export function calcConcrete(
  volumeM3: number,
  cementPart: number,
  aggregatePart: number,
  waterCementRatio: number,
): ConcreteMixEstimate {
  const v = Math.max(0, volumeM3)
  const c = Math.max(0.1, cementPart)
  const a = Math.max(0.1, aggregatePart)
  const sum = c + a
  const cementVol = v * (c / sum)
  const aggregateVol = v * (a / sum)
  const cementKg = Math.round(cementVol * 1440)
  const aggregateKg = Math.round(aggregateVol * 1600)
  const wc = Math.max(0.35, Math.min(0.7, waterCementRatio))
  const waterL = Math.round(cementKg * wc)
  return { cementKg, aggregateKg, waterL }
}

export function buildCostLines(
  brick: BrickMortarEstimate,
  concrete: ConcreteMixEstimate,
  rebarKg: number,
  prices: MaterialUnitPricesHuf,
): CostLine[] {
  const lines: CostLine[] = []

  lines.push({
    id: 'brick',
    material: 'Tégla (falazóelem, becsült db)',
    quantity: brick.bricks,
    qtyLabel: formatIntHu(brick.bricks),
    unit: 'db',
    unitPriceFt: prices.brickFtPerPc,
    totalFt: Math.round(brick.bricks * prices.brickFtPerPc),
  })

  lines.push({
    id: 'mortar',
    material: 'Habarcs (habarcsváltozat, becsült térfogat)',
    quantity: brick.mortarM3,
    qtyLabel: brick.mortarM3.toFixed(2).replace('.', ','),
    unit: 'm³',
    unitPriceFt: prices.mortarFtPerM3,
    totalFt: Math.round(brick.mortarM3 * prices.mortarFtPerM3),
  })

  const cementBags = Math.ceil(concrete.cementKg / 25)
  lines.push({
    id: 'cement',
    material: 'Cement (25 kg zsák, ~' + concrete.cementKg + ' kg → ' + cementBags + ' zsák)',
    quantity: cementBags,
    qtyLabel: String(cementBags),
    unit: 'zsák',
    unitPriceFt: prices.cementBag25kgFt,
    totalFt: cementBags * prices.cementBag25kgFt,
  })

  const aggT = concrete.aggregateKg / 1000
  lines.push({
    id: 'aggregate',
    material: 'Sóder / zúzottkő (becsült tömeg)',
    quantity: aggT,
    qtyLabel: aggT.toFixed(2).replace('.', ','),
    unit: 't',
    unitPriceFt: prices.aggregateFtPerTonne,
    totalFt: Math.round(aggT * prices.aggregateFtPerTonne),
  })

  lines.push({
    id: 'rebar',
    material: 'Betonacél (becsült)',
    quantity: rebarKg,
    qtyLabel: formatIntHu(Math.round(rebarKg)),
    unit: 'kg',
    unitPriceFt: prices.rebarFtPerKg,
    totalFt: Math.round(rebarKg * prices.rebarFtPerKg),
  })

  return lines
}

export function sumCostLines(lines: CostLine[]): number {
  return lines.reduce((s, l) => s + l.totalFt, 0)
}

function formatIntHu(n: number): string {
  return new Intl.NumberFormat('hu-HU').format(Math.round(n))
}
