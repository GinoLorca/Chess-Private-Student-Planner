import type { ReactNode } from 'react'
import type { PieceRenderObject } from './types'

const STROKE = '#111111'
const WHITE_FILL = '#F7F1E4'
const BLACK_FILL = '#141414'

const FOOT = (
  <>
    <rect x="12.5" y="31.5" width="20" height="6" rx="3" />
    <rect x="9" y="37.5" width="27" height="4.5" rx="2.2" />
  </>
)

function Svg({ fill, children }: { fill: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      width="100%"
      height="100%"
      fill={fill}
      stroke={STROKE}
      strokeWidth={2.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </svg>
  )
}

function Pawn({ fill }: { fill: string }) {
  return (
    <Svg fill={fill}>
      <circle cx="22.5" cy="15.5" r="6.3" />
      <path d="M17,21 L28,21 L30,27.5 L15,27.5 Z" />
      {FOOT}
    </Svg>
  )
}

function Rook({ fill }: { fill: string }) {
  return (
    <Svg fill={fill}>
      <rect x="9.5" y="12" width="6.5" height="6.5" />
      <rect x="19.2" y="12" width="6.5" height="6.5" />
      <rect x="29" y="12" width="6.5" height="6.5" />
      <rect x="9.5" y="17" width="26" height="4" />
      <path d="M12,21 L33,21 L31,31.5 L14,31.5 Z" />
      {FOOT}
    </Svg>
  )
}

function Knight({ fill, accent }: { fill: string; accent: string }) {
  return (
    <Svg fill={fill}>
      <path d="M31,31.5 L14,31.5 L15,27 C12.5,25.7 11,22.8 11,19.6 C11,14.6 14.6,10.2 19.4,8.8 C18.7,7 19.6,5 21.6,5 C23.6,5 24.6,7 23.6,8.8 C27,10 30,13 31.3,16.6 L28.6,17.2 L30.4,20.6 L26.6,19.6 L27.4,27 Z" />
      <circle cx="22.2" cy="13.5" r="1.5" fill={accent} stroke="none" />
      {FOOT}
    </Svg>
  )
}

function Bishop({ fill, accent }: { fill: string; accent: string }) {
  return (
    <Svg fill={fill}>
      <circle cx="22.5" cy="6.2" r="2.3" />
      <path d="M22.5,9 C17.3,9 14.3,13.4 14.3,18 C14.3,22.4 17,25.3 19.2,26.6 L16.5,31.5 L28.5,31.5 L25.8,26.6 C28,25.3 30.7,22.4 30.7,18 C30.7,13.4 27.7,9 22.5,9 Z" />
      {FOOT}
      <rect x="20.6" y="14.5" width="3.8" height="10" fill={accent} stroke={accent} strokeWidth={1} />
      <rect x="17.5" y="17.8" width="10" height="3.4" fill={accent} stroke={accent} strokeWidth={1} />
    </Svg>
  )
}

function Queen({ fill }: { fill: string }) {
  return (
    <Svg fill={fill}>
      <circle cx="10.5" cy="10" r="2.2" />
      <circle cx="17" cy="7" r="2.2" />
      <circle cx="22.5" cy="6" r="2.2" />
      <circle cx="28" cy="7" r="2.2" />
      <circle cx="34.5" cy="10" r="2.2" />
      <path d="M10.5,12 L15,25.5 L17,13 L22.5,25.5 L28,13 L30,25.5 L34.5,12 L31,31.5 L14,31.5 Z" />
      {FOOT}
    </Svg>
  )
}

function King({ fill }: { fill: string }) {
  return (
    <Svg fill={fill}>
      <path d="M22.5,1.8 L22.5,11 M17.8,5.7 L27.2,5.7" strokeWidth={4.4} fill="none" />
      <path d="M13.5,17 C13.5,12.2 17.5,9.5 22.5,9.5 C27.5,9.5 31.5,12.2 31.5,17 C31.5,20 30,22.5 27.3,24.5 C29,26 29.6,28 29,31.5 L16,31.5 C15.4,28 16,26 17.7,24.5 C15,22.5 13.5,20 13.5,17 Z" />
      <rect x="14.5" y="24" width="16" height="3" rx="1" />
      {FOOT}
    </Svg>
  )
}

export const classicPieceSet: PieceRenderObject = {
  wP: () => <Pawn fill={WHITE_FILL} />,
  wR: () => <Rook fill={WHITE_FILL} />,
  wN: () => <Knight fill={WHITE_FILL} accent={BLACK_FILL} />,
  wB: () => <Bishop fill={WHITE_FILL} accent={BLACK_FILL} />,
  wQ: () => <Queen fill={WHITE_FILL} />,
  wK: () => <King fill={WHITE_FILL} />,
  bP: () => <Pawn fill={BLACK_FILL} />,
  bR: () => <Rook fill={BLACK_FILL} />,
  bN: () => <Knight fill={BLACK_FILL} accent={WHITE_FILL} />,
  bB: () => <Bishop fill={BLACK_FILL} accent={WHITE_FILL} />,
  bQ: () => <Queen fill={BLACK_FILL} />,
  bK: () => <King fill={BLACK_FILL} />,
}
