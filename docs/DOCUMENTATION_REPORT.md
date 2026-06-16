# Documentation Audit Report (Archived)
> **Superseded** by `DOCUMENTATION_AUDIT.md` (2026-06-16). This report documents the initial documentation pass; the later audit reflects the current state.

# Documentation Audit Report

## Documentation Added

### `/docs` folder — 8 documents

| File | Covers |
|---|---|
| `ARCHITECTURE.md` | System overview, layer diagram, screens-own-zero-styles rule and rationale, technology stack, dependency direction, key files reading order |
| `DESIGN_SYSTEM.md` | All four design system layers (tokens → textStyles → T.* → pattern atoms), semantic color groups, dark mode strategy, extension rules |
| `COMPONENTS.md` | Component hierarchy, all layout primitives with usage guidance, atom conventions, molecule catalogue, rules for adding new components |
| `NAVIGATION.md` | Navigator structure, param typing, cross-tab screen pattern, onboarding reset pattern, dev vs. production initial route |
| `FOLDER_STRUCTURE.md` | Every directory and its purpose, path alias convention, why certain structural decisions were made |
| `CONVENTIONS.md` | All styling rules, TypeScript conventions, file naming, import order, Pressable source, image component, comment policy |
| `ONBOARDING.md` | Day-one guide: prerequisites, setup, mental model reading order, key concepts (plan lifecycle, cost types, familiar faces, recaps), how to add a screen |
| `ANTI_PATTERNS.md` | 10 documented anti-patterns with before/after examples and explanation of why each matters |
| `CONTRIBUTION.md` | Step-by-step guides for adding screens, components, tokens, text styles, colors, and cross-stack routes; PR review guidance |
| `ARCHITECTURAL_PRINCIPLES.md` | 8 documented architectural decisions with explicit reasoning and trade-offs accepted; clear list of decisions intentionally deferred to backend integration |

### Inline file-level documentation — 18 files

| File | What was documented |
|---|---|
| `src/theme/tokens.ts` | File header (purpose, extension rules), comment on global vs. mode-conditional colors, comment on CATEGORIES |
| `src/theme/textStyles.ts` | File header (why this layer exists separately from T.tsx, extension protocol) |
| `src/theme/ThemeContext.tsx` | File header (responsibilities, color mapping strategy, semantic group rationale) |
| `src/components/atoms/T.tsx` | File header (usage pattern, T.Bold special behaviour, extension protocol) |
| `src/components/layout/Screen.tsx` | File header (responsibilities, header/footer slot behaviour, scroll={false} and keyboardAware={false} guidance) |
| `src/components/layout/Row.tsx` | File header (gap prop, default alignItems rationale, wrap/justify/flex usage) |
| `src/components/layout/Stack.tsx` | File header (no default alignItems rationale, when to use vs. Row) |
| `src/components/layout/ScreenPad.tsx` | File header (purpose, why not paddingHorizontal inline, what it does not manage) |
| `src/components/layout/SectionBlock.tsx` | File header (use cases, topBorder default rationale) |
| `src/components/layout/ScrollContent.tsx` | File header (why RNGH ScrollView, primary use cases) |
| `src/components/layout/Spacer.tsx` | File header (three modes with examples, flex mode rationale) |
| `src/components/atoms/IconBox.tsx` | File header (intended use, built-in marginBottom rationale, what it is not) |
| `src/components/atoms/RolePill.tsx` | File header (color choice rationale — product decision, not arbitrary) |
| `src/hooks/useToast.ts` | File header (emitter pattern rationale, toastEmitter export purpose) |
| `src/hooks/useCountdown.ts` | File header (return value semantics, negative number meaning, interval cleanup) |
| `src/hooks/usePlanStatus.ts` | File header (why named type over raw minutes, urgency thresholds as product decisions, usage pattern) |
| `src/types/plan.ts` | File header (minutesUntilStart rationale, MemberStatus lifecycle, closed plan meaning) |
| `src/types/user.ts` | File header (null attendanceScore meaning, familiarFaceIds purpose, visibility field enforcement location) |
| `src/utils/time.ts` | File header (negative diffMins semantics, countdownLabel purpose) |
| `src/utils/plan.ts` | File header (getCostLabel copay override, getSpotsVariant urgency behaviour) |
| `src/mocks/index.ts` | File header (purpose, CURRENT_USER_ID role, replacement strategy) |
| `src/navigation/types.ts` | File header (single source of truth, cross-stack registration rationale, undefined vs. optional params) |
| `src/navigation/RootNavigator.tsx` | File header (theme wiring purpose, dev/production initial route, navigationRef purpose) |

---

## Architectural Areas Covered

- Screen styling boundary (screens own zero styles)
- Design system layer separation (tokens → textStyles → T.* → pattern atoms)
- Dark mode strategy (ThemeContext as single resolution point)
- Semantic color group usage (cost, gender, CTA, joinBtn)
- Component hierarchy (atoms / molecules / organisms)
- Layout primitive usage and selection guidance
- Navigation structure and cross-stack screen pattern
- Param typing and navigation contract
- Dependency direction rules
- Mock data layer role and replacement path
- Domain type semantics (plan lifecycle, user trust signals)
- Hook responsibilities and usage patterns
- Utility function semantics

---

## Areas Intentionally Excluded

| Area | Reason |
|---|---|
| Authentication flow | Not yet implemented — `RootNavigator` uses a `__DEV__` bypass |
| API contracts | No API exists yet; documenting a future contract would create documentation debt |
| State management | No state manager beyond local state and context — architecture TBD during backend integration |
| Data fetching patterns | React Query, SWR, or custom hooks — not yet decided |
| Error and loading states | Screens currently assume data is always available from mocks |
| Push notifications | Infrastructure not yet implemented |
| Analytics | Not yet implemented |
| Caching strategy | Depends on the state management choice |
| Backend services and repositories | Not yet built |
| Deployment and CI/CD | Out of scope for the frontend architecture phase |
| Individual screen documentation | 40+ screen files; screens are implementation rather than architecture. The patterns they follow are documented in ARCHITECTURE.md and ANTI_PATTERNS.md. Screen-level docs would be verbose, quickly outdated, and of low value to new engineers. |

---

## Remaining Knowledge Gaps

These are areas where documentation would be valuable but requires information not yet available:

1. **Auth state management** — how `RootNavigator` will determine the initial route once authentication exists
2. **Data loading patterns** — what a real data-fetching screen looks like (loading state, error state, refetch)
3. **Real-time updates** — whether plan state (joiners, chat) updates live and how
4. **Offline behaviour** — what happens when the user has no connectivity
5. **Deep linking** — URL scheme for plan sharing (the `PlanPostedScreen` has a share button stub)
6. **`PREVIEW_EMPTY` in HomeScreen** — this constant was used during development to preview empty feed states. It has been reset to `null` for production. Future engineers should be aware it exists if they need to test empty states again.

---

## Recommendations for Future Contributors

1. **After backend integration:** Add a `DATA_FLOW.md` documenting the actual API contract, hook patterns, loading/error state conventions, and caching strategy.

2. **After auth is implemented:** Document the auth state check in `RootNavigator` and the expected session management approach.

3. **If a state manager is added:** Document the state management layer, what lives in global state vs. local state, and how screens subscribe.

4. **Keep ANTI_PATTERNS.md updated:** As new patterns are introduced or existing patterns prove problematic, add them here. This document has the highest ROI for preventing repeated mistakes.

5. **Do not document individual screens:** The architectural patterns are documented; individual screen documentation would be noise. If a specific screen has a non-obvious constraint or workaround, add a single inline comment to that screen — not a doc.
