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
        <div className="species-mark" aria-hidden="true">
          <span>✦</span>
          <strong>{sheet.name.slice(0, 2).toUpperCase() || 'PK'}</strong>
          <small>SCHEDA DEMO</small>
        </div>
        <div className="sheet-identity">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">SCHEDA POKÉMON</div>
              <h2 id="pokemon-sheet-title">{sheet.name || 'Nuovo Pokémon'}</h2>
            </div>
            <span className="demo-pill">ESEMPIO MODIFICABILE</span>
          </div>
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
          </div>
        </div>
      </div>

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
    </section>
  )
}
