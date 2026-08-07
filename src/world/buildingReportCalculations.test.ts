import { describe, expect, it } from 'vitest'
import { calculateBuildingReport } from './buildingReportCalculations'
import type { Opening, WallSegment } from './planStore'

function makeWall(a: [number, number], b: [number, number], id: string): WallSegment {
  return {
    id,
    a: { x: a[0], y: a[1] },
    b: { x: b[0], y: b[1] },
    kind: 'load_bearing',
    thicknessM: 0.3,
  }
}

function expectAreaClose(actual: number, expected: number, tolerancePct = 0.01) {
  const tol = Math.max(1e-6, Math.abs(expected) * tolerancePct)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol)
}

function makeOpening(wallId: string, type: Opening['type'], id: string): Opening {
  return {
    id,
    wallId,
    type,
    t: 0.5,
    widthM: type === 'door' ? 0.9 : 1.4,
    sillM: type === 'door' ? 0 : 0.9,
    heightM: type === 'door' ? 2.1 : 1.4,
  }
}

describe('polygon-based building ground area', () => {
  it('calculates rectangle area', () => {
    const walls: WallSegment[] = [
      makeWall([0, 0], [10, 0], 'w1'),
      makeWall([10, 0], [10, 8], 'w2'),
      makeWall([10, 8], [0, 8], 'w3'),
      makeWall([0, 8], [0, 0], 'w4'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expectAreaClose(report.groundArea, 80)
  })

  it('calculates L-shaped area from closed polygon', () => {
    // Polygon: (0,0) -> (8,0) -> (8,3) -> (5,3) -> (5,8) -> (0,8)
    // Area = 8*8 - 3*5 = 49 m2
    const walls: WallSegment[] = [
      makeWall([0, 0], [8, 0], 'w1'),
      makeWall([8, 0], [8, 3], 'w2'),
      makeWall([8, 3], [5, 3], 'w3'),
      makeWall([5, 3], [5, 8], 'w4'),
      makeWall([5, 8], [0, 8], 'w5'),
      makeWall([0, 8], [0, 0], 'w6'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expectAreaClose(report.groundArea, 49)
  })

  it('calculates skewed quadrilateral area (non-orthogonal walls)', () => {
    // Polygon: (0,0) -> (6,0) -> (8,4) -> (2,4)
    // Shoelace area = 24 m2
    const walls: WallSegment[] = [
      makeWall([0, 0], [6, 0], 'w1'),
      makeWall([6, 0], [8, 4], 'w2'),
      makeWall([8, 4], [2, 4], 'w3'),
      makeWall([2, 4], [0, 0], 'w4'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expectAreaClose(report.groundArea, 24)
  })

  it('returns zero when no closed room polygon exists', () => {
    const walls: WallSegment[] = [
      makeWall([0, 0], [8, 0], 'w1'),
      makeWall([8, 0], [8, 5], 'w2'),
      makeWall([8, 5], [1, 5], 'w3'),
      // open shape: missing closing wall
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expect(report.groundArea).toBe(0)
  })

  it('splits internal wall into separate room faces but keeps total area consistent', () => {
    // Outer 10x8 rectangle with one internal divider x=4 from y=0..8
    // Total closed area should still be 80 m2 (32 + 48)
    const walls: WallSegment[] = [
      makeWall([0, 0], [10, 0], 'w1'),
      makeWall([10, 0], [10, 8], 'w2'),
      makeWall([10, 8], [0, 8], 'w3'),
      makeWall([0, 8], [0, 0], 'w4'),
      makeWall([4, 0], [4, 8], 'w5'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expectAreaClose(report.groundArea, 80)
  })

  it('calculates U-shaped floor area', () => {
    // Outer 10x8 minus center notch 4x5 => 60 m2
    const walls: WallSegment[] = [
      makeWall([0, 0], [10, 0], 'w1'),
      makeWall([10, 0], [10, 8], 'w2'),
      makeWall([10, 8], [7, 8], 'w3'),
      makeWall([7, 8], [7, 3], 'w4'),
      makeWall([7, 3], [3, 3], 'w5'),
      makeWall([3, 3], [3, 8], 'w6'),
      makeWall([3, 8], [0, 8], 'w7'),
      makeWall([0, 8], [0, 0], 'w8'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [])
    expectAreaClose(report.groundArea, 60)
  })

  it('keeps area stable with multiple doors and windows', () => {
    const walls: WallSegment[] = [
      makeWall([0, 0], [12, 0], 'w1'),
      makeWall([12, 0], [12, 7], 'w2'),
      makeWall([12, 7], [0, 7], 'w3'),
      makeWall([0, 7], [0, 0], 'w4'),
    ]
    const openings: Opening[] = [
      makeOpening('w1', 'door', 'o1'),
      makeOpening('w2', 'window', 'o2'),
      makeOpening('w3', 'window', 'o3'),
      makeOpening('w4', 'door', 'o4'),
    ]

    const report = calculateBuildingReport(walls, openings, 2.8, [])
    expectAreaClose(report.groundArea, 84)
    expect(report.openingCount).toBe(4)
  })

  it('supports open-plan living area without interior divider', () => {
    const walls: WallSegment[] = [
      makeWall([0, 0], [14, 0], 'w1'),
      makeWall([14, 0], [14, 8], 'w2'),
      makeWall([14, 8], [0, 8], 'w3'),
      makeWall([0, 8], [0, 0], 'w4'),
    ]

    const report = calculateBuildingReport(walls, [], 2.8, [
      { id: 'r1', type: 'nappali', pos: { x: 4, y: 4 } },
      { id: 'r2', type: 'konyha', pos: { x: 10, y: 4 } },
    ])
    expectAreaClose(report.groundArea, 112)
    expect(report.roomCount).toBe(2)
  })
})
