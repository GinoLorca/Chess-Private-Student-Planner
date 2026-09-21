import type { PieceRenderObject } from './types'
import wK from '../../assets/pieces/arcade/wK.png'
import wQ from '../../assets/pieces/arcade/wQ.png'
import wR from '../../assets/pieces/arcade/wR.png'
import wB from '../../assets/pieces/arcade/wB.png'
import wN from '../../assets/pieces/arcade/wN.png'
import wP from '../../assets/pieces/arcade/wP.png'
import bK from '../../assets/pieces/arcade/bK.png'
import bQ from '../../assets/pieces/arcade/bQ.png'
import bR from '../../assets/pieces/arcade/bR.png'
import bB from '../../assets/pieces/arcade/bB.png'
import bN from '../../assets/pieces/arcade/bN.png'
import bP from '../../assets/pieces/arcade/bP.png'

const SOURCES: Record<string, string> = { wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP }

function Piece({ code }: { code: string }) {
  return <img src={SOURCES[code]} alt="" draggable={false} style={{ width: '92%', height: '92%', objectFit: 'contain' }} />
}

export const arcadePieceSet: PieceRenderObject = Object.fromEntries(
  Object.keys(SOURCES).map((code) => [code, () => <Piece code={code} />]),
) as PieceRenderObject
