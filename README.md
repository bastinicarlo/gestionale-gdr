# Gestionale GDR — Cronache

Prototipo React + TypeScript per organizzare sessioni di gioco di ruolo. La schermata corrente è adattata a una scheda Pokémon per Pokerole: profilo, attributi, sociali, abilità, mosse e riserva di dadi d6.

## Avvio in locale

```sh
npm install
npm run dev
```

## Supabase per la mappa e la presentazione condivise

1. Copia `.env.example` in `.env.local` e inserisci URL del progetto e chiave `sb_publishable`.
2. Nel dashboard Supabase abilita **Anonymous Sign-Ins** in **Authentication → Sign In / Providers**.
3. Esegui in ordine cronologico, una sola volta ciascuno, tutti i file SQL in `supabase/migrations/` nel **SQL Editor** del progetto. In particolare, la modalità presentazione richiede `20261113170000_image_composition.sql`; se l’hai già eseguita, applica anche `20261113190000_image_composition_replica_identity.sql` per abilitare gli aggiornamenti in tempo reale. I segnalini condivisi richiedono inoltre `20261113180000_shared_map_tokens.sql`.
4. Riavvia Vite dopo aver modificato `.env.local`.

La scheda **Tavolo** offre una mappa e una modalità presentazione. Senza una stanza, i segnalini funzionano in locale sul dispositivo; per sincronizzarli, il Master crea una stanza e condivide il codice, e i giocatori entrano scegliendo il proprio personaggio. Ciascun partecipante può aggiungere e spostare i segnalini del proprio personaggio e dei propri Pokémon, mentre il Master può gestire quelli di tutti.

In modalità presentazione il Master può caricare una o più immagini, oppure selezionare una cartella: il browser mostra le immagini trovate anche nelle sottocartelle, filtrabili per percorso e selezionabili prima dell’upload. Le immagini possono poi essere spostate, ridimensionate, riordinate e rimosse; la scena si sincronizza mentre viene modificata e può essere mostrata a schermo intero.

## Stato del prototipo

- Scheda Pokémon demo modificabile, inclusi punti, attributi, abilità e mosse.
- Tiri digitali di una riserva di d6 (4–6 contano come successi).
- Inserimento manuale dei risultati dei dadi fisici.
- Tiri segreti con rivelazione manuale e registro locale.
- Partecipanti e appunti dimostrativi.
- Mappa condivisa, segnalini di personaggi e Pokémon e collage immagini Supabase aggiornati in tempo reale tramite codice stanza.

Le schede Pokémon e Allenatore, i tiri e gli appunti restano locali e non sono ancora sincronizzati tra browser.

## Licenze e marchi

Progetto fan-made non ufficiale, senza affiliazione o approvazione da parte di Pokerole Project o dei titolari dei marchi Pokémon. Non include il manuale fornito, illustrazioni, testi, tabelle o un catalogo di specie e mosse. Nel PDF consultato non ho trovato una licenza esplicita che autorizzi la redistribuzione; perciò l’interfaccia usa una scheda demo e campi modificabili, senza riprodurne i contenuti editoriali.

La licenza del codice di questa applicazione non è ancora stata scelta. La visibilità pubblica del repository, da sola, non concede diritti di riutilizzo.
