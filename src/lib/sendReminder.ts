import type { Reminder } from '../types/domain'
import { copyText } from './links'
import { loadShortcutName, reminderShareText, shortcutUrl } from './schedule'

export type SendResult = 'shortcut' | 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Hand a reminder to Apple Reminders. With the coach's shortcut set up
 * (Settings → Apple Reminders) it runs that, which files the reminder with
 * its due date. Otherwise it opens the share sheet, where Reminders is one
 * of the apps, and the text becomes the reminder. Without a share sheet (a
 * desktop browser) it copies the text.
 */
export async function sendToReminders(r: Reminder): Promise<SendResult> {
  const shortcut = loadShortcutName()
  if (shortcut) {
    window.location.href = shortcutUrl(r, shortcut)
    return 'shortcut'
  }
  const text = reminderShareText(r)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

