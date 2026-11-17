import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from 'react'
import { supabase } from './supabase'
import type { MapEntity } from './SharedTable'

type MapToken = {
  id: string
  owner_user_id: string
  owner_name: string
  entity_id: string
  entity_kind: MapEntity['kind']
  label: string
  x: number
  y: number
  color: string
}

type Room = {
  room_id: string
  is_master: boolean
}

type RoomMember = {
  user_id: string
  player_name: string
}

type Props = {
  authReady: boolean
  entities: MapEntity[]
  hidden: boolean
  onClaimPlayer: (name: string) => Promise<void>
  playerName: string
  players: string[]
  room: Room | null
  userId: string
}

const bucketName = 'session-images'
const maximumImageSize = 20 * 1024 * 1024
const supportedImageTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const tokenColors = ['#df3f4b', '#397cc1', '#4a9a74', '#8256a5']

function isHttpUrl(value: string) {
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'Errore di rete non specificato.'
}

function describeTokenError(error: { code?: string; message: string }) {
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message.includes('map_tokens')
  ) {
    return `${error.message} Applica la migrazione 20261113180000_shared_map_tokens.sql nel progetto Supabase.`
  }
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return `${error.message} Verifica che la migrazione sia applicata e che il giocatore abbia collegato il proprio personaggio alla stanza.`
  }
  return error.message
}

