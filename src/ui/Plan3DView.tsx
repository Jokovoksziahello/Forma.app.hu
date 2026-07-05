import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Opening, WallSegment } from '../world/planStore'
import { usePlanStore } from '../world/planStore'
import { computeBuildingFootprintBox } from '../world/footprintArea'
import type { FloorLayerSettings, FloorSettings, RoofLayerSettings, RoofSettings, SunSettings } from '../world/buildingOptions'

export function Plan3DView({
  roof,
  sun,
  wallColor,
  showOpeningTextures,
  doorColor,
  windowFrameColor,
  floorColor,
  floor,
  lang = 'hu',
}: {
  roof: RoofSettings
  sun: SunSettings
  wallColor: string
  showOpeningTextures: boolean
  doorColor: string
  windowFrameColor: string
  floorColor: string
  floor: FloorSettings
  lang?: 'hu' | 'en'
}) {
  return (
    <div className="panel panel--dark">
      <div className="hint hint--overlay">
        <div className="hint__row">
          {lang === 'en' ? <><kbd>Left or right click + drag</kbd> look around, cursor stays available</> : <><kbd>Bal vagy jobb klikk + húzás</kbd> körbenézés, kurzor mindig elérhető</>}
        </div>
        <div className="hint__row">
          {lang === 'en' ? <><kbd>W A S D</kbd> move, <kbd>Space</kbd> up, <kbd>Shift</kbd> down, <kbd>Ctrl</kbd> sprint</> : <><kbd>W A S D</kbd> mozgás, <kbd>Space</kbd> fel, <kbd>Shift</kbd> le, <kbd>Ctrl</kbd> sprint</>}
        </div>
        <div className="hint__row">
          {lang === 'en' ? 'Click the 3D canvas to activate movement keys' : 'Kattints a 3D vászonra, hogy a mozgás billentyűk aktívak legyenek'}
        </div>
      </div>

      <Canvas 
        shadows={{ type: THREE.PCFShadowMap }} 
        camera={{ fov: 70, near: 0.05, far: 200, position: [0, 1.6, 3] }}
      >
        <Scene
          roof={roof}
          sun={sun}
          wallColor={wallColor}
          showOpeningTextures={showOpeningTextures}
          doorColor={doorColor}
          windowFrameColor={windowFrameColor}
          floorColor={floorColor}
          floor={floor}
        />
      </Canvas>
    </div>
  )
}

