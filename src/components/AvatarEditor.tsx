import { useState, useRef } from 'react'
import { X, Upload, Link, Loader2, Camera } from 'lucide-react'

interface AvatarEditorProps {
  currentUrl: string | null
  onUpload: (file: File) => Promise<string>
  onSave: (url: string) => void
  onClose: () => void
}

export function AvatarEditor({ currentUrl, onUpload, onSave, onClose }: AvatarEditorProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url')
  const [urlInput, setUrlInput] = useState(currentUrl ?? '')
  const [preview, setPreview] = useState(currentUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await onUpload(file)
      onSave(url)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    }
    setUploading(false)
  }

  function handleUrlSave() {
    if (!urlInput.trim()) {
      setError('Please enter a URL')
      return
    }
    setError('')
    onSave(urlInput.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-bg-card p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">Edit Avatar</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-accent/40 bg-bg-input shadow-[0_0_24px_rgba(124,58,237,0.15)]">
          {preview ? (
            <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-8 w-8 text-text-muted" />
          )}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-bg-input p-1">
          <button
            onClick={() => setTab('url')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all ${
              tab === 'url' ? 'bg-bg-card-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            URL
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all ${
              tab === 'upload' ? 'bg-bg-card-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-muted border border-danger/20 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {tab === 'url' ? (
          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setPreview(e.target.value) }}
              placeholder="https://example.com/avatar.jpg"
              className="w-full rounded-lg bg-bg-input px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
            <button
              onClick={handleUrlSave}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-bold text-white transition-all hover:bg-accent-hover min-h-[44px]"
            >
              Save URL
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-bg-card-hover py-2.5 text-xs font-bold text-text-primary transition-all hover:bg-bg-primary min-h-[44px]"
            >
              <Upload className="h-3.5 w-3.5" />
              {fileRef.current?.files?.[0] ? 'Change file' : 'Choose image'}
            </button>
            {fileRef.current?.files?.[0] && (
              <p className="text-center text-[10px] text-[#52525b]">
                {fileRef.current.files[0].name}
              </p>
            )}
            <button
              onClick={handleUpload}
              disabled={uploading || !fileRef.current?.files?.[0]}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-bold text-white transition-all hover:bg-accent-hover disabled:opacity-50 min-h-[44px]"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading...' : 'Upload & Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
