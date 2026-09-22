# Task List — Azmoon Visual Polish Pass

## Status: Active (do not stop until all done)

## Completed
1. ✅ Menu closing animation — panels shrink back into hamburger button (CSS keyframes pan-up/pan-down + inline transformOrigin)
2. ✅ Panel blur/strength increased — glx backdrop 6px, glx-strong blur 12px, stronger shadows (0.12-0.18 vs 0.20)
3. ✅ Sky white background (`#f0f7ff`)
4. ✅ Topbar separation removed (transparent router-view-box)
5. ✅ Custom Dropdown component — replaces all native `<select>` (no more Windows OS dropdown)
6. ✅ Dropdown readability — solid paper-warm bg (95% opacity), `text-sm` font, improved hover/selected contrast
7. ✅ Modal depth — `panel-in`/`panel-out` scale animation with `transformOrigin: center bottom`, deeper shadows
8. ✅ Button styling — consistent spacing, hover brightness, press-down active:scale, proper focus states
9. ✅ Form input unification — `Input` component with `text-sm`, matching Dropdown trigger
10. ✅ Darker `--color-text-secondary` — `#525d72` (was `#6b7280`)

## Remaining Issues
### Global input font consistency
- ExamResults.tsx: inline inputs still use `text-xs`
- ExamPreview.tsx: inline inputs use `text-xs` and `text-[10.5px]`
- Students.tsx: ExamLogs modal inline inputs still `text-xs`

### Topbar notification panel animation
- Still uses separate `growFromBell`/`shrinkToBell` — could unify with panel animation system

## Next
1. Global sweep: convert all inline input `text-xs` → `text-sm` in teacher pages
2. Verify all dropdowns use the custom Dropdown component (not native select)