function GrassGround({
  walls,
}: {
  walls: WallSegment[]
}) {
  const bounds = useMemo(() => computeWallBounds(walls), [walls])
  
  // Zöld alap MINDIG 500×500, nem változik a falakkal
  const grassW = 500
  const grassL = 500
  const grassCx = bounds?.cx ?? 0
  const grassCz = bounds?.cz ?? 0
  
  const grassThickness = 0.05
  const grassY = -grassThickness / 2 - 0.05

  const materialProps = {
    color: '#4a7c59',
    roughness: 0.85,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }

  return (
    <mesh
      position={[grassCx, grassY, grassCz]}
      receiveShadow
    >
      <boxGeometry args={[grassW, grassThickness, grassL]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  )
}

function Scene({
  roof,
  sun,
  wallColor,
  showOpeningTextures,
  doorColor,
  windowFrameColor,
  floorColor,
  floor,
}: {
  roof: RoofSettings
  sun: SunSettings
  wallColor: string
  showOpeningTextures: boolean
  doorColor: string
  windowFrameColor: string
  floorColor: string
  floor: FloorSettings
}) {
  const walls = usePlanStore((s) => s.walls)
  const openings = usePlanStore((s) => s.openings)
  const wallHeightM = usePlanStore((s) => s.wallHeightM)
  const footprint = useMemo(() => computeBuildingFootprintBox(walls), [walls])
  const sunPosition = useMemo(() => sunPositionFromSettings(sun), [sun])
  const sunAltitude = estimateSunAltitudeDeg(sun.hour, sun.month)

  const skyTexture = useMemo(() => createProceduralSkyTexture(), [])
  const wallTexture = useMemo(() => createProceduralWallTexture(), [])
  const doorTexture = useMemo(() => createProceduralDoorTexture(), [])
  const windowTexture = useMemo(() => createProceduralWindowTexture(), [])

  useEffect(() => {
    return () => {
      skyTexture.dispose()
      wallTexture.dispose()
      doorTexture.dispose()
      windowTexture.dispose()
    }
  }, [doorTexture, skyTexture, wallTexture, windowTexture])

  return (
    <>
      <SkyDome texture={skyTexture} />
      <ambientLight intensity={sun.shadows ? 0.35 : 0.75} />
      <directionalLight
        position={sunPosition}
        intensity={0.45 + (sunAltitude / 62) * 1.15}
        castShadow={sun.shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Zöld füves alapréteg */}
      <GrassGround walls={walls} />

      {floor.layers.some((l) => l.visible) ? (
        <group>
          {floor.layers.map((l) => (
            <Floor key={l.id} walls={walls} floorColor={floorColor} floorLayer={l} />
          ))}
        </group>
      ) : null}
      <Walls
        walls={walls}
        openings={openings}
        height={wallHeightM}
        baseTexture={wallTexture}
        wallColor={wallColor}
        showOpeningTextures={showOpeningTextures}
        doorColor={doorColor}
        windowFrameColor={windowFrameColor}
        doorTexture={doorTexture}
        windowTexture={windowTexture}
      />
      {roof.layers.some((layer) => layer.visible) ? (
        <group>
          {roof.layers.map((layer) => (
            <RoofLayer key={layer.id} walls={walls} height={wallHeightM} layer={layer} footprintAreaM2={footprint.areaM2} />
          ))}
        </group>
      ) : null}

      <Player />
      <Export3dHook />
    </>
  )
}

function SkyDome({ texture }: { texture: THREE.Texture }) {
  const map = useMemo(() => {
    const t = texture.clone()
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.repeat.set(1, 1)
    t.needsUpdate = true
    return t
  }, [texture])

  useEffect(() => {
    return () => map.dispose()
  }, [map])

  return (
    <mesh>
      <sphereGeometry args={[180, 48, 32]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} fog={false} />
    </mesh>
  )
}

function Floor({
  walls,
  floorColor,
  floorLayer,
}: {
  walls: WallSegment[]
  floorColor: string
  floorLayer: FloorLayerSettings
}) {
  const bounds = useMemo(() => computeWallBounds(walls), [walls])
  if (!bounds || bounds.width <= 0.01 || bounds.length <= 0.01 || !floorLayer.visible) return null

  const floorW = Math.max(0.1, bounds.width * Math.max(0.2, floorLayer.widthMultiplier))
  const floorL = Math.max(0.1, bounds.length * Math.max(0.2, floorLayer.lengthMultiplier))
  const floorY = Math.max(-0.5, floorLayer.offsetYM)
  const floorThickness = Math.max(0.02, Math.min(0.6, floorLayer.thicknessM))

  const materialColor = floorLayer.colorHex || floorColor
  const materialProps = {
    color: materialColor,
    roughness: 0.72,
    metalness: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }

  return (
    <mesh
      position={[bounds.cx + floorLayer.offsetXM, floorY + floorThickness / 2, bounds.cz + floorLayer.offsetZM]}
      rotation={[0, ((floorLayer.rotationDeg ?? 0) * Math.PI) / 180, 0]}
      receiveShadow
      castShadow
    >
      <boxGeometry args={[floorW, floorThickness, floorL]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  )
}

function Walls({
  walls,
  openings,
  height,
  baseTexture,
  wallColor,
  showOpeningTextures,
  doorColor,
  windowFrameColor,
  doorTexture,
  windowTexture,
}: {
  walls: WallSegment[]
  openings: Opening[]
  height: number
  baseTexture: THREE.Texture
  wallColor: string
  showOpeningTextures: boolean
  doorColor: string
  windowFrameColor: string
  doorTexture: THREE.Texture
  windowTexture: THREE.Texture
}) {
  return (
    <group>
      {walls.map((w) => (
        <WallMesh
          key={w.id}
          wall={w}
          openings={openings.filter((o) => o.wallId === w.id)}
          height={height}
          baseTexture={baseTexture}
          wallColor={wallColor}
          showOpeningTextures={showOpeningTextures}
          doorColor={doorColor}
          windowFrameColor={windowFrameColor}
          doorTexture={doorTexture}
          windowTexture={windowTexture}
        />
      ))}
    </group>
  )
}

function WallMesh({
  wall,
  openings,
  height,
  baseTexture,
  wallColor,
  showOpeningTextures,
  doorColor,
  windowFrameColor,
  doorTexture,
  windowTexture,
}: {
  wall: WallSegment
  openings: Opening[]
  height: number
  baseTexture: THREE.Texture
  wallColor: string
  showOpeningTextures: boolean
  doorColor: string
  windowFrameColor: string
  doorTexture: THREE.Texture
  windowTexture: THREE.Texture
}) {
  const a = wall.a
  const b = wall.b
  const az = worldYToSceneZ(a.y)
  const bz = worldYToSceneZ(b.y)
  const dx = b.x - a.x
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return null

  const angle = Math.atan2(dz, dx)
  const cx = (a.x + b.x) / 2
  const cz = (az + bz) / 2
  const thickness = wall.thicknessM ?? 0.18

  const texture = useMemo(() => {
    const t = baseTexture.clone()
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(Math.max(0.5, length), Math.max(0.5, height))
    t.needsUpdate = true
    return t
  }, [baseTexture, height, length])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        color: wallColor,
        roughness: 0.95,
        metalness: 0,
      }),
    [texture, wallColor],
  )

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-length / 2, 0)
    shape.lineTo(length / 2, 0)
    shape.lineTo(length / 2, height)
    shape.lineTo(-length / 2, height)
    shape.closePath()

    for (const o of openings) {
      const centerX = -length / 2 + o.t * length
      const x0 = centerX - o.widthM / 2
      const x1 = centerX + o.widthM / 2
      const y0 = o.sillM
      const y1 = o.sillM + o.heightM
      const pad = 0.02
      const [hx0, hx1] = fitInterval(x0, x1, -length / 2 + pad, length / 2 - pad)
      const [hy0, hy1] = fitInterval(y0, y1, pad, height - pad)
      if (hx1 - hx0 < 0.05 || hy1 - hy0 < 0.05) continue

      const hole = new THREE.Path()
      hole.moveTo(hx0, hy0)
      hole.lineTo(hx0, hy1)
      hole.lineTo(hx1, hy1)
      hole.lineTo(hx1, hy0)
      hole.closePath()
      shape.holes.push(hole)
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
    })
    geo.translate(0, 0, -thickness / 2)
    geo.computeVertexNormals()
    return geo
  }, [height, length, openings, thickness])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    }
  }, [geometry, material, texture])


  const insertDepth = Math.max(0.02, thickness * 0.86)
  const insertPad = 0.03

  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      <mesh castShadow receiveShadow material={material}>
        <primitive object={geometry} attach="geometry" />
      </mesh>
      {showOpeningTextures &&
        openings.map((o) => {
          const centerX = -length / 2 + o.t * length
          const openW = Math.max(0.08, o.widthM - insertPad)
          const openH = Math.max(0.08, o.heightM - insertPad)
          const centerY = o.sillM + o.heightM / 2
          if (centerY < 0 || centerY > height + 0.2) return null

          if (o.type === 'door') {
            return (
              <mesh key={o.id} position={[centerX, centerY, 0]} castShadow receiveShadow>
                <boxGeometry args={[openW, openH, insertDepth]} />
                <meshStandardMaterial map={doorTexture} color={doorColor} roughness={0.78} metalness={0.02} />
              </mesh>
            )
          }

          return (
            <group key={o.id} position={[centerX, centerY, 0]}>
              {(() => {
                const tokW = Math.max(0.05, Math.min(0.12, Math.min(openW, openH) * 0.14))
                const clearW = Math.max(0.08, openW - tokW * 2)
                const clearH = Math.max(0.08, openH - tokW * 2)
                return (
                  <>
                    <mesh position={[0, -openH / 2 + tokW / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[openW, tokW, insertDepth]} />
                      <meshStandardMaterial color={windowFrameColor} roughness={0.72} metalness={0.04} />
                    </mesh>
                    <mesh position={[0, openH / 2 - tokW / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[openW, tokW, insertDepth]} />
                      <meshStandardMaterial color={windowFrameColor} roughness={0.72} metalness={0.04} />
                    </mesh>
                    <mesh position={[-openW / 2 + tokW / 2, 0, 0]} castShadow receiveShadow>
                      <boxGeometry args={[tokW, Math.max(0.08, openH - tokW * 2), insertDepth]} />
                      <meshStandardMaterial color={windowFrameColor} roughness={0.72} metalness={0.04} />
                    </mesh>
                    <mesh position={[openW / 2 - tokW / 2, 0, 0]} castShadow receiveShadow>
                      <boxGeometry args={[tokW, Math.max(0.08, openH - tokW * 2), insertDepth]} />
                      <meshStandardMaterial color={windowFrameColor} roughness={0.72} metalness={0.04} />
                    </mesh>
                    <mesh position={[0, 0, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.04, clearH, insertDepth * 0.9]} />
                      <meshStandardMaterial color={windowFrameColor} roughness={0.7} metalness={0.05} />
                    </mesh>
                    <mesh position={[0, 0, insertDepth / 2 - 0.004]}>
                      <planeGeometry args={[clearW, clearH]} />
                      <meshStandardMaterial
                        map={windowTexture}
                        color="#dfefff"
                        roughness={0.12}
                        metalness={0.02}
                        transparent
                        opacity={0.8}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                      />
                    </mesh>
                  </>
                )
              })()}
            </group>
          )
        })}
    </group>
  )
}

