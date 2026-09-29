import { useState } from 'react'
import { copyText } from '../../lib/links'
import { Button } from './Button'

/**
 * A database update still to run: what it adds, the SQL on a button, and a
 * re-check once it's been run in Supabase.
 */
export function MigrationNotice({ file, sql, adds, onCheck }: { file: string; sql: string; adds: string; onCheck: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
      <p className="font-semibold">One database update for {adds}.</p>
      <p className="mt-1">In Supabase → SQL Editor → New query, paste {file} and Run, once.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (await copyText(sql)) setCopied(true)
          }}
        >
          {copied ? 'Copied' : 'Copy the SQL'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCheck}>
          I've run it, check again
        </Button>
      </div>
    </div>
  )
}
