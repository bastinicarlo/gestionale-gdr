import { useState } from 'react'
import {
  attributes,
  socialAttributes,
  skills,
  type PokemonSheetData,
} from './pokerole'

type Props = {
  sheet: PokemonSheetData
  onChange: (sheet: PokemonSheetData) => void
}

type RatingDotsProps = {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  tone?: 'attribute' | 'social' | 'skill' | 'bond'
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
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          onChange(Number.isFinite(nextValue) ? nextValue : 0)
        }}
        type="number"
        value={value}
      />
    </label>
  )
}

function RatingDots({
  label,
  value,
  max,
  onChange,
  tone = 'attribute',
}: RatingDotsProps) {
  return (
    <div className={`rating-row rating-row--${tone}`}>
      <span className="rating-label">{label}</span>
      <div className="rating-control">
        <div className="rating-dots" role="group" aria-label={`${label}: ${value} su ${max}`}>
          {Array.from({ length: max }, (_, index) => {
            const point = index + 1
            return (
              <button
                aria-label={`Imposta ${label} a ${point}`}
                aria-pressed={value === point}
                className={`rating-dot${point <= value ? ' is-filled' : ''}`}
                key={point}
                onClick={() => onChange(value === point ? point - 1 : point)}
                type="button"
              />
            )
          })}
        </div>
        <span className="rating-value">{value}</span>
      </div>
    </div>
  )
}

