# Image loading audit

_Last reviewed: 2026-09-25_

- Shell identity imagery (logo, teacher avatar, top-bar avatar) is eager because it is visible immediately and stabilizes shell geometry.
- Question, answer-option, preview, and exam-content images are lazy and asynchronously decoded because they may occur below the fold or across many items.
- Existing containers preserve dimensions through component layout; content images retain their authored aspect behavior.
- Theme-critical decoration is CSS/SVG and semantic-token driven rather than duplicated light/dark raster assets.
- User-uploaded and question images remain data-driven; no inspection fixtures or external fallback URLs are introduced into production.
