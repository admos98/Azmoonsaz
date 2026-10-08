/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

/* ==========================================
   1b. MICRO CONTROLS — TextLink / IconButton / PillButton
   The three shapes pages hand-rolled for months because Button (glass
   material, three paddings, rounded-xl) cannot express them: link-styled
   text buttons, icon-only micro actions, compact soft-fill pills. Each
   primitive emits exactly the class vocabulary the hand-rolled corpus
   used, so migrating a site can be verified byte-set-equal (pixel-safe);
   tools/check-library-adoption.mjs ratchets every category.

   Shared with Button: the focus-ring token. Deliberately NOT baked:
   disabled opacity (sites carry their own disabled styling) and display
   flex (sites that need a row pass flex items-center gap-*, matching the
   original markup).
   ========================================== */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