export function PokemonSheet({ sheet, onChange }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState('')
  const imageUrl = sheet.imageUrl.trim()
  const hasValidImageUrl = /^https?:\/\/[^\s]+$/i.test(imageUrl)
  const hasInvalidImageUrl = imageUrl !== '' && !hasValidImageUrl
  const hasFailedImage = hasValidImageUrl && failedImageUrl === imageUrl

  function updateField<Key extends keyof PokemonSheetData>(
    key: Key,
    value: PokemonSheetData[Key],
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

  function updateMove(index: number, field: keyof PokemonSheetData['moves'][number], value: string) {
    const moves = sheet.moves.map((move, moveIndex) =>
      moveIndex === index ? { ...move, [field]: value } : move,
    )
    updateField('moves', moves)
  }

  function addMove() {
    updateField('moves', [
      ...sheet.moves,
      {
        id: crypto.randomUUID(),
        name: '',
        type: '',
        accuracy: '',
        damage: '',
        effect: '',
      },
    ])
  }

  function removeMove(id: string) {
    updateField(
      'moves',
      sheet.moves.filter((move) => move.id !== id),
    )
  }

  return (
    <section className="panel pokemon-sheet" aria-labelledby="pokemon-sheet-title">
      <div className="sheet-heading">
        <div className="species-mark">
          {hasValidImageUrl && !hasFailedImage ? (
            <img
              alt={`${sheet.name || 'Pokémon'} personalizzato`}
              className="pokemon-custom-image"
              onError={() => setFailedImageUrl(imageUrl)}
              referrerPolicy="no-referrer"
              src={imageUrl}
            />
          ) : (
            <svg aria-hidden="true" className="companion-icon" viewBox="0 0 64 64" fill="none">
              <path
                d="M32 8c4.5 0 7.3 4.2 10.1 6.5 3.3-.5 8.3-1.6 11.5 1.6s2.1 8.2 1.6 11.5C57.5 30.3 61.7 33.1 61.7 37.6s-4.2 7.3-6.5 10.1c.5 3.3 1.6 8.3-1.6 11.5s-8.2 2.1-11.5 1.6C39.3 63.1 36.5 67.3 32 67.3s-7.3-4.2-10.1-6.5c-3.3.5-8.3 1.6-11.5-1.6s-2.1-8.2-1.6-11.5C6.5 45 2.3 42.2 2.3 37.6s4.2-7.3 6.5-10.1c-.5-3.3-1.6-8.3 1.6-11.5s8.2-2.1 11.5-1.6C24.7 12.2 27.5 8 32 8Z"
                transform="translate(0 -5)"
                fill="currentColor"
                opacity=".18"
              />
              <path
                d="M32 10c4.2 0 6.8 3.9 9.4 6 3.1-.5 7.7-1.5 10.7 1.5s2 7.6 1.5 10.7c2.1 2.6 6 5.2 6 9.4s-3.9 6.8-6 9.4c.5 3.1 1.5 7.7-1.5 10.7s-7.6 2-10.7 1.5c-2.6 2.1-5.2 6-9.4 6s-6.8-3.9-9.4-6c-3.1.5-7.7 1.5-10.7-1.5s-2-7.6-1.5-10.7c-2.1-2.6-6-5.2-6-9.4s3.9-6.8 6-9.4c-.5-3.1-1.5-7.7 1.5-10.7s7.6-2 10.7-1.5c2.6-2.1 5.2-6 9.4-6Z"
                fill="currentColor"
              />
              <circle cx="25" cy="35" r="2.2" fill="#fffefa" />
              <circle cx="39" cy="35" r="2.2" fill="#fffefa" />
              <path d="M27 43c3.2 2.5 6.8 2.5 10 0" stroke="#fffefa" strokeWidth="2.4" strokeLinecap="round" />
              <path d="m18 24-5-4m33 4 5-4M15 48l-4 3m38-3 4 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          <strong>{sheet.name.slice(0, 2).toUpperCase() || 'PK'}</strong>
          <small>{hasValidImageUrl && !hasFailedImage ? 'IMMAGINE PERSONALIZZATA' : 'ICONA GENERICA'}</small>
        </div>
        <div className="sheet-identity">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">SCHEDA POKÉMON</div>
              <h2 id="pokemon-sheet-title">{sheet.name || 'Nuovo Pokémon'}</h2>
            </div>
            <button
              aria-pressed={isEditing}
              className="secondary-button sheet-edit-button"
              onClick={() => setIsEditing((editing) => !editing)}
              type="button"
            >
              {isEditing ? 'Fine modifica' : 'Modifica scheda'}
            </button>
          </div>
          <fieldset className="identity-editable-fields" disabled={!isEditing}>
            <div className="identity-fields">
              <TextField
                label="Nome"
                onChange={(value) => updateField('name', value)}
                value={sheet.name}
              />
              <TextField
                label="Tipo"
                onChange={(value) => updateField('pokemonType', value)}
                value={sheet.pokemonType}
              />
              <TextField
                label="Allenatore"
                onChange={(value) => updateField('trainer', value)}
                value={sheet.trainer}
              />
              <TextField
                label="Rango"
                onChange={(value) => updateField('rank', value)}
                value={sheet.rank}
              />
              <TextField
                label="Abilità"
                onChange={(value) => updateField('ability', value)}
                value={sheet.ability}
              />
              <TextField
                label="Natura"
                onChange={(value) => updateField('nature', value)}
                value={sheet.nature}
              />
              {isEditing && (
                <label className="sheet-field image-url-field">
                  <span>Immagine personalizzata · link diretto</span>
                  <input
                    aria-describedby="pokemon-image-help"
                    aria-invalid={hasInvalidImageUrl || hasFailedImage}
                    autoComplete="url"
                    onChange={(event) => updateField('imageUrl', event.target.value)}
                    placeholder="https://esempio.it/immagine.jpg"
                    type="url"
                    value={sheet.imageUrl}
                  />
                  <small id="pokemon-image-help">
                    Usa un link diretto accessibile all’immagine e solo immagini che hai diritto di usare.
                  </small>
                  {hasInvalidImageUrl && (
                    <small className="image-url-error" role="alert">
                      Inserisci un URL che inizi con http:// o https://.
                    </small>
                  )}
                  {hasFailedImage && (
                    <small className="image-url-error" role="alert">
                      Immagine non caricata: verifica che il link punti direttamente a un file immagine.
                    </small>
                  )}
                </label>
              )}
            </div>
          </fieldset>
        </div>
      </div>

      <fieldset className="sheet-editable-fields" disabled={!isEditing}>
      <div className="vitals-grid">
        <div className="vital-card vital-card--hp">
          <span className="vital-label">PUNTI FERITA</span>
          <div className="vital-number-pair">
            <NumberField
              label="Attuali"
              onChange={(value) => updateField('hp', value)}
              value={sheet.hp}
            />
            <span className="vital-divider">/</span>
            <NumberField
              label="Massimi"
              onChange={(value) => updateField('maxHp', value)}
              value={sheet.maxHp}
            />
          </div>
        </div>
        <div className="vital-card">
          <span className="vital-label">VOLONTÀ</span>
          <NumberField
            label="Punti volontà"
            onChange={(value) => updateField('will', value)}
            value={sheet.will}
          />
        </div>
        <div className="vital-card vital-card--bond">
          <span className="vital-label">FELICITÀ</span>
          <RatingDots
            label="Felicità"
            max={5}
            onChange={(value) => updateField('happiness', value)}
            tone="bond"
            value={sheet.happiness}
          />
        </div>
        <div className="vital-card vital-card--bond">
          <span className="vital-label">LEALTÀ</span>
          <RatingDots
            label="Lealtà"
            max={5}
            onChange={(value) => updateField('loyalty', value)}
            tone="bond"
            value={sheet.loyalty}
          />
        </div>
        <div className="vital-card">
          <span className="vital-label">DETTAGLI</span>
          <div className="detail-fields">
            <TextField
              label="Oggetto"
              onChange={(value) => updateField('heldItem', value)}
              value={sheet.heldItem}
            />
            <TextField
              label="Altezza"
              onChange={(value) => updateField('height', value)}
              value={sheet.height}
            />
            <TextField
              label="Peso"
              onChange={(value) => updateField('weight', value)}
              value={sheet.weight}
            />
            <NumberField
              label="Punti allenamento"
              onChange={(value) => updateField('trainingPoints', value)}
              value={sheet.trainingPoints}
            />
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <section className="stat-card stat-card--attributes" aria-labelledby="attributes-title">
          <div className="stat-heading">
            <h3 id="attributes-title">Attributi</h3>
            <span>0–10</span>
          </div>
          <div className="stat-list">
            {attributes.map(({ key, label }) => (
              <RatingDots
                key={key}
                label={label}
                max={10}
                onChange={(value) => updateRating('attributes', key, value)}
                tone="attribute"
                value={sheet.attributes[key]}
              />
            ))}
          </div>
        </section>

        <section className="stat-card stat-card--social" aria-labelledby="social-title">
          <div className="stat-heading">
            <h3 id="social-title">Sociali</h3>
            <span>0–5</span>
          </div>
          <div className="stat-list">
            {socialAttributes.map(({ key, label }) => (
              <RatingDots
                key={key}
                label={label}
                max={5}
                onChange={(value) => updateRating('social', key, value)}
                tone="social"
                value={sheet.social[key]}
              />
            ))}
          </div>
        </section>

        <section className="stat-card stat-card--skills" aria-labelledby="skills-title">
          <div className="stat-heading">
            <h3 id="skills-title">Abilità</h3>
            <span>0–5</span>
          </div>
          <div className="skill-list">
            {skills.map(({ key, label }) => (
              <RatingDots
                key={key}
                label={label}
                max={5}
                onChange={(value) => updateRating('skills', key, value)}
                tone="skill"
                value={sheet.skills[key]}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="moves-section" aria-labelledby="moves-title">
        <div className="moves-heading">
          <div>
            <div className="eyebrow">MOSSE</div>
            <h3 id="moves-title">Mosse del Pokémon</h3>
          </div>
          <button className="secondary-button" onClick={addMove} type="button">
            <span aria-hidden="true">＋</span>
            Aggiungi mossa
          </button>
        </div>
        {sheet.moves.length === 0 ? (
          <p className="empty-moves">Nessuna mossa inserita. Aggiungine una per completare la scheda.</p>
        ) : (
          <div className="moves-list">
            {sheet.moves.map((move, index) => (
              <article className="move-card" key={move.id}>
                <div className="move-card-heading">
                  <span>MOSSA {String(index + 1).padStart(2, '0')}</span>
                  <button
                    aria-label={`Rimuovi mossa ${index + 1}`}
                    className="icon-button"
                    onClick={() => removeMove(move.id)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <div className="move-fields">
                  <TextField
                    label="Nome"
                    onChange={(value) => updateMove(index, 'name', value)}
                    value={move.name}
                  />
                  <TextField
                    label="Tipo"
                    onChange={(value) => updateMove(index, 'type', value)}
                    value={move.type}
                  />
                  <TextField
                    label="Precisione"
                    onChange={(value) => updateMove(index, 'accuracy', value)}
                    value={move.accuracy}
                  />
                  <TextField
                    label="Danno"
                    onChange={(value) => updateMove(index, 'damage', value)}
                    value={move.damage}
                  />
                </div>
                <label className="sheet-field move-effect">
                  <span>Note al tavolo</span>
                  <textarea
                    onChange={(event) => updateMove(index, 'effect', event.target.value)}
                    placeholder="Annotazioni personalizzate"
                    rows={2}
                    value={move.effect}
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>
      </fieldset>
    </section>
  )
}
