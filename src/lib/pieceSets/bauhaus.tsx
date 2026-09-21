import type { PieceRenderObject } from './types'
import wK from '../../assets/pieces/bauhaus/wK.svg'
import wQ from '../../assets/pieces/bauhaus/wQ.svg'
import wR from '../../assets/pieces/bauhaus/wR.svg'
import wB from '../../assets/pieces/bauhaus/wB.svg'
import wN from '../../assets/pieces/bauhaus/wN.svg'
import wP from '../../assets/pieces/bauhaus/wP.svg'
import bK from '../../assets/pieces/bauhaus/bK.svg'
import bQ from '../../assets/pieces/bauhaus/bQ.svg'
import bR from '../../assets/pieces/bauhaus/bR.svg'
import bB from '../../assets/pieces/bauhaus/bB.svg'
import bN from '../../assets/pieces/bauhaus/bN.svg'
import bP from '../../assets/pieces/bauhaus/bP.svg'

// Charcoal (#1B1B19) on warm ivory (#FAF7EF), round caps, shared 128×128 viewBox.
const SOURCES: Record<string, string> = { wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP }

function Piece({ code }: { code: string }) {
  return <img src={SOURCES[code]} alt="" draggable={false} style={{ width: '94%', height: '94%', objectFit: 'contain' }} />
}

export const bauhausPieceSet: PieceRenderObject = Object.fromEntries(
  Object.keys(SOURCES).map((code) => [code, () => <Piece code={code} />]),
) as PieceRenderObject
