import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  icon?: ReactNode
}

/** A tappable option. Big enough for a thumb, quiet enough to show twenty at once. */
export function Chip({ selected, icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        'inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition active:scale-95',
        selected
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-accent-strong',
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('flex flex-wrap gap-2', className)}>{children}</div>
}
