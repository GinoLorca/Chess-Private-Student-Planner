import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useAppearance, type Appearance } from '../app/providers'
import { PIECE_SET_OPTIONS, PIECE_SETS, type PieceSetId } from '../lib/pieceSets'
import { PieceSetOverrideContext, usePieceSet } from '../state/PieceSetContext'
import { START_FEN } from '../lib/fen'
import { Page, Card, SectionLabel } from '../components/ui/Page'
import { Button } from '../components/ui/Button'
import { Board } from '../components/board/Board'
import { Check, Moon, Sun } from '../components/ui/Icons'

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'Match device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export function SettingsPage() {
  const { signOut, session } = useAuth()
  const { appearance, setAppearance, resolved } = useAppearance()
  const { pieceSetId, setPieceSetId } = usePieceSet()

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

      <SectionLabel>Chess pieces</SectionLabel>
      <p className="-mt-1 mb-3 text-[14px] text-ink-3">Used on every board in the app, including the lesson table views.</p>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PIECE_SET_OPTIONS.map((opt) => (
          <PieceSetCard
            key={opt.id}
            id={opt.id}
            label={opt.label}
            description={opt.description}
            selected={pieceSetId === opt.id}
            onSelect={() => setPieceSetId(opt.id)}
          />
        ))}
      </div>

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
    </Page>
  )
}

function PieceSetCard({
  id,
  label,
  description,
  selected,
  onSelect,
}: {
  id: PieceSetId
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'rounded-2xl border-2 bg-surface p-3 text-left transition active:scale-[0.99]',
        selected ? 'border-accent' : 'border-line hover:border-line-strong',
      )}
    >
      {/* Preview the candidate set, not the active one, so all three compare side by side. */}
      <PieceSetOverrideContext.Provider value={PIECE_SETS[id]}>
        <Board fen={START_FEN} coordinates={false} className="rounded-lg" />
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
  )
}
