import React, { useEffect, useMemo } from 'react'
import { usePlanStore } from '../world/planStore'

interface Props {
  lightMode: boolean
  lang: 'en' | 'hu'
}

export const PlanElevationView: React.FC<Props> = ({ lightMode, lang }) => {
  const walls = usePlanStore((s) => s.walls)
  const openings = usePlanStore((s) => s.openings)
  const { wallHeightM, wallThicknessM } = useMemo(
    () => usePlanStore.getState(),
    []
  )

  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  function exportPng(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    try {
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }

  useEffect(() => {
    ;(window as any).__plan_elevation_exportPng = exportPng
    return () => {
      try {
        delete (window as any).__plan_elevation_exportPng
      } catch {
        ;(window as any).__plan_elevation_exportPng = undefined
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !walls) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const bgColor = lightMode ? '#f5f5f5' : '#1a1a1a'
    const textColor = lightMode ? '#000' : '#ccc'
    const lineColor = lightMode ? '#333' : '#999'

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)

    // Calculate total wall length for scaling
    const totalWallLength = walls.reduce((sum, wall) => {
      const dx = wall.b.x - wall.a.x
      const dy = wall.b.y - wall.a.y
      return sum + Math.sqrt(dx * dx + dy * dy)
    }, 0)

    if (totalWallLength === 0) {
      // No walls - show empty message
      ctx.fillStyle = textColor
      ctx.font = '14px monospace'
      ctx.fillText(lang === 'en' ? 'No walls drawn' : 'Nincs fal megrajzolva', w / 2 - 50, h / 2)
      return
    }

    const pad = 40
    const scaleY = (h - 2 * pad) / (wallHeightM + 1)
    const drawW = w - 2 * pad
    const scaleX = drawW / totalWallLength

    // Draw ground line
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pad, h - pad)
    ctx.lineTo(w - pad, h - pad)
    ctx.stroke()

    // Draw walls with openings
    ctx.fillStyle = 'rgba(120, 120, 120, 0.2)'
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1

    let xPos = pad

    walls.forEach((wall) => {
      const dx = wall.b.x - wall.a.x
      const dy = wall.b.y - wall.a.y
      const wallLen = Math.sqrt(dx * dx + dy * dy)
      const wallX = xPos
      const wallW = wallLen * scaleX
      const wallTop = h - pad - wallHeightM * scaleY

      // Draw wall slab
      ctx.fillRect(wallX, wallTop, wallW, wallHeightM * scaleY)
      ctx.strokeRect(wallX, wallTop, wallW, wallHeightM * scaleY)

      // Draw openings (doors and windows) in this wall
      const wallOpenings = openings.filter((o) => o.wallId === wall.id)
      wallOpenings.forEach((opening) => {
        const openX = wallX + opening.t * wallW
        const openW = opening.widthM * scaleX
        const openH = opening.heightM * scaleY
        const openTop = wallTop + (wallHeightM - opening.sillM - opening.heightM) * scaleY

        // Draw opening
        ctx.fillStyle = 'rgba(100, 150, 200, 0.3)'
        ctx.fillRect(openX, openTop, openW, openH)
        
        // Draw opening border
        ctx.strokeStyle = opening.type === 'door' ? '#ff6b6b' : '#4ecdc4'
        ctx.lineWidth = 2
        ctx.strokeRect(openX, openTop, openW, openH)

        // Label opening type
        ctx.fillStyle = opening.type === 'door' ? '#ff6b6b' : '#4ecdc4'
        ctx.font = '10px monospace'
        const label = opening.type === 'door' ? 'D' : 'W'
        const labelW = ctx.measureText(label).width
        ctx.fillText(label, openX + (openW - labelW) / 2, openTop + openH / 2 + 3)
      })

      // Draw dimension for this wall
      ctx.fillStyle = textColor
      ctx.font = '10px monospace'
      const wallLenText = wallLen.toFixed(2) + 'm'
      const textMetrics = ctx.measureText(wallLenText)
      ctx.fillText(wallLenText, wallX + (wallW - textMetrics.width) / 2, h - pad + 15)

      xPos += wallW
    })

    // Draw height dimension
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.font = '12px monospace'

    const dimX = pad - 20
    ctx.beginPath()
    ctx.moveTo(dimX, h - pad)
    ctx.lineTo(dimX, h - pad - wallHeightM * scaleY)
    ctx.stroke()

    // Dimension arrows
    ctx.beginPath()
    ctx.moveTo(dimX - 3, h - pad - 5)
    ctx.lineTo(dimX, h - pad)
    ctx.lineTo(dimX + 3, h - pad - 5)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(dimX - 3, h - pad - wallHeightM * scaleY + 5)
    ctx.lineTo(dimX, h - pad - wallHeightM * scaleY)
    ctx.lineTo(dimX + 3, h - pad - wallHeightM * scaleY + 5)
    ctx.stroke()

    // Height dimension text
    const heightText = `${wallHeightM.toFixed(2)} m`
    const textMetrics = ctx.measureText(heightText)
    ctx.fillStyle = textColor
    ctx.fillText(heightText, dimX - textMetrics.width - 10, (h - pad + h - pad - wallHeightM * scaleY) / 2)

    // Title
    ctx.font = 'bold 16px monospace'
    ctx.fillText(lang === 'en' ? 'Elevation (Front)' : 'Homlokzat (Elöl)', pad, 30)

    ctx.font = '11px monospace'
    ctx.fillStyle = 'rgba(100, 100, 100, 0.6)'
    ctx.fillText(lang === 'en' ? 'D=Door, W=Window' : 'D=Ajtó, W=Ablak', pad, h - 8)
  }, [walls, openings, lightMode, lang, wallHeightM, wallThicknessM])


  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: lightMode ? '#f5f5f5' : '#1a1a1a' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ flex: 1, objectFit: 'contain', background: lightMode ? '#f5f5f5' : '#1a1a1a' }}
      />
    </div>
  )
}