function RoofLayer({
  walls,
  height,
  layer,
  footprintAreaM2,
}: {
  walls: WallSegment[]
  height: number
  layer: RoofLayerSettings
  footprintAreaM2: number
}) {
  const bounds = useMemo(() => computeWallBounds(walls), [walls])
  if (!bounds || footprintAreaM2 <= 0.01) return null

  const rawWidth = Math.max(0.1, (bounds.width + layer.overhangM * 2) * layer.scale * layer.widthMultiplier)
  const rawLength = Math.max(0.1, (bounds.length + layer.overhangM * 2) * layer.scale * layer.lengthMultiplier)
  const cutLeft = clamp(layer.cutLeftM, 0, Math.max(0, rawWidth - 0.1))
  const cutRight = clamp(layer.cutRightM, 0, Math.max(0, rawWidth - 0.1))
  const cutFront = clamp(layer.cutFrontM, 0, Math.max(0, rawLength - 0.1))
  const cutBack = clamp(layer.cutBackM, 0, Math.max(0, rawLength - 0.1))
  const width = Math.max(0.1, rawWidth - cutLeft - cutRight)
  const length = Math.max(0.1, rawLength - cutFront - cutBack)
  const localOffsetX = (cutLeft - cutRight) / 2
  const localOffsetZ = (cutFront - cutBack) / 2
  const pitch = (clamp(layer.pitchDeg, 0, 60) * Math.PI) / 180
  const computedPitchRise = Math.tan(pitch) * (layer.type === 'gable' ? width / 2 : width) * layer.heightMultiplier
  const rise =
    layer.type === 'flat'
      ? 0.16 * layer.heightMultiplier
      : (layer.ridgeHeightM ?? 0) > 0
        ? layer.ridgeHeightM
        : computedPitchRise > 0
          ? computedPitchRise
          : 1.0 * layer.heightMultiplier
  const rotationY = (layer.rotationDeg * Math.PI) / 180
  const roofY = height + 0.05 + (layer.offsetYM ?? 0)
  const roofX = bounds.cx + layer.offsetXM
  const roofZ = bounds.cz + layer.offsetZM
  const flatThickness = Math.max(0.05, 0.16 * layer.heightMultiplier)
  const solidThickness = Math.max(0.12, 0.22 * layer.heightMultiplier)

  const material = (
    <meshStandardMaterial
      color={layer.colorHex}
      roughness={0.45}
      metalness={0}
      emissive="#000000"
      emissiveIntensity={0}
    />
  )

  if (!layer.visible) return null

  if (layer.type === 'flat' || layer.pitchDeg <= 1) {
    return (
      <group position={[roofX, roofY, roofZ]} rotation={[0, rotationY, 0]}>
        <mesh position={[localOffsetX, flatThickness / 2, localOffsetZ]} castShadow receiveShadow>
          <boxGeometry args={[width, flatThickness, length]} />
          {material}
        </mesh>
      </group>
    )
  }

  if (layer.type === 'shed') {
    const shedProfile = new THREE.Shape([
      new THREE.Vector2(-width / 2, 0),
      new THREE.Vector2(width / 2, Math.max(0.08, rise)),
      new THREE.Vector2(width / 2, -solidThickness),
      new THREE.Vector2(-width / 2, -solidThickness),
    ])
    return (
      <group position={[roofX, roofY, roofZ]} rotation={[0, rotationY, 0]}>
        <mesh position={[localOffsetX, 0, localOffsetZ - length / 2]} castShadow receiveShadow>
          <extrudeGeometry
            args={[
              shedProfile,
              {
                depth: length,
                bevelEnabled: false,
                steps: 1,
              },
            ]}
          />
          {material}
        </mesh>
      </group>
    )
  }

  if (layer.type === 'hip') {
    const roofHeight = Math.max(0.2, rise)
    const radius = Math.max(width, length) / 2
    const scaleX = width / Math.max(width, length)
    const scaleZ = length / Math.max(width, length)
    return (
      <group position={[roofX, roofY, roofZ]} rotation={[0, rotationY, 0]}>
        <mesh position={[localOffsetX, roofHeight / 2, localOffsetZ]} scale={[scaleX, 1, scaleZ]} castShadow receiveShadow>
          <coneGeometry args={[radius, roofHeight, 4, 1, false]} />
          {material}
        </mesh>
      </group>
    )
  }

  if (layer.type === 'butterfly') {
    const butterflyProfile = new THREE.Shape([
      new THREE.Vector2(-width / 2, Math.max(0.08, rise)),
      new THREE.Vector2(0, 0),
      new THREE.Vector2(width / 2, Math.max(0.08, rise)),
      new THREE.Vector2(width / 2, -solidThickness),
      new THREE.Vector2(-width / 2, -solidThickness),
    ])
    return (
      <group position={[roofX, roofY, roofZ]} rotation={[0, rotationY, 0]}>
        <mesh position={[localOffsetX, 0, localOffsetZ - length / 2]} castShadow receiveShadow>
          <extrudeGeometry
            args={[
              butterflyProfile,
              {
                depth: length,
                bevelEnabled: false,
                steps: 1,
              },
            ]}
          />
          {material}
        </mesh>
      </group>
    )
  }

  const gableProfile = new THREE.Shape([
    new THREE.Vector2(-width / 2, 0),
    new THREE.Vector2(0, Math.max(0.08, rise)),
    new THREE.Vector2(width / 2, 0),
    new THREE.Vector2(width / 2, -solidThickness),
    new THREE.Vector2(-width / 2, -solidThickness),
  ])

  return (
    <group position={[roofX, roofY, roofZ]} rotation={[0, rotationY, 0]}>
      <mesh position={[localOffsetX, 0, localOffsetZ - length / 2]} castShadow receiveShadow>
        <extrudeGeometry
          args={[
            gableProfile,
            {
              depth: length,
              bevelEnabled: false,
              steps: 1,
            },
          ]}
        />
        {material}
      </mesh>
    </group>
  )
}

