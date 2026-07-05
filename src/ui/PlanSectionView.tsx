import React, { useEffect, useMemo } from 'react'
import { usePlanStore } from '../world/planStore'

interface Props {
  lightMode: boolean
  lang: 'en' | 'hu'
}

export const PlanSectionView: React.FC<Props> = ({ lightMode, lang }) => {
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
    ;(window as any).__plan_section_exportPng = exportPng
    return () => {
      try {
        delete (window as any).__plan_section_exportPng
      } catch {
        ;(window as any).__plan_section_exportPng = undefined
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

    // Calculate bounding box of all walls
    let minY = Infinity,
      maxY = -Infinity

    walls.forEach((wall) => {
      minY = Math.min(minY, wall.a.y, wall.b.y)
      maxY = Math.max(maxY, wall.a.y, wall.b.y)
    })

    if (!isFinite(minY) || minY === maxY) {
      // No valid walls
      ctx.fillStyle = textColor
      ctx.font = '14px monospace'
      ctx.fillText(lang === 'en' ? 'No walls drawn' : 'Nincs fal megrajzolva', w / 2 - 50, h / 2)
      return
    }

    const planDepth = maxY - minY

    const pad = 40
    const scaleY = (h - 2 * pad) / (wallHeightM + 2)
    const drawW = w - 2 * pad
    const scaleX = drawW / Math.max(planDepth, 1)

    // Draw ground line (floor)
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pad, h - pad)
    ctx.lineTo(w - pad, h - pad)
    ctx.stroke()

    // Draw floor slab
    ctx.strokeStyle = '#8B8B8B'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(pad, h - pad - 2)
    ctx.lineTo(w - pad, h - pad - 2)
    ctx.stroke()

    // Draw walls along the section (front to back)
    ctx.fillStyle = 'rgba(120, 120, 120, 0.2)'
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1

    walls.forEach((wall) => {
      const wallCenterY = (wall.a.y + wall.b.y) / 2
      const xPos = pad + (wallCenterY - minY) * scaleX
      const wallTop = h - pad - wallHeightM * scaleY

      // Draw wall section
      ctx.fillRect(xPos - wallThicknessM * scaleX * 0.5, wallTop, wallThicknessM * scaleX, wallHeightM * scaleY)
      ctx.strokeRect(xPos - wallThicknessM * scaleX * 0.5, wallTop, wallThicknessM * scaleX, wallHeightM * scaleY)

      // Draw openings in this wall
      const wallOpenings = openings.filter((o) => o.wallId === wall.id)
      wallOpenings.forEach((opening) => {
        const openW = opening.widthM * scaleX
        const openH = opening.heightM * scaleY
        const openTop = wallTop + (wallHeightM - opening.sillM - opening.heightM) * scaleY

        ctx.fillStyle = 'rgba(100, 150, 200, 0.3)'
        ctx.fillRect(xPos - openW / 2, openTop, openW, openH)

        ctx.strokeStyle = opening.type === 'door' ? '#ff6b6b' : '#4ecdc4'
        ctx.lineWidth = 2
        ctx.strokeRect(xPos - openW / 2, openTop, openW, openH)
      })
    })

    // Draw roof profile
    const roofH = 2.5
    const roofWallTop = h - pad - wallHeightM * scaleY

    ctx.strokeStyle = '#d9534f'
    ctx.lineWidth = 2
    ctx.fillStyle = 'rgba(217, 83, 79, 0.05)'

    ctx.beginPath()
    ctx.moveTo(pad, roofWallTop)
    ctx.lineTo((pad + w - pad) / 2, roofWallTop - roofH * scaleY)
    ctx.lineTo(w - pad, roofWallTop)
    ctx.lineTo(w - pad, roofWallTop + wallHeightM * scaleY)
    ctx.lineTo(pad, roofWallTop + wallHeightM * scaleY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Draw height dimension
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.font = '12px monospace'

    const dimX = pad - 20
    ctx.beginPath()
    ctx.moveTo(dimX, h - pad)
    ctx.lineTo(dimX, roofWallTop)
    ctx.stroke()

    // Dimension arrows
    ctx.beginPath()
    ctx.moveTo(dimX - 3, h - pad - 5)
    ctx.lineTo(dimX, h - pad)
    ctx.lineTo(dimX + 3, h - pad - 5)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(dimX - 3, roofWallTop + 5)
    ctx.lineTo(dimX, roofWallTop)
    ctx.lineTo(dimX + 3, roofWallTop + 5)
    ctx.stroke()

    // Height dimension text
    const heightText = `${wallHeightM.toFixed(2)} m`
    const textMetrics = ctx.measureText(heightText)
    ctx.fillStyle = textColor
    ctx.fillText(heightText, dimX - textMetrics.width - 10, (h - pad + roofWallTop) / 2)

    // Title
    ctx.font = 'bold 16px monospace'
    ctx.fillText(lang === 'en' ? 'Section (Cross-Cut)' : 'Metszet (Keresztmetszet)', pad, 30)

    ctx.font = '11px monospace'
    ctx.fillStyle = 'rgba(100, 100, 100, 0.6)'
    ctx.fillText(lang === 'en' ? 'Building profile with roof' : 'Épület profil tetővel', pad, h - 8)
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
