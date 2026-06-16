# Documentation Audit
**Audit date:** 2026-06-16 · **Scope:** `src/` inline docs + `docs/` directory

---

## 1. Inline Code Documentation — Assessment

### 1.1 API Layer (`src/api/`) — EXCELLENT ✅

Every file has a file-level JSDoc comment explaining its purpose, contract, and any gotchas. Key examples:

- `client.ts` — explains React Native URL polyfill requirement, AsyncStorage vs in-memory fallback, autoRefreshToken wiring
- `auth.ts` — explains the OTP flow, E.164 phone normalisation, beta backdoor, the `getUser()` offline gotcha
- `plans.ts` — explains the RPC-only mutation rule, the `isMine`/`viewerJoined` derivation, the `get_my_plans` RPC rationale
- `mappers.ts` — explains the snake_case → camelCase contract and all derived fields

The `getUserHostedPlans` function has a large comment flagging that it's broken in production (throws 42501) — this is the right call; the comment is honest and actionable.

**No changes needed in the API layer.**

### 1.2 State Layer (`src/state/`) — EXCELLENT ✅

- `AuthContext.tsx` — explains the two-fact gate (`session` + `hasProfile`), the `ONBOARDED_KEY` offline flag, the `setTimeout` deferral for `onAuthStateChange`
- `SessionContext.tsx` — explains the load strategy, realtime subscription, optimistic mark-read, foreground refetch
- `suspension.ts` — explains why suspension is reactive (can't read `account_status` directly)
- `pendingStory.ts` — explains the moderation gap it solves, the max-age expiry

**No changes needed in the state layer.**

### 1.3 Components (`src/components/`) — GOOD ✅

Layout components have JSDoc explaining their purpose and when to use them (`Screen.tsx`, `ScrollContent.tsx`, `SectionBlock.tsx`).

Atoms are mostly self-explanatory from their names and props, appropriately uncommented.

Molecules have no file-level docs, which is acceptable — their names and props are descriptive.

### 1.4 Screens (`src/screens/`) — ADEQUATE 🔵

Screens have **no file-level documentation**, which is appropriate for screens (their name explains their purpose). However:

- `PlanScreen.tsx` — has an important comment explaining the `plan_not_found` vs network error distinction. Keep.
- `ChatScreen.tsx` — explains author resolution from plan detail. Keep.
- Screens with complex conditional logic (e.g. `EndorseScreen.tsx`, `ProfileScreen.tsx`) have no inline comments on the complex branches.

**Recommendation:** Add a one-line comment to `EndorseScreen.tsx` explaining the host vs peer mode branching. No other screens need documentation.

### 1.5 Hooks (`src/hooks/`) — GOOD ✅

- `usePlanStatus.ts` — well documented (though the hook is unused; see `DEAD_CODE_REPORT.md`)
- `useCountdown.ts` — no docs but trivially obvious
- `useToast.ts` — no docs but trivially obvious

### 1.6 Utils (`src/utils/`) — GOOD ✅

- `plan.ts` — explains `deriveUrgency` thresholds (4h for NOW, 240min for LATER TODAY) and `isWrappedUp` product decision
- `time.ts` — simple; no docs needed
- `avatar.ts` — simple; no docs needed

---

## 2. `docs/` Directory — Assessment

The project has an unusually comprehensive documentation suite for an early-stage app. All key areas are covered.

### 2.1 What Exists (As Of This Audit)

| Doc | Status | Notes |
|---|---|---|
| `ARCHITECTURE.md` | ✅ Current | High-level system overview |
| `BACKEND_DEV.md` | ✅ Current | Local dev workflow, migration commands |
| `LAUNCH_CHECKLIST.md` | ✅ Current | Config/ops items before launch |
| `OPERATIONS_RUNBOOK.md` | ✅ Current | Day-2 ops playbook |
| `PROD_ENVIRONMENT_SETUP.md` | ✅ Current | Step-by-step prod config |
| `INTEGRATION_PLAN.md` | ✅ Current | Wave-by-wave client integration plan |
| `PROJECT_STATUS.md` | ✅ Current | Current state + handoff |
| `NOTIFICATION_MATRIX.md` | ✅ Current | All 41 notification types |
| `SOCIAL_GRAPH_MATRIX.md` | ✅ Current | Follow/block/visibility matrix |
| `SAFETY_INTERACTION_MATRIX.md` | ✅ Current | Content moderation model |
| `TRUST_V2_DESIGN.md` | ✅ Current | Trust system spec |
| `ONBOARDING.md` | ✅ Current | Onboarding flow docs |
| `NAVIGATION.md` | ✅ Current | Navigator structure |
| `COMPONENTS.md` | ✅ Current | Component usage guide |
| `DESIGN_SYSTEM.md` | ✅ Current | Theme tokens + typography |
| `FOLDER_STRUCTURE.md` | ⚠️ Slightly stale | Doesn't reflect new `api/hooks/` or `LocationPickerSheet`; see `FOLDER_STRUCTURE_PROPOSAL.md` |
| `ANTI_PATTERNS.md` | ✅ Current | What not to do |
| `ARCHITECTURAL_PRINCIPLES.md` | ✅ Current | Core design decisions |
| `CONVENTIONS.md` | ✅ Current | Coding conventions |
| `CONTRIBUTION.md` | ✅ Current | How to contribute |
| Wave reports (W2–W7) | ✅ Current | Historical wave completion reports |
| `ACCOUNTS_SETUP.md` | ✅ Current | Services setup playbook |
| `DOCUMENTATION_REPORT.md` | ✅ Exists | Prior documentation audit |

### 2.2 Gaps / Stale Docs

| Gap | Action |
|---|---|
| `FOLDER_STRUCTURE.md` doesn't mention `api/hooks/`, `LocationPickerSheet`, or the `useHomeLocation` hook | Update or supersede with `FOLDER_STRUCTURE_PROPOSAL.md` |
| No `TESTING.md` — pgTAP tests exist (`supabase/tests/`) but there's no guide to running them locally, what they cover, or how to write new ones | Write a `TESTING.md` (1–2 pages) |
| No `SECURITY.md` — the security model (RLS + SECURITY DEFINER + block exclusion) is documented in the migration files but not in a standalone doc | Optional for launch; useful for code reviewers |
| `DOCUMENTATION_REPORT.md` (prior audit) is now superseded by these new audit docs | Archive or link forward to new docs |

---

## 3. Comment Quality Issues

### 3.1 Over-Documented: `StyleSheet_absoluteFill` in `HomeMapScreen.tsx`
```ts
// absoluteFill is a structural layout constant, not a style value — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;
```
This comment and rename are unnecessary — `StyleSheet.absoluteFill` is a well-known React Native API. Remove the local variable and use `StyleSheet.absoluteFill` directly.

### 3.2 Stale Onboarding Comment in `plans.ts`
```ts
// create_plan returns a bare plans row; map with self as host, no joiners yet.
```
This comment is accurate and useful — keep it.

### 3.3 The Beta Auth Comment is Fine
```ts
// ⚠️ BETA backdoor: when EXPO_PUBLIC_BETA_AUTH=true…
```
This is the right level of emphasis for a production-critical flag. Keep.

---

## 4. Recommendations

| Priority | Action | Effort |
|---|---|---|
| MEDIUM | Write `TESTING.md` — how to run pgTAP, what's covered, how to add tests | 1h |
| LOW | Update `FOLDER_STRUCTURE.md` or note it's superseded by `FOLDER_STRUCTURE_PROPOSAL.md` | 15min |
| LOW | Remove the `StyleSheet_absoluteFill` local variable in `HomeMapScreen.tsx` | 2min |
| LOW | Add one-line comment to `EndorseScreen.tsx` explaining host vs peer mode branching | 5min |
| OPTIONAL | Write `SECURITY.md` describing the RLS + DEFINER + block model | 2h |
