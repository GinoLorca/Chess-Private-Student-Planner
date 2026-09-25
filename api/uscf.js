/**
 * GET /api/uscf?id=12345678            → the member's current ratings
 * GET /api/uscf?id=12345678&events=1   → the same, plus their tournament history
 *
 * Read from the USCF member pages (the MSA site). The browser can't fetch
 * uschess.org itself (no CORS), so the app asks this function, which fetches
 * the pages and pulls the numbers out of them.
 *
 * Reply: { id, name, regular, quick, blitz, expires, fetchedAt, events? }
 * with each rating a number or null (unrated / not shown). An event is
 * { date, eventId, name, section, points, games, before, after }: points
 * and games come from the event's crosstable, the ratings from the history
 * page. Cached at the edge, so a lesson's worth of opens costs one fetch.
 *
 * Plain JavaScript on purpose: Vercel runs it as-is, with nothing to compile.
 */

const MSA_HOSTS = ['https://www.uschess.org/msa', 'http://www.uschess.org/msa']
/**
 * The USCF site sits behind Cloudflare's bot check, which lets browsers in
 * and turns plain server requests away ("Just a moment… Enable JavaScript
 * and cookies"). When the direct fetch is challenged, the page is read
 * through a rendering reader that loads it in a real browser and hands the
 * HTML back. Every page fetch is also given a deadline so the history
 * lookup can't run the function out of time.
 */
const READER = 'https://r.jina.ai/'
const FETCH_TIMEOUT_MS = 9000
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
}
/** How many recent events get their crosstable read for the score. */
const EVENTS_WITH_SCORES = 6

/** HTML to plain text, with tag boundaries kept as spaces so numbers don't run into labels. */
function textOf(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
}

/** The number after a label such as "Regular Rating", or null when unrated / absent. */
function ratingAfter(text, label) {
  const re = new RegExp(`${label}\\s*(?:Rating)?[^0-9A-Za-z]{0,20}(Unrated|\\d{3,4})`, 'i')
  const m = re.exec(text)
  if (!m) return null
  return /unrated/i.test(m[1]) ? null : Number(m[1])
}

/** Pull what the member page says. Exported for tests. */
export function parseMemberPage(html, id) {
  const text = textOf(html)
  if (!text.includes(String(id))) return null
  const name = new RegExp(`${id}\\s*:\\s*([A-Z][A-Z .,'-]{2,60}?)(?=\\s{2,}|\\s(?:Regular|Quick|Blitz|Expir|Rating|Last|State|Gender|Member)|$)`, 'i').exec(text)
  const expires = /Expir\w*\.?\s*(?:Dt\.?|Date)?\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text)
  return {
    id: String(id),
    name: name ? name[1].trim() : null,
    regular: ratingAfter(text, 'Regular'),
    quick: ratingAfter(text, 'Quick'),
    blitz: ratingAfter(text, 'Blitz'),
    expires: expires ? expires[1] : null,
  }
}

/** Each <tr> of a page as plain text, in order. */
function rowsOf(html) {
  const rows = []
  const re = /<tr[\s\S]*?<\/tr>/gi
  let m
  while ((m = re.exec(html))) rows.push({ html: m[0], text: textOf(m[0]).trim() })
  return rows
}

/**
 * The tournament history page (MbrDtlTnmtHst.php): one row per event with
 * the end date, the event id and name, the section, and the regular rating
 * before and after ("1105 => 1136"). Exported for tests.
 */
export function parseHistoryPage(html) {
  const events = []
  for (const row of rowsOf(html)) {
    const date = /^(\d{4}-\d{2}-\d{2})\b/.exec(row.text)
    const eventId = /\b(\d{12})\b/.exec(row.text)
    if (!date || !eventId) continue
    const link = /XtblMain\.php\?([0-9.]+(?:-\d+)?)/i.exec(row.html)
    // Name: what follows the id up to the section ("3: U1200") or a rating pair.
    const after = row.text.slice(row.text.indexOf(eventId[1]) + 12)
    const section = /(\d{1,2})\s*:\s*([A-Za-z0-9][^=]*?)(?=\s+(?:\d{3,4}|Unrated)\s*=>|\s+\d{3,4}\s+\d{3,4}|$)/.exec(after)
    let name = after
    if (section) name = after.slice(0, section.index)
    else {
      const cut = /\s(?:\d{3,4}|Unrated)\s*=>/.exec(after)
      if (cut) name = after.slice(0, cut.index)
    }
    name = name.replace(/^[\s:.-]+|[\s:.-]+$/g, '').replace(/\s+/g, ' ')
    const ratings = /(\d{3,4}|Unrated)\s*=>\s*(\d{3,4}|Unrated)/.exec(after)
    events.push({
      date: date[1],
      eventId: eventId[1],
      crosstable: link ? link[1] : null,
      name: name || 'Event',
      section: section ? `${section[1]}: ${section[2].trim()}` : null,
      before: ratings && /^\d/.test(ratings[1]) ? Number(ratings[1]) : null,
      after: ratings && /^\d/.test(ratings[2]) ? Number(ratings[2]) : null,
      points: null,
      games: null,
    })
  }
  return events
}

/**
 * The player's score in an event's crosstable: their row is the one carrying
 * their member id (or name); the total points is the first "3.5"-style
 * number on it, and the games are the W/L/D/B/H/U/X result cells. Exported
 * for tests.
 */
