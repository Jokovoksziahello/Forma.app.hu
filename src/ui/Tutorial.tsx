import { useState } from 'react'

type UiLang = 'hu' | 'en'

type Step = {
  id: number
  icon: string
  title: string
  text: string
  tip?: string
}

const STEPS: Record<UiLang, Step[]> = {
  hu: [
    { id: 1, icon: '🏗️', title: 'Üdvözlünk a FORMA-ban!', text: 'A FORMA egy profi épülettervező és kalkulátor. Ebben a rövid útmutatóban megmutatjuk a legfontosabb funkciókat.', tip: 'Bármikor újraindíthatod az útmutatót a Súgó gombbal.' },
    { id: 2, icon: '✏️', title: '2D Alaprajz rajzolás', text: 'Az alaprajzon falakat, ajtókat és ablakokat rakhatsz le. Válaszd ki az eszközt a gombokkal, majd kattints a tervre.', tip: 'Jobb klikk + húzás = mozgatás · Görgő = zoom · Ctrl+Z = visszavonás' },
    { id: 3, icon: '🏠', title: '3D nézet', text: 'Nyomd meg a "3D nézet" gombot, hogy sétálj be az épületedbe. Adj hozzá tetőt a "＋ Tetőelem" gombbal.', tip: 'WASD = mozgás · Egér drag = körbenézés · Space = fel · Shift = le' },
    { id: 4, icon: '🧮', title: 'Kalkulátor', text: 'A "Kalkulátor" gomb megnyitja az anyag- és munkadíj-kalkulátort. Minden tétel a rajz alapján számolódik, de felül is írhatod.', tip: 'A munkadíj külön blokk – nem kerül bele az anyag végösszegébe.' },
    { id: 5, icon: '💾', title: 'Mentés és export', text: 'A "Mentés" gomb a böngészőben tárolja a tervet. Exportálhatsz PNG képet, PDF dokumentumot, vagy CSV anyaglistát.', tip: 'A terved neve a bal felső sarokban látható – kattintva átnevezheted.' },
  ],
  en: [
    { id: 1, icon: '🏗️', title: 'Welcome to FORMA!', text: 'FORMA is a professional building planner and calculator. This short guide shows the most important features.', tip: 'You can restart the tutorial anytime from the Help button.' },
    { id: 2, icon: '✏️', title: '2D Floor Plan Drawing', text: 'On the floor plan you can place walls, doors and windows. Pick a tool from the buttons, then click on the plan.', tip: 'Right click + drag = pan · Wheel = zoom · Ctrl+Z = undo' },
    { id: 3, icon: '🏠', title: '3D View', text: 'Press the "3D view" button to walk inside your building. Add a roof with the "+ Roof" button.', tip: 'WASD = move · Mouse drag = look around · Space = up · Shift = down' },
    { id: 4, icon: '🧮', title: 'Calculator', text: 'The "Calculator" button opens the materials and labor calculator. Every item is calculated from the drawing, but you can override values.', tip: 'Labor is shown in a separate block and is not included in the material total.' },
    { id: 5, icon: '💾', title: 'Save and Export', text: 'The "Save" button stores the project in the browser. You can export PNG images, PDF documents, or a CSV materials list.', tip: 'The project name is shown in the top-left corner and can be renamed by clicking it.' },
  ],
}

export function Tutorial({ onClose, lang = 'hu' }: { onClose: () => void; lang?: UiLang }) {
  const [step, setStep] = useState(0)
  const steps = STEPS[lang]
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="tutorialOverlay">
      <div className="tutorialCard">
        <button className="tutorialSkip btn btn--small" onClick={onClose}>
          {lang === 'en' ? 'Skip ✕' : 'Kihagyás ✕'}
        </button>

        <div className="tutorialLogoWrap">
          <img src="/forma-logo.png" alt="FORMA" className="tutorialLogo" />
        </div>

        <div className="tutorialStepIcon">{current.icon}</div>
        <div className="tutorialStepNum">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`tutorialDot${i === step ? ' tutorialDot--active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <h2 className="tutorialTitle">{current.title}</h2>
        <p className="tutorialText">{current.text}</p>

        {current.tip && (
          <div className="tutorialTip">
            <span className="tutorialTipIcon">💡</span>
            {current.tip}
          </div>
        )}

        <div className="tutorialActions">
          <button
            className="btn"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={{ opacity: step === 0 ? 0 : 1 }}
          >
            {lang === 'en' ? '← Back' : '← Vissza'}
          </button>
          <div className="spacer" />
          {isLast ? (
            <button className="btn btn--primary tutorialStartBtn" onClick={onClose}>
              {lang === 'en' ? 'Let\'s start! 🚀' : 'Kezdjük el! 🚀'}
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => setStep(step + 1)}>
              {lang === 'en' ? 'Next →' : 'Következő →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
