import { useEffect, useMemo, useRef, useState } from 'react'
import type { Opening, OpeningType, RoomLabel, RoomType, Vec2, WallKind, WallSegment } from '../world/planStore'
import { usePlanStore } from '../world/planStore'
import type { ToolMode } from './App'
import { computeBuildingFootprintBox } from '../world/footprintArea'

type UiLang = 'hu' | 'en'

type View = { zoom: number; pan: Vec2 } // pan in screen px

const GRID_M = 0.25
const ENDPOINT_SNAP_M = 0.18
const WALLBODY_SNAP_M = 0.14
const MIN_WALL_WARN_M = 0.3
const WALL_HIT_M = 0.12
const DANGLING_CONNECT_TOL_M = 0.08
const DANGLING_INTERIOR_T_EPS = 0.03
const OPENING_STRETCH_MIN_DOOR_M = 0.7
const OPENING_STRETCH_MAX_DOOR_M = 1.4
const OPENING_STRETCH_MIN_WINDOW_M = 0.4
const OPENING_STRETCH_MAX_WINDOW_M = 4.0

const PLAN2D_TEXT = {
  hu: {
    areaTitle: 'A falvégpontok legkisebb befoglaló téglalapja: szélesség × hosszúság = négyzetméter (L-alaknál a téglalap nagyobb, mint a valódi alapterület).',
    area: 'Alapterület', wall: 'Fal', door: 'Ajtó', window: 'Ablak', room: 'Helyiség', label: 'Felirat', errors: 'Hibák', more: 'további',
    type: 'Típus', roomHelp: '(katt a tervre: lerakás, katt a feliratra: törlés)', customLabel: 'Saját felirat', textHelp: '(katt a tervre: lerakás)',
    opening: 'Nyílászáró', width: 'Szél', height: 'Mag', sill: 'Parapet', close: 'Bezár', delete: 'Törlés', openingHelp: '(kattints egy ajtóra/ablakra a szerkesztéshez, Shift+katt: törlés)',
    leftClick: 'Bal klikk', wallHelp: 'fal pontok lerakása (falról is lehet kezdeni)', roomPlace: 'helyiség felirat lerakása', textPlace: 'saját felirat lerakása',
    placeThen: 'lerakása, majd', drag: 'húzás', toResize: 'méretezéshez', fastResizeHelp: '(később: katt+ húzás a nyílászárón = gyors méretezés)',
    selectedWall: 'Kijelölt fal', loadBearing: 'Teherhordó', partition: 'Válaszfal', thickness: 'Vastagság', rightClickDrag: 'Jobb klikk + húzás', pan: 'pásztázás',
    wheel: 'Görgő', zoom: 'zoom', finish: 'befejezés', click: 'katt', select: 'kijelölés',
  },
  en: {
    areaTitle: 'Smallest bounding rectangle of the wall endpoints: width × length = square meters (for L-shapes this rectangle is larger than the real floor area).',
    area: 'Area', wall: 'Wall', door: 'Door', window: 'Window', room: 'Room', label: 'Label', errors: 'Errors', more: 'more',
    type: 'Type', roomHelp: '(click on the plan: place, click on the label: delete)', customLabel: 'Custom label', textHelp: '(click on the plan: place)',
    opening: 'Opening', width: 'Width', height: 'Height', sill: 'Sill', close: 'Close', delete: 'Delete', openingHelp: '(click a door/window to edit it, Shift+click: delete)',
    leftClick: 'Left click', wallHelp: 'place wall points (can also start from an existing wall)', roomPlace: 'place room label', textPlace: 'place custom label',
    placeThen: 'place, then', drag: 'drag', toResize: 'to resize', fastResizeHelp: '(later: click+drag on the opening = quick resize)',
    selectedWall: 'Selected wall', loadBearing: 'Load-bearing', partition: 'Partition', thickness: 'Thickness', rightClickDrag: 'Right click + drag', pan: 'pan',
    wheel: 'Wheel', zoom: 'zoom', finish: 'finish', click: 'click', select: 'select',
  },
} as const

