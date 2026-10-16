import { Navigate, useMatch } from 'react-router-dom'
import { usePrivateFolders } from '../lib/privateFolders'

/**
 * A folder private on this device can't be opened here: a link into it, the
 * Back button or a reopened app lands on Students instead. Unhide it in
 * Settings → Private folders to open it again.
 */
export function PrivateFolderGate() {
  const match = useMatch('/students/:studentId/*')
  const hidden = usePrivateFolders()
  const id = match?.params.studentId
  return id && hidden.includes(id) ? <Navigate to="/" replace /> : null
}
