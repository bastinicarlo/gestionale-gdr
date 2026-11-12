export const attributes = [
  { key: 'strength', label: 'Forza' },
  { key: 'dexterity', label: 'Destrezza' },
  { key: 'vitality', label: 'Vitalità' },
  { key: 'special', label: 'Speciale' },
  { key: 'insight', label: 'Intuito' },
] as const

export const socialAttributes = [
  { key: 'tough', label: 'Grinta' },
  { key: 'cool', label: 'Disinvoltura' },
  { key: 'beauty', label: 'Bellezza' },
  { key: 'clever', label: 'Astuzia' },
  { key: 'etiquette', label: 'Etichetta' },
] as const

export const skills = [
  { key: 'brawl', label: 'Lotta' },
  { key: 'channel', label: 'Canalizzazione' },
  { key: 'clash', label: 'Scontro' },
  { key: 'evasion', label: 'Evasione' },
  { key: 'alert', label: 'Allerta' },
  { key: 'athletic', label: 'Atletica' },
  { key: 'nature', label: 'Natura' },
  { key: 'stealth', label: 'Furtività' },
  { key: 'allure', label: 'Fascino' },
  { key: 'etiquette', label: 'Etichetta' },
  { key: 'intimidate', label: 'Intimidire' },
  { key: 'perform', label: 'Esibirsi' },
] as const

export type AttributeKey = (typeof attributes)[number]['key']
export type SocialAttributeKey = (typeof socialAttributes)[number]['key']
export type SkillKey = (typeof skills)[number]['key']

export type Move = {
  id: string
  name: string
  type: string
  accuracy: string
  damage: string
  effect: string
}

export type PokemonSheetData = {
  name: string
  pokemonType: string
  trainer: string
  rank: string
  ability: string
  nature: string
  trainingPoints: number
  hp: number
  maxHp: number
  will: number
  heldItem: string
  height: string
  weight: string
  happiness: number
  loyalty: number
  attributes: Record<AttributeKey, number>
  social: Record<SocialAttributeKey, number>
  skills: Record<SkillKey, number>
  moves: Move[]
}

export function createInitialPokemonSheet(): PokemonSheetData {
  return {
    name: 'Luxio',
    pokemonType: 'Elettro',
    trainer: 'Ema',
    rank: 'Standard',
    ability: 'Guts',
    nature: 'Adamant',
    trainingPoints: 0,
    hp: 8,
    maxHp: 8,
    will: 7,
    heldItem: 'Nessuno',
    height: '0,9 m',
    weight: '30 kg',
    happiness: 1,
    loyalty: 1,
    attributes: {
      strength: 2,
      dexterity: 2,
      vitality: 4,
      special: 2,
      insight: 4,
    },
    social: {
      tough: 1,
      cool: 1,
      beauty: 1,
      clever: 1,
      etiquette: 1,
    },
    skills: {
      brawl: 1,
      channel: 1,
      clash: 1,
      evasion: 1,
      alert: 1,
      athletic: 1,
      nature: 1,
      stealth: 1,
      allure: 1,
      etiquette: 1,
      intimidate: 1,
      perform: 1,
    },
    moves: [
      {
        id: 'move-1',
        name: '',
        type: '',
        accuracy: '',
        damage: '',
        effect: '',
      },
    ],
  }
}