export function parseCrosstableScore(html, id, name) {
  const wanted = String(id)
  const rows = rowsOf(html)
  let row = rows.find((r) => r.text.includes(wanted))
  if (!row && name) row = rows.find((r) => r.text.toUpperCase().includes(String(name).toUpperCase()))
  if (!row) return null
  const pts = /\b(\d{1,2}\.[05])\b/.exec(row.text)
  const results = row.text.match(/\b[WLDBHUXF]\s*\d{1,3}\b|\b[BHUX]\b/g) || []
  return { points: pts ? Number(pts[1]) : null, games: results.length || null }
}

/** Cloudflare's interstitial rather than the page itself. */
function isChallenge(status, text) {
  return status === 403 || status === 503 || /just a moment|enable javascript and cookies|cf-chl|challenge-platform/i.test(text)
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { ...HEADERS, ...extraHeaders },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const text = await res.text()
  if (!res.ok || isChallenge(res.status, text)) {
    const err = new Error(isChallenge(res.status, text) ? `USCF's bot check turned the request away (${res.status})` : `USCF replied ${res.status}`)
    err.snippet = textOf(text).slice(0, 120)
    err.challenged = isChallenge(res.status, text)
    throw err
  }
  return text
}

/** The page through the rendering reader, as raw HTML, so the same parsers apply. */
async function fetchViaReader(url) {
  return fetchText(`${READER}${url}`, { 'x-return-format': 'html', 'x-no-cache': 'true', accept: 'text/html,*/*' })
}

/**
 * The first route that answers: the MSA site directly over https, then
 * http (it was plain http for years), then through the reader when the
 * site's bot check is in the way.
 */
async function fetchMsa(path, attempts) {
  let lastError = null
  let challenged = false
  for (const host of MSA_HOSTS) {
    const url = `${host}/${path}`
    try {
      const text = await fetchText(url)
      attempts.push({ url, ok: true, snippet: textOf(text).slice(0, 120) })
      return text
    } catch (e) {
      attempts.push({ url, ok: false, error: e instanceof Error ? e.message : String(e), snippet: e?.snippet })
      lastError = e
      if (e?.challenged) challenged = true
    }
  }
  if (challenged || lastError) {
    const url = `${MSA_HOSTS[0]}/${path}`
    try {
      const text = await fetchViaReader(url)
      attempts.push({ url: `${READER}${url}`, ok: true, snippet: textOf(text).slice(0, 120) })
      return text
    } catch (e) {
      attempts.push({ url: `${READER}${url}`, ok: false, error: e instanceof Error ? e.message : String(e), snippet: e?.snippet })
      lastError = e
    }
  }
  throw lastError ?? new Error('USCF unreachable')
}

/**
 * The member's ratings. When every route fails, the error says what each
 * one returned, so a parser or network problem can be seen from the app.
 */
async function lookupRatings(id) {
  const attempts = []
  for (const path of [`MbrDtlMain.php?${id}`, `thin3.php?${id}`]) {
    let text
    try {
      text = await fetchMsa(path, attempts)
    } catch {
      continue
    }
    const parsed = parseMemberPage(text, id)
    if (parsed) return parsed
    attempts[attempts.length - 1].error = 'page fetched, but no member data found on it'
  }
  const detail = attempts
    .map((a) => `${a.url}: ${a.ok ? 'fetched' : a.error}${a.snippet ? ` — "${a.snippet}"` : ''}`)
    .join(' | ')
  throw new Error(`Could not read the USCF member page. ${detail}`)
}

async function lookupEvents(id, name) {
  const events = parseHistoryPage(await fetchMsa(`MbrDtlTnmtHst.php?${id}`, []))
  // Scores live on each event's crosstable; read the recent ones, a few at a time.
  const recent = events.slice(0, EVENTS_WITH_SCORES)
  for (let i = 0; i < recent.length; i += 6) {
    await Promise.all(
      recent.slice(i, i + 6).map(async (ev) => {
        if (!ev.crosstable) return
        try {
          const score = parseCrosstableScore(await fetchMsa(`XtblMain.php?${ev.crosstable}`, []), id, name)
          if (score) {
            ev.points = score.points
            ev.games = score.games
          }
        } catch {
          // The event stays listed without a score.
        }
      }),
    )
  }
  return events.map(({ crosstable: _c, ...ev }) => ev)
}

function json(status, body, cache) {
  const headers = { 'content-type': 'application/json; charset=utf-8' }
  if (cache) headers['cache-control'] = cache
  return new Response(JSON.stringify(body), { status, headers })
}

/** Room for the reader route, which is slower than a direct fetch (the history call makes several). */
export const config = { maxDuration: 60 }

/** @param {Request} req */
export async function GET(req) {
  const url = new URL(req.url)
  const id = (url.searchParams.get('id') ?? '').trim()
  if (!/^\d{5,10}$/.test(id)) return json(400, { error: 'id must be a USCF member number (digits only)' })
  const withEvents = url.searchParams.get('events') === '1'
  try {
    const rating = await lookupRatings(id)
    const body = { ...rating, fetchedAt: new Date().toISOString() }
    if (withEvents) {
      try {
        body.events = await lookupEvents(id, rating.name)
      } catch (e) {
        body.events = []
        body.eventsError = e instanceof Error ? e.message : String(e)
      }
    }
    return json(200, body, withEvents ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=3600, stale-while-revalidate=86400')
  } catch (e) {
    return json(502, { error: e instanceof Error ? e.message : String(e) })
  }
}