export function Plan2DEditor({
  tool,
  onToolChange,
  lightMode = false,
  lang = 'hu',
  readOnly = false,
}: {
  tool: ToolMode
  onToolChange: (t: ToolMode) => void
  lightMode?: boolean
  lang?: UiLang
  readOnly?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const {
    walls,
    openings,
    roomLabels,
    addWall,
    addOpening,
    updateOpening,
    removeOpening,
    removeWall,
    updateWall,
    addRoomLabel,
    removeRoomLabel,
    wallThicknessM,
  } = usePlanStore()

  const [view, setView] = useState<View>({ zoom: 60, pan: { x: 0, y: 0 } }) // px per meter
  const [drawing, setDrawing] = useState<null | { startM: Vec2; endM: Vec2 }>(null)
  const [panning, setPanning] = useState<null | { startPx: Vec2; startPan: Vec2 }>(null)
  const [hoverOpeningId, setHoverOpeningId] = useState<string | null>(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [stretchOpeningId, setStretchOpeningId] = useState<string | null>(null)
  const [hoverWallId, setHoverWallId] = useState<string | null>(null)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [roomType, setRoomType] = useState<RoomType>('konyha')
  const [customRoomText, setCustomRoomText] = useState('Egyedi felirat')
  const [hoverRoomId, setHoverRoomId] = useState<string | null>(null)
  const [cursorWorldM, setCursorWorldM] = useState<Vec2>({ x: 0, y: 0 })

  const dpr = useMemo(() => Math.max(1, Math.min(2, window.devicePixelRatio || 1)), [])
  const wallIssues = useMemo(() => validateWalls(walls, MIN_WALL_WARN_M), [walls])
  const weakWallIds = useMemo(
    () => new Set(wallIssues.filter((i) => i.kind === 'short_wall').map((i) => i.wallId)),
    [wallIssues],
  )
  const footprintBox = useMemo(() => computeBuildingFootprintBox(walls), [walls])
  const fmtM = (n: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 }).format(n)
  const tt = PLAN2D_TEXT[lang]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvas)
    draw()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    walls,
    openings,
    roomLabels,
    view,
    drawing,
    hoverOpeningId,
    hoverRoomId,
    roomType,
    selectedOpeningId,
    hoverWallId,
    selectedWallId,
    stretchOpeningId,
    lightMode,
    lang,
    cursorWorldM,
  ])

  function screenToWorldM(p: Vec2): Vec2 {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const cx = rect.width / 2 + view.pan.x
    const cy = rect.height / 2 + view.pan.y
    const x = (p.x - rect.left - cx) / view.zoom
    const y = -((p.y - rect.top - cy) / view.zoom)
    return { x, y }
  }

  function worldMToScreen(p: Vec2): Vec2 {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const cx = rect.width / 2 + view.pan.x
    const cy = rect.height / 2 + view.pan.y
    const x = cx + p.x * view.zoom
    const y = cy - p.y * view.zoom
    return { x, y }
  }

  function snapM(p: Vec2): Vec2 {
    return { x: snap(p.x, GRID_M), y: snap(p.y, GRID_M) }
  }

  function snapToExistingEndpoint(p: Vec2): Vec2 {
    let best: null | { p: Vec2; d: number } = null
    for (const w of walls) {
      const dA = dist(p, w.a)
      if (dA <= ENDPOINT_SNAP_M && (!best || dA < best.d)) best = { p: w.a, d: dA }
      const dB = dist(p, w.b)
      if (dB <= ENDPOINT_SNAP_M && (!best || dB < best.d)) best = { p: w.b, d: dB }
    }
    return best ? best.p : p
  }

  function snapPoint(p: Vec2): { p: Vec2; splitWallId: string | null } {
    const g = snapM(p)
    const ep = snapToExistingEndpoint(g)
    if (ep !== g) return { p: ep, splitWallId: null }

    // snap to wall body (T-junction)
    const hit = nearestWallHit(walls, g, WALLBODY_SNAP_M)
    if (!hit) return { p: g, splitWallId: null }
    if (hit.t <= 0.02 || hit.t >= 0.98) return { p: hit.point, splitWallId: null }
    return { p: hit.point, splitWallId: hit.wall.id }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, rect.width, rect.height)

    // Background
    ctx.fillStyle = lightMode ? '#ffffff' : '#0b1220'
    ctx.fillRect(0, 0, rect.width, rect.height)

    drawGrid(ctx, rect.width, rect.height, view, lightMode)
    drawAxes(ctx, rect.width, rect.height, view, lightMode)

    // Existing walls
    for (const w of walls) {
      drawWall(
        ctx,
        w,
        worldMToScreen,
        false,
        w.id === hoverWallId,
        w.id === selectedWallId,
        weakWallIds.has(w.id),
      )
      drawWallLength(ctx, w, worldMToScreen)
    }

    // Wall issues (dangling endpoints)
    drawWallIssues(ctx, walls, wallIssues, worldMToScreen, lang)

    // Openings
    for (const o of openings) {
      const wall = walls.find((w) => w.id === o.wallId)
      if (!wall) continue
      drawOpening(ctx, wall, o, worldMToScreen, o.id === hoverOpeningId, o.id === selectedOpeningId)
    }

    // Room labels
    for (const r of roomLabels) {
      drawRoomLabel(ctx, r, worldMToScreen, r.id === hoverRoomId, lang)
    }

    // Preview wall
    if (drawing) {
      const ghost: WallSegment = {
        id: 'ghost',
        a: drawing.startM,
        b: drawing.endM,
        kind: wallThicknessM >= 0.25 ? 'load_bearing' : 'partition',
        thicknessM: wallThicknessM,
      }
      drawWall(ctx, ghost, worldMToScreen, true, false, false)

      const a = drawing.startM
      const b = drawing.endM
      const len = dist(a, b)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const midPx = worldMToScreen(mid)

      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${len.toFixed(2)} m`, midPx.x, midPx.y - 8)
    }
  }

  function exportPng(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    try {
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const isRight = e.button === 2
    if (isRight) {
      e.preventDefault()
      if (drawing) {
        setDrawing(null)
      } else {
        setPanning({
          startPx: { x: e.clientX, y: e.clientY },
          startPan: view.pan,
        })
      }
      return
    }

    const rawPM = screenToWorldM({ x: e.clientX, y: e.clientY })
    const pM = tool === 'wall' ? snapPoint(rawPM).p : rawPM
    if (readOnly) return
    if (tool === 'wall') {
      // If we're NOT currently drawing a wall:
      // - Shift + click on wall: delete
      // - Ctrl + click on wall: select
      // - plain click on wall: start drawing from that point
      if (!drawing && hoverWallId) {
        if (e.shiftKey) {
          removeWall(hoverWallId)
          if (selectedWallId === hoverWallId) setSelectedWallId(null)
          return
        }
        if (e.ctrlKey || e.metaKey) {
          setSelectedWallId(hoverWallId)
          return
        }
        // start drawing from wall (including wall body snap / split)
        setSelectedWallId(null)
        setDrawing({ startM: pM, endM: pM })
        return
      }

      if (!drawing) {
        setDrawing({ startM: pM, endM: pM })
        return
      }

      const len = dist(drawing.startM, pM)
      if (len < 0.1) return

      addWall({
        a: drawing.startM,
        b: pM,
        thicknessM: wallThicknessM,
        kind: wallThicknessM >= 0.25 ? 'load_bearing' : 'partition',
      })
      setDrawing({ startM: pM, endM: pM })
      return
    }

    // delete hovered item (rooms)
    if (hoverRoomId) {
      removeRoomLabel(hoverRoomId)
      return
    }
    // opening selection (and delete with Shift)
    if (hoverOpeningId) {
      if (e.shiftKey) {
        removeOpening(hoverOpeningId)
      } else {
        setSelectedOpeningId(hoverOpeningId)
        // Easy resize: click + drag on the opening itself
        if (tool === 'door' || tool === 'window') setStretchOpeningId(hoverOpeningId)
      }
      return
    } else {
      setSelectedOpeningId(null)
    }

    if (tool === 'room') {
      addRoomLabel({ type: roomType, pos: pM })
      return
    }

    if (tool === 'text') {
      addRoomLabel({
        type: 'custom',
        pos: pM,
        text: customRoomText.trim() || 'Egyedi felirat',
      })
      return
    }

    // Place opening on nearest wall
    if (tool !== 'door' && tool !== 'window') return
    const hoverWall = hoverWallId ? walls.find((w) => w.id === hoverWallId) : null
    const fallbackHit = nearestWallHit(walls, pM, 0.45)
    const wall = hoverWall ?? fallbackHit?.wall
    if (!wall) return

    const newId = openingId()
    const projected = projectPointToSegment(pM, wall.a, wall.b)
    const opening = defaultOpening(tool, projected.t)
    const len = dist(wall.a, wall.b)
    const edgePadM = 0.04
    const halfWidthM = opening.widthM / 2
    const minT = len > 1e-6 ? (halfWidthM + edgePadM) / len : 0.05
    const maxT = len > 1e-6 ? 1 - minT : 0.95
    const safeT = clamp(opening.t, Math.min(0.49, minT), Math.max(0.51, maxT))

    addOpening({
      id: newId,
      wallId: wall.id,
      type: opening.type,
      t: safeT,
      widthM: opening.widthM,
      sillM: opening.sillM,
      heightM: opening.heightM,
    })
    setSelectedOpeningId(newId)
    setStretchOpeningId(null)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panning) {
      const dx = e.clientX - panning.startPx.x
      const dy = e.clientY - panning.startPx.y
      setView((v) => ({ ...v, pan: { x: panning.startPan.x + dx, y: panning.startPan.y + dy } }))
      return
    }
    const rawPM = screenToWorldM({ x: e.clientX, y: e.clientY })
    setCursorWorldM(rawPM)
    const pM = tool === 'wall' ? snapPoint(rawPM).p : rawPM

    // opening stretch while placing
    if (stretchOpeningId) {
      const o = openings.find((x) => x.id === stretchOpeningId)
      if (o) {
        const wall = walls.find((w) => w.id === o.wallId)
        if (wall) {
          const len = dist(wall.a, wall.b)
          if (len > 1e-6) {
            const cursorT = clamp(projectPointToSegment(pM, wall.a, wall.b).t, 0, 1)
            const delta = Math.abs(cursorT - o.t) * len
            const minW = o.type === 'door' ? OPENING_STRETCH_MIN_DOOR_M : OPENING_STRETCH_MIN_WINDOW_M
            const maxW = o.type === 'door' ? OPENING_STRETCH_MAX_DOOR_M : OPENING_STRETCH_MAX_WINDOW_M
            const maxByWall = Math.max(minW, Math.min(maxW, len * (2 * Math.min(o.t, 1 - o.t)) - 0.04))
            const wM = clamp(2 * delta, minW, maxByWall)
            updateOpening(o.id, { widthM: wM })
          }
        }
      }
    }

    const wh = nearestWallLineHit(walls, pM, WALL_HIT_M)
    setHoverWallId(wh?.wall.id ?? null)

    // hover logic for openings (delete on click)
    const h = nearestOpeningHit(walls, openings, pM, 0.22)
    setHoverOpeningId(h?.opening.id ?? null)

    const rh = nearestRoomHit(roomLabels, pM, 0.28)
    setHoverRoomId(rh?.room.id ?? null)

    if (tool !== 'wall') return
    if (!drawing) return
    setDrawing((d) => (d ? { ...d, endM: pM } : d))
  }

  function onPointerUp() {
    setPanning(null)
    setStretchOpeningId(null)
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.0012)
    setView((v) => ({ ...v, zoom: clamp(v.zoom * factor, 15, 240) }))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (readOnly) return
    if (e.key === 'Escape') setDrawing(null)
    if (e.key === 'Enter') setDrawing(null)
    if (e.key === '1') onToolChange('wall')
    if (e.key === '2') onToolChange('door')
    if (e.key === '3') onToolChange('window')
    if (e.key === '4') onToolChange('room')
    if (e.key === '5') onToolChange('text')
    if (e.key === 'Delete' && selectedOpeningId) {
      removeOpening(selectedOpeningId)
      setSelectedOpeningId(null)
    }
    if (e.key === 'Delete' && selectedWallId) {
      removeWall(selectedWallId)
      setSelectedWallId(null)
    }
  }

  const selectedOpening = selectedOpeningId
    ? openings.find((o) => o.id === selectedOpeningId) ?? null
    : null

  const selectedWall = selectedWallId ? walls.find((w) => w.id === selectedWallId) ?? null : null

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* CAD-szerű fejléc */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: lightMode ? '#f0f0f0' : '#1a2332',
        borderBottom: lightMode ? '1px solid #ccc' : '1px solid #333',
        fontFamily: 'system-ui, monospace',
        fontSize: '11px',
        color: lightMode ? '#1a1a1a' : '#d0d0d0',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div>
            <span style={{ opacity: 0.7 }}>Zoom: </span>
            <strong>{(view.zoom * 100 / 60).toFixed(0)}%</strong>
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>X: </span>
            <strong>{cursorWorldM.x.toFixed(2)}</strong>
            <span style={{ opacity: 0.7, marginLeft: '8px' }}>Y: </span>
            <strong>{cursorWorldM.y.toFixed(2)}</strong>
          </div>
          {selectedWall && (
            <div>
              <span style={{ opacity: 0.7 }}>Fal: </span>
              <strong>{dist(selectedWall.a, selectedWall.b).toFixed(2)} m</strong>
            </div>
          )}
          {selectedOpening && (
            <div>
              <span style={{ opacity: 0.7 }}>Nyílás: </span>
              <strong>{selectedOpening.widthM.toFixed(2)} m</strong>
            </div>
          )}
        </div>
        <div style={{ opacity: 0.6, fontSize: '10px' }}>
          • Rács: 0,25 m • Koordinátarács • Méretháló
        </div>
      </div>
      
      <div className="hint" style={{ flex: '0 0 auto' }}>
        {readOnly && (
          <div className="hint__row">
            <span className="warnBadge">Csak olvashato mod - szerkesztes tiltva</span>
          </div>
        )}
        <div className="hint__row">
          <span
            className="areaPill"
            title={tt.areaTitle}
          >
            {tt.area}: {fmtM(footprintBox.widthM)} × {fmtM(footprintBox.lengthM)} m ={' '}
            <strong>{fmtM(footprintBox.areaM2)} m²</strong>
          </span>
        </div>
        <div className="hint__row">
          <button
            className={`chip ${tool === 'wall' ? 'chip--active' : ''}`}
            onClick={() => !readOnly && onToolChange('wall')}
            disabled={readOnly}
          >
            {tt.wall} (1)
          </button>
          <button
            className={`chip ${tool === 'door' ? 'chip--active' : ''}`}
            onClick={() => !readOnly && onToolChange('door')}
            disabled={readOnly}
          >
            {tt.door} (2)
          </button>
          <button
            className={`chip ${tool === 'window' ? 'chip--active' : ''}`}
            onClick={() => !readOnly && onToolChange('window')}
            disabled={readOnly}
          >
            {tt.window} (3)
          </button>
          <button
            className={`chip ${tool === 'room' ? 'chip--active' : ''}`}
            onClick={() => !readOnly && onToolChange('room')}
            disabled={readOnly}
          >
            {tt.room} (4)
          </button>
          <button
            className={`chip ${tool === 'text' ? 'chip--active' : ''}`}
            onClick={() => !readOnly && onToolChange('text')}
            disabled={readOnly}
          >
            {tt.label} (5)
          </button>
        </div>
        {wallIssues.length > 0 && (
          <div className="hint__row">
            <span className="warnBadge">{tt.errors}</span>
            <div className="warnList">
              {wallIssues.slice(0, 3).map((w) => (
                <span key={w.id} className="warnItem">
                  {translateWallIssueMessage(w.message, lang)}
                </span>
              ))}
              {wallIssues.length > 3 && (
                <span className="warnItem muted">(+{wallIssues.length - 3} {tt.more})</span>
              )}
            </div>
          </div>
        )}
        {tool === 'room' && (
          <div className="hint__row">
            <span className="muted">{tt.type}:</span>
            <select
              className="select"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value as RoomType)}
              disabled={readOnly}
            >
              <option value="konyha">{roomTypeLabel('konyha', lang)}</option>
              <option value="wc">WC</option>
              <option value="furdoszoba">{roomTypeLabel('furdoszoba', lang)}</option>
              <option value="garazs">{roomTypeLabel('garazs', lang)}</option>
              <option value="nappali">{roomTypeLabel('nappali', lang)}</option>
              <option value="haloszoba">{roomTypeLabel('haloszoba', lang)}</option>
              <option value="eloter">{roomTypeLabel('eloter', lang)}</option>
              <option value="kamra">{roomTypeLabel('kamra', lang)}</option>
              <option value="dolgozo">{roomTypeLabel('dolgozo', lang)}</option>
            </select>
            <span className="muted">
              {tt.roomHelp}
            </span>
          </div>
        )}
        {tool === 'text' && (
          <div className="hint__row">
            <span className="muted">{tt.label}:</span>
            <input
              className="text"
              value={customRoomText}
              onChange={(e) => setCustomRoomText(e.target.value)}
              placeholder={tt.customLabel}
              style={{ maxWidth: 260 }}
              disabled={readOnly}
            />
            <span className="muted">{tt.textHelp}</span>
          </div>
        )}
        {(tool === 'door' || tool === 'window') && (
          <div className="hint__row">
            <span className="muted">{tt.opening}:</span>
            {selectedOpening ? (
              <>
                <span className="badge">{selectedOpening.type === 'door' ? tt.door : tt.window}</span>
                <div className="miniField">
                  <label>{tt.width} (m)</label>
                  <input
                    type="number"
                    min={selectedOpening.type === 'door' ? 0.7 : 0.4}
                    max={selectedOpening.type === 'door' ? 1.4 : 4}
                    step={0.01}
                    value={selectedOpening.widthM}
                    onChange={(e) => updateOpening(selectedOpening.id, { widthM: Number(e.target.value) })}
                    disabled={readOnly}
                  />
                </div>
                <div className="miniField">
                  <label>{tt.height} (m)</label>
                  <input
                    type="number"
                    min={selectedOpening.type === 'door' ? 1.9 : 0.3}
                    max={selectedOpening.type === 'door' ? 2.4 : 2.2}
                    step={0.01}
                    value={selectedOpening.heightM}
                    onChange={(e) => updateOpening(selectedOpening.id, { heightM: Number(e.target.value) })}
                    disabled={readOnly}
                  />
                </div>
                <div className="miniField">
                  <label>{tt.sill} (m)</label>
                  <input
                    type="number"
                    min={0.2}
                    max={1.6}
                    step={0.01}
                    value={selectedOpening.sillM}
                    disabled={readOnly || selectedOpening.type === 'door'}
                    onChange={(e) => updateOpening(selectedOpening.id, { sillM: Number(e.target.value) })}
                  />
                </div>
                <button className="btn btn--danger btn--small" onClick={() => setSelectedOpeningId(null)} disabled={readOnly}>
                  {tt.close}
                </button>
                <button
                  className="btn btn--danger btn--small"
                  onClick={() => {
                    removeOpening(selectedOpening.id)
                    setSelectedOpeningId(null)
                  }}
                  disabled={readOnly}
                >
                  {tt.delete}
                </button>
              </>
            ) : (
              <span className="muted">{tt.openingHelp}</span>
            )}
          </div>
        )}
        <div className="hint__row">
          {tool === 'wall' ? (
            <>
              <kbd>{tt.leftClick}</kbd> {tt.wallHelp}
            </>
          ) : tool === 'room' ? (
            <>
              <kbd>{tt.leftClick}</kbd> {tt.roomPlace}
            </>
          ) : tool === 'text' ? (
            <>
              <kbd>{tt.leftClick}</kbd> {tt.textPlace}
            </>
          ) : (
            <>
              <kbd>{tt.leftClick}</kbd> {tool === 'door' ? tt.door : tt.window} {tt.placeThen} <kbd>{tt.drag}</kbd> {tt.toResize}
              <span className="muted">{tt.fastResizeHelp}</span>
            </>
          )}
        </div>
        {tool === 'wall' && selectedWall && (
          <div className="hint__row">
            <span className="muted">{tt.selectedWall}:</span>
            <span className="badge">
              {selectedWall.kind === 'load_bearing' ? tt.loadBearing : tt.partition}
            </span>
            <div className="miniField">
              <label>{tt.type}</label>
              <select
                className="select"
                value={selectedWall.kind}
                onChange={(e) => updateWall(selectedWall.id, { kind: e.target.value as WallKind })}
                disabled={readOnly}
              >
                <option value="load_bearing">{tt.loadBearing}</option>
                <option value="partition">{tt.partition}</option>
              </select>
            </div>
            <div className="miniField">
              <label>{tt.thickness} (m)</label>
              <input
                type="number"
                min={0.05}
                max={0.6}
                step={0.01}
                value={selectedWall.thicknessM}
                onChange={(e) => updateWall(selectedWall.id, { thicknessM: Number(e.target.value) })}
                disabled={readOnly}
              />
            </div>
            <button className="btn btn--danger btn--small" onClick={() => setSelectedWallId(null)} disabled={readOnly}>
              {tt.close}
            </button>
          </div>
        )}
        <div className="hint__row">
          <kbd>{tt.rightClickDrag}</kbd> {tt.pan}
        </div>
        <div className="hint__row">
          <kbd>{tt.wheel}</kbd> {tt.zoom}, <kbd>Esc</kbd> {tt.finish}, <kbd>Shift+{tt.click}</kbd> {tt.wall}: {tt.delete}, <kbd>Ctrl+{tt.click}</kbd>{' '}
          {tt.wall}: {tt.select}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="plan2d"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        tabIndex={0}
        onKeyDown={onKeyDown}
      />
      {/* Expose export via window for now (used by App export buttons). */}
      <ExportHook onExport={exportPng} />
    </div>
  )
}

function ExportHook({ onExport }: { onExport: () => string | null }) {
  useEffect(() => {
    ;(window as any).__plan2d_exportPng = onExport
    return () => {
      try {
        delete (window as any).__plan2d_exportPng
      } catch {
        ;(window as any).__plan2d_exportPng = undefined
      }
    }
  }, [onExport])
  return null
}

function defaultOpening(tool: ToolMode, t: number): {
  type: OpeningType
  t: number
  widthM: number
  sillM: number
  heightM: number
} {
  if (tool === 'door') return { type: 'door', t, widthM: 0.9, sillM: 0, heightM: 2.1 }
  return { type: 'window', t, widthM: 1.2, sillM: 0.9, heightM: 1.2 }
}

function nearestRoomHit(roomLabels: RoomLabel[], p: Vec2, maxDistM: number) {
  let best: null | { room: RoomLabel; dist: number } = null
  for (const r of roomLabels) {
    const d = dist(p, r.pos)
    if (d <= maxDistM && (!best || d < best.dist)) best = { room: r, dist: d }
  }
  return best
}

function nearestWallHit(walls: WallSegment[], p: Vec2, maxDistM: number) {
  let best: null | { wall: WallSegment; t: number; dist: number; point: Vec2 } = null
  for (const w of walls) {
    const hit = projectPointToSegment(p, w.a, w.b)
    const d = dist(p, hit.point)
    if (d <= maxDistM && (!best || d < best.dist)) {
      best = { wall: w, t: hit.t, dist: d, point: hit.point }
    }
  }
  return best
}

function nearestWallLineHit(walls: WallSegment[], p: Vec2, maxDistM: number) {
  let best: null | { wall: WallSegment; dist: number } = null
  for (const w of walls) {
    const hit = projectPointToSegment(p, w.a, w.b)
    const d = dist(p, hit.point)
    if (d <= maxDistM && (!best || d < best.dist)) best = { wall: w, dist: d }
  }
  return best
}

function nearestOpeningHit(walls: WallSegment[], openings: Opening[], p: Vec2, maxDistM: number) {
  let best: null | { opening: Opening; dist: number } = null
  for (const o of openings) {
    const wall = walls.find((w) => w.id === o.wallId)
    if (!wall) continue
    const pos = pointOnSegment(wall.a, wall.b, o.t)
    const d = dist(p, pos)
    if (d <= maxDistM && (!best || d < best.dist)) best = { opening: o, dist: d }
  }
  return best
}

function pointOnSegment(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function projectPointToSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; point: Vec2 } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const denom = abx * abx + aby * aby
  const t = denom < 1e-8 ? 0 : clamp((apx * abx + apy * aby) / denom, 0, 1)
  return { t, point: { x: a.x + abx * t, y: a.y + aby * t } }
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  opening: Pick<Opening, 'id' | 'type' | 't' | 'widthM'>,
  worldToScreen: (v: Vec2) => Vec2,
  hover: boolean,
  selected: boolean,
) {
  const p = pointOnSegment(wall.a, wall.b, opening.t)
  const wallLen = dist(wall.a, wall.b)
  if (wallLen < 1e-6) return
  const dir = { x: (wall.b.x - wall.a.x) / wallLen, y: (wall.b.y - wall.a.y) / wallLen }
  const half = opening.widthM / 2
  const leftM = { x: p.x - dir.x * half, y: p.y - dir.y * half }
  const rightM = { x: p.x + dir.x * half, y: p.y + dir.y * half }

  const c = worldToScreen(p)
  const left = worldToScreen(leftM)
  const right = worldToScreen(rightM)

  ctx.save()
  ctx.lineWidth = selected ? 7 : hover ? 6 : 5
  ctx.lineCap = 'round'
  ctx.strokeStyle =
    opening.type === 'door'
      ? hover
        ? 'rgba(248,113,113,0.95)'
        : 'rgba(248,113,113,0.85)'
      : hover
        ? 'rgba(52,211,153,0.95)'
        : 'rgba(52,211,153,0.85)'
  if (selected) {
    ctx.strokeStyle = opening.type === 'door' ? 'rgba(248,113,113,1)' : 'rgba(52,211,153,1)'
  }
  ctx.beginPath()
  ctx.moveTo(left.x, left.y)
  ctx.lineTo(right.x, right.y)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(c.x, c.y, hover ? 4 : 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, view: View, lightMode = false) {
  const stepPx = view.zoom * GRID_M
  if (stepPx < 8) return

  ctx.save()
  ctx.strokeStyle = lightMode ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1

  const cx = w / 2 + view.pan.x
  const cy = h / 2 + view.pan.y

  const startX = cx % stepPx
  const startY = cy % stepPx

  for (let x = startX; x < w; x += stepPx) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = startY; y < h; y += stepPx) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  
  // Méterjelzések a rácshoz (ha elég nagy a zoom)
  if (view.zoom > 50) {
    const metrStepPx = view.zoom
    const cx = w / 2 + view.pan.x
    const cy = h / 2 + view.pan.y
    const startXmeter = cx % metrStepPx
    const startYmeter = cy % metrStepPx
    
    ctx.fillStyle = lightMode ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.35)'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    // X tengelyen a méterszámok
    for (let x = startXmeter; x < w; x += metrStepPx) {
      const meterX = Math.round((x - cx) / view.zoom * 4) / 4
      if (meterX % 1 === 0 && Math.abs(meterX) < 100) {
        ctx.fillText(Math.floor(meterX).toString(), x + 4, 8)
      }
    }
    
    // Y tengelyen a méterszámok
    for (let y = startYmeter; y < h; y += metrStepPx) {
      const meterY = Math.round((cy - y) / view.zoom * 4) / 4
      if (meterY % 1 === 0 && Math.abs(meterY) < 100) {
        ctx.fillText(Math.floor(meterY).toString(), 8, y + 4)
      }
    }
  }
  
  ctx.restore()
}

function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, view: View, lightMode = false) {
  ctx.save()
  const cx = w / 2 + view.pan.x
  const cy = h / 2 + view.pan.y
  ctx.strokeStyle = lightMode ? 'rgba(15,23,42,0.25)' : 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, h)
  ctx.stroke()
  
  // Tengelycímkék (X, Y)
  ctx.fillStyle = lightMode ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.4)'
  ctx.font = 'bold 13px system-ui'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('X', w - 12, cy - 6)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('Y', cx + 6, 12)
  
  // Tengelyvonalzó jelzések (0, 1, 2, ... metern)
  if (view.zoom > 45) {
    const markerStepPx = view.zoom
    ctx.fillStyle = lightMode ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.25)'
    ctx.font = '10px system-ui'
    
    // X-tengely jelzések
    for (let x = cx % markerStepPx; x < w; x += markerStepPx) {
      ctx.fillRect(x, cy - 3, 1, 6)
      const meterVal = Math.round((x - cx) / view.zoom * 4) / 4
      if (meterVal % 1 === 0 && Math.abs(meterVal) < 100) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(Math.floor(meterVal).toString(), x, cy + 8)
      }
    }
    
    // Y-tengely jelzések
    for (let y = cy % markerStepPx; y < h; y += markerStepPx) {
      ctx.fillRect(cx - 3, y, 6, 1)
      const meterVal = Math.round((cy - y) / view.zoom * 4) / 4
      if (meterVal % 1 === 0 && Math.abs(meterVal) < 100) {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(Math.floor(meterVal).toString(), cx - 8, y)
      }
    }
  }
  
  ctx.restore()
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  worldToScreen: (v: Vec2) => Vec2,
  ghost = false,
  hover = false,
  selected = false,
  weak = false,
) {
  const a = worldToScreen(wall.a)
  const b = worldToScreen(wall.b)

  ctx.save()
  ctx.lineWidth = selected ? 7 : hover ? 6 : ghost ? 2 : 4
  ctx.lineCap = 'round'
  const base = weak
    ? 'rgba(239,68,68,'
    : wall.kind === 'load_bearing'
      ? 'rgba(251,191,36,' // amber
      : 'rgba(96,165,250,' // blue
  ctx.strokeStyle = ghost
    ? `${base}0.7)`
    : selected
      ? `${base}1)`
      : hover
        ? `${base}0.98)`
        : `${base}0.95)`
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.fillStyle = ghost ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.arc(a.x, a.y, 4, 0, Math.PI * 2)
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawWallLength(ctx: CanvasRenderingContext2D, wall: WallSegment, worldToScreen: (v: Vec2) => Vec2) {
  const a = wall.a
  const b = wall.b
  const len = dist(a, b)
  if (len < 0.1) return

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const p = worldToScreen(mid)
  const text = `${len.toFixed(2)} m`

  ctx.save()
  ctx.font = '12px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const padX = 6
  const boxW = metrics.width + padX * 2
  const boxH = 18
  ctx.fillStyle = 'rgba(11,18,32,0.78)'
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  roundRect(ctx, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(text, p.x, p.y + 0.5)
  ctx.restore()
}

function drawRoomLabel(
  ctx: CanvasRenderingContext2D,
  room: RoomLabel,
  worldToScreen: (v: Vec2) => Vec2,
  hover: boolean,
  lang: UiLang = 'hu',
) {
  const p = worldToScreen(room.pos)
  const text = room.type === 'custom' ? room.text || (lang === 'en' ? 'Custom label' : 'Egyedi felirat') : roomTypeLabel(room.type, lang)

  ctx.save()
  ctx.font = '12px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const padX = 8
  const boxW = metrics.width + padX * 2
  const boxH = 20

  ctx.fillStyle = hover ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.08)'
  ctx.strokeStyle = hover ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 1
  roundRect(ctx, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(text, p.x, p.y + 0.5)
  ctx.restore()
}

function roomTypeLabel(t: RoomType, lang: UiLang = 'hu') {
  if (lang === 'en') {
    if (t === 'konyha') return 'Kitchen'
    if (t === 'wc') return 'WC'
    if (t === 'furdoszoba') return 'Bathroom'
    if (t === 'garazs') return 'Garage'
    if (t === 'nappali') return 'Living room'
    if (t === 'haloszoba') return 'Bedroom'
    if (t === 'eloter') return 'Entry hall'
    if (t === 'kamra') return 'Pantry'
    if (t === 'custom') return 'Custom label'
    return 'Study'
  }
  if (t === 'konyha') return 'Konyha'
  if (t === 'wc') return 'WC'
  if (t === 'furdoszoba') return 'Fürdő'
  if (t === 'garazs') return 'Garázs'
  if (t === 'nappali') return 'Nappali'
  if (t === 'haloszoba') return 'Hálószoba'
  if (t === 'eloter') return 'Előtér'
  if (t === 'kamra') return 'Kamra'
  if (t === 'custom') return 'Egyedi felirat'
  return 'Dolgozó'
}

function translateWallIssueMessage(message: string, lang: UiLang) {
  if (lang === 'hu') return message
  if (message.startsWith('Statikailag gyenge fal:')) return message.replace('Statikailag gyenge fal:', 'Structurally weak wall:')
  if (message === 'Lógó falvég (nincs csatlakozás)') return 'Dangling wall end (no connection)'
  return message
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

type WallIssue =
  | { id: string; kind: 'short_wall'; wallId: string; message: string }
  | { id: string; kind: 'dangling_endpoint'; message: string; pos: Vec2 }

function validateWalls(walls: WallSegment[], minLenWarnM: number): WallIssue[] {
  const issues: WallIssue[] = []

  const endpointCount = new Map<string, { pos: Vec2; count: number }>()
  for (const w of walls) {
    const len = dist(w.a, w.b)
    if (len > 0.01 && len < minLenWarnM) {
      issues.push({
        id: `short:${w.id}`,
        kind: 'short_wall',
        wallId: w.id,
        message: `Statikailag gyenge fal: ${len.toFixed(2)} m`,
      })
    }

    for (const p of [w.a, w.b]) {
      const k = endpointKey(p)
      const prev = endpointCount.get(k)
      endpointCount.set(k, prev ? { pos: prev.pos, count: prev.count + 1 } : { pos: p, count: 1 })
    }
  }

  for (const [, v] of endpointCount) {
    if (v.count === 1) {
      if (isEndpointConnectedToWallBody(v.pos, walls, DANGLING_CONNECT_TOL_M, DANGLING_INTERIOR_T_EPS)) {
        continue
      }
      issues.push({
        id: `dangling:${endpointKey(v.pos)}`,
        kind: 'dangling_endpoint',
        pos: v.pos,
        message: 'Lógó falvég (nincs csatlakozás)',
      })
    }
  }

  return issues
}

function endpointKey(p: Vec2) {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`
}