function computeWallBounds(walls: WallSegment[]) {
  if (walls.length === 0) return null
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const wall of walls) {
    for (const point of [wall.a, wall.b]) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      const z = worldYToSceneZ(point.y)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width: maxX - minX,
    length: maxZ - minZ,
  }
}

function worldYToSceneZ(y: number) {
  return -y
}

function sunPositionFromSettings(sun: SunSettings): [number, number, number] {
  const altitude = (estimateSunAltitudeDeg(sun.hour, sun.month) * Math.PI) / 180
  const azimuth = ((sun.orientationDeg + (sun.hour - 12) * 15) * Math.PI) / 180
  const radius = 24
  return [
    Math.sin(azimuth) * Math.cos(altitude) * radius,
    Math.max(1, Math.sin(altitude) * radius),
    Math.cos(azimuth) * Math.cos(altitude) * radius,
  ]
}

function estimateSunAltitudeDeg(hour: number, month: number) {
  const noonCurve = month === 6 ? 62 : month === 3 || month === 9 ? 42 : month === 12 ? 18 : 25
  const hourOffset = Math.abs(hour - 12)
  return Math.max(1, noonCurve - hourOffset * 7)
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function fitInterval(a0: number, a1: number, min: number, max: number): [number, number] {
  let x0 = Math.min(a0, a1)
  let x1 = Math.max(a0, a1)
  const w = x1 - x0
  const maxW = max - min
  if (w >= maxW) return [min, max]

  // Shift interval inside bounds (do not shrink unless necessary)
  if (x0 < min) {
    const d = min - x0
    x0 += d
    x1 += d
  }
  if (x1 > max) {
    const d = x1 - max
    x0 -= d
    x1 -= d
  }

  x0 = clamp(x0, min, max)
  x1 = clamp(x1, min, max)
  if (x1 - x0 > w) x1 = x0 + w
  return [x0, x1]
}

function createProceduralWallTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  // Base plaster tone
  ctx.fillStyle = '#e9ecef'
  ctx.fillRect(0, 0, size, size)

  // Subtle noise
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12
    img.data[i] = clamp255(img.data[i] + n)
    img.data[i + 1] = clamp255(img.data[i + 1] + n)
    img.data[i + 2] = clamp255(img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)

  // Very subtle grid to show scale
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 2
  const step = 64
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createProceduralSkyTexture() {
  const w = 2048
  const h = 1024
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!

  // Vertical atmosphere gradient: horizon brighter, zenith deeper blue.
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#4b86d4')
  g.addColorStop(0.45, '#78aee8')
  g.addColorStop(0.72, '#b9d8f3')
  g.addColorStop(1, '#e6f2ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Soft cloud blobs.
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * w
    const y = Math.random() * (h * 0.62)
    const rx = 120 + Math.random() * 260
    const ry = 40 + Math.random() * 110
    const alpha = 0.05 + Math.random() * 0.12
    const cg = ctx.createRadialGradient(x, y, 8, x, y, rx)
    cg.addColorStop(0, `rgba(255,255,255,${(alpha * 1.35).toFixed(3)})`)
    cg.addColorStop(0.5, `rgba(255,255,255,${alpha.toFixed(3)})`)
    cg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fine grain to avoid flat color banding.
  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 5
    img.data[i] = clamp255(img.data[i] + n)
    img.data[i + 1] = clamp255(img.data[i + 1] + n)
    img.data[i + 2] = clamp255(img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createProceduralDoorTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  const wood = ctx.createLinearGradient(0, 0, size, size)
  wood.addColorStop(0, '#c79b69')
  wood.addColorStop(0.4, '#b48049')
  wood.addColorStop(0.7, '#8d5b33')
  wood.addColorStop(1, '#6b3e21')
  ctx.fillStyle = wood
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 110; i++) {
    const x = (i / 110) * size
    const alpha = 0.04 + Math.random() * 0.11
    const g = 45 + Math.floor(Math.random() * 50)
    ctx.strokeStyle = `rgba(${g}, ${g * 0.85}, ${g * 0.55}, ${alpha.toFixed(3)})`
    ctx.lineWidth = 1 + Math.random() * 1.3
    const bend = (Math.random() - 0.5) * 18
    ctx.beginPath()
    ctx.moveTo(x + bend * 0.25, 0)
    ctx.bezierCurveTo(x - bend, size * 0.28, x + bend, size * 0.7, x - bend * 0.2, size)
    ctx.stroke()
  }

  const panelX = 56
  const panelW = size - panelX * 2
  const panelH = (size - 150) / 2
  const drawPanel = (y: number) => {
    const grad = ctx.createLinearGradient(0, y, 0, y + panelH)
    grad.addColorStop(0, 'rgba(255,255,255,0.14)')
    grad.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = grad
    ctx.fillRect(panelX, y, panelW, panelH)
    ctx.strokeStyle = 'rgba(40,24,12,0.45)'
    ctx.lineWidth = 7
    ctx.strokeRect(panelX, y, panelW, panelH)
  }
  drawPanel(54)
  drawPanel(54 + panelH + 44)

  ctx.strokeStyle = 'rgba(25,15,8,0.28)'
  ctx.lineWidth = 10
  ctx.strokeRect(20, 20, size - 40, size - 40)

  const hx = size - 88
  const hy = size / 2 + 18
  ctx.fillStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.roundRect(hx, hy, 20, 10, 3)
  ctx.fill()
  ctx.fillStyle = '#9ca3af'
  ctx.beginPath()
  ctx.arc(hx + 2, hy + 5, 4.5, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createProceduralWindowTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  const glass = ctx.createLinearGradient(0, 0, size, size)
  glass.addColorStop(0, '#eef8ff')
  glass.addColorStop(0.5, '#d8efff')
  glass.addColorStop(1, '#a8d6ff')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 12
  ctx.strokeRect(10, 10, size - 20, size - 20)
  ctx.strokeStyle = 'rgba(125,175,220,0.35)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(size / 2, 16)
  ctx.lineTo(size / 2, size - 16)
  ctx.moveTo(16, size / 2)
  ctx.lineTo(size - 16, size / 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function clamp255(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function Player() {
  const { camera, gl } = useThree()
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    sprint: false,
    up: false,
    down: false,
  })
  const yawOnlyForward = useRef(new THREE.Vector3())
  const rightVec = useRef(new THREE.Vector3())
  const dir = useRef(new THREE.Vector3())
  const lookActive = useRef(false)
  const hasFocus = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0)

  const resetKeys = () => {
    keys.current.w = false
    keys.current.a = false
    keys.current.s = false
    keys.current.d = false
    keys.current.sprint = false
    keys.current.up = false
    keys.current.down = false
  }

  useEffect(() => {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(camera.quaternion)
    yaw.current = euler.y
    pitch.current = euler.x
  }, [camera])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.tabIndex = 0

    const onGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (!canvas.contains(target)) {
        hasFocus.current = false
        lookActive.current = false
        resetKeys()
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        hasFocus.current = true
        canvas.focus()
        lookActive.current = true
      }
      if (e.button === 0 || e.button === 2) {
        e.preventDefault()
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        const leftPressed = (e.buttons & 1) !== 0
        const rightPressed = (e.buttons & 2) !== 0
        lookActive.current = leftPressed || rightPressed
      }
    }

    const onMouseLeave = () => {
      lookActive.current = false
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!lookActive.current) return
      if ((e.buttons & 1) === 0 && (e.buttons & 2) === 0) {
        lookActive.current = false
        return
      }
      const sensitivity = 0.0024
      yaw.current -= e.movementX * sensitivity
      pitch.current -= e.movementY * sensitivity
      pitch.current = clamp(pitch.current, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02)
    }

    window.addEventListener('mousedown', onGlobalMouseDown, true)
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('mousedown', onGlobalMouseDown, true)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl])

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasFocus.current) return
      if (isInteractiveTarget(e.target)) return

      if (e.code === 'KeyW') keys.current.w = true
      if (e.code === 'KeyA') keys.current.a = true
      if (e.code === 'KeyS') keys.current.s = true
      if (e.code === 'KeyD') keys.current.d = true
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.current.sprint = true
      if (e.code === 'Space') keys.current.up = true
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.down = true

      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'Space' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'ControlLeft' ||
        e.code === 'ControlRight'
      ) {
        e.preventDefault()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.w = false
      if (e.code === 'KeyA') keys.current.a = false
      if (e.code === 'KeyS') keys.current.s = false
      if (e.code === 'KeyD') keys.current.d = false
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.current.sprint = false
      if (e.code === 'Space') keys.current.up = false
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.down = false
    }

    const onBlur = () => resetKeys()
    const onVisibility = () => {
      if (document.hidden) resetKeys()
    }
    const onWindowBlur = () => {
      resetKeys()
      lookActive.current = false
      hasFocus.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  useFrame((_, dt) => {
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))

    if (!hasFocus.current) return

    const moveSpeed = keys.current.sprint ? 9 : 5.6
    const flySpeed = keys.current.sprint ? 8 : 4.8

    // Build move direction (camera yaw only)
    yawOnlyForward.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
    yawOnlyForward.current.y = 0
    if (yawOnlyForward.current.lengthSq() > 0) yawOnlyForward.current.normalize()

    rightVec.current.crossVectors(yawOnlyForward.current, new THREE.Vector3(0, 1, 0)).normalize()
    dir.current.set(0, 0, 0)
    if (keys.current.w) dir.current.add(yawOnlyForward.current)
    if (keys.current.s) dir.current.sub(yawOnlyForward.current)
    if (keys.current.d) dir.current.add(rightVec.current)
    if (keys.current.a) dir.current.sub(rightVec.current)
    if (dir.current.lengthSq() > 0) dir.current.normalize()

    camera.position.x += dir.current.x * moveSpeed * dt
    camera.position.z += dir.current.z * moveSpeed * dt

    // Vertical fly
    const vdir = (keys.current.up ? 1 : 0) + (keys.current.down ? -1 : 0)
    camera.position.y += vdir * flySpeed * dt
    camera.position.y = clamp(camera.position.y, 0.2, 80)
  })

  return null
}

