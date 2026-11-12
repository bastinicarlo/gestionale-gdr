import { useState, type FormEvent } from 'react'
import { PokemonSheet } from './PokemonSheet'
import {
  attributes,
  createInitialPokemonSheet,
  skills,
  type AttributeKey,
  type PokemonSheetData,
  type SkillKey,
} from './pokerole'
import './App.css'

type RollSource = 'online' | 'physical'

type Roll = {
  id: string
  actor: string
  attribute: string
  skill: string
  faces: number[]
  successes: number
  requiredSuccesses: number
  source: RollSource
  secret: boolean
  revealed: boolean
  createdAt: Date
}

function isAttributeKey(value: string): value is AttributeKey {
  return attributes.some((attribute) => attribute.key === value)
}

function isSkillKey(value: string): value is SkillKey {
  return skills.some((skill) => skill.key === value)
}

function randomInt(max: number) {
  const range = 0x1_0000_0000
  const limit = Math.floor(range / max) * max
  const values = new Uint32Array(1)

  do {
    crypto.getRandomValues(values)
  } while (values[0] >= limit)

  return (values[0] % max) + 1
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function App() {
  const [sheet, setSheet] = useState<PokemonSheetData>(createInitialPokemonSheet)
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeKey>('dexterity')
  const [selectedSkill, setSelectedSkill] = useState<SkillKey>('athletic')
  const [requiredSuccesses, setRequiredSuccesses] = useState(1)
  const [source, setSource] = useState<RollSource>('online')
  const [physicalFaces, setPhysicalFaces] = useState('')
  const [secret, setSecret] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [rolls, setRolls] = useState<Roll[]>([])

  const dicePool =
    sheet.attributes[selectedAttribute] + sheet.skills[selectedSkill]
  const attributeLabel =
    attributes.find((attribute) => attribute.key === selectedAttribute)?.label ??
    'Attributi'
  const skillLabel =
    skills.find((skill) => skill.key === selectedSkill)?.label ?? 'Abilità'

  function handleRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!Number.isInteger(dicePool) || dicePool < 1) {
      setError('La riserva deve contenere almeno un dado: modifica attributo o abilità.')
      return
    }

    if (
      !Number.isInteger(requiredSuccesses) ||
      requiredSuccesses < 1 ||
      requiredSuccesses > 20
    ) {
      setError('Inserisci una difficoltà da 1 a 20 successi.')
      return
    }

    let faces: number[]
    if (source === 'physical') {
      faces = physicalFaces
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number)

      if (
        faces.length !== dicePool ||
        faces.some((face) => !Number.isInteger(face) || face < 1 || face > 6)
      ) {
        setError(`Inserisci ${dicePool} risultati, ciascuno compreso tra 1 e 6.`)
        return
      }
    } else {
      faces = Array.from({ length: dicePool }, () => randomInt(6))
    }

    const roll: Roll = {
      id: crypto.randomUUID(),
      actor: 'Tu · Master',
      attribute: attributeLabel,
      skill: skillLabel,
      faces,
      successes: faces.filter((face) => face >= 4).length,
      requiredSuccesses,
      source,
      secret,
      revealed: !secret,
      createdAt: new Date(),
    }

    setRolls((currentRolls) => [roll, ...currentRolls])
    setPhysicalFaces('')
    setSecret(false)
    setError('')
  }

  function revealRoll(id: string) {
    setRolls((currentRolls) =>
      currentRolls.map((roll) =>
        roll.id === id ? { ...roll, revealed: true } : roll,
      ),
    )
  }

  const latestRoll = rolls[0]

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cronache, pagina iniziale">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 3.5 27 10v12L16 28.5 5 22V10L16 3.5Z" />
              <path d="m16 9 6.5 3.8v6.4L16 23l-6.5-3.8v-6.4L16 9Z" />
              <path d="M16 9v14m6.5-10.2-13 7.4" />
            </svg>
          </span>
          <span>cronache</span>
        </a>

        <div className="topbar-right">
          <span className="prototype-label">
            <span className="status-dot" />
            PROTOTIPO LOCALE
          </span>
          <button className="profile-button" type="button" aria-label="Profilo master">
            <span className="avatar avatar-master">M</span>
          </button>
        </div>
      </header>

      <div className="prototype-notice">
        <span aria-hidden="true">ⓘ</span>
        Anteprima locale: schede e tiri non sono ancora condivisi con gli altri giocatori.
      </div>

      <div className="page-content">
        <section className="session-heading" aria-labelledby="session-title">
          <div className="breadcrumb">
            <span>POKÉROLE</span>
            <span className="breadcrumb-divider">/</span>
            <span>CAMPAGNA DEMO</span>
          </div>
          <div className="heading-row">
            <div>
              <h1 id="session-title">Un viaggio da ricordare</h1>
              <p className="session-subtitle">
                Scheda Pokémon, riserva di dadi e appunti della sessione
              </p>
            </div>
            <div className="room-code">
              <span>CODICE STANZA</span>
              <strong>STANZA-01</strong>
            </div>
          </div>
        </section>

        <PokemonSheet sheet={sheet} onChange={setSheet} />

        <div className="workspace-grid">
          <section className="main-column" aria-label="Tiri e attività della sessione">
            <section className="panel dice-panel" aria-labelledby="dice-title">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">RISERVA DI DADI · D6</div>
                  <h2 id="dice-title">Lancia i dadi</h2>
                </div>
                <span className="turn-chip">
                  <span className="turn-dot" />
                  Master
                </span>
              </div>

              <form onSubmit={handleRoll}>
                <div className="pool-selectors">
                  <label className="select-field">
                    <span>Attributo</span>
                    <select
                      onChange={(event) => {
                        if (isAttributeKey(event.target.value)) {
                          setSelectedAttribute(event.target.value)
                        }
                      }}
                      value={selectedAttribute}
                    >
                      {attributes.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label} · {sheet.attributes[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="pool-plus" aria-hidden="true">+</span>
                  <label className="select-field">
                    <span>Abilità</span>
                    <select
                      onChange={(event) => {
                        if (isSkillKey(event.target.value)) {
                          setSelectedSkill(event.target.value)
                        }
                      }}
                      value={selectedSkill}
                    >
                      {skills.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label} · {sheet.skills[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="pool-total" aria-live="polite">
                    <strong>{dicePool}d6</strong>
                    <span>riserva</span>
                  </div>
                  <label className="difficulty-field">
                    <span>Successi richiesti</span>
                    <input
                      inputMode="numeric"
                      onChange={(event) =>
                        setRequiredSuccesses(Number(event.target.value))
                      }
                      type="number"
                      value={requiredSuccesses}
                    />
                  </label>
                </div>

                <p className="dice-hint">
                  {attributeLabel} + {skillLabel} · ogni risultato da 4 a 6 vale un successo.
                </p>

                <div className="source-row">
                  <fieldset className="source-picker">
                    <legend>Tipo di tiro</legend>
                    <div className="segmented-control">
                      <button
                        aria-pressed={source === 'online'}
                        className={source === 'online' ? 'is-active' : ''}
                        onClick={() => {
                          setSource('online')
                          setError('')
                        }}
                        type="button"
                      >
                        <span aria-hidden="true">✦</span>
                        Digitale
                      </button>
                      <button
                        aria-pressed={source === 'physical'}
                        className={source === 'physical' ? 'is-active' : ''}
                        onClick={() => {
                          setSource('physical')
                          setError('')
                        }}
                        type="button"
                      >
                        <span aria-hidden="true">◈</span>
                        Dadi fisici
                      </button>
                    </div>
                  </fieldset>

                  {source === 'physical' && (
                    <label className="physical-result">
                      <span>Risultati (separati da virgola)</span>
                      <input
                        autoComplete="off"
                        onChange={(event) => {
                          setPhysicalFaces(event.target.value)
                          setError('')
                        }}
                        placeholder="es. 4, 5, 2"
                        value={physicalFaces}
                      />
                    </label>
                  )}
                </div>

                <div className="roll-footer">
                  <label className="secret-toggle">
                    <input
                      checked={secret}
                      onChange={(event) => setSecret(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="toggle-track" aria-hidden="true">
                      <span />
                    </span>
                    <span className="secret-copy">
                      <strong>Tiro segreto</strong>
                      <small>Il risultato resta visibile al master</small>
                    </span>
                  </label>
                  <button className="roll-button" type="submit">
                    <span aria-hidden="true">✦</span>
                    Tira {dicePool}d6
                  </button>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </form>

              {latestRoll && (
                <div className={`latest-result${latestRoll.secret ? ' is-secret' : ''}`}>
                  <div className="result-symbol" aria-hidden="true">
                    {latestRoll.secret ? '◈' : '✦'}
                  </div>
                  <div className="result-copy">
                    <span>
                      {latestRoll.secret ? 'Tiro segreto registrato' : 'Ultimo tiro'}
                    </span>
                    <strong>
                      {latestRoll.attribute} + {latestRoll.skill}
                    </strong>
                  </div>
                  <div className="result-faces" aria-label={`Risultati: ${latestRoll.faces.join(', ')}`}>
                    {latestRoll.faces.map((face, index) => (
                      <span
                        className={`result-face${face >= 4 ? ' is-success' : ''}`}
                        key={`${latestRoll.id}-${index}`}
                      >
                        {face}
                      </span>
                    ))}
                  </div>
                  <div className="result-value">
                    <span>{latestRoll.successes}</span>
                    <small>/ {latestRoll.requiredSuccesses} successi</small>
                  </div>
                </div>
              )}
            </section>

            <section className="panel activity-panel" aria-labelledby="activity-title">
              <div className="activity-heading">
                <div>
                  <div className="eyebrow">ATTIVITÀ RECENTE</div>
                  <h2 id="activity-title">Registro della sessione</h2>
                </div>
                <span className="activity-count">
                  {rolls.length} {rolls.length === 1 ? 'tiro' : 'tiri'}
                </span>
              </div>

              {rolls.length === 0 ? (
                <p className="empty-activity">I tiri della sessione appariranno qui.</p>
              ) : (
                <ol className="roll-list">
                  {rolls.map((roll) => (
                    <li className="roll-item" key={roll.id}>
                      <span className={`roll-avatar${roll.actor.startsWith('Tu') ? ' is-master' : ''}`}>
                        {roll.actor.startsWith('Tu') ? 'M' : roll.actor.slice(0, 1)}
                      </span>
                      <div className="roll-details">
                        <div className="roll-title">
                          <strong>{roll.actor}</strong>
                          <span className="roll-time">{formatTime(roll.createdAt)}</span>
                        </div>
                        <div className="roll-description">
                          <span className="roll-tag">{roll.source === 'physical' ? 'Fisico' : 'Digitale'}</span>
                          <span>{roll.attribute} + {roll.skill}</span>
                          {roll.secret && (
                            <span className="secret-tag">
                              <span aria-hidden="true">◈</span>
                              Segreto
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="roll-outcome">
                        <span className="roll-number">
                          {roll.successes}/{roll.requiredSuccesses}
                        </span>
                        {roll.secret && !roll.revealed ? (
                          <button
                            className="reveal-button"
                            onClick={() => revealRoll(roll.id)}
                            type="button"
                          >
                            Rivela
                          </button>
                        ) : (
                          <span className={`visible-label${roll.successes >= roll.requiredSuccesses ? '' : ' is-failure'}`}>
                            {roll.successes >= roll.requiredSuccesses ? 'Successo' : 'Fallimento'}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="activity-footnote">
                I risultati dei dadi fisici vengono inseriti come dichiarati dal giocatore.
              </p>
            </section>
          </section>

          <aside className="side-column" aria-label="Dettagli della partita">
            <section className="panel party-panel" aria-labelledby="party-title">
              <div className="side-panel-heading">
                <div>
                  <div className="eyebrow">AL TAVOLO · DEMO</div>
                  <h2 id="party-title">Partecipanti</h2>
                </div>
                <span className="member-count">4</span>
              </div>

              <ul className="member-list">
                <li className="member-item">
                  <span className="avatar avatar-master">M</span>
                  <span className="member-info">
                    <strong>Tu</strong>
                    <small>Master</small>
                  </span>
                </li>
                <li className="member-item">
                  <span className="avatar avatar-mira">E</span>
                  <span className="member-info">
                    <strong>Ema</strong>
                    <small>Allenatrice</small>
                  </span>
                </li>
                <li className="member-item">
                  <span className="avatar avatar-tarin">N</span>
                  <span className="member-info">
                    <strong>Nico</strong>
                    <small>Allenatore</small>
                  </span>
                </li>
                <li className="member-item">
                  <span className="avatar avatar-lyra">S</span>
                  <span className="member-info">
                    <strong>Sofia</strong>
                    <small>Allenatrice</small>
                  </span>
                </li>
              </ul>

              <div className="party-note">
                <span className="note-icon" aria-hidden="true">✧</span>
                <p>La stanza e il gruppo sono esempi locali, non ancora condivisi online.</p>
              </div>
            </section>

            <section className="session-note" aria-labelledby="notes-title">
              <label className="note-heading" htmlFor="session-notes">
                <span aria-hidden="true">✧</span>
                <span id="notes-title">APPUNTI DEL MASTER</span>
              </label>
              <textarea
                id="session-notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Annota qui gli spunti per la sessione…"
                rows={4}
                value={notes}
              />
              <span className="note-updated">Appunti conservati solo in questa anteprima.</span>
            </section>

            <div className="session-meta">
              <span className="meta-icon" aria-hidden="true">◷</span>
              <span>Profilo attivo: <strong>{sheet.trainer || 'Allenatore'}</strong></span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

export default App
