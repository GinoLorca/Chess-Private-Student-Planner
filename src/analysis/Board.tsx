import { useMemo, type ComponentProps } from 'react'
import { Chessboard } from 'react-chessboard'
import { TouchBackend } from 'react-dnd-touch-backend'
import { Chess } from 'chess.js'
import { checkedKingSquare, CHECK_STYLE, LAST_MOVE_STYLE } from './legalMoves'
import { DEFAULT_PIECE_DARK, DEFAULT_PIECE_LIGHT, pieceSet, useThemePieces } from './pieces'
import type { Palette } from './palette'

type ChessboardProps = ComponentProps<typeof Chessboard>
type SquareStyles = Record<string, Record<string, string | number>>

// react-chessboard picks its drag backend with `"ontouchstart" in window`. An
// iPad reports touch support, so it gets the touch backend — which ignores
// mouse and trackpad input, leaving a Magic Keyboard cursor unable to drag.
// Using the touch backend WITH enableMouseEvents makes both work at once.
const isTouchCapable = typeof window !== 'undefined' && 'ontouchstart' in window
const dndProps = isTouchCapable
  ? { customDndBackend: TouchBackend, customDndBackendOptions: { enableMouseEvents: true, delayTouchStart: 0 } }
  : {}

// The rank numbers and file letters, stroked so they hold up on any theme.
// react-chessboard draws each one in the opposite square's colour, so
// currentColor is exactly the stroke wanted, with no per-theme value.
const NOTATION_STYLE = {
  WebkitTextStroke: '0.35px currentColor',
  textShadow: '0 0 1.5px currentColor',
  fontWeight: 700,
}

/**
 * Repertoire Lab's shared board (src/components/Board.jsx there):
 * react-chessboard in the palette's colours, input that works with a mouse,
 * a trackpad and a touchscreen, the move just played washed in pale yellow
 * and the king in check glowing red. Arrows are never react-chessboard's own:
 * the analysis board draws them itself, so a knight's arrow bends.
 */
export function Board({
  position,
  customSquareStyles,
  lastMove,
  palette,
  markCheck = true,
  markLast = true,
  ...rest
}: Omit<ChessboardProps, 'customSquareStyles'> & {
  position: string
  customSquareStyles?: SquareStyles
  lastMove?: { from: string; to: string } | null
  palette: Palette
  /** The red glow under a king in check. */
  markCheck?: boolean
  /** The pale wash on the move just played. */
  markLast?: boolean
}) {
  // Only hand react-chessboard a custom set when it differs from its own, so
  // an untouched board keeps the package's pieces exactly as they were.
  const themed = useThemePieces()
  const customPieces =
    themed ??
    (palette.pieceLight === DEFAULT_PIECE_LIGHT && palette.pieceDark === DEFAULT_PIECE_DARK ? undefined : pieceSet(palette.pieceLight, palette.pieceDark))

  const lastFrom = lastMove?.from
  const lastTo = lastMove?.to
  const styles = useMemo(() => {
    let out: SquareStyles = customSquareStyles ?? {}
    // Where the move came from and where it went, the way chess.com marks it.
    // Underneath everything else, so a selection still reads on top.
    if (markLast && lastFrom && lastTo) {
      out = { [lastFrom]: { ...LAST_MOVE_STYLE }, [lastTo]: { ...LAST_MOVE_STYLE }, ...out }
    }
    let square: string | null = null
    if (markCheck) try {
      square = checkedKingSquare(new Chess(position))
    } catch {
      square = null
    }
    // Anything the caller put on that square stays on top of the glow.
    if (square) out = { ...out, [square]: { ...CHECK_STYLE, ...(out[square] ?? {}) } }
    return out
  }, [markLast, markCheck, lastFrom, lastTo, position, customSquareStyles])

  return (
    <Chessboard
      customLightSquareStyle={{ backgroundColor: palette.boardLight }}
      customDarkSquareStyle={{ backgroundColor: palette.boardDark }}
      customPieces={customPieces}
      customNotationStyle={NOTATION_STYLE}
      areArrowsAllowed={false}
      {...dndProps}
      position={position}
      customSquareStyles={styles}
      {...rest}
    />
  )
}
