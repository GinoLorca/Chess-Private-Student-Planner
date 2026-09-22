/**
 * Stable links to a position, for pasting into another app (the ICN Chess
 * Club Planner's puzzle rows, a note, a message). The short form goes
 * through /p/<id>, which looks the position up and opens it in Present mode,
 * so the link survives the position being moved between lessons.
 */
export function puzzleLink(puzzleId: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/p/${puzzleId}`
}

/** Copy to the clipboard; true when it worked. Falls back to a hidden textarea for older WebKit. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea trick
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
