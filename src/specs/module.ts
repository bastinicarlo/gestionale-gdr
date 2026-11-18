// ============================================================================
// GESTIONALEGDR — module.ts (barrel)
// ============================================================================
// Unico punto di import per ridurre i token di contesto nelle chiamate
// successive. Riesporta tipi, costanti e factory da pokerole e il client
// Supabase da supabase.
//
// ---------------------------------------------------------------------------
// APP
// ---------------------------------------------------------------------------
// Nome: GestionaleGDR
// Descrizione: applicazione per giocare a giochi di ruolo online in chiamata
//   con amici. Facilita la gestione delle schede e delle informazioni per
//   master e giocatori, migliorando l'immersività e l'esperienza di gioco.
// Utenti target: entrambi (master e giocatori).
// Funzionalità principali:
//   - visione schede (allenatore e Pokémon)
//   - tiro dadi
//   - gestione mappa e token
//   - gestione presentazioni di scene e immagini durante la storia
// Stack tecnologico: React, TypeScript, Vite, Supabase
//
// ---------------------------------------------------------------------------
// CONVENZIONI DI CODICE
// ---------------------------------------------------------------------------
// - Nomi file e cartelle: kebab-case
// - Componenti React: PascalCase, exported come named export
// - Tipi e interfacce: PascalCase, esportati con `type` o `interface`
// - Costanti e funzioni: camelCase
// - Preferire tipi espliciti su `any`
// - Non usare `any` salvo casi eccezionali documentati
//
// ---------------------------------------------------------------------------
// ORGANIZZAZIONE FILE
// ---------------------------------------------------------------------------
// - src/specs/ contiene:
//   - module.ts: barrel unico di import per tutto il progetto
//   - *.spec.ts: file di documentazione del comportamento atteso (non test
//     eseguibili, salvo configurazione futura di un test runner)
// - Ogni nuovo modulo o funzione deve avere il proprio file .spec.ts in
//   src/specs/ che descriva: costanti, tipi, factory, vincoli ed esempi d'uso.
// - Importare sempre da './specs/module' invece che dai file sorgente diretti,
//   per tenere un unico punto di import e ridurre i token di contesto.
//
// ---------------------------------------------------------------------------
// REGOLE PER L'AGENT
// ---------------------------------------------------------------------------
// 1. Prima di modificare o aggiungere codice, leggere src/specs/module.ts e
//    i relativi .spec.ts per capire il comportamento atteso.
// 2. Ogni nuova funzione o modifica deve essere accompagnata da un aggiornamento
//    del file .spec.ts corrispondente.
// 3. Rispettare le convenzioni di codice (kebab-case per file, PascalCase per
//    componenti/tipi, camelCase per costanti/funzioni).
// 4. Non introdurre dipendenze nuove senza averle discusso.
// 5. Mantenere il barrel module.ts aggiornato quando si aggiungono esportazioni.
// 6. Preferire modifiche chirurgiche e complete; evitare cambi non correlati.
// 7. Non usare `any` salvo casi documentati.
// 8. Verificare che TypeScript compili senza errori dopo ogni modifica.
// 9. Mantenere aggiornati i file .spec.ts in src/specs/ dopo ogni modifica
//    o aggiunta di codice, in modo che l'agent possa fare riferimento a essi
//    invece di riesaminare l'intero codice, riducendo i token di contesto
//    nelle chiamate successive.
//
// ---------------------------------------------------------------------------
// CONVENZIONI PER I FILE .spec.ts
// ---------------------------------------------------------------------------
// - Nome file: <modulo>.spec.ts dentro src/specs/
// - Contenuto: descrizione del comportamento atteso, esempi d'uso, vincoli,
//   tipi e costanti rilevanti. Non è un test eseguibile.
// - Usare commenti chiari in italiano.
// - Esportare simboli di esempio (es. moveSpec, pokemonSheetSpec) per
//   riferimento rapido.
// - Non importare da file sorgente diretti; importare da './module'.

export {
  attributes,
  socialAttributes,
  skills,
  type AttributeKey,
  type SocialAttributeKey,
  type SkillKey,
  type Move,
  type PokemonSheetData,
  type TrainerSheetData,
  createInitialTrainerSheet,
  createInitialPokemonSheet,
  createEmptyPokemonSheet,
} from '../pokerole'

export { supabase } from '../supabase'
