# Azmoonsaz — Empty-State Art: Generation Prompts (six motifs)

**How to use:** image generators have no memory between runs. **Paste the STYLE BLOCK verbatim at the start of EVERY prompt**, then append one SUBJECT block. Generate the six light-colorway images first; do the dark colorway by *recoloring*, not regenerating (see below).

**The grammar that makes these six read as one hand:** every motif is line-only isometric, and most carry the same recurring device — a row of four small circles where the **third is the single solid gold circle** (The Mark's own rule: gold = 3rd of 4, always filled, never a ring). That repetition is the system. Don't let the tool "improve" it.

**Glyph vocabulary — the only two signs allowed to carry meaning:**
- **BUBBLE ROW** (exam grammar): four small circles, third solid gold = answer choices / the Mark. Used on documents, cards, panes.
- **PERSON** (people grammar): one line-only circle head above a single open shoulder arc. No facial features, no hair, no clothing — pure geometry, the same sign as the `users` icon already in the app. In person groups the **third head is the gold fill**, so the one-fill rule and the third-of-four rule both survive.
A motif about people MUST contain person glyphs. A motif about papers MUST contain the bubble row. Mixing them is what makes an illustration read as the wrong noun (v1 of STUDENTS was a card stack with a bubble row = "forms", not students).

---

## STYLE BLOCK — paste verbatim into every prompt

> Flat minimal isometric line-art icon illustration, true 30-degree isometric projection, pure clean vector look. Uniform rounded-cap strokes only; stroke thickness everywhere equal to 22% of the diameter of the small circles in the scene. Light colorway: strokes deep plum ink #221E4A; at most one pale wash plane #EFEFEB; exactly ONE filled shape in the whole image: a single solid gold circle #F5B301 with no outline of its own. No gradients, no shadows, no highlights, no textures, no noise, no glow, no outlines around the gold circle. No text, no letters, no numbers, no punctuation anywhere in the image. Transparent background, square canvas, single centered object group with 12% margin on all sides, generous negative space. Crisp clean edges, one consistent stroke weight, no 3D shading, no perspective other than isometric, no background scenery except at most one thin sweeping contour curve drawn in the stroke color at 40% opacity.

---

## 1 · STUDENTS — «تعداد دانش‌آموزان» + Students page empty state (v2 — people, not papers)

> Subject: a group of four abstract person glyphs standing in a staggered isometric row on a thin ground plane: each person is a line-only circle head above a single open shoulder arc, no facial features, no hair, no clothing. The third person's head is the single solid gold circle; the other three heads are outlines only. One thin open contour curve sweeps behind the group as a ground motif. No cards, no panels, no documents, no boxes, no desks. Nothing else in frame.

## 2 · QUESTIONS — «تعداد کل سوالات» + question bank empty state

> Subject: an isometric open index-card box with three question cards rising out of it at slight depth offsets. The front card carries a horizontal row of four small answer bubbles — three outlines only, the third being the single solid gold circle — above two outline-only rule lines. The box is outline-only with one pale wash plane on its inner side wall. Nothing else in frame.

## 3 · ACTIVE EXAMS — «آزمون‌های فعال در کلاس» + "active & upcoming exams" bottom panel (v2 — adds the timed sign)

> Subject: a single isometric answer sheet floating just above a thin outline-only desk plane. The sheet carries a horizontal row of four small bubbles — three outlines only, the third being the single solid gold circle — and two outline-only rule lines beneath the row. At the sheet's top corner, a small outline-only clock: a plain circle with two straight hands and no digits, no ticks. One thin open contour curve sweeps under the desk plane as a ground motif. Nothing else in frame.

## 4 · GRADING — «نیازمند تصحیح تشریحی» + "latest submissions" bottom panel + results list (v2 — adds the human marker)

> Subject: an isometric inbox tray holding two sheets, the top sheet slid half-out toward the viewer; a line-only pen rests diagonally across the tray's front edge — elongated body, pointed tip, no clip, no branding. The visible sheet face carries two outline-only rule lines and the single solid gold circle placed like a stamp at its top corner. One pale wash plane on the tray's inner side wall only, never on a top face. Nothing else in frame.

## 5 · SCHEDULED — «آزمون‌های زمان‌بندی‌شده» + exams list (scheduled filter)

> Subject: an isometric upright thin calendar pane showing an outline-only three-by-three grid of squares with no numbers in them; the single solid gold circle rests on the center square as the marked day. One thin contour curve sweeps behind the pane as a ground motif. Nothing else in frame.

## 6 · CLASSES — profile hub Classes tab + class picker empty states (v2 — a contained group, not "layers")

> Subject: one upright isometric rounded pane with a small corner tab, like a group container standing on a thin ground plane; inside the pane, a horizontal row of four small abstract person glyphs — each a line-only circle head above a single open shoulder arc, no facial features — with the third head being the single solid gold circle. The pane is outline-only with one pale wash plane on its inner side wall, never on its front face. No stacked panes, no documents, no desks. Nothing else in frame.

**Students vs classes, stated plainly:** students = a free-standing crowd on the ground (no container). Classes = the same person grammar *contained* in one pane with a tab. Same glyphs, different composition — that pair is what keeps the two from collapsing into one drawing.

---

## Dark colorway — recolor, don't regenerate

Regenerating for dark will give you six *different* compositions and break the set. Since the art is flat line work on transparent, recolor the light exports instead (Figma/Illustrator select-by-color, or a plain `sed`/script on SVG fills if you vectorize):

| role | light | dark |
|---|---|---|
| strokes / contour curve | `#221E4A` | `#F7F1E4` |
| pale wash plane | `#EFEFEB` | `#322F47` |
| the one gold fill | `#F5B301` | `#F8C542` |

If you hand-vector these (recommended — see export note), build them with `currentColor` for strokes + two named fills, and both colorways come free from CSS, exactly like `TheMark.tsx` does.

## Reject checklist — if a generation shows any of these, throw it away

- [ ] any gradient, shadow, highlight, glow or texture
- [ ] any text, letter, digit or punctuation (tools love sneaking a "12" into calendars)
- [ ] more than ONE filled shape (the gold circle is the only fill allowed)
- [ ] an outline drawn around the gold circle
- [ ] non-uniform stroke weight, or strokes that taper
- [ ] perspective that isn't 30° isometric (tools drift to two-point perspective)
- [ ] a white/off-white background baked in instead of transparency
- [ ] extra props: pencils, clocks, faces, hands, plants, confetti — the brand is geometry, not clipart
- [ ] the four-bubble row reordered (gold must be **third of four**) or reduced to fewer bubbles
- [ ] **a baked-in background**: black or grey smoke, halos, vignettes, soft glows behind the subject — generators fake "transparency" with smoke. Reject on sight; see export note.
- [ ] **a closed contour ring/orbit around the subject** (reads as a planet). The contour curve must be an *open sweep* that passes behind the object and exits the frame.
- [ ] **a wash or fill on a top/main face** — washes live on side and inner planes only, or the object reads as a sticker and won't recolor for dark.
- [ ] **a people motif drawn as papers** (the v1 STUDENTS failure): if the panel is about humans, person glyphs must be in frame; if it's about papers, the bubble row must be. Card stacks with rule lines read as "forms/database", never as students.

## Export & placement spec

- **Format:** SVG if you vectorize (best: `currentColor` strokes → themes free). PNG otherwise, **transparent**, exported at 3× (e.g. 480px for a 160px slot).
- **Background — do NOT ask the generator for transparency.** It cannot produce real alpha; it paints smoke, halos or vignettes and pretends (the first STUDENTS render arrived on grey fog over black). Ask for a **solid pure-white #FFFFFF background**, then key it out in one step (magic-wand, or `convert in.png -fuzz 8% -transparent white out.png`), or trace to SVG. True transparency comes from your editor, never from the model.
- **Sizes:** stat-card slot **56–72px** tall, sitting in the value zone where the dot-zero used to be (it *replaces* the zero, it doesn't join it); panel crest rail **112px** art in a fixed **136px** inline-end slot — same slot empty and filled (below); page-level empty states **160px** centered; `compact`/dropdown empty states stay icon-only, no art.
- **Filled state keeps the crest (fixed rail):** the motif is the panel's permanent resident, not an apology for nothing. Panel body = content column + fixed rail at inline-end (physical **left** under `dir=rtl`; anchor by DOM order or logical properties, never a physical `left:`). The rail lives outside any scroll container so rows scroll under a stationary crest. Empty↔filled changes only the content column and the crest opacity — empty `1.0`, filled `0.60` light / `0.75` dark (`--panel-crest-dim`), 160ms cross-fade, static under reduce. Zero layout shift between states is the acceptance test. Layout mock: `empty-art/panel-mock.png`.
- **Markup:** `aria-hidden="true"` on the image always — the existing Persian title + description carry the meaning; the art is decorative by definition.
- **Motion:** none, or a single one-time stroke draw-in on mount. No loops — the repo's pulse-discipline rule (`animation-iteration-count: 3` max, then rest) applies to illustrations too, and `data-motion='reduce'` must render them static.
- **Wiring:** the `art?: React.ReactNode` prop on `EmptyState` (`UIComponents.tsx:876-910`) from worklist item 1K; stat cards render the motif conditionally when their count is 0, next to the footnote CTA.
- **Consistency test before accepting the set:** line the six up in a row at 72px. If one reads heavier, denser or bigger-than-the-others than its siblings, redraw that one — the constraint is what makes it a system instead of six decisions.

## Verified set — shipped 2026-10-06

The six motifs were generated against this pack and accepted after one correction round. Winning takes: **01 students, 04 grading, 05 scheduled = take 1 · 02 questions, 03 active-exams, 06 classes = take 2.** Take-2 existed because take-1 broke two rules the checklist already names: an ink **ring drawn around the gold disc** (02/03/06) and the **gold bubble landing 4th of four** (02). The fix was prompt-side, not post-side: a standalone GOLD RULE paragraph ("flat solid disc, absolutely no outline, no ring, no stroke touching it") plus an explicit left-to-right bubble enumeration. If you regen any motif, keep both clauses verbatim.

Delivered artifacts (all under `empty-art/`):

- `src/*-white.png` — raw generations on solid white (01/04/05 v1, 02/03/06 v2).
- `light/*.png`, `dark/*.png` — the shippable set: transparent RGBA squares, keyed and recolored by `process.py` (coverage-fit matte: each pixel solved as `a·ink + (1−a)·bg`, coverage becomes alpha; interior ink/gold snapped solid; wash gradient and AA fringe preserved). Dark is a recolor of the same matte, never a regen.
- `preview.png` — contact sheet: light row, dark row, then both at the 72px acceptance size. The set passed: six in a row read as one system in both themes.
- `process.py` — re-run after any regen: `python3 empty-art/process.py` (needs PIL + numpy). Update the `ASSETS` list if a filename changes.
