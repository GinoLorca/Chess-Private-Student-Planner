import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { copyText, puzzleLink } from '../../lib/links'
import { Check, LinkIcon } from './Icons'

/**
 * Copies a position's link. Shows "Copied" for a moment so the coach knows
 * it took, then goes back to the chain icon.
 */
export function CopyLinkButton({ puzzleId, className, label = 'Copy link' }: { puzzleId: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (await copyText(puzzleLink(puzzleId))) setCopied(true)
      }}
      className={clsx(
        'inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold transition active:scale-95',
        copied ? 'text-accent-strong' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {copied ? <Check size={16} /> : <LinkIcon size={16} />}
      <span className={clsx(copied ? '' : 'sr-only sm:not-sr-only')}>{copied ? 'Copied' : 'Link'}</span>
    </button>
  )
}
