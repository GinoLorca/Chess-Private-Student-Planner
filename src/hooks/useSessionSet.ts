import { useCallback, useState } from 'react'

/** A Set<string> persisted to sessionStorage — survives in-app navigation but resets each browser session. */
export function useSessionSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })

  const add = useCallback(
    (id: string) => {
      setSet((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        try {
          sessionStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          // ignore storage failures (private browsing, quota, etc.)
        }
        return next
      })
    },
    [key],
  )

  const toggle = useCallback(
    (id: string) => {
      setSet((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        try {
          sessionStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          // ignore storage failures
        }
        return next
      })
    },
    [key],
  )

  return { set, add, toggle }
}
