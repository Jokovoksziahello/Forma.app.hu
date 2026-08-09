import { useMemo } from 'react'
import { usePlanStore } from '../world/planStore'
import {
  calculateBuildingReport,
  generateMissingDocuments,
  generateRisks,
  generateRecommendations,
} from '../world/buildingReportCalculations'
import { jsPDF } from 'jspdf'

type Lang = 'hu' | 'en'

const REPORT_TEXT = {
  hu: {
    title: 'Épület Terv Dokumentáció',
    subtitle: 'Teljes építési dokumentáció 2026',
    architecture: 'ÉPÍTÉSZETI TERV',
    statics: 'STATIKAI TERV',
    structure: 'SZERKEZETI RÉTEGRENDEK',
    physics: 'ÉPÜLETFIZIKA & ENERGETIKA',
    hvac: 'GÉPÉSZET',
    electrical: 'VILLAMOSSÁG',
    fireProtection: 'TŰZVÉDELEM',
    budget: 'KÖLTSÉGVETÉS',
    summary: 'ÖSSZEGZÉS & AJÁNLÁSOK',
    
    // Feliratok
    groundArea: 'Teljes alapterület',
    usableArea: 'Hasznos alapterület',
    roomCount: 'Helyiségek száma',
    perimeter: 'Kerület',
    wallCount: 'Falak száma',
    openingCount: 'Nyílászárók száma',
    doorCount: 'Ajtók száma',
    windowCount: 'Ablakok száma',
    
    uValueWall: 'U-érték (fal)',
    uValueWindow: 'U-érték (ablak)',
    heatingDemand: 'Fűtési igény',
    coolingDemand: 'Hűtési igény',
    primaryEnergy: 'Primer energia szükséglet',
    co2: 'CO₂ kibocsátás',
    
    heatingPower: 'Fűtési teljesítmény',
    coolingPower: 'Hűtési teljesítmény',
    ventilation: 'Szellőzés légáramkell',
    hotWater: 'Melegvíz igény',
    
    structureReady: 'Szerkezetkész',
    semiFinished: 'Félkész',
    keyReady: 'Kulcsrakész',
    costPerM2: 'Ft/m²',
    
    brickCount: 'Tégla mennyiség',
    cement: 'Cement szükséglet',
    steel: 'Acél szükséglet',
    insulation: 'Szigetelés terület',
    
    missingDocs: 'HIÁNYZÓ DOKUMENTUMOK (PRIORITÁS SZERINTI)',
    staticalRisks: 'STATIKAI KOCKÁZATOK',
    recommendations: 'ENERGETIKAI & SZERKEZETI FEJLESZTÉSI JAVASLATOK',
    
    unit_m2: 'm²',
    unit_m: 'm',
    unit_kWh: 'kWh/m²/év',
    unit_kW: 'kW',
    unit_m3h: 'm³/h',
    unit_l: 'l/nap',
    unit_Wm2K: 'W/m²K',
    unit_kg: 'kg',
    unit_ft: 'Ft',
    
    exportPdf: 'Terv exportálása PDF-be',
  },
  en: {
    title: 'Building Plan Documentation',
    subtitle: 'Complete Building Documentation 2026',
    architecture: 'ARCHITECTURAL PLAN',
    statics: 'STRUCTURAL PLAN',
    structure: 'STRUCTURAL LAYERS',
    physics: 'BUILDING PHYSICS & ENERGY',
    hvac: 'MECHANICAL SYSTEMS',
    electrical: 'ELECTRICAL SYSTEMS',
    fireProtection: 'FIRE PROTECTION',
    budget: 'BUDGET',
    summary: 'SUMMARY & RECOMMENDATIONS',
    
    groundArea: 'Total floor area',
    usableArea: 'Usable floor area',
    roomCount: 'Number of rooms',
    perimeter: 'Perimeter',
    wallCount: 'Number of walls',
    openingCount: 'Number of openings',
    doorCount: 'Number of doors',
    windowCount: 'Number of windows',
    
    uValueWall: 'U-value (wall)',
    uValueWindow: 'U-value (window)',
    heatingDemand: 'Heating demand',
    coolingDemand: 'Cooling demand',
    primaryEnergy: 'Primary energy demand',
    co2: 'CO₂ emissions',
    
    heatingPower: 'Heating power',
    coolingPower: 'Cooling power',
    ventilation: 'Ventilation air flow',
    hotWater: 'Hot water demand',
    
    structureReady: 'Structure complete',
    semiFinished: 'Semi-finished',
    keyReady: 'Key-ready',
    costPerM2: 'Ft/m²',
    
    brickCount: 'Brick quantity',
    cement: 'Cement requirement',
    steel: 'Steel requirement',
    insulation: 'Insulation area',
    
    missingDocs: 'MISSING DOCUMENTS (BY PRIORITY)',
    staticalRisks: 'STRUCTURAL RISKS',
    recommendations: 'ENERGY & STRUCTURAL IMPROVEMENT SUGGESTIONS',
    
    unit_m2: 'm²',
    unit_m: 'm',
    unit_kWh: 'kWh/m²/year',
    unit_kW: 'kW',
    unit_m3h: 'm³/h',
    unit_l: 'l/day',
    unit_Wm2K: 'W/m²K',
    unit_kg: 'kg',
    unit_ft: 'HUF',
    
    exportPdf: 'Export plan to PDF',
  },
} as const

