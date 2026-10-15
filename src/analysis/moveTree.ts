// Repertoire Lab's move tree (src/lib/moveTree.js there): a line as a tree, so
// an alternative played from an earlier move is kept as a variation instead of
// throwing away what came after — the way Lichess and chess.com record analysis.
//
// Shape: { id, san, children }. children[0] is the main continuation; the rest
// are variations, in the order they were added. The root carries no move and
// always has id 'root'. Plain data, so it can be kept and restored as JSON.

export interface MoveNode {
  id: string
  san: string | null
  children: MoveNode[]
}

// Ids only have to be unique within one tree, but a kept tree comes back after
// a reload, when a plain counter would start again and hand a new move the id
// of one already in it. So each page load gets its own prefix.
const run = Math.random().toString(36).slice(2, 7)
let seq = 0
const nid = () => `n${run}${(seq += 1)}`

export const newRoot = (): MoveNode => ({ id: 'root', san: null, children: [] })

/** A plain list of moves becomes a trunk with no branches. */
export function makeTree(sans: string[] = []): MoveNode {
  const root = newRoot()
  let node = root
  for (const san of sans) {
    const child: MoveNode = { id: nid(), san, children: [] }
    node.children.push(child)
    node = child
  }
  return root
}

export function findNode(root: MoveNode, id: string): MoveNode | null {
  if (!id || id === 'root') return root
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    for (const c of n.children) stack.push(c)
  }
  return null
}

/** Root → node, without the root itself. Empty when the node is the root. */
export function nodePath(root: MoveNode, id: string): MoveNode[] {
  const out: MoveNode[] = []
  const walk = (node: MoveNode, trail: MoveNode[]): boolean => {
    if (node.id === id) {
      out.push(...trail)
      return true
    }
    return node.children.some((c) => walk(c, [...trail, c]))
  }
  walk(root, [])
  return out
}

/** The main continuation from a node: keep taking the first child. */
export function mainLineFrom(node: MoveNode): MoveNode[] {
  const out: MoveNode[] = []
  let n: MoveNode | undefined = node
  while (n?.children?.length) {
    n = n.children[0]
    out.push(n)
  }
  return out
}

/** Everything on the board: how you got to `id`, then how the line carries on from there. */
export function lineThrough(root: MoveNode, id: string): MoveNode[] {
  const head = findNode(root, id) ?? root
  return [...nodePath(root, head.id), ...mainLineFrom(head)]
}

// Structural edits copy the nodes they touch, so React sees a new tree.
function edit(root: MoveNode, fn: (copy: MoveNode) => void) {
  const clone = (n: MoveNode): MoveNode => ({ ...n, children: n.children.map(clone) })
  const copy = clone(root)
  fn(copy)
  return copy
}

/** Play `san` after `parentId`. Repeating a move that's already there follows it rather than adding a duplicate branch. */
export function addMove(root: MoveNode, parentId: string, san: string) {
  let id = ''
  const tree = edit(root, (copy) => {
    const parent = findNode(copy, parentId) ?? copy
    const existing = parent.children.find((c) => c.san === san)
    if (existing) {
      id = existing.id
      return
    }
    const node = { id: nid(), san, children: [] }
    parent.children.push(node)
    id = node.id
  })
  return { tree, nodeId: id }
}

/** Make this variation the main line, all the way up to the first move. */
export function promote(root: MoveNode, id: string) {
  return edit(root, (copy) => {
    const trail = nodePath(copy, id)
    let parent = copy
    for (const step of trail) {
      const i = parent.children.findIndex((c) => c.id === step.id)
      if (i > 0) {
        const [pick] = parent.children.splice(i, 1)
        parent.children.unshift(pick)
      }
      parent = parent.children[0]
    }
  })
}

/** Promote one level only: swap this branch with its immediate main line. */
export function promoteOne(root: MoveNode, id: string) {
  return edit(root, (copy) => {
    const trail = nodePath(copy, id)
    if (trail.length === 0) return
    const parent = trail.length > 1 ? trail[trail.length - 2] : copy
    const i = parent.children.findIndex((c) => c.id === id)
    if (i > 0) {
      const [pick] = parent.children.splice(i, 1)
      parent.children.splice(i - 1, 0, pick)
    }
  })
}

/** Cut this move and everything after it. */
export function removeNode(root: MoveNode, id: string) {
  return edit(root, (copy) => {
    const trail = nodePath(copy, id)
    if (trail.length === 0) return
    const parent = trail.length > 1 ? trail[trail.length - 2] : copy
    parent.children = parent.children.filter((c) => c.id !== id)
  })
}

/** Drop every variation, keeping only the main line. */
export function keepMainLineOnly(root: MoveNode) {
  return edit(root, (copy) => {
    let n = copy
    while (n.children.length) {
      n.children = [n.children[0]]
      n = n.children[0]
    }
  })
}

export const hasVariations = (root: MoveNode) => {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.children.length > 1) return true
    for (const c of n.children) stack.push(c)
  }
  return false
}

/**
 * The variation `id` belongs to, at its topmost level: the first node on the
 * way there that isn't its parent's main continuation. Null for a node on the
 * main line the whole way.
 */
export function branchRootOf(root: MoveNode, id: string): string | null {
  const trail = nodePath(root, id)
  let parent = root
  for (const node of trail) {
    const i = parent.children.findIndex((c) => c.id === node.id)
    if (i > 0) return node.id
    parent = node
  }
  return null
}

/** "Back to the main line" from anywhere, however many variations deep: the last node still on the trunk. */
export function lastMainLineAncestor(root: MoveNode, id: string): string {
  const trail = nodePath(root, id)
  let parent = root
  let last = root
  for (const node of trail) {
    const i = parent.children.findIndex((c) => c.id === node.id)
    if (i > 0) break
    last = node
    parent = node
  }
  return last.id
}

/**
 * The alternatives on offer from where the board is standing, in a stable
 * order: children[1..] of the branch point, which is the parent when standing
 * on a move that has siblings, else the node itself.
 */
export function alternativesAt(root: MoveNode, id: string): MoveNode[] {
  const trail = nodePath(root, id)
  const node = trail.length > 0 ? trail[trail.length - 1] : root
  const parent = trail.length > 1 ? trail[trail.length - 2] : root
  const branchPoint = (parent.children ?? []).length > 1 ? parent : node
  return (branchPoint.children ?? []).slice(1)
}
