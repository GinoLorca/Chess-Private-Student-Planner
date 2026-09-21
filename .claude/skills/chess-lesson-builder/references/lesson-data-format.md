# Lesson data format

This is the exact shape the lesson-artifact JS expects, and the input format
to ask Gino for when a required piece is missing. Both `lesson-artifacts/*.html`
files share this same schema — only the CSS/markup differs between the two themes.

## What to ask Gino for

A lesson is: one student + one or more sections, each with one or more puzzles
(positions). Per puzzle you need:

- **Position** — a FEN placement string (just the piece-placement field, e.g.
  `r2qkbnr/1pp1pppb/p6p/3p4/1n1P1B2/2N2N2/PPP1PPPP/1R1QKB1R` — no side/castling/
  move-count suffix, that's added automatically) and **side to move** (`w`/`b`).
- **Quiz prompt** (optional) — the question shown to the student before the
  answer, e.g. "How should Black react against White's last move?". Often
  blank — the position + "what's the best move?" is implied.
- **Summary/context** — the explanation shown after the student reveals the
  answer. This is the coaching content; write it the way Gino would say it out
  loud, not a dry engine readout.
- **Solution** — the move(s) in SAN (e.g. `["Rc1"]` or `["dxc4", "Bxc4", "Nxc4"]`
  for a multi-move line). A puzzle can have per-move comments (see below) if a
  move needs its own explanation, not just the summary.
- **Reference link** (optional) — a Lichess/Chess.com puzzle URL and a short
  label, if the position is sourced from one.

If Gino gives you a game (PGN or move list) instead of a bare FEN, derive the
FEN yourself from the position at the relevant move — don't ask him to do that
conversion. If he gives you positions without solutions or explanations,
**ask him** rather than inventing chess content — a wrong "best move" or a
made-up explanation is worse than an incomplete lesson.

## Puzzle object — the `pz()` helper

Every puzzle in the file is built with this helper (already defined once near
the top of the `<script>` block — don't redefine it):

```js
function pz(label, placement, side, quizPrompt, summary, sanList, refUrl, refLabel){
  return {
    id: uid("pz"), label: label, placement: placement, side: side,
    arrows: [], highlights: [], quizPrompt: quizPrompt || "", summary: summary || "",
    solution: (sanList||[]).map(function(san){ return {san:san, comment:""}; }),
    refUrl: refUrl || "", refLabel: refLabel || ""
  };
}
```

Call it like:

```js
pz("Rc1", "r2qkbnr/1pp1pppb/p6p/3p4/1n1P1B2/2N2N2/PPP1PPPP/1R1QKB1R", "w",
   "",
   "Any other move loses material. Bh7 and Nb4 are threatening to fork the a1-rook on c2. 1.Kd2? avoids the check, but it does not protect the pawn.",
   ["Rc1"], "", "")
```

- `label` is the short move/name shown in the puzzle row and the editor tab
  title (usually just the solution's first move, e.g. `"Rc1"`, `"f3"`).
- For a **multi-move line with a per-move comment**, don't use `pz()` for the
  solution — build the object directly so you can attach `comment` to one
  entry, e.g.:

  ```js
  { id: uid("pz"), label: "dxc4", placement: "...", side: "b",
    arrows: [], highlights: [], quizPrompt: "", summary: "...",
    solution: [
      {san:"dxc4", comment:""},
      {san:"Bxc4", comment:"Recapturing with the bishop keeps the knight on f3 protecting the center."},
      {san:"Nxc4", comment:""}
    ],
    refUrl: "", refLabel: "" }
  ```

## Section object

```js
{ id: "<studentId><lessonNum>s<sectionIndex>", title:"Detect the Weakness", puzzles:[ pz(...), pz(...) ] }
```

`title` is an eyebrow label shown above the puzzle rows (e.g. "Defend and
Protect", "Can I Take It?", "Tactics"). A lesson can have one section or
several — Gino may send you a lesson with just one theme, or several distinct
drills bundled together; ask if it's unclear whether he wants one section or
a split.

## Lesson plan object

```js
{
  id: "lp<N>", number: <N>, title: "",
  agenda: [],
  sections: [ /* one or more section objects */ ]
}
```

- `number` is the next sequential lesson number **for that student** — look
  at the highest `number` already in their `make<Student>Lessons()` function
  and use `+1`. Lesson numbering is per-student, not global.
- `id` follows the existing convention: `"lp" + number` (e.g. `"lp11"`), unique
  within that student's own array — it does not need to be globally unique,
  since lookups always scope by student id first.
- `title` and `agenda` are almost always left blank/empty in existing lessons
  (`agenda` is a free-form coach checklist Gino fills in live, in-app) — leave
  them as `""` / `[]` unless Gino explicitly gives you agenda items.
- Display order doesn't matter: the lesson list always shows newest-number
  first regardless of array order, so just append the new lesson object to
  the end of the array.

## Where this lives per student

Each student with real content has a `make<Name>Lessons()` function (e.g.
`makeJojoLessons()`, `makeParkerLessons()`) that returns the array assigned to
`DB.lessonPlans[studentId]`:

```js
lessonPlans: {
  jojo: makeJojoLessons(),
  parker: makeParkerLessons(),
  aria: [], marcus: []
}
```

- **Existing student with a `make*Lessons()` function**: add the new lesson
  plan object to the end of the array that function returns.
- **Existing student with an empty array** (like `aria: []` or `marcus: []`
  today): write a new `make<Name>Lessons()` function following the same
  pattern (a function returning `[ {lesson plan object} ]`), and change the
  `DB.lessonPlans` entry from `aria: []` to `aria: makeAriaLessons()`. Define
  the function near the other `make*Lessons()` functions, not inline.
- **A student who isn't in `DB.students` yet**: add them to `DB.students`
  first — `{id:"<lowercase-key>", name:"<Full Name>", color:"<hex>"}`. Pick an
  unused pastel hex from the palette already in use nearby (or reuse the same
  `palette` array the in-app "+" add-student button cycles through) so the
  folder tab looks consistent with the others.

## Piece sets and board colors

Don't touch `wavyPieceBody`, `pieceBodySvg`, `arcadePieceSvg`, or the
`--board-*` / piece-set CSS — those are shared engine code, not per-lesson
data. A lesson never needs to specify a piece set or board color; the viewer
already respects whatever the coach has picked in Settings.
