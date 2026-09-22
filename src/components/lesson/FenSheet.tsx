import { useMemo, useState, type ClipboardEvent } from 'react'
import clsx from 'clsx'
import type { PuzzlePatch } from '../../lib/data'
import { describeDetected, detectInput, patchFromImported } from '../../lib/import'
import { resolveBatchItem } from '../../lib/import/batch'
import { usePieceSet } from '../../state/PieceSetContext'
import { Modal } from '../ui/Modal'
import { Button, IconButton } from '../ui/Button'
import { Check, Plus, Trash, Warning } from '../ui/Icons'

interface Row {
  id: number
  text: string
  url: string
}

interface FenSheetProps {
  open: boolean
  title: string
  /** The button label for n recognised positions; n is 0 for an empty submit. */
  submitLabel: (n: number) => string
  onClose: () => void
  /** Resolves once the positions are saved; the sheet closes itself after. */
  onSubmit: (positions: PuzzlePatch[]) => Promise<void>
}

let nextId = 1
const blank = (): Row => ({ id: nextId++, text: '', url: '' })

/**
 * FENs are the currency. One row per position: the FEN (or a Lichess /
 * Chess.com link, which is recognised the same way) and an optional source
 * link. Paste a whole list and it splits into rows.
 */
export function FenSheet({ open, title, submitLabel, onClose, onSubmit }: FenSheetProps) {
  const { settings } = usePieceSet()
  const [rows, setRows] = useState<Row[]>(() => [blank()])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detected = useMemo(() => rows.map((r) => (r.text.trim() ? detectInput(r.text) : null)), [rows])
  const filled = rows.filter((r) => r.text.trim())
  const unknown = detected.filter((d) => d && d.kind === 'unknown').length
  const recognised = filled.length - unknown

  function close() {
    setRows([blank()])
    setError(null)
    setBusy(null)
    onClose()
  }

  function setRow(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: number) {
    setRows((rs) => (rs.length === 1 ? [blank()] : rs.filter((r) => r.id !== id)))
  }

  // A multi-line paste fills this row and adds one per remaining line. A line
  // that is "FEN  https://…" keeps the link as the row's source.
  function onPaste(id: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const parsed = lines.map(splitLine)
    setRows((rs) => {
      const at = rs.findIndex((r) => r.id === id)
      const first = { ...rs[at], ...parsed[0] }
      const rest = parsed.slice(1).map((p) => ({ ...blank(), ...p }))
      return [...rs.slice(0, at), first, ...rest, ...rs.slice(at + 1).filter((r) => r.text.trim())]
    })
  }

  async function submit() {
    if (unknown > 0) {
      setError(`${unknown} line${unknown === 1 ? " isn't" : "s aren't"} a FEN or a link — fix or remove ${unknown === 1 ? 'it' : 'them'}.`)
      return
    }
    setError(null)
    const positions: PuzzlePatch[] = []
    try {
      let i = 0
      for (const row of filled) {
        i++
        const input = detectInput(row.text)
        if (input.kind === 'unknown') continue
        if (input.kind !== 'fen') setBusy(`Fetching ${i} of ${filled.length}…`)
        const result = await resolveBatchItem(input, { chesscomUsername: settings?.chesscom_username })
        if (result.positions.length === 0) throw new Error(`Line ${i}: ${result.note ?? 'nothing came of it.'}`)
        for (const p of result.positions) {
          const patch = patchFromImported(p)
          const url = row.url.trim()
          if (url) {
            patch.reference_url = url
            patch.reference_label = sourceLabel(url)
          }
          positions.push(patch)
        }
      }
      setBusy(positions.length ? `Saving ${positions.length}…` : 'Creating…')
      await onSubmit(positions)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="space-y-3">
        <p className="text-[13.5px] text-ink-2">
          One position per line: a FEN, or a Lichess / Chess.com link. Moves after the FEN become the answer. Paste a whole
          list and it splits into rows.
        </p>
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const d = detected[i]
            return (
              <li key={row.id} className="index-card rounded-xl border border-line bg-surface p-2.5 pl-3">
                <div className="flex items-start gap-2">
                  <span className="w-5 shrink-0 pt-3 text-right font-mono text-[12px] text-ink-3 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      value={row.text}
                      onChange={(e) => setRow(row.id, { text: e.target.value })}
                      onPaste={(e) => onPaste(row.id, e)}
                      placeholder="FEN or link"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoFocus={i === rows.length - 1 && rows.length > 1}
                      className="h-11 w-full rounded-lg border border-line-strong bg-surface-2 px-3 font-mono text-[13px] outline-none focus:border-accent"
                    />
                    <input
                      value={row.url}
                      onChange={(e) => setRow(row.id, { url: e.target.value })}
                      placeholder="Source link (optional)"
                      inputMode="url"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] outline-none focus:border-accent"
                    />
                    {d && (
                      <p className={clsx('flex items-center gap-1 text-[12px] font-medium', d.kind === 'unknown' ? 'text-warn' : 'text-accent-strong')}>
                        {d.kind === 'unknown' ? <Warning size={13} /> : <Check size={13} />}
                        {describeDetected(d)}
                      </p>
                    )}
                  </div>
                  <IconButton label="Remove line" className="h-9 w-9 text-ink-3" onClick={() => removeRow(row.id)}>
                    <Trash size={15} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ol>
        <Button variant="soft" icon={<Plus size={16} />} onClick={() => setRows((rs) => [...rs, blank()])} disabled={Boolean(busy)}>
          Add another
        </Button>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Button variant="primary" size="lg" block onClick={submit} disabled={Boolean(busy)}>
          {busy ?? submitLabel(recognised)}
        </Button>
      </div>
    </Modal>
  )
}

/** "FEN  https://source" on one line: the link becomes the row's source. */
function splitLine(line: string): Pick<Row, 'text' | 'url'> {
  const m = /^(.*?)\s+(https?:\/\/\S+)$/.exec(line)
  if (m && detectInput(m[1]).kind !== 'unknown') return { text: m[1].trim(), url: m[2] }
  return { text: line, url: '' }
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
