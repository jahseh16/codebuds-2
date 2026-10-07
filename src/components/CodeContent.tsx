import { useState, useRef, useEffect, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

const COLLAPSE_LINES = 14

/* ─── Collapsible Code Block ─────────────────────────── */
function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [lineCount, setLineCount] = useState(0)
  const codeRef = useRef<HTMLElement>(null)

  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : 'plaintext'

  // Count lines on mount / content change
  useEffect(() => {
    const text = typeof children === 'string' ? children : ''
    const lines = text.split('\n').length
    setLineCount(lines)
  }, [children])

  const shouldCollapse = lineCount > COLLAPSE_LINES

  function handleCopy() {
    const text = typeof children === 'string' ? children : ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="my-3 min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-bg-input">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code area — collapsible */}
      <div className="relative">
        <div
          className={`overflow-x-auto transition-all duration-300 ease-in-out ${
            shouldCollapse && !isExpanded ? 'max-h-80 overflow-y-hidden' : ''
          }`}
        >
          <pre className="p-4 text-[13px] leading-relaxed">
            <code ref={codeRef} className={`${className ?? ''} whitespace-pre`}>
              {children}
            </code>
          </pre>
        </div>

        {/* Gradient overlay + expand/collapse button */}
        {shouldCollapse && !isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="h-20 bg-gradient-to-t from-bg-input via-bg-input/80 to-transparent" />
            <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center pb-3">
              <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-all duration-200 hover:bg-accent-muted backdrop-blur-sm"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show full code
              </button>
            </div>
          </div>
        )}

        {/* Collapse button when expanded */}
        {shouldCollapse && isExpanded && (
          <div className="flex justify-center border-t border-border-light py-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-all duration-200 hover:bg-accent-muted"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Markdown renderer with syntax highlighting ─────── */
export function CodeContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className
            if (isInline) {
              return (
                <code className="rounded-md bg-bg-input px-1.5 py-0.5 text-[13px] font-mono text-accent whitespace-pre" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <CodeBlock className={className}>{children}</CodeBlock>
            )
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:text-accent-hover hover:decoration-accent"
              >
                {children}
              </a>
            )
          },
          ul({ children }) {
            return <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-accent/40 pl-4 text-text-secondary italic">
                {children}
              </blockquote>
            )
          },
          h1({ children }) {
            return <h1 className="mb-2 text-lg font-bold text-text-primary">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="mb-2 text-base font-bold text-text-primary">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="mb-2 text-sm font-bold text-text-primary">{children}</h3>
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-border bg-bg-card-hover/60 px-3 py-2 text-left text-xs font-semibold text-text-primary">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2 text-text-secondary">{children}</td>
            )
          },
          hr() {
            return <hr className="my-4 border-border" />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
