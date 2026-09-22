import { useEffect, useState } from 'react'
import { onlineManager, useMutationState } from '@tanstack/react-query'
import clsx from 'clsx'

/**
 * A thin strip under the status bar while there is no connection: the
 * lessons on the device still open, and anything changed is counted here
 * until it syncs. Shows "Back online" for a moment when the connection
 * returns, so a pending count that drops to zero is seen to.
 */
export function OfflineBar() {
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  const [justBack, setJustBack] = useState(false)
  const pending = useMutationState({ filters: { status: 'pending' } }).length

  useEffect(() => {
    let timer = 0
    let wasOffline = !onlineManager.isOnline()
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      setOnline(isOnline)
      if (!isOnline) {
        wasOffline = true
        window.clearTimeout(timer)
        setJustBack(false)
        return
      }
      if (wasOffline) {
        wasOffline = false
        setJustBack(true)
        timer = window.setTimeout(() => setJustBack(false), 2500)
      }
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  if (online && !justBack) return null
  return (
    <div
      role="status"
      className={clsx(
        'pt-safe sticky top-0 z-40 px-4 text-center text-[13px] font-semibold',
        online ? 'bg-accent text-accent-ink' : 'bg-warn-soft text-warn',
      )}
    >
      <p className="py-1.5">
        {online
          ? pending > 0
            ? `Back online · syncing ${pending} change${pending === 1 ? '' : 's'}`
            : 'Back online'
          : pending > 0
            ? `Offline · ${pending} change${pending === 1 ? '' : 's'} will sync when you're back`
            : 'Offline · showing the lessons saved on this device'}
      </p>
    </div>
  )
}
