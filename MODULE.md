# MODULE.md — Riferimento rapido per l'AI

Questo file riassume la struttura del codice, i simboli principali e le convenzioni
per ridurre i token di contesto nelle chiamate successive. Importare sempre da
`./module` (barrel) invece che dai file sorgente diretti.

## Stack

React 19, TypeScript, Vite, Supabase JS. Nessun test runner configurato.

## Barrel unico

`src/specs/module.ts` riesporta tutto da `pokerole.ts` e `supabase.ts`.

Esempio:
```ts
import {
  attributes,
  skills,
  createInitialTrainerSheet,
  supabase,
} from './module'
```

## Moduli principali

| File | Responsabilità |
|------|----------------|
| `src/App.tsx` | Shell: roster Pokémon, schede, tiri dadi, registro attività, appunti master |
| `src/PokemonSheet.tsx` | Scheda Pokémon modificabile (attributi, sociali, abilità, mosse, vitale, immagine) |
| `src/TrainerSheet.tsx` | Scheda allenatore (identità, attributi, sociali, abilità, inventario, squadra attiva) |
| `src/SharedTable.tsx` | Tavolo condiviso: mappa, modalità presentazione, upload immagini, stanza Supabase |
| `src/SessionMap.tsx` | Mappa condivisa con segnalini in tempo reale |
| `src/pokerole.ts` | Costanti, tipi e factory per schede Pokémon e allenatore |
| `src/supabase.ts` | Client Supabase (graceful degradation se mancano le env vars) |
| `src/specs/module.ts` | Barrel unico di import per tutto il progetto |

## Tipi chiave (da `./module`)

```ts
type AttributeKey = 'strength' | 'dexterity' | 'vitality' | 'special' | 'insight'
type SocialAttributeKey = 'tough' | 'cool' | 'beauty' | 'clever' | 'etiquette'
type SkillKey = 'brawl' | 'channel' | 'clash' | 'evasion' | 'alert' | 'athletic' | 'nature' | 'stealth' | 'allure' | 'etiquette' | 'intimidate' | 'perform'

type Move = { id: string; name: string; type: string; accuracy: string; damage: string; effect: string }

type PokemonSheetData = {
  name: string; imageUrl: string; pokemonType: string; trainer: string; rank: string;
  ability: string; nature: string; trainingPoints: number; hp: number; maxHp: number;
  will: number; heldItem: string; height: string; weight: string; happiness: number;
  loyalty: number; attributes: Record<AttributeKey, number>;
  social: Record<SocialAttributeKey, number>; skills: Record<SkillKey, number>; moves: Move[]
}

type TrainerSheetData = {
  name: string; playerName: string; age: string; rank: string; concept: string;
  nature: string; confidence: string; money: number; hp: number;
  attributes: Record<AttributeKey, number>; social: Record<SocialAttributeKey, number>;
  skills: Record<SkillKey, number>; achievements: string; pokemonSeen: number;
  pokemonCaught: number; potionPocket: string; smallPocket: string; mainPocket: string;
  badges: string
}

type MapEntity = { id: string; owner: string; kind: 'character' | 'pokemon'; label: string }
```

## Costanti

```ts
attributes:   { key: AttributeKey; label: string }[]   // 5 attributi (0-10)
socialAttributes: { key: SocialAttributeKey; label: string }[] // 5 sociali (0-5)
skills:       { key: SkillKey; label: string }[]       // 12 abilità (0-5)
```

## Factory

```ts
createInitialTrainerSheet(playerName: string): TrainerSheetData
createInitialPokemonSheet(): PokemonSheetData          // Luxio demo
createEmptyPokemonSheet(trainer: string): PokemonSheetData
```

## Supabase

`src/supabase.ts` espone `supabase` (può essere `null` se mancano le env vars).
Variabili richieste: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Convenzioni di codice

- File/cartelle: `kebab-case`
- Componenti React: `PascalCase`, named export
- Tipi/interfacce: `PascalCase`, `type` o `interface`
- Costanti/funzioni: `camelCase`
- Preferire tipi espliciti su `any`
- Non usare `any` salvo casi documentati
- Ogni nuovo modulo deve avere il proprio `src/specs/<modulo>.spec.ts`
- Aggiornare `src/specs/module.ts` quando si aggiungono esportazioni
- Importare sempre da `./module`

## Supabase (migrazioni)

Eseguire in ordine in `supabase/migrations/`:
1. `20261113163000_shared_images.sql`
2. `20261113170000_image_composition.sql`
3. `20261113180000_shared_map_tokens.sql`
4. `20261113190000_image_composition_replica_identity.sql`

Abilitare Anonymous Sign-Ins in Supabase Authentication.

## Comandi

```sh
npm install
npm run dev        # avvio sviluppo
npm run build      # TypeScript + Vite build
npm run lint       # oxlint
```
