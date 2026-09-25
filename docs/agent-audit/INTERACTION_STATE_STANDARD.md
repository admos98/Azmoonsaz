# Interaction-state standard

Every interactive control uses the following state contract. Shared CSS provides the baseline; semantic components may strengthen it without changing meaning.

| State | Required signal |
| --- | --- |
| Default | Semantic foreground/background and sufficient contrast |
| Hover | Color/elevation change only on hover-capable devices |
| Pressed | Small immediate translate/brightness response; removed under reduced motion |
| Selected | Persistent semantic fill/border plus programmatic `aria-selected`, `aria-checked`, or current state |
| Focused | Two-pixel semantic focus ring with offset; never color-only |
| Disabled | Native `disabled`/`aria-disabled`, reduced emphasis, and non-interactive cursor |
| Loading | Control remains labelled, exposes busy state, and prevents duplicate submission |
| Success | Specific result text announced politely |
| Error | Field-level description or assertive operation error; user input remains intact |

## Fields and validation

Text fields, selects, textareas, checkboxes, radios, switches, and segmented controls use semantic surface, border, text, placeholder, focus, invalid, and disabled channels. Validation text names the problem and expected recovery. LTR data uses the shared directional island.

## Geometry and elevation

Radii follow the token ladder. A nested surface uses the next smaller radius token after accounting for its inset. Elevation is reserved for overlays and independently interactive floating surfaces; nested content uses borders or tonal separation rather than another glass shadow.

## RTL behavior

Back/forward icons express logical direction, not hard-coded western direction. Popup transform origins are captured from their trigger. Horizontal keyboard behavior follows each widget's RTL semantics. Text/icon spacing uses logical visual order and mixed-direction values are isolated.
