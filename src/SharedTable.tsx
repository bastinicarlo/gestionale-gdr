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

function isSupportedImage(file: File) {
  return supportedImageTypes.has(file.type) ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name)
}

function imageContentType(file: File) {
  if (supportedImageTypes.has(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  const contentTypes: Record<string, string> = {
    avif: 'image/avif',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  return contentTypes[extension ?? ''] ?? ''
}

type Props = {
  activeRoomCode: string
  hidden: boolean
  mapEntities: MapEntity[]
  onRoomCodeChange: (code: string) => void
  players: string[]
}

export type MapEntity = {
  id: string
  owner: string
  kind: 'character' | 'pokemon'
  label: string
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

type FolderImage = {
  file: File
  previewUrl: string
  relativePath: string
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

function describeRoomSetupError(error: { code?: string; message: string }) {
  if (
    error.code === 'PGRST202' ||
    error.message.includes('claim_image_room_player') ||
    error.message.includes('get_image_room_player')
  ) {
    return `${error.message} Applica la migrazione 20261113180000_shared_map_tokens.sql nel progetto Supabase.`
  }
  return error.message
}

function describeCompositionError(error: { code?: string; message: string }) {
  if (error.message.includes('image_composition_items')) {
    return `${error.message} Applica la migrazione 20261113170000_image_composition.sql nel progetto Supabase. Se l’hai già applicata, esegui NOTIFY pgrst, 'reload schema' nel SQL Editor.`
  }
  return error.message
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SharedTable({
  activeRoomCode,
  hidden,
  mapEntities,
  onRoomCodeChange,
  players,
}: Props) {
  const [tableMode, setTableMode] = useState<'map' | 'composition'>('map')
  const [room, setRoom] = useState<Room | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinAs, setJoinAs] = useState(players[0] ?? '')
  const [playerName, setPlayerName] = useState('')
  const [userId, setUserId] = useState('')
  const [images, setImages] = useState<CompositionImage[]>([])
  const [folderImages, setFolderImages] = useState<FolderImage[]>([])
  const [folderSearch, setFolderSearch] = useState('')
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([])
  const [authReady, setAuthReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [draggingImageId, setDraggingImageId] = useState('')
  const [selectedImageId, setSelectedImageId] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const folderPreviewUrlsRef = useRef<string[]>([])
  const imagesRef = useRef<CompositionImage[]>([])
  const interactionRef = useRef<Interaction | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const roomId = room?.room_id
  const compositionHidden = hidden || tableMode !== 'composition'

  function replaceImages(nextImages: CompositionImage[]) {
    imagesRef.current = nextImages
    setImages(nextImages)
  }

  useEffect(() => {
    function updateFullscreenState() {
      setIsFullscreen(document.fullscreenElement === stageRef.current)
    }
    document.addEventListener('fullscreenchange', updateFullscreenState)
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState)
  }, [])

  useEffect(() => {
    return () => {
      folderPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (hidden || !client) return
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
          setUserId(data.session.user.id)
          setAuthReady(true)
          return
        }

        const { data: signInData, error: signInError } = await client.auth.signInAnonymously()
        if (!active) return
        if (signInError) {
          setError(
            `Accesso anonimo non disponibile. Attivalo in Supabase → Authentication → Sign In / Providers → Anonymous Sign-Ins. (${signInError.message})`,
          )
          return
        }
        if (!signInData.user) {
          setError('Supabase non ha restituito l’identità anonima.')
          return
        }
        setUserId(signInData.user.id)
        setAuthReady(true)
      } catch (caughtError) {
        if (active) setError(`Connessione a Supabase non riuscita: ${describeError(caughtError)}`)
      }
    }

    void prepareAnonymousAccess(client)
    return () => {
      active = false
    }
  }, [hidden])

  useEffect(() => {
    const client = supabase
    if (hidden || !client || !authReady || !activeRoomCode) return
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
      const { data: restoredPlayer, error: playerError } = await client.rpc(
        'get_image_room_player',
        { p_room_id: restoredRoom.room_id },
      )
      if (!active) return
      if (playerError) {
        setError(
          `Impossibile recuperare il personaggio della stanza: ${describeRoomSetupError(playerError)}`,
        )
        return
      }
      setPlayerName(typeof restoredPlayer === 'string' ? restoredPlayer : '')
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
  }, [activeRoomCode, authReady, hidden, onRoomCodeChange, room?.room_code])

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
        setError(`Impossibile caricare la composizione: ${describeCompositionError(placementError)}`)
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
          if (!interactionRef.current) {
            void loadComposition(client, roomId).catch((caughtError: unknown) => {
              if (active) {
                setError(`Aggiornamento composizione non riuscito: ${describeError(caughtError)}`)
              }
            })
          }
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
    setPlayerName(result.is_master ? 'Master' : '')
    persistRoomCode(result.room_code)
  }

  async function claimRoomPlayer(name: string) {
    const client = supabase
    if (!client || !room || room.is_master) return
    const { data, error: claimError } = await client.rpc('claim_image_room_player', {
      p_room_id: room.room_id,
      p_player_name: name,
    })
    if (claimError) {
      setError(`Assegnazione del personaggio non riuscita: ${describeRoomSetupError(claimError)}`)
      return
    }
    if (typeof data !== 'string') {
      setError('Supabase non ha confermato il personaggio selezionato.')
      return
    }
    setPlayerName(data)
    setError('')
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
    setPlayerName('Master')
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
    if (roleError) {
      setBusy(false)
      setError(`Impossibile verificare il ruolo nella stanza: ${roleError.message}`)
      return
    }

    if (isMaster !== true) {
      const { error: claimError } = await client.rpc('claim_image_room_player', {
        p_room_id: joinedRoom.room_id,
        p_player_name: joinAs,
      })
      if (claimError) {
        setBusy(false)
        setError(
          `Impossibile associare il personaggio alla stanza: ${describeRoomSetupError(claimError)}`,
        )
        return
      }
    }
    setBusy(false)
    acceptRoom({ ...joinedRoom, is_master: isMaster === true })
    setPlayerName(isMaster === true ? 'Master' : joinAs)
  }

  async function uploadImageFile(file: File): Promise<string | null> {
    const client = supabase
    const currentRoom = room
    if (!client || !currentRoom?.is_master) return 'Solo il Master può aggiungere immagini.'
    if (!isSupportedImage(file)) {
      return 'Formato non supportato. Usa JPG, PNG, GIF, WebP o AVIF.'
    }
    if (file.size > maximumImageSize) return 'L’immagine supera il limite di 20 MB.'

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'immagine'
    const storagePath = `${currentRoom.room_id}/${crypto.randomUUID()}-${safeName}`
    try {
      const { error: uploadError } = await client.storage
        .from(bucketName)
        .upload(storagePath, file, { contentType: imageContentType(file), upsert: false })
      if (uploadError) return `Caricamento non riuscito: ${uploadError.message}`

      const { data: imageRow, error: metadataError } = await client
        .from('shared_images')
        .insert({
          room_id: currentRoom.room_id,
          storage_path: storagePath,
          file_name: file.name,
        })
        .select('id')
        .single()

      if (metadataError) {
        const { error: cleanupError } = await client.storage
          .from(bucketName)
          .remove([storagePath])
        return cleanupError
          ? `Immagine caricata ma non condivisa: ${metadataError.message}. Pulizia file fallita: ${cleanupError.message}`
          : `Immagine caricata ma non condivisa: ${metadataError.message}`
      }

      const index = imagesRef.current.length
      const zIndex = Math.max(0, ...imagesRef.current.map((image) => image.z_index)) + 1
      const placement = {
        room_id: currentRoom.room_id,
        image_id: imageRow.id,
        x: 20 + (index % 3) * 30,
        y: 22 + (Math.floor(index / 3) % 3) * 28,
        width: 25,
        z_index: zIndex,
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
        return (
          `Impossibile aggiungere l’immagine alla composizione: ${describeCompositionError(placementError)}` +
          (metadataCleanupError ? ` Pulizia dati fallita: ${metadataCleanupError.message}` : '') +
          (storageCleanupError ? ` Pulizia file fallita: ${storageCleanupError.message}` : '')
        )
      }

      const { data: signedData, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 60 * 60)
      const image: CompositionImage = {
        id: imageRow.id,
        file_name: file.name,
        storage_path: storagePath,
        url: signedError ? '' : signedData.signedUrl,
        ...placement,
      }
      replaceImages([...imagesRef.current, image])
      return signedError
        ? `Immagine aggiunta, ma anteprima non disponibile: ${signedError.message}`
        : null
    } catch (caughtError) {
      return `Caricamento non riuscito: ${describeError(caughtError)}`
    }
  }

  async function uploadImages(files: File[]) {
    if (!room?.is_master || !files.length) return
    setBusy(true)
    setError('')
    setNotice('')
    let uploadedCount = 0
    const failures: string[] = []
    for (const file of files) {
      const uploadError = await uploadImageFile(file)
      if (uploadError) failures.push(`${file.name}: ${uploadError}`)
      else uploadedCount += 1
    }
    setBusy(false)
    if (uploadedCount) {
      setNotice(`${uploadedCount} ${uploadedCount === 1 ? 'immagine aggiunta' : 'immagini aggiunte'} alla scena.`)
    }
    if (failures.length) setError(failures.join(' '))
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await uploadImages(files)
  }

  function chooseFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    folderPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    const images = files
      .filter(isSupportedImage)
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        relativePath: file.webkitRelativePath || file.name,
      }))
    folderPreviewUrlsRef.current = images.map((image) => image.previewUrl)
    setFolderImages(images)
    setFolderSearch('')
    setSelectedFolderPaths([])
    setError(
      images.length
        ? ''
        : 'La cartella selezionata non contiene immagini JPG, PNG, GIF, WebP o AVIF.',
    )
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
    setSelectedImageId(image.id)
    setDraggingImageId(image.id)
  }

  function persistImagePosition(imageId: string) {
    const client = supabase
    const currentRoom = room
    const image = imagesRef.current.find((item) => item.id === imageId)
    if (!client || !currentRoom || !image) return Promise.resolve(false)

    const save = async () => {
      const { error: saveError } = await client
        .from('image_composition_items')
        .update({ x: image.x, y: image.y, width: image.width })
        .eq('room_id', currentRoom.room_id)
        .eq('image_id', image.id)
      if (saveError) {
        setError(`Posizione non salvata: ${saveError.message}`)
        return false
      }
      return true
    }

    const queuedSave = saveQueueRef.current.then(save, save)
    saveQueueRef.current = queuedSave.then(() => undefined)
    return queuedSave
  }

  function scheduleImagePositionSave(imageId: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persistImagePosition(imageId)
    }, 140)
  }

  function moveInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!interaction || !bounds || bounds.width === 0 || bounds.height === 0) return

    const deltaX = ((event.clientX - interaction.startX) / bounds.width) * 100
    const deltaY = ((event.clientY - interaction.startY) / bounds.height) * 100
    const updated = imagesRef.current.map((image) => {
      if (image.id !== interaction.imageId) return image
      if (interaction.mode === 'resize') {
        return { ...image, width: clamp(interaction.originalWidth + deltaX, 10, 65) }
      }
      const x = clamp(interaction.originalX + deltaX, image.width / 2, 100 - image.width / 2)
      const y = clamp(interaction.originalY + deltaY, 8, 92)
      return { ...image, x, y }
    })
    imagesRef.current = updated
    setImages(updated)
    scheduleImagePositionSave(interaction.imageId)
  }

  async function finishInteraction() {
    const interaction = interactionRef.current
    interactionRef.current = null
    setDraggingImageId('')
    if (!interaction || !room || !supabase) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const saved = await persistImagePosition(interaction.imageId)
    if (saved) return

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
  }

  async function bringSelectedImageForward() {
    const client = supabase
    if (!client || !room || !room.is_master || !selectedImageId) return
    const selected = imagesRef.current.find((image) => image.id === selectedImageId)
    if (!selected) return
    const zIndex = Math.max(0, ...imagesRef.current.map((image) => image.z_index)) + 1
    const { error: saveError } = await client
      .from('image_composition_items')
      .update({ z_index: zIndex })
      .eq('room_id', room.room_id)
      .eq('image_id', selected.id)
    if (saveError) {
      setError(`Impossibile portare l’immagine in primo piano: ${saveError.message}`)
      return
    }
    replaceImages(imagesRef.current.map((image) =>
      image.id === selected.id ? { ...image, z_index: zIndex } : image,
    ))
  }

  async function removeSelectedImage() {
    const client = supabase
    if (!client || !room || !room.is_master || !selectedImageId) return
    const selected = imagesRef.current.find((image) => image.id === selectedImageId)
    if (!selected) return
    setBusy(true)
    const { error: deleteError } = await client
      .from('shared_images')
      .delete()
      .eq('room_id', room.room_id)
      .eq('id', selected.id)
    if (deleteError) {
      setBusy(false)
      setError(`Impossibile rimuovere l’immagine: ${deleteError.message}`)
      return
    }
    const { error: storageError } = await client.storage
      .from(bucketName)
      .remove([selected.storage_path])
    replaceImages(imagesRef.current.filter((image) => image.id !== selected.id))
    setSelectedImageId('')
    setBusy(false)
    if (storageError) {
      setError(`Immagine rimossa dalla scena, ma il file non è stato eliminato: ${storageError.message}`)
      return
    }
    setNotice('Immagine rimossa dalla scena condivisa.')
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === stageRef.current) {
        await document.exitFullscreen()
      } else {
        await stageRef.current?.requestFullscreen()
      }
    } catch (caughtError) {
      setError(`Impossibile attivare lo schermo intero: ${describeError(caughtError)}`)
    }
  }

  function leaveRoom() {
    setRoom(null)
    replaceImages([])
    setSelectedImageId('')
    setJoinCode('')
    setPlayerName('')
    setError('')
    setNotice('')
    persistRoomCode('')
  }

  const selectedCompositionImage = images.find((image) => image.id === selectedImageId)
  const visibleFolderImages = folderImages.filter((image) =>
    image.relativePath.toLocaleLowerCase('it-IT')
      .includes(folderSearch.trim().toLocaleLowerCase('it-IT')),
  )
  const selectedFolderFiles = folderImages.filter((image) =>
    selectedFolderPaths.includes(image.relativePath),
  )
  const allVisibleFolderImagesSelected =
    visibleFolderImages.length > 0 &&
    visibleFolderImages.every((image) => selectedFolderPaths.includes(image.relativePath))

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
          Presentazione
        </button>
      </div>

      {tableMode === 'map' && (
        <section className="map-room-access" aria-label="Condivisione della mappa">
          {!supabase ? (
            <p className="shared-images-message" role="status">
              Configurazione Supabase mancante: la mappa condivisa richiede VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
            </p>
          ) : !authReady ? (
            <p className="shared-images-message" role={error ? 'alert' : 'status'}>
              {error || 'Connessione alla stanza in corso…'}
            </p>
          ) : !room ? (
            <div className="shared-room-setup">
              <div>
                <h3>Condividi la mappa</h3>
                <p>Crea una stanza o entra con il codice usato dagli altri partecipanti.</p>
                <button
                  className="roll-button"
                  disabled={busy}
                  onClick={() => void createRoom()}
                  type="button"
                >
                  {busy ? 'Creazione…' : 'Crea stanza'}
                </button>
              </div>
              <form onSubmit={(event) => void joinRoom(event)}>
                <label>
                  <span>Il tuo personaggio</span>
                  <select onChange={(event) => setJoinAs(event.target.value)} value={joinAs}>
                    {players.map((player) => <option key={player} value={player}>{player}</option>)}
                  </select>
                </label>
                <label>
                  <span>Codice stanza</span>
                  <input
                    autoComplete="off"
                    maxLength={19}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="ABCD-EF12-3456-7890"
                    value={joinCode}
                  />
                </label>
                <button className="secondary-button" disabled={busy || !joinAs} type="submit">
                  Entra nella stanza
                </button>
              </form>
            </div>
          ) : (
            <div className="shared-room-bar">
              <div>
                <span>STANZA CONDIVISA · {room.is_master ? 'MASTER' : playerName || 'SCEGLI IL PERSONAGGIO'}</span>
                <strong>{room.room_code.match(/.{1,4}/g)?.join('-')}</strong>
              </div>
              <button className="text-button" onClick={leaveRoom} type="button">
                Esci dalla stanza
              </button>
            </div>
          )}
          {error && authReady && <p className="shared-images-error" role="alert">{error}</p>}
        </section>
      )}

      <SessionMap
        authReady={authReady}
        entities={mapEntities}
        hidden={hidden || tableMode !== 'map'}
        onClaimPlayer={claimRoomPlayer}
        playerName={playerName}
        players={players}
        room={room}
        userId={userId}
      />

      <section
        aria-labelledby="shared-images-title"
        className="panel shared-images-panel"
        hidden={tableMode !== 'composition'}
      >
        <div className="shared-images-heading">
          <div>
            <div className="eyebrow">TAVOLO CONDIVISO</div>
            <h2 id="shared-images-title">Modalità presentazione</h2>
            <p>Il Master compone la scena: sposta, ridimensiona e sovrappone le immagini in diretta.</p>
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
              <label>
                <span>Il tuo personaggio</span>
                <select onChange={(event) => setJoinAs(event.target.value)} value={joinAs}>
                  {players.map((player) => <option key={player} value={player}>{player}</option>)}
                </select>
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
              <div className="presentation-image-sources">
                <label className={`shared-image-upload${busy ? ' is-disabled' : ''}`}>
                  <span>{busy ? 'Caricamento…' : '＋ Aggiungi foto'}</span>
                  <input
                    accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                    disabled={busy}
                    multiple
                    onChange={(event) => void uploadImage(event)}
                    type="file"
                  />
                </label>
                <label className={`shared-image-upload folder-picker${busy ? ' is-disabled' : ''}`}>
                  <span>Sfoglia cartella e sottocartelle</span>
                  <input
                    accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                    aria-label="Seleziona una cartella di immagini, incluse le sottocartelle"
                    disabled={busy}
                    multiple
                    onChange={chooseFolder}
                    ref={(input) => {
                      input?.setAttribute('webkitdirectory', '')
                    }}
                    type="file"
                  />
                </label>
              </div>
            ) : (
              <p className="shared-images-message">
                Solo il Master può aggiungere, spostare o ridimensionare le immagini.
              </p>
            )}

            {room.is_master && folderImages.length > 0 && (
              <section className="folder-image-library" aria-label="Libreria immagini cartella">
                <div className="folder-image-library-heading">
                  <div>
                    <strong>{folderImages.length} immagini nella cartella</strong>
                    <span>La ricerca include anche le sottocartelle.</span>
                  </div>
                  <label>
                    <input
                      aria-label="Cerca tra le immagini"
                      onChange={(event) => setFolderSearch(event.target.value)}
                      placeholder="Cerca per nome o sottocartella"
                      type="search"
                      value={folderSearch}
                    />
                  </label>
                </div>
                <div className="folder-image-grid">
                  {visibleFolderImages.map((image) => (
                    <label className="folder-image-card" key={image.relativePath}>
                      <input
                        checked={selectedFolderPaths.includes(image.relativePath)}
                        onChange={(event) => {
                          setSelectedFolderPaths((current) =>
                            event.target.checked
                              ? [...current, image.relativePath]
                              : current.filter((path) => path !== image.relativePath),
                          )
                        }}
                        type="checkbox"
                      />
                      <img alt="" loading="lazy" src={image.previewUrl} />
                      <span title={image.relativePath}>{image.relativePath}</span>
                    </label>
                  ))}
                </div>
                <div className="folder-image-library-actions">
                  <span>{selectedFolderPaths.length} selezionate</span>
                  <button
                    className="text-button"
                    disabled={!visibleFolderImages.length}
                    onClick={() => {
                      const visiblePaths = visibleFolderImages.map((image) => image.relativePath)
                      setSelectedFolderPaths((current) =>
                        allVisibleFolderImagesSelected
                          ? current.filter((path) => !visiblePaths.includes(path))
                          : [...new Set([...current, ...visiblePaths])],
                      )
                    }}
                    type="button"
                  >
                    {allVisibleFolderImagesSelected ? 'Deseleziona visibili' : 'Seleziona visibili'}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!selectedFolderFiles.length || busy}
                    onClick={() => void uploadImages(selectedFolderFiles.map((image) => image.file))}
                    type="button"
                  >
                    Aggiungi selezionate alla scena
                  </button>
                </div>
              </section>
            )}

            {room.is_master && selectedCompositionImage && (
              <div className="composition-toolbar" aria-label="Controlli immagine selezionata">
                <span>{selectedCompositionImage.file_name}</span>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void bringSelectedImageForward()}
                  type="button"
                >
                  Porta in primo piano
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void removeSelectedImage()}
                  type="button"
                >
                  Rimuovi immagine
                </button>
              </div>
            )}

            <div
              aria-label="Scena condivisa. Le modifiche del Master sono visibili in tempo reale."
              className={`image-composition-stage${isFullscreen ? ' is-fullscreen' : ''}`}
              onPointerCancel={() => void finishInteraction()}
              onPointerMove={moveInteraction}
              onPointerUp={() => void finishInteraction()}
              ref={stageRef}
              role="group"
            >
              <button
                aria-label={isFullscreen ? 'Esci dallo schermo intero' : 'Mostra la scena a schermo intero'}
                className="composition-fullscreen-button"
                onClick={() => void toggleFullscreen()}
                type="button"
              >
                {isFullscreen ? 'Esci dallo schermo intero' : 'Schermo intero'}
              </button>
              {images.length === 0 ? (
                <div className="composition-empty-state">
                  <strong>La scena è vuota</strong>
                  <span>Carica le immagini che vuoi mostrare al gruppo.</span>
                </div>
              ) : (
                images.map((image) => (
                  <div
                    aria-label={image.file_name}
                    className={`composition-image${draggingImageId === image.id ? ' is-dragging' : ''}${selectedImageId === image.id ? ' is-selected' : ''}${room.is_master ? '' : ' is-readonly'}`}
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
