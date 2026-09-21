import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Home } from './Icons'

interface PageProps {
  title?: ReactNode
  /** Small line above the title — a student name, a lesson number. */
  eyebrow?: ReactNode
  /** Where the back chevron goes. Omit to hide it; -1 means history back. */
  back?: string | -1
  actions?: ReactNode
  /** Wide pages (the lesson table views) opt out of the reading-width container. */
  width?: 'reading' | 'wide' | 'full'
  children: ReactNode
  className?: string
}

/**
 * Standard screen frame: a sticky, translucent top bar under the status bar,
 * then content. Titles live in the content flow (not the bar) so they can be
 * large and wrap on a phone without fighting the back button for space.
 */
export function Page({ title, eyebrow, back, actions, width = 'reading', children, className }: PageProps) {
  const navigate = useNavigate()
  const container = width === 'reading' ? 'max-w-3xl' : width === 'wide' ? 'max-w-6xl' : 'max-w-none'

  return (
    <div className="min-h-svh">
      <header className="page-header pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className={clsx('mx-auto flex h-12 items-center gap-1 px-2', container)}>
          {back !== undefined ? (
            back === -1 ? (
              <button
                onClick={() => navigate(-1)}
                className="flex h-11 items-center gap-0.5 rounded-xl pr-3 pl-1 text-[15px] font-medium text-accent-on-bg active:opacity-60"
              >
                <ChevronLeft size={22} />
                Back
              </button>
            ) : (
              <Link
                to={back}
                className="flex h-11 items-center gap-0.5 rounded-xl pr-3 pl-1 text-[15px] font-medium text-accent-on-bg active:opacity-60"
              >
                <ChevronLeft size={22} />
                Back
              </Link>
            )
          ) : (
            <div className="w-2" />
          )}
          {back !== undefined && back !== '/' && (
            <Link
              to="/"
              aria-label="Students"
              title="Students"
              className="grid h-11 w-11 place-items-center rounded-xl text-accent-on-bg active:opacity-60"
            >
              <Home size={21} />
            </Link>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      </header>

      <main className={clsx('mx-auto px-4 pt-4 pb-24', container, className)}>
        {(eyebrow || title) && (
          <div className="mb-5">
            {eyebrow && <p className="mb-1 text-[13px] font-semibold tracking-wide text-on-bg-2 uppercase">{eyebrow}</p>}
            {title && <h1 className="text-balance text-[28px] leading-tight font-bold tracking-tight text-on-bg">{title}</h1>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx('rounded-2xl border border-line bg-surface shadow-card', className)}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx('mb-2 text-[12px] font-semibold tracking-wider text-ink-3 uppercase', className)}>{children}</p>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-[14px] text-ink-3">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx('h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-accent', className)}
      role="status"
      aria-label="Loading"
    />
  )
}

export function LoadingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner />
    </div>
  )
}
