import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { cn } from '../../../../lib/cn'

const MAX_SIZE = 2 * 1024 * 1024

export function CharacterPortraitUpload({
  value,
  characterName,
  onChange,
}: {
  value: string | null
  characterName: string
  onChange: (value: string | null) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function accept(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('That portrait is larger than 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setError(null)
      onChange(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => setError('That portrait could not be read.')
    reader.readAsDataURL(file)
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    accept(event.target.files?.[0])
    event.target.value = ''
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    accept(event.dataTransfer.files[0])
  }

  return (
    <>
      <div
        className={cn('character-card__upload-zone', dragging && 'character-card__upload-zone--dragging')}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={drop}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={choose}
        />

        {value ? (
          <img className="character-card__portrait" src={value} alt={`${characterName || 'Character'} portrait preview`} />
        ) : null}

        <button
          type="button"
          className="character-card__upload-button"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-3.5" aria-hidden="true" />
          {value ? 'Change portrait' : 'Add portrait'}
        </button>

        {value ? (
          <button
            type="button"
            className="character-card__remove-portrait"
            onClick={() => onChange(null)}
            aria-label="Remove portrait"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {error ? <p className="character-card__upload-error">{error}</p> : null}
    </>
  )
}
