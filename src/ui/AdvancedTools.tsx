import type { Opening, WallSegment } from '../world/planStore'
import { computeBuildingFootprintBox } from '../world/footprintArea'
import type { InsulationSettings, RoofLayerSettings, SunSettings } from '../world/buildingOptions'

type AdvancedToolTab = 'sun' | 'roof' | 'openings' | 'insulation'
type UiLang = 'hu' | 'en'

export function AdvancedTools({
  tab,
  walls,
  openings,
  wallHeightM,
  roof,
  setRoof,
  sun,
  setSun,
  insulation,
  setInsulation,
  lang = 'hu',
}: {
  tab: AdvancedToolTab
  walls: WallSegment[]
  openings: Opening[]
  wallHeightM: number
  roof: RoofLayerSettings
  setRoof: (patch: Partial<RoofLayerSettings>) => void
  sun: SunSettings
  setSun: (patch: Partial<SunSettings>) => void
  insulation: InsulationSettings
  setInsulation: (patch: Partial<InsulationSettings>) => void
  lang?: UiLang
}) {
  if (tab === 'sun') return <SunPanel sun={sun} setSun={setSun} lang={lang} />
  if (tab === 'roof') return <RoofPanel walls={walls} roof={roof} setRoof={setRoof} lang={lang} />
  if (tab === 'openings') return <OpeningsPanel walls={walls} openings={openings} lang={lang} />
  return (
    <InsulationPanel
      walls={walls}
      openings={openings}
      wallHeightM={wallHeightM}
      insulation={insulation}
      setInsulation={setInsulation}
      lang={lang}
    />
  )
}

