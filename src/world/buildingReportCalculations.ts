import type { WallSegment, Opening } from './planStore'
import { computeBuildingFootprintBox } from './footprintArea'

export interface BuildingReport {
  // Alapadatok
  groundArea: number // m²
  perimeter: number // m
  wallCount: number
  openingCount: number
  
  // Építészeti
  architectoralArea: number
  usableArea: number
  roomCount: number
  
  // Szerkezeti
  loadBearingWalls: number
  partitionWalls: number
  doorCount: number
  windowCount: number
  totalWallLength: number
  avgWallHeight: number
  
  // Energetika
  uValueWall: number // W/m²K
  uValueWindow: number
  heatingDemand: number // kWh/m²/év
  coolingDemand: number
  primaryEnergy: number // kWh/m²/év
  co2Emissions: number // kg/m²/év
  
  // Gépészet
  heatingPower: number // kW
  coolingPower: number
  ventilationAirflow: number // m³/h
  hotWaterDemand: number // l/nap
  
  // Költségvetés
  structureReadyCost: number // Ft
  semiFinishedCost: number
  keyReadyCost: number
  costPerM2: number
  
  // Anyagmennyiségek
  brickCount: number
  cementNeeded: number // kg
  steelNeeded: number // kg
  insulationArea: number // m²
}

