// Spec di documentazione per src/supabase.ts
//
// Descrive come viene creato e usato il client Supabase.
// Importare da './module' invece che da './supabase' direttamente.

import { supabase } from './module'

// `supabase` è il client Supabase istanziato con le variabili d'ambiente
// VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
// Se una delle due variabili manca, supabase è null (graceful degradation).
//
// Esempio di uso:
//   import { supabase } from './module'
//   const { data, error } = await supabase.from('trainers').select('*')
//
// Variabili d'ambiente richieste (vedi .env.example):
//   VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=tuo_chiave_pubblica

export const supabaseSpec = {
  isConfigured: supabase !== null,
  client: supabase,
}
