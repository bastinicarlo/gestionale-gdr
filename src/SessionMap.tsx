import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'

type MapToken = {
  id: string
  owner: string
  label: string
  x: number
  y: number
  color: string
}

type Props = {
  players: string[]
  hidden: boolean
}

function isHttpUrl(value: string) {
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

export function SessionMap({ players, hidden }: Props) {
  const [viewer, setViewer] = useState('Master')
  const [mapUrl, setMapUrl] = useState('')
  const [mapFile, setMapFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [failedSource, setFailedSource] = useState('')
  const [tokens, setTokens] = useState<MapToken[]>(() =>
    players.map((player, index) => ({
      id: player.toLowerCase(),
      owner: player,
      label: player,
      x: 28 + index * 22,
      y: 48 + (index % 2) * 18,
      color: ['#df3f4b', '#397cc1', '#4a9a74'][index % 3],
    })),
  )
  const [selectedTokenId, setSelectedTokenId] = useState(players[0]?.toLowerCase() ?? '')
  const [draggingTokenId, setDraggingTokenId] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const fileUrlRef = useRef('')

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current)
      }
    }
  }, [])

  const isMaster = viewer === 'Master'
  const isValidUrl = isHttpUrl(mapUrl)
  const hasInvalidUrl = mapUrl.trim() !== '' && !isValidUrl
  const imageSource = fileUrl || (isValidUrl ? mapUrl.trim() : '')
  const imageFailed = imageSource !== '' && failedSource === imageSource
  const availableTokens = isMaster
    ? tokens
    : tokens.filter((token) => token.owner === viewer)
  const selectedToken =
    tokens.find((token) => token.id === selectedTokenId) ?? availableTokens[0]

  function chooseViewer(nextViewer: string) {
    setViewer(nextViewer)
    if (nextViewer !== 'Master') {
      const ownedToken = tokens.find((token) => token.owner === nextViewer)
      setSelectedTokenId(ownedToken?.id ?? '')
    } else {
      setSelectedTokenId((current) => current || tokens[0]?.id || '')
    }
  }

  function moveToken(id: string, clientX: number, clientY: number) {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return

    const x = Math.min(96, Math.max(4, ((clientX - bounds.left) / bounds.width) * 100))
    const y = Math.min(94, Math.max(6, ((clientY - bounds.top) / bounds.height) * 100))
    setTokens((current) =>
      current.map((token) => (token.id === id ? { ...token, x, y } : token)),
    )
  }

  function handleStageClick(event: MouseEvent<HTMLDivElement>) {
    const clickedBackground =
      event.target === event.currentTarget || event.target instanceof HTMLImageElement
    if (!clickedBackground || !selectedToken || (!isMaster && selectedToken.owner !== viewer)) {
      return
    }
    moveToken(selectedToken.id, event.clientX, event.clientY)
  }

  function handleTokenPointerDown(event: PointerEvent<HTMLButtonElement>, token: MapToken) {
    event.stopPropagation()
    if (!isMaster && token.owner !== viewer) return
    setSelectedTokenId(token.id)
    setDraggingTokenId(token.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleStagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (draggingTokenId) {
      moveToken(draggingTokenId, event.clientX, event.clientY)
    }
  }

  function handleMapFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Seleziona un file immagine.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('L’immagine non può superare 20 MB.')
      return
    }
    replaceMapFile(file)
    setMapUrl('')
    setFailedSource('')
    setUploadError('')
  }

  function replaceMapFile(file: File | null) {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current)
    }
    const nextUrl = file ? URL.createObjectURL(file) : ''
    fileUrlRef.current = nextUrl
    setFileUrl(nextUrl)
    setMapFile(file)
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
          <p>Carica una mappa, poi trascina i segnalini o selezionane uno e clicca sulla mappa.</p>
        </div>
        <span className="map-local-badge">PROTOTIPO LOCALE</span>
      </div>

      <div className="map-toolbar">
        <label className="map-viewer-field">
          <span>Visualizza come</span>
          <select onChange={(event) => chooseViewer(event.target.value)} value={viewer}>
            <option value="Master">Master</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
        </label>

        <label className="map-token-field">
          <span>Segnalino selezionato</span>
          <select
            onChange={(event) => setSelectedTokenId(event.target.value)}
            value={selectedToken?.id ?? ''}
          >
            {availableTokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.label}{isMaster ? ` · ${token.owner}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={`map-upload-field${!isMaster ? ' is-disabled' : ''}`}>
          <span>Carica immagine mappa</span>
          <input
            accept="image/*"
            disabled={!isMaster}
            onChange={handleMapFile}
            type="file"
          />
        </label>

        <label className="map-url-field">
          <span>Oppure incolla un link diretto</span>
          <input
            aria-invalid={hasInvalidUrl || imageFailed}
            disabled={!isMaster}
            onChange={(event) => {
              setMapUrl(event.target.value)
              replaceMapFile(null)
              setFailedSource('')
            }}
            placeholder="https://esempio.it/mappa.jpg"
            type="url"
            value={mapUrl}
          />
        </label>
      </div>

      {!isMaster && (
        <p className="map-permission-note" role="status">
          I giocatori possono spostare solo il proprio segnalino; il Master gestisce la mappa.
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
              replaceMapFile(null)
              setFailedSource('')
            }}
            type="button"
          >
            Rimuovi
          </button>
        </p>
      )}

      <div
        className={`session-map-stage${imageSource && !imageFailed ? ' has-image' : ''}`}
        onClick={handleStageClick}
        onPointerCancel={() => setDraggingTokenId('')}
        onPointerMove={handleStagePointerMove}
        onPointerUp={() => setDraggingTokenId('')}
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
            <small>Carica un’immagine o inserisci un link diretto.</small>
          </div>
        )}

        {tokens.map((token) => {
          const canMove = isMaster || token.owner === viewer
          return (
            <button
              aria-label={`Segnalino ${token.label}, proprietario ${token.owner}${canMove ? ', trascinabile' : ', sola visualizzazione'}`}
              aria-pressed={token.id === selectedToken?.id}
              className={`map-token${token.id === selectedToken?.id ? ' is-selected' : ''}${canMove ? '' : ' is-readonly'}`}
              key={token.id}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedTokenId(token.id)
              }}
              onPointerDown={(event) => handleTokenPointerDown(event, token)}
              onPointerUp={() => setDraggingTokenId('')}
              style={{
                backgroundColor: token.color,
                left: `${token.x}%`,
                top: `${token.y}%`,
              }}
              type="button"
            >
              {token.label.slice(0, 1).toUpperCase()}
              <span>{token.label}</span>
            </button>
          )
        })}
      </div>

      <p className="session-map-footnote">
        Le modifiche sono temporanee in questa anteprima e non sono ancora condivise con altri dispositivi.
        Usa solo immagini che hai diritto di condividere.
      </p>
    </section>
  )
}
