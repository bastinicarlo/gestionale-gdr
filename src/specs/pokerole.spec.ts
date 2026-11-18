// Spec di documentazione per src/pokerole.ts
//
// Questo file descrive il comportamento atteso di costanti, tipi e factory
// definiti in pokerole.ts. Non è un test eseguibile (nessun runner configurato),
// ma serve come riferimento rapido per ridurre i token di contesto nelle
// chiamate successive.
//
// Importare da './module' invece che da './pokerole' direttamente.

import {
  type AttributeKey,
  type SocialAttributeKey,
  type SkillKey,
  type Move,
  type PokemonSheetData,
  type TrainerSheetData,
  createInitialTrainerSheet,
  createInitialPokemonSheet,
  createEmptyPokemonSheet,
} from './module'

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

// `attributes` contiene i 5 attributi principali del trainer.
// Ogni entry ha `key` (nome tecnico) e `label` (etichetta UI in italiano).
// Esempio d'uso: attributes.find(a => a.key === 'strength')?.label  // 'Forza'
export const attributesSpec: AttributeKey[] = [
  'strength',
  'dexterity',
  'vitality',
  'special',
  'insight',
]

// `socialAttributes` contiene i 5 attributi sociali.
// Esempio: socialAttributes.find(a => a.key === 'etiquette')?.label  // 'Etichetta'
export const socialAttributesSpec: SocialAttributeKey[] = [
  'tough',
  'cool',
  'beauty',
  'clever',
  'etiquette',
]

// `skills` contiene le 12 abilità.
// Esempio: skills.find(s => s.key === 'stealth')?.label  // 'Furtività'
export const skillsSpec: SkillKey[] = [
  'brawl',
  'channel',
  'clash',
  'evasion',
  'alert',
  'athletic',
  'nature',
  'stealth',
  'allure',
  'etiquette',
  'intimidate',
  'perform',
]

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

// `Move` descrive una mossa del Pokémon.
export const moveSpec: Move = {
  id: 'move-1',
  name: '',
  type: '',
  accuracy: '',
  damage: '',
  effect: '',
}

// `PokemonSheetData` è la struttura completa della scheda Pokémon.
// I record `attributes`, `social`, `skills` usano rispettivamente
// AttributeKey, SocialAttributeKey, SkillKey come chiavi.
export const pokemonSheetSpec: PokemonSheetData = {
  name: 'Luxio',
  imageUrl: '',
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
  attributes: { strength: 2, dexterity: 2, vitality: 4, special: 2, insight: 4 },
  social: { tough: 1, cool: 1, beauty: 1, clever: 1, etiquette: 1 },
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
  moves: [moveSpec],
}

// `TrainerSheetData` è la struttura completa della scheda allenatore.
export const trainerSheetSpec: TrainerSheetData = {
  name: '',
  playerName: '',
  age: '',
  rank: 'Starter',
  concept: '',
  nature: '',
  confidence: '',
  money: 1500,
  hp: 1,
  attributes: { strength: 1, dexterity: 1, vitality: 1, special: 1, insight: 1 },
  social: { tough: 1, cool: 1, beauty: 1, clever: 1, etiquette: 1 },
  skills: {
    brawl: 0,
    channel: 0,
    clash: 0,
    evasion: 0,
    alert: 0,
    athletic: 0,
    nature: 0,
    stealth: 0,
    allure: 0,
    etiquette: 0,
    intimidate: 0,
    perform: 0,
  },
  achievements: '',
  pokemonSeen: 0,
  pokemonCaught: 0,
  potionPocket: '',
  smallPocket: '',
  mainPocket: '',
  badges: '',
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// `createInitialTrainerSheet(playerName)` restituisce una scheda allenatore
// precompilata con valori di default (denaro 1500, hp 1, tutti i rating a 1
// per attributi/sociali, 0 per abilità).
export const initialTrainerSpec = createInitialTrainerSheet('Ema')

// `createInitialPokemonSheet()` restituisce una scheda Pokémon di esempio
// (Luxio, tipo Elettro, allenatore Ema, hp 8/8, will 7, ecc.).
export const initialPokemonSpec = createInitialPokemonSheet()

// `createEmptyPokemonSheet(trainer)` restituisce una scheda Pokémon vuota
// con tutti i campi a zero/stringa vuota e moves array vuoto, tranne `trainer`
// impostato al valore passato.
export const emptyPokemonSpec = createEmptyPokemonSheet('Ema')

// Vincoli documentati (da rispettare quando si modificano le factory):
// - attributes/social/skills devono contenere esattamente le chiavi definite
//   nelle costanti corrispondenti.
// - hp non può superare maxHp.
// - happiness e loyalty vanno da 0 a 5.
// - attributes vanno da 0 a 10.
// - social e skills vanno da 0 a 5.