function isEndpointConnectedToWallBody(pos: Vec2, walls: WallSegment[], tolM: number, interiorTEps: number) {
  for (const w of walls) {
    const hit = projectPointToSegment(pos, w.a, w.b)
    if (hit.t <= interiorTEps || hit.t >= 1 - interiorTEps) continue
    if (dist(pos, hit.point) <= tolM) return true
  }
  return false
}

function drawWallIssues(
  ctx: CanvasRenderingContext2D,
  walls: WallSegment[],
  issues: WallIssue[],
  worldToScreen: (v: Vec2) => Vec2,
  lang: UiLang = 'hu',
) {
  if (walls.length === 0) return
  const shortWalls = issues.filter((i) => i.kind === 'short_wall') as Array<Extract<WallIssue, { kind: 'short_wall' }>>
  const dangling = issues.filter((i) => i.kind === 'dangling_endpoint') as Array<
    Extract<WallIssue, { kind: 'dangling_endpoint' }>
  >
  if (dangling.length === 0 && shortWalls.length === 0) return

  ctx.save()
  for (const sw of shortWalls) {
    const wall = walls.find((w) => w.id === sw.wallId)
    if (!wall) continue
    const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }
    const p = worldToScreen(mid)

    ctx.fillStyle = 'rgba(127,29,29,0.85)'
    ctx.strokeStyle = 'rgba(239,68,68,0.95)'
    ctx.lineWidth = 1
    roundRect(ctx, p.x - 94, p.y - 28, 188, 20, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(254,226,226,0.98)'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(lang === 'en' ? 'Structurally weak wall' : 'Statikailag gyenge fal', p.x, p.y - 18)
  }

  for (const d of dangling) {
    const p = worldToScreen(d.pos)
    ctx.fillStyle = 'rgba(248,113,113,0.95)'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(11,18,32,0.8)'
    ctx.strokeStyle = 'rgba(248,113,113,0.9)'
    ctx.lineWidth = 1
    roundRect(ctx, p.x + 10, p.y - 10, 172, 20, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(lang === 'en' ? 'Dangling wall end' : 'Lógó falvég', p.x + 18, p.y)
  }
  ctx.restore()
}

function snap(v: number, step: number) {
  return Math.round(v / step) * step
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function openingId() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
}

