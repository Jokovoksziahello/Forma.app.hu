import type { WallSegment } from './planStore'

export type BuildingFootprintBox = {
  /** Befoglaló téglalap szélessége (m), X tartomány */
  widthM: number
  /** Befoglaló téglalap „hossza” (m), Y tartomány */
  lengthM: number
  /** widthM × lengthM */
  areaM2: number
}

/**
 * Az egész alaprajz legegyszerűbb m²-e: a falvégpontok köré rajzolt
 * **tengelyirányú befoglaló téglalap** területe = szélesség × hosszúság.
 */
export function computeBuildingFootprintBox(walls: WallSegment[]): BuildingFootprintBox {
  if (walls.length === 0) {
    return { widthM: 0, lengthM: 0, areaM2: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const w of walls) {
    for (const p of [w.a, w.b]) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
  }
  const widthM = Math.max(0, maxX - minX)
  const lengthM = Math.max(0, maxY - minY)
  return {
    widthM,
    lengthM,
    areaM2: widthM * lengthM,
  }
}

export function computeBuildingFloorAreaM2(walls: WallSegment[]): number {
  return computeBuildingFootprintBox(walls).areaM2
}