export function SessionMap({
  authReady,
  entities,
  hidden,
  onClaimPlayer,
  playerName,
  players,
  room,
  userId,
}: Props) {
  const [mapUrl, setMapUrl] = useState('')
  const [sharedMapSource, setSharedMapSource] = useState('')
  const [mapFile, setMapFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [tokens, setTokens] = useState<MapToken[]>([])
  const [tokensRoomId, setTokensRoomId] = useState('')
  const [mapRoomId, setMapRoomId] = useState('')
  const [localTokens, setLocalTokens] = useState<MapToken[]>([])
  const [localViewer, setLocalViewer] = useState('Master')
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [claimName, setClaimName] = useState(players[0] ?? '')
  const [draggingTokenId, setDraggingTokenId] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [failedSource, setFailedSource] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const tokensRef = useRef<MapToken[]>([])
  const fileUrlRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draggingTokenRef = useRef('')
  const roomId = room?.room_id

  function replaceTokens(nextTokens: MapToken[]) {
    tokensRef.current = nextTokens
    setTokens(nextTokens)
  }

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (hidden || !roomId || !authReady || !supabase) {
      return
    }

    const client = supabase
    const activeRoomId = roomId
    let active = true

    async function loadTokens() {
      const { data, error } = await client
        .from('map_tokens')
        .select('id, owner_user_id, owner_name, entity_id, entity_kind, label, x, y, color')
        .eq('room_id', activeRoomId)
        .order('created_at', { ascending: true })
      if (!active) return
      if (error) {
        setUploadError(`Impossibile caricare i segnalini: ${describeTokenError(error)}`)
        return
      }
      replaceTokens((data ?? []).map((token) => ({
        ...token,
        x: Number(token.x),
        y: Number(token.y),
      })))
      setTokensRoomId(activeRoomId)
      setUploadError('')
    }

    async function loadMap() {
      const { data, error } = await client
        .from('image_room_maps')
        .select('storage_path, source_url')
        .eq('room_id', activeRoomId)
        .maybeSingle()
      if (!active) return
      if (error) {
        setUploadError(`Impossibile caricare la mappa condivisa: ${error.message}`)
        return
      }
      setMapUrl(data?.source_url ?? '')
      if (data?.source_url) {
        setSharedMapSource(data.source_url)
        setMapRoomId(activeRoomId)
        return
      }
      if (!data?.storage_path) {
        setSharedMapSource('')
        setMapRoomId(activeRoomId)
        return
      }
      const { data: signedData, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(data.storage_path, 60 * 60)
      if (!active) return
      if (signedError) {
        setUploadError(`Impossibile visualizzare la mappa condivisa: ${signedError.message}`)
        return
      }
      setSharedMapSource(signedData.signedUrl)
      setMapRoomId(activeRoomId)
    }

    void Promise.all([loadTokens(), loadMap()]).catch((error: unknown) => {
      if (active) setUploadError(`Connessione alla mappa non riuscita: ${describeError(error)}`)
    })

    const channel = client
      .channel(`shared-map-${activeRoomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'map_tokens',
        filter: `room_id=eq.${activeRoomId}`,
      }, () => {
        if (!draggingTokenRef.current) void loadTokens()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'image_room_maps',
        filter: `room_id=eq.${activeRoomId}`,
      }, () => void loadMap())
      .subscribe((status) => {
        if (active && status === 'CHANNEL_ERROR') {
          setUploadError('Aggiornamenti mappa non disponibili. Ricarica la scheda per aggiornare.')
        }
      })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [authReady, hidden, roomId])

  const activePlayerName = room ? playerName : localViewer
  const isMaster = room ? room.is_master : localViewer === 'Master'
  const canAddTokens = room ? isMaster || Boolean(playerName) : true
  const roomTokens = roomId === tokensRoomId ? tokens : []
  const visibleTokens = room ? roomTokens : localTokens
  const availableEntities = entities.filter((entity) =>
    (isMaster || entity.owner === activePlayerName) &&
    !visibleTokens.some((token) => token.entity_id === entity.id && token.owner_name === entity.owner),
  )
  const selectedEntity =
    availableEntities.find((entity) => entity.id === selectedEntityId) ?? availableEntities[0]
  const movableTokens = isMaster
    ? visibleTokens
    : visibleTokens.filter((token) =>
      token.owner_user_id === (room ? userId : `local:${localViewer}`),
    )
  const selectedToken =
    visibleTokens.find((token) => token.id === selectedTokenId) ?? movableTokens[0]
  const canDeleteSelectedToken = Boolean(
    selectedToken &&
    (isMaster ||
      selectedToken.owner_user_id === (room ? userId : `local:${localViewer}`)),
  )
  const imageSource = roomId
    ? mapRoomId === roomId
      ? sharedMapSource || (isHttpUrl(mapUrl) ? mapUrl.trim() : '')
      : ''
    : fileUrl || (isHttpUrl(mapUrl) ? mapUrl.trim() : '')
  const imageFailed = imageSource !== '' && failedSource === imageSource
  const hasInvalidUrl = mapUrl.trim() !== '' && !isHttpUrl(mapUrl)

  async function addToken() {
    const client = supabase
    if (!selectedEntity || !canAddTokens) return
    if (!room) {
      const ownerName = selectedEntity.owner
      const token: MapToken = {
        id: crypto.randomUUID(),
        owner_user_id: `local:${ownerName}`,
        owner_name: ownerName,
        entity_id: selectedEntity.id,
        entity_kind: selectedEntity.kind,
        label: selectedEntity.label,
        x: 50,
        y: 50,
        color: tokenColors[Math.max(0, players.indexOf(ownerName)) % tokenColors.length],
      }
      setLocalTokens((current) => [...current, token])
      setSelectedTokenId(token.id)
      return
    }
    if (!client || !userId) return
    let owner: RoomMember | undefined
    if (isMaster && selectedEntity.owner !== 'Master') {
      const { data, error } = await client.rpc('list_image_room_players', {
        p_room_id: room.room_id,
      })
      if (error) {
        setUploadError(
          `Impossibile verificare il proprietario del segnalino: ${describeTokenError(error)}`,
        )
        return
      }
      const roomPlayers = (data ?? []) as RoomMember[]
      owner = roomPlayers.find((member) => member.player_name === selectedEntity.owner)
    } else {
      owner = isMaster
        ? { user_id: userId, player_name: 'Master' }
        : { user_id: userId, player_name: playerName }
    }
    if (!owner) {
      setUploadError(`Prima ${selectedEntity.owner} deve entrare nella stanza condivisa.`)
      return
    }
    setBusy(true)
    setUploadError('')
    const { data, error } = await client
      .from('map_tokens')
      .insert({
        room_id: room.room_id,
        owner_user_id: owner.user_id,
        owner_name: owner.player_name,
        entity_id: selectedEntity.id,
        entity_kind: selectedEntity.kind,
        label: selectedEntity.label,
        x: 50,
        y: 50,
        color: tokenColors[Math.max(0, players.indexOf(selectedEntity.owner)) % tokenColors.length],
      })
      .select('id, owner_user_id, owner_name, entity_id, entity_kind, label, x, y, color')
      .single()
    setBusy(false)
    if (error) {
      setUploadError(`Impossibile aggiungere il segnalino: ${describeTokenError(error)}`)
      return
    }
    const token = { ...data, x: Number(data.x), y: Number(data.y) }
    const currentRoomTokens =
      tokensRoomId === room.room_id ? tokensRef.current : []
    setTokensRoomId(room.room_id)
    replaceTokens([...currentRoomTokens, token])
    setSelectedTokenId(token.id)
  }

  async function persistToken(id: string) {
    const client = supabase
    if (!client || !room) return
    const token = tokensRef.current.find((item) => item.id === id)
    if (!token) return
    const { error } = await client
      .from('map_tokens')
      .update({ x: token.x, y: token.y })
      .eq('room_id', room.room_id)
      .eq('id', id)
    if (error) setUploadError(`Posizione del segnalino non salvata: ${error.message}`)
  }

  function moveToken(id: string, clientX: number, clientY: number) {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return
    const x = Math.min(96, Math.max(4, ((clientX - bounds.left) / bounds.width) * 100))
    const y = Math.min(94, Math.max(6, ((clientY - bounds.top) / bounds.height) * 100))
    const currentTokens = room ? tokensRef.current : localTokens
    const nextTokens = currentTokens.map((token) =>
      token.id === id ? { ...token, x, y } : token,
    )
    if (room) replaceTokens(nextTokens)
    else setLocalTokens(nextTokens)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistToken(id)
    }, 140)
  }

  function startTokenDrag(event: PointerEvent<HTMLButtonElement>, token: MapToken) {
    const canMove = isMaster || token.owner_user_id === userId
    event.stopPropagation()
    if (!canMove) return
    setSelectedTokenId(token.id)
    setDraggingTokenId(token.id)
    draggingTokenRef.current = token.id
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishTokenDrag() {
    const id = draggingTokenRef.current
    draggingTokenRef.current = ''
    setDraggingTokenId('')
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (id) void persistToken(id)
  }

  async function deleteSelectedToken() {
    const client = supabase
    if (!selectedToken || !canDeleteSelectedToken) return
    if (!room) {
      setLocalTokens((current) => current.filter((token) => token.id !== selectedToken.id))
      setSelectedTokenId('')
      return
    }
    if (!client || (!isMaster && selectedToken.owner_user_id !== userId)) return
    setBusy(true)
    const { error } = await client
      .from('map_tokens')
      .delete()
      .eq('room_id', room.room_id)
      .eq('id', selectedToken.id)
    setBusy(false)
    if (error) {
      setUploadError(`Impossibile rimuovere il segnalino: ${error.message}`)
      return
    }
    replaceTokens(tokensRef.current.filter((token) => token.id !== selectedToken.id))
    setSelectedTokenId('')
  }

  function replaceLocalMapFile(file: File | null) {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
    const nextUrl = file ? URL.createObjectURL(file) : ''
    fileUrlRef.current = nextUrl
    setFileUrl(nextUrl)
    setMapFile(file)
  }

  async function saveSharedMap(storagePath: string | null, sourceUrl: string | null, fileName: string) {
    const client = supabase
    if (!client || !room || !isMaster || !userId) return false
    const { error } = await client
      .from('image_room_maps')
      .upsert({
        room_id: room.room_id,
        storage_path: storagePath,
        source_url: sourceUrl,
        file_name: fileName,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'room_id' })
    if (error) {
      setUploadError(`Impossibile condividere la mappa: ${error.message}`)
      return false
    }
    return true
  }

  async function handleMapFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    if (!supportedImageTypes.has(file.type)) {
      setUploadError('Formato non supportato. Usa JPG, PNG, GIF, WebP o AVIF.')
      return
    }
    if (file.size > maximumImageSize) {
      setUploadError('L’immagine non può superare 20 MB.')
      return
    }
    if (!room || !isMaster || !supabase) {
      replaceLocalMapFile(file)
      setUploadError('')
      return
    }

    const client = supabase
    const path = `${room.room_id}/map/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'mappa'}`
    setBusy(true)
    setUploadError('')
    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setBusy(false)
      setUploadError(`Caricamento della mappa non riuscito: ${uploadError.message}`)
      return
    }
    const { data: currentMap, error: readError } = await client
      .from('image_room_maps')
      .select('storage_path')
      .eq('room_id', room.room_id)
      .maybeSingle()
    if (readError) {
      const { error: cleanupError } = await client.storage.from(bucketName).remove([path])
      setBusy(false)
      setUploadError(
        `Impossibile verificare la mappa precedente: ${readError.message}` +
          (cleanupError ? ` Pulizia del nuovo file fallita: ${cleanupError.message}` : ''),
      )
      return
    }
    if (!await saveSharedMap(path, null, file.name)) {
      const { error: cleanupError } = await client.storage.from(bucketName).remove([path])
      setBusy(false)
      if (cleanupError) {
        setUploadError(`Mappa non condivisa e pulizia del file fallita: ${cleanupError.message}`)
      }
      return
    }
    const { data: signedData, error: signedError } = await client.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 60)
    if (signedError) {
      setUploadError(`Mappa condivisa ma anteprima non disponibile: ${signedError.message}`)
    } else {
      setSharedMapSource(signedData.signedUrl)
      setMapRoomId(room.room_id)
      setMapUrl('')
      setFailedSource('')
    }
    if (currentMap?.storage_path) {
      const { error: cleanupError } = await client.storage
        .from(bucketName)
        .remove([currentMap.storage_path])
      if (cleanupError) setUploadError(`Mappa aggiornata, ma il vecchio file non è stato rimosso: ${cleanupError.message}`)
    }
    setMapFile(null)
    replaceLocalMapFile(null)
    setBusy(false)
  }

  async function saveMapUrl() {
    const client = supabase
    if (!client || !room || !isMaster || !isHttpUrl(mapUrl)) return
    setBusy(true)
    setUploadError('')
    const { data: currentMap, error: readError } = await client
      .from('image_room_maps')
      .select('storage_path')
      .eq('room_id', room.room_id)
      .maybeSingle()
    if (readError) {
      setBusy(false)
      setUploadError(`Impossibile verificare la mappa precedente: ${readError.message}`)
      return
    }
    if (!await saveSharedMap(null, mapUrl.trim(), 'Mappa da link')) {
      setBusy(false)
      return
    }
    if (currentMap?.storage_path) {
      const { error } = await client.storage.from(bucketName).remove([currentMap.storage_path])
      if (error) setUploadError(`Link condiviso, ma il vecchio file non è stato rimosso: ${error.message}`)
    }
    setSharedMapSource(mapUrl.trim())
    setMapRoomId(room.room_id)
    setFailedSource('')
    setBusy(false)
  }

  async function removeSharedMap() {
    const client = supabase
    if (!client || !room || !isMaster) return
    setBusy(true)
    const { data: currentMap, error: readError } = await client
      .from('image_room_maps')
      .select('storage_path')
      .eq('room_id', room.room_id)
      .maybeSingle()
    if (readError) {
      setBusy(false)
      setUploadError(`Impossibile caricare la mappa corrente: ${readError.message}`)
      return
    }
    const { error } = await client
      .from('image_room_maps')
      .delete()
      .eq('room_id', room.room_id)
    if (error) {
      setBusy(false)
      setUploadError(`Impossibile rimuovere la mappa: ${error.message}`)
      return
    }
    if (currentMap?.storage_path) {
      const { error: cleanupError } = await client.storage.from(bucketName).remove([currentMap.storage_path])
      if (cleanupError) {
        setUploadError(`Mappa rimossa, ma il file non è stato eliminato: ${cleanupError.message}`)
      }
    }
    setSharedMapSource('')
    setMapRoomId(room.room_id)
    setMapUrl('')
    setFailedSource('')
    setBusy(false)
  }

  return (
    <section
      aria-labelledby="session-map-title"
      className="panel session-map-panel"
      hidden={hidden}
    >
      <div className="session-map-heading">
        <div>
          <div className="eyebrow">TAVOLO DI GIOCO</div>
          <h2 id="session-map-title">Mappa della sessione</h2>
          <p>Ogni partecipante può aggiungere e spostare i propri personaggi e Pokémon.</p>
        </div>
        <span className="map-local-badge">{room ? 'SINCRONIZZATA' : 'LOCALE'}</span>
      </div>

      <div className="map-toolbar">
        {!room && (
          <label className="map-token-field">
            <span>Gestisci localmente come</span>
            <select
              onChange={(event) => {
                setLocalViewer(event.target.value)
                setSelectedTokenId('')
              }}
              value={localViewer}
            >
              <option value="Master">Master</option>
              {players.map((player) => <option key={player} value={player}>{player}</option>)}
            </select>
          </label>
        )}
        <label className="map-token-field">
          <span>Personaggio o Pokémon</span>
          <select
            disabled={!canAddTokens || availableEntities.length === 0}
            onChange={(event) => setSelectedEntityId(event.target.value)}
            value={selectedEntity?.id ?? ''}
          >
            {availableEntities.length === 0 ? (
              <option value="">Nessun segnalino disponibile</option>
            ) : availableEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.kind === 'character' ? 'Personaggio' : 'Pokémon'} · {entity.label}
                {isMaster ? ` · ${entity.owner}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={!selectedEntity || !canAddTokens || busy}
          onClick={() => void addToken()}
          type="button"
        >
          ＋ Aggiungi segnalino
        </button>

        <label className="map-token-field">
          <span>Segnalino da spostare</span>
          <select
            disabled={movableTokens.length === 0}
            onChange={(event) => setSelectedTokenId(event.target.value)}
            value={selectedToken?.id ?? ''}
          >
            {movableTokens.length === 0 ? (
              <option value="">Nessun segnalino tuo</option>
            ) : movableTokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.label}{isMaster ? ` · ${token.owner_name}` : ''}
              </option>
            ))}
          </select>
        </label>
        {canDeleteSelectedToken && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void deleteSelectedToken()}
            type="button"
          >
            Rimuovi segnalino
          </button>
        )}

        <label className={`map-upload-field${!isMaster ? ' is-disabled' : ''}`}>
          <span>{busy ? 'Salvataggio…' : 'Carica mappa'}</span>
          <input
            accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
            disabled={busy || Boolean(room && !isMaster)}
            onChange={(event) => void handleMapFile(event)}
            type="file"
          />
        </label>

        <label className="map-url-field">
          <span>Oppure incolla un link diretto</span>
          <input
            aria-invalid={hasInvalidUrl || imageFailed}
            disabled={Boolean(room && !isMaster)}
            onChange={(event) => {
              setMapUrl(event.target.value)
                setSharedMapSource('')
              setFailedSource('')
              setUploadError('')
            }}
            placeholder="https://esempio.it/mappa.jpg"
            type="url"
            value={mapUrl}
          />
        </label>
        {room && isMaster && (
          <button
            className="secondary-button"
            disabled={!isHttpUrl(mapUrl) || busy}
            onClick={() => void saveMapUrl()}
            type="button"
          >
            Condividi link
          </button>
        )}
        {room && isMaster && sharedMapSource && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void removeSharedMap()}
            type="button"
          >
            Rimuovi mappa
          </button>
        )}
      </div>

      {!room && (
        <p className="map-permission-note" role="status">
          Modalità locale: i segnalini sono visibili solo su questo dispositivo. Crea o apri una stanza per condividerli.
        </p>
      )}
      {room && !isMaster && !playerName && (
        <div className="map-player-claim">
          <label>
            <span>Collega il tuo personaggio</span>
            <select onChange={(event) => setClaimName(event.target.value)} value={claimName}>
              {players.map((player) => <option key={player} value={player}>{player}</option>)}
            </select>
          </label>
          <button
            className="secondary-button"
            disabled={!claimName}
            onClick={() => void onClaimPlayer(claimName)}
            type="button"
          >
            Conferma
          </button>
        </div>
      )}
      {room && !isMaster && (
        <p className="map-permission-note" role="status">
          Sposta solo i tuoi segnalini. Il Master gestisce la mappa condivisa.
        </p>
      )}
      {hasInvalidUrl && (
        <p className="map-error" role="alert">Il link deve iniziare con http:// o https://.</p>
      )}
      {imageFailed && (
        <p className="map-error" role="alert">
          Mappa non caricata: verifica che il link sia diretto a un’immagine accessibile.
        </p>
      )}
      {uploadError && <p className="map-error" role="alert">{uploadError}</p>}
      {mapFile && (
        <p className="map-file-name" role="status">
          File selezionato: {mapFile.name}
          <button
            onClick={() => {
              replaceLocalMapFile(null)
              setFailedSource('')
            }}
            type="button"
          >
            Rimuovi anteprima
          </button>
        </p>
      )}

      <div
        className={`session-map-stage${imageSource && !imageFailed ? ' has-image' : ''}`}
        onPointerCancel={finishTokenDrag}
        onPointerMove={(event) => {
          if (draggingTokenId) moveToken(draggingTokenId, event.clientX, event.clientY)
        }}
        onPointerUp={finishTokenDrag}
        ref={stageRef}
      >
        {imageSource && !imageFailed ? (
          <img
            alt="Mappa della sessione"
            className="session-map-image"
            draggable={false}
            onError={() => setFailedSource(imageSource)}
            referrerPolicy="no-referrer"
            src={imageSource}
          />
        ) : (
          <div className="map-empty-state">
            <span className="map-empty-icon" aria-hidden="true">⌖</span>
            <strong>{imageFailed ? 'Immagine non disponibile' : 'La mappa apparirà qui'}</strong>
            <small>Il Master può caricare un’immagine o inserire un link diretto.</small>
          </div>
        )}

        {visibleTokens.map((token) => {
          const canMove = isMaster ||
            token.owner_user_id === (room ? userId : `local:${localViewer}`)
          return (
            <button
              aria-label={`Segnalino ${token.entity_kind === 'character' ? 'personaggio' : 'Pokémon'} ${token.label}, proprietario ${token.owner_name}${canMove ? ', trascinabile' : ', sola visualizzazione'}`}
              aria-pressed={token.id === selectedToken?.id}
              className={`map-token${token.id === selectedToken?.id ? ' is-selected' : ''}${canMove ? '' : ' is-readonly'}`}
              key={token.id}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedTokenId(token.id)
              }}
              onPointerDown={(event) => startTokenDrag(event, token)}
              style={{
                backgroundColor: token.color,
                left: `${token.x}%`,
                top: `${token.y}%`,
              }}
              type="button"
            >
              {token.label.slice(0, 1).toUpperCase()}
              <span>{token.label} · {token.owner_name}</span>
            </button>
          )
        })}
      </div>

      <p className="session-map-footnote">
        Segnalini e mappa sono sincronizzati in tempo reale nella stanza. Usa solo immagini che hai diritto di condividere.
      </p>
    </section>
  )
}
