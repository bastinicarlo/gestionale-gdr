import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { SessionMap } from './SessionMap'
import { supabase } from './supabase'

const bucketName = 'session-images'
const maximumImageSize = 20 * 1024 * 1024
const supportedImageTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

type Props = {
  activeRoomCode: string
  hidden: boolean
  onRoomCodeChange: (code: string) => void
  players: string[]
}

type RoomData = {
  room_id: string
  room_code: string
}

type Room = RoomData & {
  is_master: boolean
}

type CompositionImage = {
  id: string
  file_name: string
  storage_path: string
  url: string
  x: number
  y: number
  width: number
  z_index: number
}

type Interaction = {
  imageId: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originalX: number
  originalY: number
  originalWidth: number
}

type SupabaseClient = NonNullable<typeof supabase>

function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'Errore di rete non specificato.'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SharedTable({
  activeRoomCode,
  hidden,
  onRoomCodeChange,
  players,
}: Props) {
  const [tableMode, setTableMode] = useState<'map' | 'composition'>('map')
  const [room, setRoom] = useState<Room | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [images, setImages] = useState<CompositionImage[]>([])
  const [authReady, setAuthReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [draggingImageId, setDraggingImageId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<CompositionImage[]>([])
  const interactionRef = useRef<Interaction | null>(null)
  const roomId = room?.room_id
  const compositionHidden = hidden || tableMode !== 'composition'

  function replaceImages(nextImages: CompositionImage[]) {
    imagesRef.current = nextImages
    setImages(nextImages)
  }

  useEffect(() => {
    const client = supabase
    if (compositionHidden || !client) return
    let active = true

    async function prepareAnonymousAccess(client: SupabaseClient) {
      try {
        const { data, error: sessionError } = await client.auth.getSession()
        if (!active) return
        if (sessionError) {
          setError(`Impossibile inizializzare l’accesso: ${sessionError.message}`)
          return
        }
        if (data.session) {
          setAuthReady(true)
          return
        }

        const { error: signInError } = await client.auth.signInAnonymously()
        if (!active) return
        if (signInError) {
          setError(
            `Accesso anonimo non disponibile. Attivalo in Supabase → Authentication → Sign In / Providers → Anonymous Sign-Ins. (${signInError.message})`,
          )
          return
        }
        setAuthReady(true)
      } catch (caughtError) {
        if (active) setError(`Connessione a Supabase non riuscita: ${describeError(caughtError)}`)
      }
    }

    void prepareAnonymousAccess(client)
    return () => {
      active = false
    }
  }, [compositionHidden])

  useEffect(() => {
    const client = supabase
    if (compositionHidden || !client || !authReady || !activeRoomCode) return
    if (room?.room_code === activeRoomCode) return
    let active = true

    async function restoreRoom(client: SupabaseClient) {
      const { data, error: joinError } = await client.rpc('join_image_room', {
        p_room_code: normalizeRoomCode(activeRoomCode),
      })
      if (!active) return
      if (joinError) {
        setError(`Non riesco a riaprire la stanza salvata: ${joinError.message}`)
        localStorage.removeItem('cronache-image-room-code')
        onRoomCodeChange('')
        return
      }
      const restoredRoom = (data as RoomData[] | null)?.[0]
      if (!restoredRoom) {
        setError('La stanza salvata non è più disponibile. Inserisci nuovamente il codice.')
        localStorage.removeItem('cronache-image-room-code')
        onRoomCodeChange('')
        return
      }
      const { data: isMaster, error: roleError } = await client.rpc(
        'is_image_room_master',
        { p_room_id: restoredRoom.room_id },
      )
      if (!active) return
      if (roleError) {
        setError(`Impossibile verificare il ruolo nella stanza: ${roleError.message}`)
        return
      }
      setLoadingImages(true)
      setRoom({ ...restoredRoom, is_master: isMaster === true })
      setError('')
    }

    void restoreRoom(client).catch((caughtError: unknown) => {
      if (active) setError(`Connessione alla stanza non riuscita: ${describeError(caughtError)}`)
    })
    return () => {
      active = false
    }
  }, [activeRoomCode, authReady, compositionHidden, onRoomCodeChange, room?.room_code])

  useEffect(() => {
    const client = supabase
    if (compositionHidden || !client || !roomId) return
    let active = true

    async function loadComposition(client: SupabaseClient, roomId: string) {
      const { data: placements, error: placementError } = await client
        .from('image_composition_items')
        .select('image_id, x, y, width, z_index')
        .eq('room_id', roomId)
        .order('z_index', { ascending: true })

      if (!active) return
      if (placementError) {
        setError(`Impossibile caricare la composizione: ${placementError.message}`)
        setLoadingImages(false)
        return
      }
      if (!placements?.length) {
        replaceImages([])
        setLoadingImages(false)
        setError('')
        return
      }

      const imageIds = placements.map((placement) => placement.image_id)
      const { data: imageRows, error: imagesError } = await client
        .from('shared_images')
        .select('id, file_name, storage_path')
        .eq('room_id', roomId)
        .in('id', imageIds)

      if (!active) return
      if (imagesError) {
        setError(`Impossibile caricare le immagini: ${imagesError.message}`)
        setLoadingImages(false)
        return
      }

      const placementsByImage = new Map(
        placements.map((placement) => [placement.image_id, placement]),
      )
      const loadedImages = await Promise.all(
        (imageRows ?? []).map(async (image) => {
          const placement = placementsByImage.get(image.id)
          const { data: signedData, error: signedError } = await client.storage
            .from(bucketName)
            .createSignedUrl(image.storage_path, 60 * 60)
          return {
            ...image,
            url: signedError ? '' : signedData.signedUrl,
            x: Number(placement?.x ?? 50),
            y: Number(placement?.y ?? 50),
            width: Number(placement?.width ?? 25),
            z_index: Number(placement?.z_index ?? 0),
          }
        }),
      )
      if (!active) return
      replaceImages(loadedImages)
      setError(
        loadedImages.some((image) => !image.url)
          ? 'Alcune immagini non sono al momento accessibili.'
          : '',
      )
      setLoadingImages(false)
    }

    void loadComposition(client, roomId).catch((caughtError: unknown) => {
      if (!active) return
      setError(`Impossibile caricare la composizione: ${describeError(caughtError)}`)
      setLoadingImages(false)
    })

    const channel = client
      .channel(`image-composition-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'image_composition_items',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void loadComposition(client, roomId).catch((caughtError: unknown) => {
            if (active) setError(`Aggiornamento composizione non riuscito: ${describeError(caughtError)}`)
          })
        },
      )
      .subscribe((status) => {
        if (active && status === 'CHANNEL_ERROR') {
          setError('Aggiornamenti in tempo reale non disponibili. Ricarica la scheda per aggiornare.')
        }
      })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [compositionHidden, roomId])

  function persistRoomCode(code: string) {
    const normalizedCode = normalizeRoomCode(code)
    if (normalizedCode) {
      localStorage.setItem('cronache-image-room-code', normalizedCode)
    } else {
      localStorage.removeItem('cronache-image-room-code')
    }
    onRoomCodeChange(normalizedCode)
  }

  function acceptRoom(result: Room, roomImages: CompositionImage[] = []) {
    setRoom(result)
    replaceImages(roomImages)
    setLoadingImages(true)
    setError('')
    setNotice('')
    persistRoomCode(result.room_code)
  }

  async function createRoom() {
    const client = supabase
    if (!client || !authReady) return
    setBusy(true)
    setError('')
    const { data, error: createError } = await client.rpc('create_image_room')
    setBusy(false)
    if (createError) {
      setError(`Creazione stanza non riuscita: ${createError.message}`)
      return
    }
    const createdRoom = (data as RoomData[] | null)?.[0]
    if (!createdRoom) {
      setError('Supabase non ha restituito i dati della stanza.')
      return
    }
    acceptRoom({ ...createdRoom, is_master: true })
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const client = supabase
    if (!client || !authReady) return
    const code = normalizeRoomCode(joinCode)
    if (code.length !== 16) {
      setError('Inserisci il codice stanza completo.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: joinError } = await client.rpc('join_image_room', {
      p_room_code: code,
    })
    if (joinError) {
      setBusy(false)
      setError(`Codice stanza non valido o connessione non riuscita: ${joinError.message}`)
      return
    }
    const joinedRoom = (data as RoomData[] | null)?.[0]
    if (!joinedRoom) {
      setBusy(false)
      setError('Supabase non ha restituito i dati della stanza.')
      return
    }
    const { data: isMaster, error: roleError } = await client.rpc(
      'is_image_room_master',
      { p_room_id: joinedRoom.room_id },
    )
    setBusy(false)
    if (roleError) {
      setError(`Impossibile verificare il ruolo nella stanza: ${roleError.message}`)
      return
    }
    acceptRoom({ ...joinedRoom, is_master: isMaster === true })
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const client = supabase
    if (!file || !client || !room?.is_master) return
    if (!supportedImageTypes.has(file.type)) {
      setError('Formato non supportato. Usa JPG, PNG, GIF, WebP o AVIF.')
      return
    }
    if (file.size > maximumImageSize) {
      setError('L’immagine non può superare 20 MB.')
      return
    }

    setBusy(true)
    setError('')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'immagine'
    const storagePath = `${room.room_id}/${crypto.randomUUID()}-${safeName}`
    try {
      const { error: uploadError } = await client.storage
        .from(bucketName)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (uploadError) {
        setError(`Caricamento non riuscito: ${uploadError.message}`)
        return
      }

      const { data: imageRow, error: metadataError } = await client
        .from('shared_images')
        .insert({
          room_id: room.room_id,
          storage_path: storagePath,
          file_name: file.name,
        })
        .select('id')
        .single()

      if (metadataError) {
        const { error: cleanupError } = await client.storage
          .from(bucketName)
          .remove([storagePath])
        setError(
          cleanupError
            ? `Immagine caricata ma non condivisa: ${metadataError.message}. Pulizia file fallita: ${cleanupError.message}`
            : `Immagine caricata ma non condivisa: ${metadataError.message}`,
        )
        return
      }

      const index = imagesRef.current.length
      const placement = {
        room_id: room.room_id,
        image_id: imageRow.id,
        x: 20 + (index % 3) * 30,
        y: 22 + (Math.floor(index / 3) % 3) * 28,
        width: 25,
        z_index: index + 1,
      }
      const { error: placementError } = await client
        .from('image_composition_items')
        .insert(placement)

      if (placementError) {
        const { error: metadataCleanupError } = await client
          .from('shared_images')
          .delete()
          .eq('id', imageRow.id)
        const { error: storageCleanupError } = await client.storage
          .from(bucketName)
          .remove([storagePath])
        setError(
          `Impossibile aggiungere l’immagine alla composizione: ${placementError.message}` +
            (metadataCleanupError ? ` Pulizia dati fallita: ${metadataCleanupError.message}` : '') +
            (storageCleanupError ? ` Pulizia file fallita: ${storageCleanupError.message}` : ''),
        )
        return
      }

      const { data: signedData, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 60 * 60)
      if (signedError) {
        setError(`Immagine condivisa ma anteprima non disponibile: ${signedError.message}`)
        return
      }
      replaceImages([
        ...imagesRef.current,
        {
          id: imageRow.id,
          file_name: file.name,
          storage_path: storagePath,
          url: signedData.signedUrl,
          ...placement,
        },
      ])
      setNotice('Immagine aggiunta alla composizione condivisa.')
    } catch (caughtError) {
      setError(`Caricamento non riuscito: ${describeError(caughtError)}`)
    } finally {
      setBusy(false)
    }
  }

  function startInteraction(
    event: ReactPointerEvent<HTMLElement>,
    image: CompositionImage,
    mode: Interaction['mode'],
  ) {
    if (!room?.is_master) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      imageId: image.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originalX: image.x,
      originalY: image.y,
      originalWidth: image.width,
    }
    setDraggingImageId(image.id)
  }

  function moveInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!interaction || !bounds || bounds.width === 0 || bounds.height === 0) return

    const deltaX = ((event.clientX - interaction.startX) / bounds.width) * 100
    const deltaY = ((event.clientY - interaction.startY) / bounds.height) * 100
    setImages((current) => {
      const updated = current.map((image) => {
        if (image.id !== interaction.imageId) return image
        if (interaction.mode === 'resize') {
          return { ...image, width: clamp(interaction.originalWidth + deltaX, 10, 65) }
        }
        const x = clamp(interaction.originalX + deltaX, image.width / 2, 100 - image.width / 2)
        const y = clamp(interaction.originalY + deltaY, 8, 92)
        return { ...image, x, y }
      })
      imagesRef.current = updated
      return updated
    })
  }

  async function finishInteraction() {
    const interaction = interactionRef.current
    interactionRef.current = null
    setDraggingImageId('')
    if (!interaction || !room || !supabase) return
    const image = imagesRef.current.find((item) => item.id === interaction.imageId)
    if (!image) return

    const { error: saveError } = await supabase
      .from('image_composition_items')
      .update({ x: image.x, y: image.y, width: image.width })
      .eq('room_id', room.room_id)
      .eq('image_id', image.id)
    if (!saveError) return

    const restored = imagesRef.current.map((item) =>
      item.id === interaction.imageId
        ? {
            ...item,
            x: interaction.originalX,
            y: interaction.originalY,
            width: interaction.originalWidth,
          }
        : item,
    )
    replaceImages(restored)
    setError(`Posizione non salvata: ${saveError.message}`)
  }

  function leaveRoom() {
    setRoom(null)
    replaceImages([])
    setJoinCode('')
    setError('')
    setNotice('')
    persistRoomCode('')
  }

  return (
    <section className="shared-table" hidden={hidden} aria-label="Tavolo di gioco">
      <div className="table-mode-tabs" role="tablist" aria-label="Vista del tavolo">
        <button
          aria-selected={tableMode === 'map'}
          className={tableMode === 'map' ? 'is-active' : ''}
          onClick={() => setTableMode('map')}
          role="tab"
          type="button"
        >
          Mappa
        </button>
        <button
          aria-selected={tableMode === 'composition'}
          className={tableMode === 'composition' ? 'is-active' : ''}
          onClick={() => setTableMode('composition')}
          role="tab"
          type="button"
        >
          Composizione
        </button>
      </div>

      <SessionMap hidden={tableMode !== 'map'} players={players} />

      <section
        aria-labelledby="shared-images-title"
        className="panel shared-images-panel"
        hidden={tableMode !== 'composition'}
      >
        <div className="shared-images-heading">
          <div>
            <div className="eyebrow">TAVOLO CONDIVISO</div>
            <h2 id="shared-images-title">Composizione immagini</h2>
            <p>Il Master aggiunge e dispone le immagini; gli altri le vedono in tempo reale.</p>
          </div>
          <span className="map-local-badge">SUPABASE</span>
        </div>

        {!supabase ? (
          <p className="shared-images-message" role="status">
            Configurazione Supabase mancante. Imposta VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
          </p>
        ) : !authReady ? (
          <p className="shared-images-message" role={error ? 'alert' : 'status'}>
            {error || 'Connessione a Supabase in corso…'}
          </p>
        ) : !room ? (
          <div className="shared-room-setup">
            <div>
              <h3>Crea una stanza</h3>
              <p>Genera un codice da condividere con chi deve vedere la composizione.</p>
              <button
                className="roll-button"
                disabled={busy}
                onClick={() => void createRoom()}
                type="button"
              >
                {busy ? 'Creazione…' : 'Crea stanza e codice'}
              </button>
            </div>
            <form onSubmit={(event) => void joinRoom(event)}>
              <label>
                <span>Oppure inserisci un codice stanza</span>
                <input
                  autoComplete="off"
                  maxLength={19}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="ABCD-EF12-3456-7890"
                  value={joinCode}
                />
              </label>
              <button className="secondary-button" disabled={busy} type="submit">
                Entra nella stanza
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="shared-room-bar">
              <div>
                <span>CODICE DA CONDIVIDERE</span>
                <strong>{room.room_code.match(/.{1,4}/g)?.join('-')}</strong>
              </div>
              <button
                className="secondary-button"
                onClick={() => {
                  if (!navigator.clipboard) {
                    setError('Copia non disponibile: seleziona e copia il codice mostrato.')
                    return
                  }
                  void navigator.clipboard.writeText(room.room_code).then(
                    () => setNotice('Codice copiato.'),
                    () => setError('Copia non riuscita: seleziona e copia il codice mostrato.'),
                  )
                }}
                type="button"
              >
                Copia codice
              </button>
              <button className="text-button" onClick={leaveRoom} type="button">
                Esci dalla stanza
              </button>
            </div>

            {room.is_master ? (
              <label className={`shared-image-upload${busy ? ' is-disabled' : ''}`}>
                <span>{busy ? 'Caricamento…' : '＋ Aggiungi immagine al tavolo'}</span>
                <input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => void uploadImage(event)}
                  type="file"
                />
              </label>
            ) : (
              <p className="shared-images-message">
                Solo il Master può aggiungere, spostare o ridimensionare le immagini.
              </p>
            )}

            <div
              aria-label="Composizione condivisa. Trascina un’immagine per spostarla e usa l’angolo per ridimensionarla."
              className="image-composition-stage"
              onPointerCancel={() => void finishInteraction()}
              onPointerMove={moveInteraction}
              onPointerUp={() => void finishInteraction()}
              ref={stageRef}
              role="group"
            >
              {images.length === 0 ? (
                <div className="composition-empty-state">
                  <strong>Il tavolo è vuoto</strong>
                  <span>Carica un’immagine per aggiungerla alla composizione.</span>
                </div>
              ) : (
                images.map((image) => (
                  <div
                    aria-label={image.file_name}
                    className={`composition-image${draggingImageId === image.id ? ' is-dragging' : ''}${room.is_master ? '' : ' is-readonly'}`}
                    key={image.id}
                    onPointerDown={(event) => startInteraction(event, image, 'move')}
                    style={{
                      left: `${image.x}%`,
                      top: `${image.y}%`,
                      width: `${image.width}%`,
                      zIndex: image.z_index,
                    }}
                  >
                    {image.url ? (
                      <img alt={image.file_name} draggable={false} src={image.url} />
                    ) : (
                      <span className="composition-image-unavailable">Anteprima non disponibile</span>
                    )}
                    <span className="composition-image-label">{image.file_name}</span>
                    {room.is_master && (
                      <button
                        aria-label={`Ridimensiona ${image.file_name}`}
                        className="composition-resize-handle"
                        onPointerDown={(event) => startInteraction(event, image, 'resize')}
                        title="Trascina per ridimensionare"
                        type="button"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
            {loadingImages && <p className="shared-images-message">Caricamento composizione…</p>}
          </>
        )}

        {error && authReady && <p className="shared-images-error" role="alert">{error}</p>}
        {notice && <p className="shared-images-notice" role="status">{notice}</p>}
        <p className="shared-images-footnote">
          Le immagini e le loro posizioni si sincronizzano nella stanza. Il codice consente di entrare e vedere la composizione.
        </p>
      </section>
    </section>
  )
}
