import { useState } from 'react'
import {
  attributes,
  skills,
  socialAttributes,
  type TrainerSheetData,
} from './pokerole'

type Props = {
  sheet: TrainerSheetData
  trainers: string[]
  selectedTrainer: string
  party: Array<{ id: string; name: string; pokemonType: string }>
  onChange: (sheet: TrainerSheetData) => void
  onSelectTrainer: (trainer: string) => void
  onOpenPokemon: (id: string) => void
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        type="number"
        value={value}
      />
    </label>
  )
}

export function TrainerSheet({
  sheet,
  trainers,
  selectedTrainer,
  party,
  onChange,
  onSelectTrainer,
  onOpenPokemon,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)

  function updateField<Key extends keyof TrainerSheetData>(
    key: Key,
    value: TrainerSheetData[Key],
  ) {
    onChange({ ...sheet, [key]: value })
  }

  function updateRating(
    group: 'attributes' | 'social' | 'skills',
    key: string,
    value: number,
  ) {
    onChange({
      ...sheet,
      [group]: {
        ...sheet[group],
        [key]: value,
      },
    })
  }

  return (
    <section className="panel trainer-sheet" aria-labelledby="trainer-sheet-title">
      <div className="trainer-sheet-heading">
        <div className="trainer-sheet-mark" aria-hidden="true">
          {(sheet.name.slice(0, 2) || sheet.playerName.slice(0, 2)).toUpperCase()}
        </div>
        <div className="trainer-sheet-title">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">SCHEDA ALLENATORE</div>
              <h2 id="trainer-sheet-title">{sheet.name || `Allenatore di ${sheet.playerName}`}</h2>
            </div>
            <div className="trainer-sheet-controls">
              <label>
                <span>Giocatore</span>
                <select
                  onChange={(event) => onSelectTrainer(event.target.value)}
                  value={selectedTrainer}
                >
                  {trainers.map((trainer) => (
                    <option key={trainer} value={trainer}>{trainer}</option>
                  ))}
                </select>
              </label>
              <button
                aria-pressed={isEditing}
                className="secondary-button"
                onClick={() => setIsEditing((editing) => !editing)}
                type="button"
              >
                {isEditing ? 'Fine modifica' : 'Modifica scheda'}
              </button>
            </div>
          </div>
          <p>Profilo di {sheet.playerName} · {sheet.rank || 'Rango da definire'}</p>
        </div>
      </div>

      <fieldset className="trainer-editable-fields" disabled={!isEditing}>
        <section className="trainer-section" aria-label="Identità">
          <h3>Identità</h3>
          <div className="trainer-identity-grid">
            <TextField label="Nome del personaggio" onChange={(value) => updateField('name', value)} value={sheet.name} />
            <TextField label="Nome giocatore" onChange={(value) => updateField('playerName', value)} value={sheet.playerName} />
            <TextField label="Età" onChange={(value) => updateField('age', value)} value={sheet.age} />
            <TextField label="Rango" onChange={(value) => updateField('rank', value)} value={sheet.rank} />
            <TextField label="Concetto" onChange={(value) => updateField('concept', value)} value={sheet.concept} />
            <TextField label="Natura" onChange={(value) => updateField('nature', value)} value={sheet.nature} />
            <TextField label="Fiducia" onChange={(value) => updateField('confidence', value)} value={sheet.confidence} />
            <NumberField label="Denaro" onChange={(value) => updateField('money', value)} value={sheet.money} />
            <NumberField label="Punti ferita attuali" onChange={(value) => updateField('hp', value)} value={sheet.hp} />
          </div>
        </section>

        <section className="trainer-vitals" aria-label="Risorse">
          <div>
            <span>PUNTI FERITA MASSIMI</span>
            <strong>{sheet.attributes.vitality}</strong>
            <small>in base alla Vitalità</small>
          </div>
          <div>
            <span>VOLONTÀ</span>
            <strong>{sheet.attributes.insight + 2}</strong>
            <small>Intuito + 2</small>
          </div>
        </section>

        <div className="trainer-stats-grid">
          <section className="stat-card" aria-labelledby="trainer-attributes-title">
            <div className="stat-heading"><h3 id="trainer-attributes-title">Attributi</h3></div>
            <div className="trainer-rating-list">
              {attributes.map(({ key, label }) => (
                <NumberField
                  key={key}
                  label={label}
                  onChange={(value) => updateRating('attributes', key, value)}
                  value={sheet.attributes[key]}
                />
              ))}
            </div>
          </section>
          <section className="stat-card" aria-labelledby="trainer-social-title">
            <div className="stat-heading"><h3 id="trainer-social-title">Sociali</h3></div>
            <div className="trainer-rating-list">
              {socialAttributes.map(({ key, label }) => (
                <NumberField
                  key={key}
                  label={label}
                  onChange={(value) => updateRating('social', key, value)}
                  value={sheet.social[key]}
                />
              ))}
            </div>
          </section>
          <section className="stat-card" aria-labelledby="trainer-skills-title">
            <div className="stat-heading"><h3 id="trainer-skills-title">Abilità</h3></div>
            <div className="trainer-rating-list trainer-rating-list--skills">
              {skills.map(({ key, label }) => (
                <NumberField
                  key={key}
                  label={label}
                  onChange={(value) => updateRating('skills', key, value)}
                  value={sheet.skills[key]}
                />
              ))}
            </div>
          </section>
        </div>

        <section className="trainer-section" aria-label="Progressi e inventario">
          <h3>Progressi e inventario</h3>
          <div className="trainer-identity-grid">
            <NumberField label="Pokémon visti" onChange={(value) => updateField('pokemonSeen', value)} value={sheet.pokemonSeen} />
            <NumberField label="Pokémon catturati" onChange={(value) => updateField('pokemonCaught', value)} value={sheet.pokemonCaught} />
            <TextField label="Obiettivi di rango" onChange={(value) => updateField('achievements', value)} value={sheet.achievements} />
            <TextField label="Tasche pozioni" onChange={(value) => updateField('potionPocket', value)} value={sheet.potionPocket} />
            <TextField label="Tasca rapida" onChange={(value) => updateField('smallPocket', value)} value={sheet.smallPocket} />
            <TextField label="Tasca principale" onChange={(value) => updateField('mainPocket', value)} value={sheet.mainPocket} />
            <TextField label="Medaglie" onChange={(value) => updateField('badges', value)} value={sheet.badges} />
          </div>
        </section>
      </fieldset>

      <section className="trainer-party" aria-labelledby="trainer-party-title">
        <div className="stat-heading">
          <h3 id="trainer-party-title">Squadra attiva</h3>
          <span>{party.length}/6 Pokémon</span>
        </div>
        {party.length === 0 ? (
          <p className="trainer-party-empty">Nessun Pokémon in squadra.</p>
        ) : (
          <ul>
            {party.map((pokemon) => (
              <li key={pokemon.id}>
                <button onClick={() => onOpenPokemon(pokemon.id)} type="button">
                  <strong>{pokemon.name || 'Nuovo Pokémon'}</strong>
                  <span>{pokemon.pokemonType || 'Tipo da definire'}</span>
                  <small>Apri scheda →</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
