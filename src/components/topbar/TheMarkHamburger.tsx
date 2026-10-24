/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TheMark Hamburger — the morphing menu/close icon.
 *
 * Extracted verbatim from src/components/Topbar.tsx.
 */
// TheMark Hamburger — four rounded pills stacked vertically, 3rd gold-filled.
// When open, the pills form the brand X IN PLACE: the three ink rings travel to
// center and land inside one another as the hollow "/" arm, the gold pill swings
// into the solid "\" arm — the menu lines literally become the close button.
export function TheMarkHamburger({
  size = 48,
  isHovered = false,
  isOpen = false,
}: {
  size?: number;
  isHovered?: boolean;
  isOpen?: boolean;
}) {
  const ink = 'var(--color-ink)';
  const gold = 'var(--color-gold)';
  const baseScale = isHovered && !isOpen ? 1.1 : 1; // pills expand on hover
  const pillWidth = size * 0.65 * baseScale; // horizontal bar width
  const pillHeight = size * 0.1 * baseScale; // bar thickness (thinner)
  const gap = ((size - pillHeight * 4) / 3) * 0.5; // pills closer together
  const x = (size - pillWidth * baseScale) / 2;
  const rx = pillHeight / 2.5; // rounded corners
  const stretch = 0.74 / 0.65; // pill width -> full X-arm length
  // opening morphs at 0.5s; CLOSING must beat the menu's 0.22s shrink-to-
  // hamburger, or the X keeps unwinding after the panels are already gone
  const morph = isOpen
    ? 'transform 0.5s cubic-bezier(0.25, 1, 0.35, 1)'
    : 'transform 0.2s cubic-bezier(0.25, 1, 0.35, 1)';
  const armAt = (i: number, angle: number) => ({
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
    transition: morph,
    transform: isOpen
      ? `translateY(${size / 2 - ((gap + pillHeight) * i + pillHeight / 2)}px) rotate(${angle}deg) scaleX(${stretch})`
      : 'none',
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Pill 1 — ink ring → "/" arm */}
      <rect
        x={x}
        y={gap * 0 + pillHeight * 0}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(0, -45)}
      />
      {/* Pill 2 — ink ring → "/" arm (lands inside pill 1) */}
      <rect
        x={x}
        y={gap * 1 + pillHeight * 1}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(1, -45)}
      />
      {/* Pill 3 — gold filled → "\" arm */}
      <rect
        x={x}
        y={gap * 2 + pillHeight * 2}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        fill={gold}
        style={armAt(2, 45)}
      />
      {/* Pill 4 — ink ring → "/" arm (lands inside the others) */}
      <rect
        x={x}
        y={gap * 3 + pillHeight * 3}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(3, -45)}
      />
    </svg>
  );
}
