import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useAppearance, type Appearance } from '../app/providers'
import { PIECE_CODES, PIECE_SETS, PIECE_SET_OPTIONS, renderersFromImages } from '../lib/pieceSets'
import { PieceSetOverrideContext, usePieceSet } from '../state/PieceSetContext'
import { BOARD_THEMES, resolveBoard } from '../lib/boardThemes'
import { START_FEN } from '../lib/fen'
import { useCustomPieceSetMutations } from '../lib/queries'
import { imagesFromFiles, readPieceFiles, type ImportedPieceFile } from '../lib/pieceImport'
import type { CustomPieceSet } from '../types/domain'
import { Page, Card, SectionLabel } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Board } from '../components/board/Board'
import { Check, Moon, Sun, Trash, Upload } from '../components/ui/Icons'

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'Match device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const PREVIEW_FEN = START_FEN

export function SettingsPage() {
  const { signOut, session } = useAuth()
  const { appearance, setAppearance, resolved } = useAppearance()
  const { pieceSetId, setPieceSetId, customSets, boardTheme, customBoard, setBoardTheme, settings, updateSettings } =
    usePieceSet()
  const { remove } = useCustomPieceSetMutations()
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<CustomPieceSet | null>(null)
  const current = resolveBoard(boardTheme, customBoard)

  const field =
    'h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[15px] outline-none focus:border-accent'

  return (
    <Page back="/" title="Settings">
      <SectionLabel>Appearance</SectionLabel>
      <Card className="mb-8 flex gap-1 p-1.5">
        {APPEARANCES.map((a) => (
          <button
            key={a.id}
            onClick={() => setAppearance(a.id)}
            className={clsx(
              'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold transition',
              appearance === a.id ? 'bg-accent text-accent-ink shadow-card' : 'text-ink-2 hover:bg-surface-2',
            )}
          >
            {a.id === 'light' && <Sun size={16} />}
            {a.id === 'dark' && <Moon size={16} />}
            {a.label}
          </button>
        ))}
      </Card>

      <SectionLabel>Board colours</SectionLabel>
      <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {BOARD_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setBoardTheme(t.id)}
            aria-pressed={boardTheme === t.id}
            className={clsx(
              'rounded-xl border-2 p-1.5 text-left transition',
              boardTheme === t.id ? 'border-accent' : 'border-line hover:border-line-strong',
            )}
          >
            <Swatch light={t.light} dark={t.dark} />
            <span className="mt-1 block text-center text-[12px] font-semibold text-ink-2">{t.label}</span>
          </button>
        ))}
      </div>
      <Card className="mb-8 flex flex-wrap items-center gap-3 p-3">
        <span className="text-[14px] font-semibold text-ink">Custom</span>
        <ColorInput label="Light squares" value={current.light} onChange={(light) => setBoardTheme('custom', { ...current, light })} />
        <ColorInput label="Dark squares" value={current.dark} onChange={(dark) => setBoardTheme('custom', { ...current, dark })} />
        {boardTheme === 'custom' && <Check className="text-accent" />}
      </Card>

      <SectionLabel>Chess pieces</SectionLabel>
      <p className="-mt-1 mb-3 text-[14px] text-ink-3">
        Used on every board in the app. Import a set from Chess Arcade or anywhere else — 12 images named like wK, bQ.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PIECE_SET_OPTIONS.map((opt) => (
          <PieceSetCard
            key={opt.id}
            label={opt.label}
            description={opt.description}
            selected={pieceSetId === opt.id}
            renderers={PIECE_SETS[opt.id]}
            onSelect={() => setPieceSetId(opt.id)}
          />
        ))}
        {customSets.map((set) => (
          <PieceSetCard
            key={set.id}
            label={set.name}
            description="Imported set"
            selected={pieceSetId === `custom:${set.id}`}
            renderers={renderersFromImages(set.images)}
            onSelect={() => setPieceSetId(`custom:${set.id}`)}
            onDelete={() => setDeleting(set)}
          />
        ))}
      </div>
      <Button variant="soft" icon={<Upload size={18} />} onClick={() => setImporting(true)} className="mb-8">
        Import piece set
      </Button>

      <SectionLabel>Game accounts</SectionLabel>
      <p className="-mt-1 mb-3 text-[14px] text-ink-3">Lets Quick Add find your own games by link.</p>
      <Card className="mb-8 grid gap-3 p-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-ink-2">Lichess username</span>
          <input
            key={settings?.lichess_username ?? ''}
            defaultValue={settings?.lichess_username ?? ''}
            onBlur={(e) => e.target.value !== (settings?.lichess_username ?? '') && updateSettings({ lichess_username: e.target.value.trim() })}
            autoCapitalize="off"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-ink-2">Chess.com username</span>
          <input
            key={settings?.chesscom_username ?? ''}
            defaultValue={settings?.chesscom_username ?? ''}
            onBlur={(e) => e.target.value !== (settings?.chesscom_username ?? '') && updateSettings({ chesscom_username: e.target.value.trim() })}
            autoCapitalize="off"
            className={field}
          />
        </label>
      </Card>

      <SectionLabel>Account</SectionLabel>
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{session?.user.email}</p>
          <p className="text-[13px] text-ink-3">Signed in · {resolved} mode</p>
        </div>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </Card>

      <ImportPieceSetSheet open={importing} onClose={() => setImporting(false)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete "${deleting?.name}"?`}
        body="Boards using it switch back to Classic."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          if (pieceSetId === `custom:${deleting.id}`) setPieceSetId('classic')
          await remove.mutateAsync(deleting.id)
        }}
      />
    </Page>
  )
}

function Swatch({ light, dark }: { light: string; dark: string }) {
  return (
    <span className="grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-md">
      <span style={{ background: light }} />
      <span style={{ background: dark }} />
      <span style={{ background: dark }} />
      <span style={{ background: light }} />
    </span>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-lg border border-line-strong bg-transparent p-0.5"
        aria-label={label}
      />
      {label}
    </label>
  )
}

function PieceSetCard({
  label,
  description,
  selected,
  renderers,
  onSelect,
  onDelete,
}: {
  label: string
  description: string
  selected: boolean
  renderers: ReturnType<typeof renderersFromImages>
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl border-2 bg-surface p-3 transition',
        selected ? 'border-accent' : 'border-line hover:border-line-strong',
      )}
    >
      <button onClick={onSelect} className="block w-full text-left active:scale-[0.99]">
        {/* Preview the candidate set, not the active one, so they compare side by side. */}
        <PieceSetOverrideContext.Provider value={renderers}>
          <Board fen={PREVIEW_FEN} coordinates={false} className="rounded-lg" />
        </PieceSetOverrideContext.Provider>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">{label}</span>
          {selected && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-ink">
              <Check size={14} />
            </span>
          )}
        </div>
        <p className="text-[13px] text-ink-3">{description}</p>
      </button>
      {onDelete && (
        <IconButton label="Delete set" className="absolute right-2 bottom-2 h-9 w-9 text-ink-3" onClick={onDelete}>
          <Trash size={16} />
        </IconButton>
      )}
    </div>
  )
}

/**
 * Drop in the twelve piece images from any set. Names like wK.png / black_knight.svg
 * are matched automatically; the rest are assigned with a picker per slot.
 */
function ImportPieceSetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useCustomPieceSetMutations()
  const { setPieceSetId } = usePieceSet()
  const [name, setName] = useState('')
  const [files, setFiles] = useState<ImportedPieceFile[]>([])
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { images, missing } = imagesFromFiles(files)

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return
    setReading(true)
    try {
      const read = await readPieceFiles(list)
      setFiles((prev) => [...prev.filter((p) => !read.some((r) => r.name === p.name)), ...read])
    } finally {
      setReading(false)
    }
  }

  function assign(code: string, fileName: string) {
    setFiles((prev) => prev.map((f) => (f.name === fileName ? { ...f, code } : f.code === code ? { ...f, code: null } : f)))
  }

  function close() {
    setName('')
    setFiles([])
    onClose()
  }

  async function saveSet() {
    const set = await create.mutateAsync({ name: name.trim() || 'Imported set', images })
    setPieceSetId(`custom:${set.id}`)
    close()
  }

  return (
    <Modal open={open} onClose={close} title="Import piece set">
      <div className="space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Set name, e.g. Chess Arcade Neon"
          className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button variant="secondary" block icon={<Upload size={18} />} onClick={() => inputRef.current?.click()} disabled={reading}>
          {reading ? 'Reading images…' : files.length ? 'Add more images' : 'Choose the 12 piece images'}
        </Button>

        {files.length > 0 && (
          <div className="grid grid-cols-6 gap-2">
            {PIECE_CODES.map((code) => {
              const file = files.find((f) => f.code === code)
              return (
                <div key={code} className="text-center">
                  <div
                    className={clsx(
                      'grid aspect-square place-items-center rounded-lg p-1',
                      file ? 'bg-surface-2' : 'border border-dashed border-line-strong',
                    )}
                    style={{ background: file ? (code[0] === 'w' ? '#b58863' : '#f0d9b5') : undefined }}
                  >
                    {file ? <img src={file.dataUrl} alt="" className="h-full w-full object-contain" /> : null}
                  </div>
                  <select
                    value={file?.name ?? ''}
                    onChange={(e) => e.target.value && assign(code, e.target.value)}
                    className="mt-1 w-full truncate rounded-md bg-surface-2 px-1 py-0.5 text-[11px] text-ink-2"
                    aria-label={`Image for ${code}`}
                  >
                    <option value="">{code}</option>
                    {files.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {files.length > 0 && missing.length > 0 && (
          <p className="text-[13px] text-warn">Still needed: {missing.join(', ')} — pick the file for each slot above.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveSet} disabled={missing.length > 0 || create.isPending}>
            {create.isPending ? 'Saving…' : 'Save and use'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
