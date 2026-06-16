# Phase 5 — hitSlop Standardisation
**Date:** 2026-06-16  
**Status:** COMPLETE

---

## Objective

Replace hardcoded `hitSlop` numbers with design token references, consistent with the convention already used in ~60% of the codebase.

---

## Convention

`spacing.sm` (= 8) for standard touch targets. `spacing.md` (= 12) for larger targets (e.g. close buttons on media overlays).

---

## Files Modified

| File | Change |
|---|---|
| `src/components/molecules/SectionHeader.tsx` | `hitSlop={8}` → `hitSlop={spacing.sm}` |
| `src/screens/recaps/RecapPostScreen.tsx` | `hitSlop={8}` → `hitSlop={spacing.sm}` |
| `src/screens/recaps/StoryViewerScreen.tsx` | `hitSlop={12}` → `hitSlop={spacing.md}` (close button), `hitSlop={10}` → `hitSlop={spacing.sm}` (action buttons, 3 occurrences) |

---

## Validation

- `npx tsc --noEmit`: **PASSED**

---

## Risk Assessment

**Very Low.** `spacing.sm = 8` and `spacing.md = 12`. The `10` → `8` change on StoryViewer action buttons is a 2px reduction in touch target expansion on media overlay controls — acceptable and within Apple/Google HIG guidelines (minimum 44pt target met by the button size itself).