function Export3dHook() {
  const { gl, scene, camera } = useThree()
  
  useEffect(() => {
    const exportPng = async () => {
      try {
        return new Promise<string | null>((resolve) => {
          requestAnimationFrame(() => {
            try {
              const size = gl.getSize(new THREE.Vector2())
              const prevPixelRatio = gl.getPixelRatio()
              const targetPixelRatio = Math.max(prevPixelRatio, 2.5)

              // Supersampled render for sharper export image.
              gl.setPixelRatio(targetPixelRatio)
              gl.setSize(size.x, size.y, false)
              gl.render(scene, camera)

              // One extra frame to ensure all buffers are fully updated.
              requestAnimationFrame(() => {
                try {
                  const canvas = gl.domElement as HTMLCanvasElement
                  const dataUrl = canvas.toDataURL('image/png')

                  // Restore renderer settings after capture.
                  gl.setPixelRatio(prevPixelRatio)
                  gl.setSize(size.x, size.y, false)
                  gl.render(scene, camera)

                  resolve(dataUrl)
                } catch (err) {
                  console.error('toDataURL error:', err)
                  gl.setPixelRatio(prevPixelRatio)
                  gl.setSize(size.x, size.y, false)
                  resolve(null)
                }
              })
            } catch (err) {
              console.error('Export render error:', err)
              resolve(null)
            }
          })
        })
      } catch (err) {
        console.error('Export async error:', err)
        return null
      }
    }
    ;(window as any).__plan3d_exportPng = exportPng
    
    return () => {
      try {
        delete (window as any).__plan3d_exportPng
      } catch {
        ;(window as any).__plan3d_exportPng = undefined
      }
    }
  }, [gl, scene, camera])
  
  return null
}
