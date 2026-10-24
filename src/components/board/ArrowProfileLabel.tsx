import clsx from 'clsx'
import { SEQ_COLORS, SEQ_NAMES, STRATEGIC, LIGHT_HALO, cycleArrowProfile, useArrowProfile } from '../../lib/arrowProfiles'

const Dot = ({ color }: { color: string }) => (
  <span
    className={clsx('inline-block h-2 w-2 rounded-full align-middle', LIGHT_HALO.includes(color) && 'shadow-[0_0_0_1px_var(--ink-3)]')}
    style={{ background: color }}
  />
)

/**
 * By a board while an arrow colour profile is on, so whoever reads the
 * board knows what the colours mean (Chess Arcade's label in each board's
 * hint row). Tapping it moves to the next profile. In Default it isn't there.
 */
export function ArrowProfileLabel({ className }: { className?: string }) {
  const profile = useArrowProfile()
  if (profile === 'default') return null
  const title =
    profile === 'sequential'
      ? `Arrow colours follow the order they're drawn on this position: ${SEQ_NAMES.map((n, i) => `${i + 1} ${n}`).join(', ')}, then green again. A highlight takes the colour of the arrow before it. Tap for Strategic.`
      : 'Arrow colours follow the side: W = White green, B = Black blue, x = a capture, White red, Black yellow. A highlight takes the colour of the arrow before it. Tap for Default.'
  // `className` is the wrapper's, so a caller can place or hide it (hidden sm:block) without fighting the button's own layout.
  return (
    <span className={className}>
      <button onClick={cycleArrowProfile} title={title} className="arrow-profile-label inline-flex items-center gap-1 text-[13px] font-medium whitespace-nowrap text-on-bg-2 hover:text-on-bg">
        Arrows: <span className="font-semibold text-on-bg">{profile === 'sequential' ? 'Sequential' : 'Strategic'}</span>
        {profile === 'sequential' ? (
          <span className="inline-flex items-center gap-0.5">
            {SEQ_COLORS.slice(0, 4).map((c) => (
              <Dot key={c} color={c} />
            ))}
            …
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Dot color={STRATEGIC.w} />W <Dot color={STRATEGIC.b} />B
            <span className="inline-flex gap-0.5">
              <Dot color={STRATEGIC.wx} />
              <Dot color={STRATEGIC.bx} />
            </span>
            x
          </span>
        )}
      </button>
    </span>
  )
}
