/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Search pill that opens the CommandPalette (hover-expanding label panel).
 * Extracted verbatim from src/components/Topbar.tsx.
 */
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Search } from 'lucide-react';

interface TopbarSearchPillProps {
 showHamburgerMenu: boolean;
 setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
}

export function TopbarSearchPill({
 showHamburgerMenu,
 setCommandPaletteOpen,
}: TopbarSearchPillProps) {
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLButtonElement>(null);

 return (
 <>
        {/* Search — a pill that opens the CommandPalette. Collapsed: a 44px
            icon. Hover/expand reveals a "جستجو" label; clicking anywhere on
            the pill opens the palette, which is the actual search field (the
            old in-pill input typed into a void). Same `drop` droplet
            material as the bell / menu icon buttons, no kbd hint. */}
        <div
          className="relative h-11 w-11"
          onMouseEnter={() => !showHamburgerMenu && setShowSearch(true)}
          onMouseLeave={() => !showHamburgerMenu && setShowSearch(false)}
        >
          {/* Label panel — pane glass that slides out from behind the circle
              and merges back into it on leave. The circle never moves. */}
          <div
            className={`absolute top-0 right-[14px] h-11 rounded-full overflow-hidden pane transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showSearch ? 'w-[176px]' : 'w-0'
            }`}
          >
            <span
              className={`absolute inset-y-0 right-[46px] flex items-center whitespace-nowrap text-caption text-[var(--color-text-secondary)] transition-opacity duration-200 delay-150 ${
                showSearch ? 'opacity-100' : 'opacity-0'
              }`}
            >
              جستجو…
            </span>
          </div>
          <button
            type="button"
            ref={searchRef}
            className="btn-glass absolute right-0 top-0 z-10 grid h-11 w-11 place-items-center rounded-full cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="جستجو — باز کردن پالت فرمان‌ها"
            aria-expanded={showSearch}
          >
            <Search className="w-4.5 h-4.5 shrink-0" />
          </button>
        </div>
 </>
 );
}