export function calculateBuildingReport(
  walls: WallSegment[],
  openings: Opening[],
  wallHeightM: number,
  roomLabels: any[] = []
): BuildingReport {
  const box = computeBuildingFootprintBox(walls)
  const closedArea = calculateClosedPlanArea(walls)
  
  const doorCount = openings.filter(o => o.type === 'door').length
  const windowCount = openings.filter(o => o.type === 'window').length
  
  // Teherhordó és válaszfalak száma
  const loadBearingWalls = walls.filter(w => w.kind === 'load_bearing').length
  const partitionWalls = walls.filter(w => w.kind === 'partition').length
  
  // Falak hossza
  let totalWallLength = 0
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x
    const dy = wall.b.y - wall.a.y
    totalWallLength += Math.sqrt(dx * dx + dy * dy)
  }
  
  // Alapterület: kizárólag zárt falpolygonok valós területe
  const groundArea = closedArea
  
  // Kerület
  const perimeter = 2 * (box.widthM + box.lengthM)
  
  // Hasznos alapterület (84% az építészeti terv alapján)
  const usableArea = groundArea * 0.84
  
  // Helyiségek száma
  const roomCount = roomLabels.length
  
  // --- ENERGETIKA SZÁMÍTÁSOK ---
  // Átlagos falvastagság
  const avgWallThickness = walls.length > 0 
    ? walls.reduce((sum, w) => sum + w.thicknessM, 0) / walls.length 
    : 0.18
  
  // U-értékek (W/m²K) - szigetelés nélkül
  const uValueWall = calculateUValueWall(avgWallThickness)
  const uValueWindow = 1.5 // Modern ablakok
  
  // Ablak/ajtó terület
  const openingArea = openings.reduce((sum, o) => sum + (o.widthM * o.heightM), 0)
  const wallSurfaceArea = totalWallLength * wallHeightM
  
  // Fűtési igény (kWh/m²/év) - egyszerűsített
  const heatingDemand = calculateHeatingDemand(
    usableArea,
    wallSurfaceArea,
    openingArea,
    uValueWall,
    uValueWindow
  )
  
  const coolingDemand = heatingDemand * 0.4 // Hűtési igény
  
  // Primer energia (kWh/m²/év)
  const primaryEnergy = heatingDemand * 1.2 + coolingDemand * 0.8
  
  // CO2 kibocsátás (kg/m²/év)
  const co2Emissions = primaryEnergy * 0.25
  
  // --- GÉPÉSZET SZÁMÍTÁSOK ---
  const heatingPower = (heatingDemand * usableArea) / 1000 / 2400 // kW (2400 h/év)
  const coolingPower = (coolingDemand * usableArea) / 1000 / 2400
  
  // Szellőzés: 8 m³/h/fő, átlag 4 fő/100m²
  const occupancy = (usableArea / 100) * 4
  const ventilationAirflow = occupancy * 8 + (usableArea * 0.3) // + terület alapú háttérszellőzés
  
  // Használati melegvíz: 40 l/nap/fő
  const hotWaterDemand = occupancy * 40
  
  // --- ANYAGMENNYISÉGEK ---
  // Tégla mennyiség (1 tégla ~ 0.12 m²)
  const loadBearingWallArea = walls
    .filter(w => w.kind === 'load_bearing')
    .reduce((sum, w) => {
      const len = Math.sqrt((w.b.x - w.a.x) ** 2 + (w.b.y - w.a.y) ** 2)
      return sum + len * wallHeightM
    }, 0)
  
  const brickCount = Math.round((loadBearingWallArea / 0.12) * 1.05) // +5% veszteség
  
  // Cement, acél (becslés)
  const cementNeeded = loadBearingWallArea * 120 // kg/m²
  const steelNeeded = totalWallLength * wallHeightM * 8 // kg
  const insulationArea = wallSurfaceArea * 1.1
  
  // --- KÖLTSÉGVETÉS (2026-os magyarországi árak) ---
  const costPerM2 = calculateCostPerM2(usableArea, heatingDemand)
  // Készültségi szintek: kezdés 25%, félkész 50%, teljes kész 100%
  const structureReadyCost = costPerM2 * usableArea * 0.25
  const semiFinishedCost = costPerM2 * usableArea * 0.5
  const keyReadyCost = costPerM2 * usableArea
  
  return {
    groundArea: Math.round(groundArea * 100) / 100,
    perimeter: Math.round(perimeter * 100) / 100,
    wallCount: walls.length,
    openingCount: openings.length,
    architectoralArea: Math.round(groundArea * 100) / 100,
    usableArea: Math.round(usableArea * 100) / 100,
    roomCount,
    loadBearingWalls,
    partitionWalls,
    doorCount,
    windowCount,
    totalWallLength: Math.round(totalWallLength * 100) / 100,
    avgWallHeight: Math.round(wallHeightM * 100) / 100,
    uValueWall: Math.round(uValueWall * 100) / 100,
    uValueWindow,
    heatingDemand: Math.round(heatingDemand * 10) / 10,
    coolingDemand: Math.round(coolingDemand * 10) / 10,
    primaryEnergy: Math.round(primaryEnergy * 10) / 10,
    co2Emissions: Math.round(co2Emissions * 100) / 100,
    heatingPower: Math.round(heatingPower * 100) / 100,
    coolingPower: Math.round(coolingPower * 100) / 100,
    ventilationAirflow: Math.round(ventilationAirflow),
    hotWaterDemand: Math.round(hotWaterDemand),
    structureReadyCost: Math.round(structureReadyCost / 1000) * 1000,
    semiFinishedCost: Math.round(semiFinishedCost / 1000) * 1000,
    keyReadyCost: Math.round(keyReadyCost / 1000) * 1000,
    costPerM2: Math.round(costPerM2 / 1000) * 1000,
    brickCount,
    cementNeeded: Math.round(cementNeeded),
    steelNeeded: Math.round(steelNeeded),
    insulationArea: Math.round(insulationArea * 100) / 100,
  }
}

function calculateClosedPlanArea(walls: WallSegment[]) {
  const polygons = buildClosedRoomPolygons(walls)
  return polygons.reduce((sum, polygon) => sum + polygonAreaAbs(polygon), 0)
}

