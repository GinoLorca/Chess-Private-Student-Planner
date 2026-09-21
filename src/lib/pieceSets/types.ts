import type { ReactNode } from 'react'

/** A piece set: wK…bP → a component that fills its square. */
export type PieceRenderObject = Record<string, () => ReactNode>
