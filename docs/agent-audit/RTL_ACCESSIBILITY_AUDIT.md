# RTL interaction and accessible-name audit

_Last reviewed: 2026-09-25_

## Directional behavior

- Teacher back actions use `ArrowRight`, matching backward movement in RTL.
- Student previous-question actions use `ArrowRight`; next-question actions use `ArrowLeft`.
- Forward calls to action use `ArrowLeft` in RTL.
- Bidirectional role switching uses the neutral `ArrowLeftRight` symbol.
- Semantic tablists reverse horizontal arrow movement for RTL and retain vertical/Home/End behavior where applicable.
- Trigger-origin overlays calculate their transform origin from geometry rather than assuming left/right.
- LTR IDs, codes, email, URLs, and numeric fields use isolated directional islands.

## Accessible names

`npm run check:a11y-buttons` parses every production TSX file and fails when a button contains only an icon with no `aria-label`, `aria-labelledby`, or title. The initial audit found five genuine unnamed controls; all were corrected with concise Persian labels and visible native tooltips. Dynamic text buttons remain accepted by the check.

## Remaining manual verification

Screen-reader pronunciation and browser-native tooltip timing remain part of the final human/browser matrix rather than being inferred from source code.
