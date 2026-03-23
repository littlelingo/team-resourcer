import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

interface ImageUploadProps {
  value?: string
  onChange: (file: File | null) => void
  className?: string
}

export default function ImageUpload({ value, onChange, className }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Revoke the object URL when the preview changes or on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  const displaySrc = preview ?? value ?? null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only JPEG, PNG, and WebP images are allowed.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (file.size > MAX_SIZE) {
      alert('Image must be smaller than 5 MB.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    setPreview(url)
    onChange(file)
  }

  function handleRemove() {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setPreview(null)
    onChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Circular avatar preview */}
      <div className="h-20 w-20 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt="Profile photo"
            className="h-full w-full object-cover"
          />
        ) : (
          <svg
            className="h-10 w-10 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Upload photo"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Upload photo
        </button>

        {displaySrc && (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