function buildClosedRoomPolygons(walls: WallSegment[]) {
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

function segmentIntersection(
  s1: { a: { x: number; y: number }; b: { x: number; y: number } },
  s2: { a: { x: number; y: number }; b: { x: number; y: number } },
  eps: number,
) {
  const r = { x: s1.b.x - s1.a.x, y: s1.b.y - s1.a.y }
  const s = { x: s2.b.x - s2.a.x, y: s2.b.y - s2.a.y }
  const qp = { x: s2.a.x - s1.a.x, y: s2.a.y - s1.a.y }
  const den = cross2(r, s)
  if (Math.abs(den) < eps) return null
  const t = cross2(qp, s) / den
  const u = cross2(qp, r) / den
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null
  return { t1: clamp01(t), t2: clamp01(u) }
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

function removeNearDuplicatePoints(points: Array<{ x: number; y: number }>, eps: number) {
  if (!points.length) return points
  const out: Array<{ x: number; y: number }> = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || dist2(last, p) > eps * eps) out.push(p)
  }
  if (out.length > 2 && dist2(out[0], out[out.length - 1]) <= eps * eps) out.pop()
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

function calculateUValueWall(thicknessM: number): number {
  // 30 cm: 0.32, 20 cm: 0.48, 18 cm: 0.54
  // Egyszerű lineáris interpoláció
  if (thicknessM <= 0.18) return 0.54
  if (thicknessM >= 0.30) return 0.32
  return 0.54 - ((thicknessM - 0.18) / 0.12) * 0.22
}

function calculateHeatingDemand(
  usableArea: number,
  wallSurfaceArea: number,
  openingArea: number,
  uWall: number,
  uWindow: number
): number {
  // DT = 15°C (fűtési szezon átlaga)
  // Fűtési napok: 240 nap, 8 h/nap = 1920 h
  const DT = 15
  const heatingHours = 1920
  
  const wallHeatLoss = wallSurfaceArea * uWall * DT * heatingHours / 1000
  const windowHeatLoss = openingArea * uWindow * DT * heatingHours / 1000
  
  // Összesen kWh, per m² hasznos terület
  return (wallHeatLoss + windowHeatLoss) / usableArea
}

function calculateCostPerM2(usableArea: number, heatingDemand: number): number {
  // 2026-os magyarországi átlagárak
  // Alap: 500-700 ezer Ft/m² (nyílászáró, fűtés, vízellátás nélkül)
  // Szabályozók:
  // - Méret (nagyobb = olcsóbb per m²)
  // - Energetika (magasabb igény = drágább szerkezet)
  
  let baseCost = 550000 // Ft/m²
  
  // Mérethatás
  if (usableArea < 50) baseCost += 100000
  else if (usableArea < 100) baseCost += 50000
  else if (usableArea > 300) baseCost -= 50000
  
  // Energetikai követelménytől függően
  if (heatingDemand > 120) baseCost += 80000 // Gyenge szigetelés
  else if (heatingDemand > 100) baseCost += 40000
  else if (heatingDemand < 60) baseCost += 120000 // Passzívház szint
  
  return baseCost
}

export function generateMissingDocuments(): string[] {
  return [
    "Engedélyezési terv és építési napló",
    "Tűzvédelmi szakvélemény",
    "Hangszigetelési számítás",
    "Közműcsatlakozási engedélyek",
    "Statikai szakvélemény (PE)",
    "Energetikai tanúsítás (NZEB megfelelőség)",
    "Akadálymentesítési terv",
    "Használati útmutató és karbantartási utasítás",
  ]
}

export function generateRisks(): string[] {
  return [
    "Talajvizsgálat szükséges az alapozáshoz",
    "Hőhídmentes részletekre oda kell figyelni",
    "Szellőzés megfelelő méretezése kritikus",
    "Páraállapot (konyha, fürdőszoba) kezelése",
    "Nyílászáró megfelelő beépítése (szél, víz)",
  ]
}

export function generateRecommendations(): string[] {
  return [
    "Napelem rendszer beépítése (költség: +2-3 M Ft, megtérülés 7-8 év)",
    "Hővisszanyerős szellőzés (költség: +1.5 M Ft, fűtésmegtakarítás 15%)",
    "Hőszivattyú a gázkazán helyett (költség: +2 M Ft, üzem költség -40%)",
    "Zöldtető részben (nagyobb tóga, biodiverzitás, csapadék kezelés)",
    "Okos szabályozás (költség: +300-500 k Ft, energiamegtakarítás 10%)",
  ]
}
