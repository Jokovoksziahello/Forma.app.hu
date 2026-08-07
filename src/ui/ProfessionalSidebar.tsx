import type { FloorLayerSettings, RoofLayerSettings } from '../world/buildingOptions'
import type { ToolMode } from './App'

type ViewMode = '2d' | '3d' | 'elevation' | 'section'

type Summary = {
  groundAreaM2: number
  usableAreaM2: number
  wallLengthM: number
  wallVolumeM3: number
  doorCount: number
  windowCount: number
  materialFt: number
  laborFt: number
}

type CostItem = { label: string; valueFt: number; color: string }

export function ProfessionalSidebar({
  mode,
  tool,
  readOnly,
  summary,
  costItems,
  wallHeightM,
  wallThicknessM,
  setWallHeightM,
  setWallThicknessM,
  selectedRoof,
  updateSelectedRoof,
  selectedFloor,
  updateSelectedFloor,
}: {
  mode: ViewMode
  tool: ToolMode
  readOnly: boolean
  summary: Summary
  costItems: CostItem[]
  wallHeightM: number
  wallThicknessM: number
  setWallHeightM: (v: number) => void
  setWallThicknessM: (v: number) => void
  selectedRoof: RoofLayerSettings | undefined
  updateSelectedRoof: (patch: Partial<RoofLayerSettings>) => void
  selectedFloor: FloorLayerSettings | undefined
  updateSelectedFloor: (patch: Partial<FloorLayerSettings>) => void
}) {
  return (
    <aside className="proSidebar">
      <div className="proCard">
        <div className="proCardTitle">Tulajdonsagok</div>
        {readOnly && <div className="muted" style={{ marginBottom: 8 }}>Csak olvashato mod: szerkesztes tiltva.</div>}
        {mode === '2d' && (
          <>
            {tool === 'wall' && (
              <div className="proGrid2">
                <NumberField label="Fal magassag (m)" value={wallHeightM} min={2} max={6} step={0.1} onChange={setWallHeightM} disabled={readOnly} />
                <NumberField label="Fal vastagsag (m)" value={wallThicknessM} min={0.05} max={0.6} step={0.01} onChange={setWallThicknessM} disabled={readOnly} />
              </div>
            )}
            {tool === 'door' && <div className="muted">Ajto mod: kattints ajtora, majd jobb oldali popupban szerkesztheto.</div>}
            {tool === 'window' && <div className="muted">Ablak mod: kattints ablakra, majd jobb oldali popupban szerkesztheto.</div>}
            {tool === 'room' && <div className="muted">Helyiseg mod: cimke alapu szobafelismeres aktiv.</div>}
            {tool === 'text' && <div className="muted">Szoveg mod: egyedi felirat lerakasa a terven.</div>}
          </>
        )}
        {mode === '3d' && (
          <>
            {selectedRoof && (
              <div className="proBlock">
                <div className="proSub">Kivalasztott teto</div>
                <div className="proGrid2">
                  <NumberField label="Hajlas (°)" value={selectedRoof.pitchDeg} min={0} max={60} step={1} onChange={(v) => updateSelectedRoof({ pitchDeg: v })} disabled={readOnly} />
                  <NumberField label="Gerinc mag. (m)" value={selectedRoof.ridgeHeightM} min={0} max={12} step={0.1} onChange={(v) => updateSelectedRoof({ ridgeHeightM: v })} disabled={readOnly} />
                  <NumberField label="Eresz t. (m)" value={selectedRoof.overhangM} min={0} max={3} step={0.05} onChange={(v) => updateSelectedRoof({ overhangM: v })} disabled={readOnly} />
                  <NumberField label="Cserp/m2" value={selectedRoof.tilePerM2} min={1} max={40} step={0.1} onChange={(v) => updateSelectedRoof({ tilePerM2: v })} disabled={readOnly} />
                </div>
              </div>
            )}
            {selectedFloor && (
              <div className="proBlock">
                <div className="proSub">Kivalasztott padlo</div>
                <div className="proGrid2">
                  <NumberField label="Vastagsag (m)" value={selectedFloor.thicknessM} min={0.02} max={0.6} step={0.01} onChange={(v) => updateSelectedFloor({ thicknessM: v })} disabled={readOnly} />
                  <NumberField label="Emeles (m)" value={selectedFloor.offsetYM} min={-1} max={2} step={0.01} onChange={(v) => updateSelectedFloor({ offsetYM: v })} disabled={readOnly} />
                  <NumberField label="Szelesseg x" value={selectedFloor.widthMultiplier} min={0.2} max={3} step={0.05} onChange={(v) => updateSelectedFloor({ widthMultiplier: v })} disabled={readOnly} />
                  <NumberField label="Hosszusag x" value={selectedFloor.lengthMultiplier} min={0.2} max={3} step={0.05} onChange={(v) => updateSelectedFloor({ lengthMultiplier: v })} disabled={readOnly} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="proCard">
        <div className="proCardTitle">Elo projekt osszesito</div>
        <div className="kv">
          <div className="k">Alapterulet</div><div className="v">{summary.groundAreaM2.toFixed(2)} m2</div>
          <div className="k">Hasznos alapterulet</div><div className="v">{summary.usableAreaM2.toFixed(2)} m2</div>
          <div className="k">Falhossz</div><div className="v">{summary.wallLengthM.toFixed(2)} m</div>
          <div className="k">Falterfogat</div><div className="v">{summary.wallVolumeM3.toFixed(2)} m3</div>
          <div className="k">Ajtok / Ablakok</div><div className="v">{summary.doorCount} / {summary.windowCount} db</div>
          <div className="k">Anyagkoltseg</div><div className="v">{fmtFt(summary.materialFt)}</div>
          <div className="k">Munkadij</div><div className="v">{fmtFt(summary.laborFt)}</div>
        </div>
      </div>

      <div className="proCard">
        <div className="proCardTitle">Koltegelemzes</div>
        <CostBars items={costItems} />
      </div>
    </aside>
  )
}

function CostBars({ items }: { items: CostItem[] }) {
  const total = items.reduce((s, i) => s + i.valueFt, 0)
  return (
    <div className="proBars">
      {items.map((item) => {
        const pct = total > 0 ? (item.valueFt / total) * 100 : 0
        return (
          <div key={item.label} className="proBarRow">
            <div className="proBarHead">
              <span>{item.label}</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div className="proBarTrack">
              <div className="proBarFill" style={{ width: `${pct}%`, background: item.color }} />
            </div>
          </div>
        )
      })}
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
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <label className="miniField">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function fmtFt(n: number) {
  return `${new Intl.NumberFormat('hu-HU').format(Math.round(n))} Ft`
}