export function BuildingReportPanel({ lang = 'hu', lightMode = false }: { lang?: Lang; lightMode?: boolean }) {
  const { walls, openings, roomLabels } = usePlanStore()
  const wallHeight = 2.7

  const report = useMemo(() => {
    return calculateBuildingReport(walls, openings, wallHeight, roomLabels)
  }, [walls, openings, wallHeight, roomLabels])

  const t = REPORT_TEXT[lang]

  async function exportPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageH = 297
    const left = 14
    const right = 196
    let y = 18

    const sectionColor: [number, number, number] = [25, 92, 156]
    const lineColor: [number, number, number] = [225, 232, 238]
    const mutedColor: [number, number, number] = [110, 120, 130]

    const demoActive = report.groundArea === 0
    const display = {
      groundArea: demoActive ? 120 : report.groundArea,
      usableArea: demoActive ? 95 : report.usableArea,
      perimeter: demoActive ? 44 : report.perimeter,
      roomCount: demoActive ? 5 : report.roomCount,
      wallCount: demoActive ? 4 : report.wallCount,
      openingCount: demoActive ? 14 : report.openingCount,
      doorCount: demoActive ? 8 : report.doorCount,
      windowCount: demoActive ? 6 : report.windowCount,
      loadBearingWalls: demoActive ? 3 : report.loadBearingWalls,
      partitionWalls: demoActive ? 1 : report.partitionWalls,
      totalWallLength: demoActive ? 88 : report.totalWallLength,
      avgWallHeight: demoActive ? 2.7 : report.avgWallHeight,
      uValueWall: demoActive ? 0.32 : report.uValueWall,
      uValueWindow: demoActive ? 1.3 : report.uValueWindow,
      heatingDemand: demoActive ? 85 : report.heatingDemand,
      coolingDemand: demoActive ? 25 : report.coolingDemand,
      primaryEnergy: demoActive ? 120 : report.primaryEnergy,
      co2Emissions: demoActive ? 22.5 : report.co2Emissions,
      heatingPower: demoActive ? 12 : report.heatingPower,
      coolingPower: demoActive ? 6 : report.coolingPower,
      ventilationAirflow: demoActive ? 360 : report.ventilationAirflow,
      hotWaterDemand: demoActive ? 150 : report.hotWaterDemand,
      costPerM2: demoActive ? 650000 : report.costPerM2,
      structureReadyCost: demoActive ? 120 * 0.35 * 650000 : report.structureReadyCost,
      semiFinishedCost: demoActive ? 120 * 0.65 * 650000 : report.semiFinishedCost,
      keyReadyCost: demoActive ? 120 * 650000 : report.keyReadyCost,
      brickCount: demoActive ? 18000 : report.brickCount,
      cementNeeded: demoActive ? 3600 : report.cementNeeded,
      steelNeeded: demoActive ? 7200 : report.steelNeeded,
      insulationArea: demoActive ? 450 : report.insulationArea,
    }

    const ensureSpace = (need: number) => {
      if (y + need > pageH - 16) {
        doc.addPage()
        y = 18
        drawPageHeader(false)
      }
    }

    const drawPageHeader = (cover: boolean) => {
      doc.setDrawColor(...lineColor)
      doc.line(left, 12, right, 12)
      if (cover) {
        doc.setFontSize(21)
        doc.setTextColor(...sectionColor)
        doc.text(t.title, left, 20)
        doc.setFontSize(10)
        doc.setTextColor(...mutedColor)
        const demoNote = demoActive ? (lang === 'en' ? 'No plan drawn yet: preview values are demo data.' : 'Nincs rajzolt terv: az adatok minta (demo) ertekek.') : ''
        doc.text(`${t.subtitle}${demoNote ? ` • ${demoNote}` : ''}`, left, 26)
      } else {
        doc.setFontSize(9)
        doc.setTextColor(...mutedColor)
        doc.text(t.title, left, 9.5)
      }
    }

    const section = (title: string, accent: [number, number, number]) => {
      ensureSpace(14)
      doc.setFillColor(246, 249, 252)
      doc.roundedRect(left, y - 5, right - left, 9, 1.5, 1.5, 'F')
      doc.setFontSize(12)
      doc.setTextColor(...accent)
      doc.text(title, left + 3, y + 1)
      y += 10
    }

    const kvRows = (rows: Array<[string, string]>) => {
      rows.forEach(([k, v]) => {
        ensureSpace(7)
        doc.setFontSize(10)
        doc.setTextColor(33, 37, 41)
        doc.text(k, left + 2, y)
        doc.setTextColor(17, 24, 39)
        doc.text(v, 112, y)
        doc.setDrawColor(...lineColor)
        doc.line(left + 2, y + 1.5, right - 2, y + 1.5)
        y += 6.5
      })
      y += 3
    }

    const bullets = (items: string[], bulletPrefix: string) => {
      items.forEach((item, idx) => {
        const wrapped = doc.splitTextToSize(item, 165)
        wrapped.forEach((line: string, lineIdx: number) => {
          ensureSpace(6)
          doc.setFontSize(10)
          doc.setTextColor(33, 37, 41)
          const prefix = lineIdx === 0 ? `${bulletPrefix}${idx + 1}. ` : '   '
          doc.text(`${prefix}${line}`, left + 2, y)
          y += 5.5
        })
      })
      y += 2
    }

    drawPageHeader(true)
    y = 34

    section(t.architecture, sectionColor)
    kvRows([
      [t.groundArea, `${display.groundArea.toFixed(1)} ${t.unit_m2}`],
      [t.usableArea, `${display.usableArea.toFixed(1)} ${t.unit_m2}`],
      [t.perimeter, `${display.perimeter.toFixed(1)} ${t.unit_m}`],
      [t.roomCount, `${display.roomCount}`],
      [t.wallCount, `${display.wallCount}`],
      [t.openingCount, `${display.openingCount}`],
    ])

    section(t.statics, sectionColor)
    kvRows([
      [t.doorCount, `${display.doorCount}`],
      [t.windowCount, `${display.windowCount}`],
      [lang === 'en' ? 'Load-bearing walls' : 'Teherhordo falak', `${display.loadBearingWalls}`],
      [lang === 'en' ? 'Partition walls' : 'Valaszfalak', `${display.partitionWalls}`],
      [lang === 'en' ? 'Total wall length' : 'Ossz falhossz', `${display.totalWallLength.toFixed(1)} m`],
      [lang === 'en' ? 'Average wall height' : 'Atlag falmagassag', `${display.avgWallHeight.toFixed(2)} m`],
    ])

    section(t.physics, sectionColor)
    kvRows([
      [t.uValueWall, `${display.uValueWall.toFixed(2)} ${t.unit_Wm2K}`],
      [t.uValueWindow, `${display.uValueWindow.toFixed(2)} ${t.unit_Wm2K}`],
      [t.heatingDemand, `${Number.isFinite(display.heatingDemand) ? display.heatingDemand.toFixed(1) : '-'} ${t.unit_kWh}`],
      [t.coolingDemand, `${display.coolingDemand.toFixed(1)} ${t.unit_kWh}`],
      [t.primaryEnergy, `${display.primaryEnergy.toFixed(1)} ${t.unit_kWh}`],
      [t.co2, `${display.co2Emissions.toFixed(1)} kg/m²/ev`],
    ])

    section(t.hvac, sectionColor)
    kvRows([
      [t.heatingPower, `${display.heatingPower.toFixed(2)} ${t.unit_kW}`],
      [t.coolingPower, `${display.coolingPower.toFixed(2)} ${t.unit_kW}`],
      [t.ventilation, `${display.ventilationAirflow.toFixed(0)} ${t.unit_m3h}`],
      [t.hotWater, `${display.hotWaterDemand.toFixed(0)} ${t.unit_l}`],
    ])

    ensureSpace(25)
    if (y > 210) {
      doc.addPage()
      y = 18
      drawPageHeader(false)
    }

    section(t.structure, sectionColor)
    kvRows([
      [lang === 'en' ? 'Exterior wall layer' : 'Kulso fal retegrend', lang === 'en' ? 'plaster + brick + insulation + plaster' : 'vakolat + tegla + hoszigeteles + vakolat'],
      [lang === 'en' ? 'Roof layer' : 'Teto retegrend', lang === 'en' ? 'tile + waterproofing + insulation + slab' : 'cserep + vizszigeteles + hoszigeteles + fodem'],
      [lang === 'en' ? 'Floor layer' : 'Padlo retegrend', lang === 'en' ? 'finish + screed + insulation + slab' : 'burkolat + esztrich + szigeteles + lemez'],
      [lang === 'en' ? 'Estimated wall thickness' : 'Becsult falvastagsag', `${(demoActive ? 0.30 : 0.18).toFixed(2)} m`],
    ])

    section(t.electrical, sectionColor)
    kvRows([
      [lang === 'en' ? 'Main connection' : 'Fobecsatlakozas', '3x25 A'],
      [lang === 'en' ? 'Estimated peak power' : 'Becsult csucsteljesitmeny', `${Math.max(8, Math.round(display.heatingPower + display.coolingPower))} kW`],
      [lang === 'en' ? 'Socket circuits' : 'Dugaljkorok', `${Math.max(6, Math.round(display.roomCount * 1.6))} db`],
      [lang === 'en' ? 'Lighting circuits' : 'Vilagitasi korok', `${Math.max(4, Math.round(display.roomCount * 1.1))} db`],
      [lang === 'en' ? 'Surge protection' : 'Tulfeszultseg vedelem', lang === 'en' ? 'required' : 'szukseges'],
    ])

    section(t.fireProtection, [180, 48, 48])
    kvRows([
      [lang === 'en' ? 'Fire class' : 'Tuvedelmi osztaly', 'AK'],
      [lang === 'en' ? 'Escape routes' : 'Menekulesi utvonalak', lang === 'en' ? 'to be validated on permit plan' : 'engedelyezesi tervben ellenorizendo'],
      [lang === 'en' ? 'Smoke detectors' : 'Fusterzekelok', `${Math.max(4, display.roomCount)} db`],
      [lang === 'en' ? 'Portable extinguishers' : 'Kezituloltok', '2 db'],
      [lang === 'en' ? 'Fire stop at penetrations' : 'Attoresek tuzgatlasa', lang === 'en' ? 'required' : 'szukseges'],
    ])

    doc.addPage()
    y = 18
    drawPageHeader(false)

    section(t.budget, sectionColor)
    kvRows([
      [t.costPerM2, `${display.costPerM2.toLocaleString('hu-HU')} ${t.unit_ft}`],
      [t.structureReady, `${(display.structureReadyCost / 1000000).toFixed(1)} M ${t.unit_ft}`],
      [t.semiFinished, `${(display.semiFinishedCost / 1000000).toFixed(1)} M ${t.unit_ft}`],
      [t.keyReady, `${(display.keyReadyCost / 1000000).toFixed(1)} M ${t.unit_ft}`],
    ])

    section(lang === 'en' ? 'MATERIAL QUANTITIES' : 'ANYAGMENNYISEGEK', sectionColor)
    kvRows([
      [t.brickCount, `${display.brickCount.toLocaleString('hu-HU')} db`],
      [t.cement, `${display.cementNeeded.toLocaleString('hu-HU')} ${t.unit_kg}`],
      [t.steel, `${display.steelNeeded.toLocaleString('hu-HU')} ${t.unit_kg}`],
      [t.insulation, `${display.insulationArea.toFixed(1)} ${t.unit_m2}`],
    ])

    section(t.missingDocs, [180, 120, 40])
    bullets(generateMissingDocuments(), '')

    section(t.staticalRisks, [180, 48, 48])
    bullets(generateRisks(), '')

    section(t.recommendations, [42, 133, 82])
    bullets(generateRecommendations(), '')

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setTextColor(...mutedColor)
      doc.text(`${i}/${totalPages}`, right, pageH - 8, { align: 'right' })
    }

    // Save
    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Epulet-Terv-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: lightMode ? '#ffffff' : '#0b1220',
        color: lightMode ? '#000000' : '#ffffff',
        borderRadius: '8px',
        maxHeight: '600px',
        overflowY: 'auto',
      }}
    >
      <h2>{t.title}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{t.groundArea}</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{report.groundArea} {t.unit_m2}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{t.usableArea}</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{report.usableArea} {t.unit_m2}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{t.heatingDemand}</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{report.heatingDemand} {t.unit_kWh}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{t.costPerM2}</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>
            {(report.costPerM2 / 1000).toFixed(0)}k {t.unit_ft}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: lightMode ? '#e8f5e9' : '#1a3a1a',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{t.structureReady}</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {(report.structureReadyCost / 1000000).toFixed(1)} M
          </div>
        </div>
        <div
          style={{
            padding: '12px',
            backgroundColor: lightMode ? '#fff3e0' : '#3a2a1a',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{t.semiFinished}</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {(report.semiFinishedCost / 1000000).toFixed(1)} M
          </div>
        </div>
        <div
          style={{
            padding: '12px',
            backgroundColor: lightMode ? '#e3f2fd' : '#1a2a3a',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{t.keyReady}</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {(report.keyReadyCost / 1000000).toFixed(1)} M
          </div>
        </div>
      </div>

      <button
        onClick={exportPdf}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        📋 {t.exportPdf}
      </button>
    </div>
  )
}
