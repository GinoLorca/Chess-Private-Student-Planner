import type { ReactNode } from 'react'
import type { PieceRenderObject } from 'react-chessboard'

// Ported from the uploaded "Wavy Chess Coach" piece set (a single hand-authored
// SVG sprite sheet with a <defs> per piece, reused here as standalone React
// components instead of <use href="#id">).

const WHITE = { fill: '#f7f4e8', stroke: '#111516', detail: '#111516' }
const BLACK = { fill: '#111416', stroke: '#020304', detail: '#8e9b9d' }

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" width="100%" height="100%">
      {children}
    </svg>
  )
}

function Body({ d, fill, stroke, strokeWidth = 3.2 }: { d: string; fill: string; stroke: string; strokeWidth?: number }) {
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
}

function Detail({ d, color, strokeWidth = 3 }: { d: string; color: string; strokeWidth?: number }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
}

function Base({ fill, stroke }: { fill: string; stroke: string }) {
  return <Body d="M30 69h40l5 10H25l5-10Zm-6 10h52l3 9H21l3-9Z" fill={fill} stroke={stroke} />
}

function King({ fill, stroke, detail }: { fill: string; stroke: string; detail: string }) {
  return (
    <Svg>
      <Detail d="M50 8v18M41 16h18" color={detail} strokeWidth={4} />
      <Body d="M50 25c9 0 16 7 16 16 0 8-5 14-11 18l11 10H34l11-10c-6-4-11-10-11-18 0-9 7-16 16-16Z" fill={fill} stroke={stroke} />
      <Detail d="M38 65h24" color={detail} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

function Queen({ fill, stroke, detail }: { fill: string; stroke: string; detail: string }) {
  return (
    <Svg>
      {[
        [23, 25],
        [37, 17],
        [50, 12],
        [63, 17],
        [77, 25],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r={4.5} fill={fill} stroke={stroke} strokeWidth={3.2} />
      ))}
      <Body d="M23 29l9 34h36l9-34-15 17-12-29-12 29-15-17Z" fill={fill} stroke={stroke} />
      <Detail d="M33 63h34" color={detail} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

function Rook({ fill, stroke, detail }: { fill: string; stroke: string; detail: string }) {
  return (
    <Svg>
      <Body d="M28 17h12v10h7V17h6v10h7V17h12v22l-6 6 4 24H30l4-24-6-6V17Z" fill={fill} stroke={stroke} />
      <Detail d="M34 44h32M33 65h34" color={detail} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

function Bishop({ fill, stroke, detail }: { fill: string; stroke: string; detail: string }) {
  return (
    <Svg>
      <Body d="M50 12c10 10 17 20 16 31-1 9-6 15-12 19l12 7H34l12-7c-6-4-11-10-12-19-1-11 6-21 16-31Z" fill={fill} stroke={stroke} />
      <Detail d="m56 26-13 24" color={detail} strokeWidth={4} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

function Knight({ fill, stroke, detail }: { fill: string; stroke: string; detail: string }) {
  return (
    <Svg>
      <Body
        d="M39 69c1-8 4-14 11-19 7-5 11-11 11-18-3 8-9 13-16 13-5 0-9 2-11 8-7 0-12-4-13-10 6-6 11-11 15-18l9-7c0-4-1-8-3-12 5 1 9 3 12 7 12 0 22 8 26 20 4 13 0 26-10 36l1-13c-3 6-6 10-10 13H39Z"
        fill={fill}
        stroke={stroke}
      />
      <path d="m39 29 8-3-4 7-7 2 3-6Z" fill={detail} />
      <Detail d="M70 35c5 11 2 22-5 30" color={detail} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

function Pawn({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Svg>
      <circle cx={50} cy={27} r={10.5} fill={fill} stroke={stroke} strokeWidth={3.2} />
      <Body d="M42 39h16c0 10 6 20 11 30H31c5-10 11-20 11-30Z" fill={fill} stroke={stroke} />
      <Base fill={fill} stroke={stroke} />
    </Svg>
  )
}

export const wavyPieceSet: PieceRenderObject = {
  wK: () => <King {...WHITE} />,
  wQ: () => <Queen {...WHITE} />,
  wR: () => <Rook {...WHITE} />,
  wB: () => <Bishop {...WHITE} />,
  wN: () => <Knight {...WHITE} />,
  wP: () => <Pawn {...WHITE} />,
  bK: () => <King {...BLACK} />,
  bQ: () => <Queen {...BLACK} />,
  bR: () => <Rook {...BLACK} />,
  bB: () => <Bishop {...BLACK} />,
  bN: () => <Knight {...BLACK} />,
  bP: () => <Pawn {...BLACK} />,
}