function SunPanel({
  sun,
  setSun,
  lang,
}: {
  sun: SunSettings
  setSun: (patch: Partial<SunSettings>) => void
  lang: UiLang
}) {
  const altitude = estimateSunAltitudeDeg(sun.hour, sun.month)
  const shadowFactor = altitude <= 1 ? Infinity : 1 / Math.tan((altitude * Math.PI) / 180)
  const quality = altitude < 12 ? (lang === 'en' ? 'long, flat shadow' : 'hosszú, lapos árnyék') : altitude < 35 ? (lang === 'en' ? 'medium shadow' : 'közepes árnyék') : (lang === 'en' ? 'short shadow' : 'rövid árnyék')

  return (
    <div className="modalSection calcModal">
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">{lang === 'en' ? '3D Sun Simulation' : 'Napszak-szimuláció 3D-ben'}</div>
          <div className="rangeField">
            <label>{lang === 'en' ? 'Time' : 'Időpont'}: {sun.hour}:00</label>
            <input
              type="range"
              min={6}
              max={20}
              step={1}
              value={sun.hour}
              onChange={(e) => setSun({ hour: Number(e.target.value) })}
            />
          </div>
          <div className="rangeField">
            <label>{lang === 'en' ? 'Orientation' : 'Tájolás'}: {sun.orientationDeg}°</label>
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={sun.orientationDeg}
              onChange={(e) => setSun({ orientationDeg: Number(e.target.value) })}
            />
          </div>
          <div className="miniField">
            <label>{lang === 'en' ? 'Month' : 'Hónap'}</label>
            <select
              className="select"
              value={sun.month}
              onChange={(e) => setSun({ month: Number(e.target.value) })}
            >
              <option value={1}>{lang === 'en' ? 'January' : 'Január'}</option>
              <option value={3}>{lang === 'en' ? 'March' : 'Március'}</option>
              <option value={6}>{lang === 'en' ? 'June' : 'Június'}</option>
              <option value={9}>{lang === 'en' ? 'September' : 'Szeptember'}</option>
              <option value={12}>December</option>
            </select>
          </div>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={sun.shadows}
              onChange={(e) => setSun({ shadows: e.target.checked })}
            />
            {lang === 'en' ? 'Show shadows in 3D' : 'Árnyékok megjelenítése 3D-ben'}
          </label>
        </div>

        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Shadow and Orientation' : 'Árnyék és tájolás'}</div>
          <div className="kv">
            <div className="k">{lang === 'en' ? 'Estimated sun altitude' : 'Becsült napmagasság'}</div>
            <div className="v">{altitude.toFixed(0)}°</div>
            <div className="k">{lang === 'en' ? 'Shadow type' : 'Árnyék jellege'}</div>
            <div className="v">{quality}</div>
            <div className="k">{lang === 'en' ? 'Shadow of a 1 m object' : '1 m magas elem árnyéka'}</div>
            <div className="v">{Number.isFinite(shadowFactor) ? `${shadowFactor.toFixed(2)} m` : lang === 'en' ? 'very long' : 'nagyon hosszú'}</div>
            <div className="k">{lang === 'en' ? 'Relative to south' : 'Déli tájoláshoz képest'}</div>
            <div className="v">{sun.orientationDeg === 0 ? (lang === 'en' ? 'south' : 'déli') : `${Math.abs(sun.orientationDeg)}° ${lang === 'en' ? 'offset' : 'eltérés'}`}</div>
          </div>
          <div className="muted smallPrint">
            {lang === 'en' ? 'This panel changes sun position, light intensity and shadows in the 3D view.' : 'A 3D nézetben a nap pozíciója, a fényerő és az árnyékok ezzel a panellel változnak.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function RoofPanel({
  walls,
  roof,
  setRoof,
  lang,
}: {
  walls: WallSegment[]
  roof: RoofLayerSettings
  setRoof: (patch: Partial<RoofLayerSettings>) => void
  lang: UiLang
}) {
  const box = computeBuildingFootprintBox(walls)
  const roofCalc = calcRoof(box.widthM, box.lengthM, roof)

  return (
    <div className="modalSection calcModal">
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Roof Designer' : 'Tetőtervező'}</div>
          <div className="miniField">
            <label>{lang === 'en' ? 'Roof type' : 'Tető típusa'}</label>
            <select
              className="select"
              value={roof.type}
              onChange={(e) => setRoof({ type: e.target.value as RoofLayerSettings['type'] })}
            >
              <option value="gable">{lang === 'en' ? 'Gable roof' : 'Nyeregtető'}</option>
              <option value="shed">{lang === 'en' ? 'Shed roof' : 'Félnyeregtető'}</option>
              <option value="flat">{lang === 'en' ? 'Flat roof' : 'Lapostető'}</option>
              <option value="hip">{lang === 'en' ? 'Hip roof' : 'Kontyolt tető'}</option>
              <option value="butterfly">{lang === 'en' ? 'Butterfly roof' : 'Pillangótető'}</option>
            </select>
          </div>
          <div className="row">
            <NumberField label={lang === 'en' ? 'Pitch (°)' : 'Hajlásszög (°)'} value={roof.pitchDeg} min={0} step={1} onChange={(v) => setRoof({ pitchDeg: v })} />
            <NumberField label={lang === 'en' ? 'Eave overhang (m)' : 'Eresz túlnyúlás (m)'} value={roof.overhangM} min={0} step={0.05} onChange={(v) => setRoof({ overhangM: v })} />
            <NumberField label={lang === 'en' ? 'Tiles / m²' : 'Cserép / m²'} value={roof.tilePerM2} min={1} step={0.1} onChange={(v) => setRoof({ tilePerM2: v })} />
            <NumberField label={lang === 'en' ? 'Waste (%)' : 'Ráhagyás (%)'} value={roof.tileWastePct} min={0} step={1} onChange={(v) => setRoof({ tileWastePct: v })} />
            <NumberField label={lang === 'en' ? 'Tile Ft/pc' : 'Cserép Ft/db'} value={roof.tilePriceFt} min={0} step={10} onChange={(v) => setRoof({ tilePriceFt: v })} />
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Roof Area and Tiles' : 'Tetőfelület és cserép'}</div>
          <div className="kv">
            <div className="k">{lang === 'en' ? 'Footprint size' : 'Alaprajzi méret'}</div>
            <div className="v">{fmt(box.widthM)} × {fmt(box.lengthM)} m</div>
            <div className="k">{lang === 'en' ? 'Estimated roof area' : 'Becsült tetőfelület'}</div>
            <div className="v">{fmt(roofCalc.areaM2)} m²</div>
            <div className="k">{lang === 'en' ? 'Tile quantity' : 'Cserép mennyiség'}</div>
            <div className="v">{formatInt(roofCalc.tiles)} db</div>
            <div className="k">{lang === 'en' ? 'Tile cost' : 'Cserép költség'}</div>
            <div className="v">{formatInt(roofCalc.tileCostFt)} Ft</div>
          </div>
          <div className="muted smallPrint">
            {lang === 'en' ? 'The calculation uses the plan bounding rectangle. For complex layouts this is an estimate, but it works well for preliminary material planning.' : 'A számítás a terv befoglaló téglalapjára épül. Összetett alaprajznál ez becslés, de anyag-előkalkulációra használható.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function OpeningsPanel({ walls, openings, lang }: { walls: WallSegment[]; openings: Opening[]; lang: UiLang }) {
  const rows = openings.map((opening) => {
    const wall = walls.find((w) => w.id === opening.wallId)
    const wallLength = wall ? Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y) : 0
    return {
      ...opening,
      wallLength,
      areaM2: opening.widthM * opening.heightM,
      label: opening.type === 'door' ? (lang === 'en' ? 'Door' : 'Ajtó') : (lang === 'en' ? 'Window' : 'Ablak'),
    }
  })
  const doorCount = rows.filter((r) => r.type === 'door').length
  const windowCount = rows.filter((r) => r.type === 'window').length
  const doorArea = rows.filter((r) => r.type === 'door').reduce((s, r) => s + r.areaM2, 0)
  const windowArea = rows.filter((r) => r.type === 'window').reduce((s, r) => s + r.areaM2, 0)
  const estimateFt = doorCount * 120000 + windowArea * 95000

  return (
    <div className="modalSection calcModal">
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Openings Manager' : 'Nyílászáró-kezelő'}</div>
          <div className="kv">
            <div className="k">{lang === 'en' ? 'Doors count' : 'Ajtók darabszáma'}</div>
            <div className="v">{doorCount} db</div>
            <div className="k">{lang === 'en' ? 'Windows count' : 'Ablakok darabszáma'}</div>
            <div className="v">{windowCount} db</div>
            <div className="k">{lang === 'en' ? 'Door area' : 'Ajtó felület'}</div>
            <div className="v">{fmt(doorArea)} m²</div>
            <div className="k">{lang === 'en' ? 'Window area' : 'Ablak felület'}</div>
            <div className="v">{fmt(windowArea)} m²</div>
            <div className="k">{lang === 'en' ? 'Quick cost estimate' : 'Gyors költségbecslés'}</div>
            <div className="v">{formatInt(estimateFt)} Ft</div>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'List' : 'Lista'}</div>
          {rows.length === 0 ? (
            <div className="muted">{lang === 'en' ? 'There are no doors or windows on the plan yet.' : 'Még nincs ajtó vagy ablak a terven.'}</div>
          ) : (
            <div className="tableWrap">
              <table className="costTable">
                <thead>
                  <tr>
                    <th>{lang === 'en' ? 'Type' : 'Típus'}</th>
                    <th>{lang === 'en' ? 'Size' : 'Méret'}</th>
                    <th>{lang === 'en' ? 'Area' : 'Felület'}</th>
                    <th>{lang === 'en' ? 'Wall position' : 'Fal pozíció'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td>{row.label} {i + 1}</td>
                      <td>{fmt(row.widthM)} × {fmt(row.heightM)} m</td>
                      <td className="num">{fmt(row.areaM2)} m²</td>
                      <td className="num">{fmt(row.wallLength * row.t)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InsulationPanel({
  walls,
  openings,
  wallHeightM,
  insulation,
  setInsulation,
  lang,
}: {
  walls: WallSegment[]
  openings: Opening[]
  wallHeightM: number
  insulation: InsulationSettings
  setInsulation: (patch: Partial<InsulationSettings>) => void
  lang: UiLang
}) {
  const box = computeBuildingFootprintBox(walls)
  const wallLength = walls.reduce((sum, wall) => sum + Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y), 0)
  const openingArea = openings.reduce((sum, opening) => sum + opening.widthM * opening.heightM, 0)
  const facadeM2 = Math.max(0, wallLength * wallHeightM - openingArea)
  const atticM2 = box.areaM2
  const facadeBoards = insulation.facadeBoardM2 > 0 ? Math.ceil(facadeM2 / insulation.facadeBoardM2) : 0
  const atticRolls = insulation.atticRollM2 > 0 ? Math.ceil(atticM2 / insulation.atticRollM2) : 0
  const totalFt = facadeM2 * insulation.facadePriceFtPerM2 + atticM2 * insulation.atticPriceFtPerM2

  return (
    <div className="modalSection calcModal">
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Insulation Calculator' : 'Szigetelés kalkulátor'}</div>
          <div className="row">
            <NumberField label={lang === 'en' ? 'Facade thickness (cm)' : 'Homlokzat vast. (cm)'} value={insulation.facadeThicknessCm} min={2} max={30} step={1} onChange={(v) => setInsulation({ facadeThicknessCm: v })} />
            <NumberField label={lang === 'en' ? 'Attic thickness (cm)' : 'Padlás vast. (cm)'} value={insulation.atticThicknessCm} min={5} max={50} step={1} onChange={(v) => setInsulation({ atticThicknessCm: v })} />
            <NumberField label={lang === 'en' ? 'Board m²/pc' : 'Tábla m²/db'} value={insulation.facadeBoardM2} min={0.1} max={2} step={0.01} onChange={(v) => setInsulation({ facadeBoardM2: v })} />
            <NumberField label={lang === 'en' ? 'Roll m²/pc' : 'Tekercs m²/db'} value={insulation.atticRollM2} min={1} max={20} step={0.5} onChange={(v) => setInsulation({ atticRollM2: v })} />
            <NumberField label={lang === 'en' ? 'Facade Ft/m²' : 'Homlokzat Ft/m²'} value={insulation.facadePriceFtPerM2} min={0} max={50000} step={100} onChange={(v) => setInsulation({ facadePriceFtPerM2: v })} />
            <NumberField label={lang === 'en' ? 'Attic Ft/m²' : 'Padlás Ft/m²'} value={insulation.atticPriceFtPerM2} min={0} max={50000} step={100} onChange={(v) => setInsulation({ atticPriceFtPerM2: v })} />
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">{lang === 'en' ? 'Material Requirements' : 'Anyagszükséglet'}</div>
          <div className="kv">
            <div className="k">{lang === 'en' ? 'Facade insulation' : 'Homlokzati szigetelés'}</div>
            <div className="v">{fmt(facadeM2)} m²</div>
            <div className="k">{lang === 'en' ? 'Facade boards' : 'Homlokzati táblák'}</div>
            <div className="v">{formatInt(facadeBoards)} db</div>
            <div className="k">{lang === 'en' ? 'Attic floor insulation' : 'Padlásfödém szigetelés'}</div>
            <div className="v">{fmt(atticM2)} m²</div>
            <div className="k">{lang === 'en' ? 'Attic rolls/boards' : 'Padlás tekercs/tábla'}</div>
            <div className="v">{formatInt(atticRolls)} db</div>
            <div className="k">{lang === 'en' ? 'Estimated cost' : 'Becsült költség'}</div>
            <div className="v">{formatInt(totalFt)} Ft</div>
          </div>
          <div className="muted smallPrint">
            {lang === 'en' ? 'Door and window areas are subtracted from the facade. Attic floor area is based on the bounding footprint.' : 'A homlokzati felületből levonja az ajtók és ablakok felületét. A padlásfödém a befoglaló alapterületből számol.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max?: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div className="miniField">
      <label>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function calcRoof(widthM: number, lengthM: number, roof: RoofLayerSettings) {
  const width = Math.max(0, widthM + roof.overhangM * 2)
  const length = Math.max(0, lengthM + roof.overhangM * 2)
  const pitch = (Math.max(0, roof.pitchDeg) * Math.PI) / 180
  let areaM2 = width * length

  if (roof.type === 'gable') {
    const halfRun = width / 2
    const slopeLength = pitch === 0 ? halfRun : halfRun / Math.cos(pitch)
    areaM2 = slopeLength * length * 2
  }
  if (roof.type === 'shed') {
    areaM2 = pitch === 0 ? width * length : (width / Math.cos(pitch)) * length
  }
  if (roof.type === 'hip') {
    const run = Math.min(width, length) / 2
    const slope = pitch === 0 ? run : run / Math.cos(pitch)
    const perimeter = 2 * (width + length)
    areaM2 = Math.max(width * length, (perimeter * slope) / 2)
  }
  if (roof.type === 'butterfly') {
    const half = width / 2
    const slope = pitch === 0 ? half : half / Math.cos(pitch)
    areaM2 = slope * length * 2
  }

  const tiles = Math.ceil(areaM2 * roof.tilePerM2 * (1 + roof.tileWastePct / 100))
  return { areaM2, tiles, tileCostFt: tiles * roof.tilePriceFt }
}

function estimateSunAltitudeDeg(hour: number, month: number) {
  const noonCurve = month === 6 ? 62 : month === 3 || month === 9 ? 42 : month === 12 ? 18 : 25
  const hourOffset = Math.abs(hour - 12)
  return Math.max(0, noonCurve - hourOffset * 7)
}

function fmt(n: number) {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 }).format(n)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('hu-HU').format(Math.round(n))
}
