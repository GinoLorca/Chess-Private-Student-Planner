/**
 * The PGN files inside a .zip, read in the browser: the central directory
 * for the names, then each file, stored or deflated (Web Streams'
 * DecompressionStream does the inflating, Safari 16.4 and later). No zip64
 * and no encryption: a download of PGNs is neither.
 */
export async function pgnTextsFromZip(file: Blob): Promise<{ name: string; text: string }[]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // End of central directory: signature 0x06054b50, within the last 64 KB + 22 bytes.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("That file isn't a zip archive.")
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const names = new TextDecoder()
  const out: { name: string; text: string }[] = []
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('The zip archive is damaged.')
    const method = view.getUint16(at + 10, true)
    const size = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const name = names.decode(buf.subarray(at + 46, at + 46 + nameLength))
    at += 46 + nameLength + extraLength + commentLength
    // PGN (and plain text) files only; folders, macOS's __MACOSX copies and anything else are skipped.
    if (!/\.(pgn|txt)$/i.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = buf.subarray(start, start + size)
    let bytes: Uint8Array
    if (method === 0) bytes = data
    else if (method === 8) bytes = await inflateRaw(data)
    else throw new Error(`${name} is compressed in a way this browser can't open (method ${method}).`)
    out.push({ name, text: new TextDecoder().decode(bytes) })
  }
  return out
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error("This browser can't open zip files; unzip it first and choose the .pgn.")
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** A .pgn, .txt or .zip the coach picked, as the PGN text to import (a zip's PGNs joined end to end). */
export async function pgnTextFromFile(file: File): Promise<{ text: string; note: string }> {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    const files = await pgnTextsFromZip(file)
    if (files.length === 0) throw new Error(`There's no .pgn file in ${file.name}.`)
    return {
      text: files.map((f) => f.text.trim()).join('\n\n'),
      note: files.length === 1 ? `${files[0].name} from ${file.name}` : `${files.length} PGN files from ${file.name}`,
    }
  }
  return { text: await file.text(), note: file.name }
}
