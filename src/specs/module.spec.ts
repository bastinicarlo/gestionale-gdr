// Spec di documentazione per src/specs/module.ts
//
// Il file module.ts è il barrel (unico punto di import) del progetto.
// Riesporta tutto ciò che serve da pokerole.ts e supabase.ts.
//
// Perché usarlo:
//   - Un solo import invece di molti import sparsi.
//   - Meno token di contesto nelle chiamate successive all'IA.
//   - Punto centrale da aggiornare se si aggiungono nuovi moduli.
//
// Esempio di import:
//   import {
//     attributes,
//     skills,
//     createInitialTrainerSheet,
//     supabase,
//   } from './module'
//
// Esportazioni attese dal barrel:
//   Da pokerole:
//     attributes, socialAttributes, skills
//     AttributeKey, SocialAttributeKey, SkillKey
//     Move, PokemonSheetData, TrainerSheetData
//     createInitialTrainerSheet, createInitialPokemonSheet, createEmptyPokemonSheet
//   Da supabase:
//     supabase

export const moduleExportsSpec = {
  fromPokerole: [
    'attributes',
    'socialAttributes',
    'skills',
    'AttributeKey',
    'SocialAttributeKey',
    'SkillKey',
    'Move',
    'PokemonSheetData',
    'TrainerSheetData',
    'createInitialTrainerSheet',
    'createInitialPokemonSheet',
    'createEmptyPokemonSheet',
  ],
  fromSupabase: ['supabase'],
}
