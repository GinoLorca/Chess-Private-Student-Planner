import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { branchRootOf, mainLineFrom, type MoveNode } from './moveTree'

export type HighlightColor = 'green' | 'blue' | 'yellow'

// "4." for White's move, "4…" for Black's — from a virtual ply that always
// starts White's move 1 at 1, whatever move number the position starts from.
const numFor = (virtualPly: number, startNumber: number) => `${Math.floor((virtualPly - 1) / 2) + startNumber}${virtualPly % 2 === 1 ? '.' : '…'}`

// A colour on the whole variation, not one move in it: a wash across the row.
// The same hex the pens draw in, so a green here means what a green arrow does.
const HIGHLIGHT_HEX: Record<HighlightColor, string> = { green: '#2ecc71', blue: '#3b9cff', yellow: '#e8b339' }
const highlightStyle = (color?: HighlightColor | null) => (color ? { backgroundColor: `${HIGHLIGHT_HEX[color]}2e`, borderRadius: 5 } : undefined)

type Highlights = Record<string, HighlightColor>

/** One variation, written the way a book writes it: 3…Bd6 4.e3 Nf6, with further branches in their own brackets. */
function InlineLine({
  start,
  startPly,
  startNumber,
  headId,
  highlights,
  onGo,
  onMenu,
}: {
  start: MoveNode
  startPly: number
  startNumber: number
  headId: string
  highlights: Highlights
  onGo: (id: string) => void
  onMenu: (id: string, e: ReactMouseEvent) => void
}) {
  const nodes = [start, ...mainLineFrom(start)]
  return (
    <>
      {nodes.map((node, i) => {
        const ply = startPly + i
        const showNum = ply % 2 === 1 || i === 0
        // Alternatives to this move, which belong right after it.
        const siblings = i === 0 ? [] : (nodes[i - 1].children ?? []).slice(1)
        return (
          <Fragment key={node.id}>
            {showNum && <span className="mt-inline-num">{numFor(ply, startNumber)}</span>}
            <button
              className={`mt-move inline${headId === node.id ? ' current' : ''}`}
              onClick={() => onGo(node.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                onMenu(node.id, e)
              }}
            >
              {node.san}
            </button>
            {siblings.map((sib) => (
              <span key={sib.id} className="mt-nested" style={highlightStyle(highlights[sib.id])}>
                (
                <InlineLine start={sib} startPly={ply} startNumber={startNumber} headId={headId} highlights={highlights} onGo={onGo} onMenu={onMenu} />)
              </span>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

/**
 * Repertoire Lab's move list (src/components/MoveTree.jsx there): the main
 * line as a numbered table, each variation on its own indented row under the
 * move it answers, with a menu to promote, delete or colour a variation.
 * `startNumber`/`startColor` describe the position the root stands for.
 */
export function MoveTree({
  root,
  headId,
  highlights,
  onHighlight,
  onGo,
  onPromote,
  onPromoteOne,
  onDelete,
  startNumber = 1,
  startColor = 'w',
  portalStyle,
}: {
  root: MoveNode
  headId: string
  highlights: Highlights
  onHighlight: (id: string, color: HighlightColor | null) => void
  onGo: (id: string) => void
  onPromote: (id: string) => void
  onPromoteOne: (id: string) => void
  onDelete: (id: string) => void
  startNumber?: number
  startColor?: 'w' | 'b'
  /** The palette's colours, for the menu, which opens outside the page. */
  portalStyle?: CSSProperties
}) {
  const [menu, setMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const main = mainLineFrom(root)
  // How far a virtual ply runs ahead of main[]'s real index.
  const basePly = startColor === 'b' ? 1 : 0
  const rows = Math.ceil((main.length + basePly) / 2)
  const menuBranchRoot = menu ? branchRootOf(root, menu.nodeId) : null

  const openMenu = (nodeId: string, e: ReactMouseEvent) => {
    setMenuPos(null)
    setMenu({ nodeId, x: e.clientX, y: e.clientY })
  }

  // The menu opens at the click point; pull it back on screen once its real size is known.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const margin = 8
    const rect = menuRef.current.getBoundingClientRect()
    const left = Math.min(menu.x, window.innerWidth - rect.width - margin)
    const top = Math.min(menu.y, window.innerHeight - rect.height - margin)
    setMenuPos({ left: Math.max(margin, left), top: Math.max(margin, top) })
  }, [menu])

  // Variations that answer the move at this real ply (1-based).
  const branchesAt = (ply: number) => {
    const parent = ply === 1 ? root : main[ply - 2]
    return (parent?.children ?? []).slice(1)
  }

  const cell = (ply: number) => {
    const node = main[ply - 1]
    if (!node) return <span key={`gap${ply}`} />
    return (
      <button
        key={node.id}
        className={`mt-move${headId === node.id ? ' current' : ''}`}
        onClick={() => onGo(node.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          openMenu(node.id, e)
        }}
      >
        {node.san}
      </button>
    )
  }

  return (
    <>
      <div className="move-table">
        {Array.from({ length: rows }, (_, row) => {
          const whiteReal = row * 2 + 1 - basePly
          const blackReal = whiteReal + 1
          const branches: [MoveNode, number][] = [
            ...branchesAt(whiteReal).map((b): [MoveNode, number] => [b, whiteReal]),
            ...branchesAt(blackReal).map((b): [MoveNode, number] => [b, blackReal]),
          ]
          return (
            <Fragment key={row}>
              <span className="mt-num">{startNumber + row}.</span>
              {cell(whiteReal)}
              {cell(blackReal)}
              {branches.map(([branch, realPly]) => (
                <div key={branch.id} className="mt-branch" style={highlightStyle(highlights[branch.id])}>
                  <button className="mt-branch-menu" title="Promote, delete, or highlight this variation" onClick={(e) => openMenu(branch.id, e)}>
                    ⋮
                  </button>
                  <InlineLine
                    start={branch}
                    startPly={realPly + basePly}
                    startNumber={startNumber}
                    headId={headId}
                    highlights={highlights}
                    onGo={onGo}
                    onMenu={openMenu}
                  />
                </div>
              ))}
            </Fragment>
          )
        })}
      </div>

      {/* Portaled to <body>: a fixed menu inside a transformed ancestor would
          otherwise open off-screen. */}
      {menu &&
        createPortal(
          <div className="rl-analysis rl-analysis-portal" style={portalStyle}>
            <div
              className="menu-scrim"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu(null)
              }}
            />
            <div ref={menuRef} className="move-menu" style={{ left: menuPos ? menuPos.left : menu.x, top: menuPos ? menuPos.top : menu.y }}>
              {menuBranchRoot && (
                <div className="mt-highlight-row">
                  {(['green', 'blue', 'yellow'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`mt-swatch${highlights[menuBranchRoot] === color ? ' on' : ''}`}
                      style={{ background: HIGHLIGHT_HEX[color] }}
                      title={`Highlight ${color}`}
                      onClick={() => {
                        onHighlight(menu.nodeId, color)
                        setMenu(null)
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="mt-swatch mt-swatch-clear"
                    title="Clear highlight"
                    disabled={!highlights[menuBranchRoot]}
                    onClick={() => {
                      onHighlight(menu.nodeId, null)
                      setMenu(null)
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  onPromote(menu.nodeId)
                  setMenu(null)
                }}
              >
                Promote to main line
              </button>
              <button
                onClick={() => {
                  onPromoteOne(menu.nodeId)
                  setMenu(null)
                }}
              >
                Promote one level
              </button>
              <button
                className="danger"
                onClick={() => {
                  onDelete(menu.nodeId)
                  setMenu(null)
                }}
              >
                Delete from here
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
