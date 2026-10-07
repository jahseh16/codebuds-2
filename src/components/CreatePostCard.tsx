import { useState, useRef, type FormEvent } from 'react'
import { Loader2, Send, X, Code2 } from 'lucide-react'
import { posts as postsApi } from '../lib/api'
import type { PostCategory } from '../lib/types'

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'project_update', label: 'Project Update' },
  { value: 'looking_for_collaborator', label: 'Looking for Collaborator' },
  { value: 'need_help', label: 'Need Help' },
  { value: 'team', label: 'Team' },
]

const CODE_LANGUAGES = ['typescript', 'javascript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'java', 'kotlin', 'c', 'cpp', 'go', 'rust', 'php']

interface CreatePostCardProps {
  onCreated: () => void
  onClose: () => void
}

export function CreatePostCard({ onCreated, onClose }: CreatePostCardProps) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<PostCategory>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertCodeBlock(lang: string = 'typescript') {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = content.slice(0, start)
    const after = content.slice(end)
    const block = `\`\`\`${lang}\n\n\`\`\``
    const newContent = before + block + after
    setContent(newContent)
    setShowLangPicker(false)
    // Focus and place cursor inside the code block
    setTimeout(() => {
      ta.focus()
      const cursorPos = start + lang.length + 4 // after ```lang\n
      ta.setSelectionRange(cursorPos, cursorPos)
    }, 50)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError('')

    try {
      await postsApi.create(content.trim(), category)
      setContent('')
      setCategory('general')
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="animate-slide-up rounded-2xl bg-bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Create Post</h2>
        <button onClick={onClose} aria-label="Close composer" className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with the CodeBuds community... (supports Markdown & code blocks)"
          rows={4}
          className="w-full resize-none rounded-xl bg-bg-input px-4 py-3 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat.value
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg-input text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}

            {/* Code block button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangPicker(!showLangPicker)}
                title="Insert code block"
                className="flex items-center gap-1 rounded-lg bg-bg-input px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Code</span>
              </button>

              {/* Language picker dropdown */}
              {showLangPicker && (
                <div className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl bg-bg-card py-1 shadow-xl animate-scale-in">
                  <button
                    type="button"
                    onClick={() => insertCodeBlock('')}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                  >
                    Plain text
                  </button>
                  <div className="my-0.5 h-px bg-border-light" />
                  {CODE_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => insertCodeBlock(lang)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-card-hover"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </button>
        </div>
      </form>
    </div>
  )
}
