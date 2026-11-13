# Gestionale GDR — Cronache

Prototipo React + TypeScript per organizzare sessioni di gioco di ruolo. La schermata corrente è adattata a una scheda Pokémon per Pokerole: profilo, attributi, sociali, abilità, mosse e riserva di dadi d6.

## Avvio in locale

```sh
npm install
npm run dev
```

## Supabase per la condivisione immagini

1. Copia `.env.example` in `.env.local` e inserisci URL del progetto e chiave `sb_publishable`.
2. Nel dashboard Supabase abilita **Anonymous Sign-Ins** in **Authentication → Sign In / Providers**.
3. Esegui in ordine, una sola volta ciascuno, i file SQL in `supabase/migrations/` nel **SQL Editor** del progetto.
4. Riavvia Vite dopo aver modificato `.env.local`.

La scheda **Tavolo** alterna la mappa locale e una composizione immagini condivisa. Il Master crea una stanza e condivide il codice; chi lo possiede può entrare e vedere la composizione. Solo il Master può aggiungere, spostare e ridimensionare le immagini.

## Stato del prototipo

- Scheda Pokémon demo modificabile, inclusi punti, attributi, abilità e mosse.
- Tiri digitali di una riserva di d6 (4–6 contano come successi).
- Inserimento manuale dei risultati dei dadi fisici.
- Tiri segreti con rivelazione manuale e registro locale.
- Partecipanti e appunti dimostrativi.
- Composizione immagini Supabase condivisa e aggiornata in tempo reale tramite codice stanza.

Le schede Pokémon e Allenatore, i tiri, gli appunti e la mappa restano locali e non sono ancora sincronizzati tra browser.

## Licenze e marchi

Progetto fan-made non ufficiale, senza affiliazione o approvazione da parte di Pokerole Project o dei titolari dei marchi Pokémon. Non include il manuale fornito, illustrazioni, testi, tabelle o un catalogo di specie e mosse. Nel PDF consultato non ho trovato una licenza esplicita che autorizzi la redistribuzione; perciò l’interfaccia usa una scheda demo e campi modificabili, senza riprodurne i contenuti editoriali.

La licenza del codice di questa applicazione non è ancora stata scelta. La visibilità pubblica del repository, da sola, non concede diritti di riutilizzo.
