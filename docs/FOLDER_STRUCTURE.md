# Folder Structure

```
hopon/
├── src/
│   ├── components/
│   │   ├── atoms/          # Single-responsibility UI units
│   │   │   └── inputs/     # Form input atoms
│   │   ├── layout/         # Structural layout primitives
│   │   ├── molecules/      # Multi-atom product patterns
│   │   └── organisms/      # Complex multi-molecule compositions
│   ├── hooks/              # Shared custom React hooks
│   ├── mocks/              # Static mock data (replaces API layer during dev)
│   ├── navigation/         # Navigator components and param type definitions
│   ├── screens/            # Screen components, organised by product domain
│   │   ├── chat/
│   │   ├── home/
│   │   ├── notifications/
│   │   ├── onboarding/
│   │   ├── plan/
│   │   ├── profile/
│   │   ├── recaps/
│   │   └── settings/
│   ├── theme/              # Design system: tokens, text styles, theme context
│   ├── types/              # TypeScript domain type definitions
│   └── utils/              # Pure utility functions
├── docs/                   # Frontend architecture documentation (this folder)
└── assets/                 # Fonts, images, icons
```

---

## `src/components/`

The components tree follows the atom → molecule → organism hierarchy. Within each layer, files are flat (no domain sub-folders) because components are domain-agnostic — a `PlanRow` is in `molecules/` not `molecules/plan/`, because grouping by domain creates artificial barriers to reuse.

**`atoms/inputs/`** is the one exception: input components are grouped because they share implementation patterns (focus state, theme-aware borders, label conventions) and are imported together by form screens.

---

## `src/screens/`

Screens are grouped by product domain. Domain folders map to logical user journeys, not to navigation stacks — for example, `plan/` contains all plan lifecycle states (posted, joined, ended, host view) even though some plan screens are reachable from different stacks.

**`_Placeholder.tsx`** is a generic placeholder screen used for routes that exist in the navigation map but don't have a real screen yet.

---

## `src/theme/`

Four files, each with a specific responsibility:

| File | Responsibility |
|---|---|
| `tokens.ts` | Raw design values — the only file with hardcoded numbers |
| `textStyles.ts` | Named text style presets composing token values |
| `ThemeContext.tsx` | Adaptive theme resolution and the `useTheme` hook |
| `index.ts` | Re-exports `useTheme` and `textStyles` for convenient imports |

---

## `src/types/`

Pure TypeScript domain models. No React, no React Native, no imports from anywhere in `src/`. These files describe the data shape of the HopOn domain — plans, users, notifications, chats, recaps, stories. They are the shared contract between the UI and the future API layer.

`index.ts` re-exports all type files, enabling `import { Plan, User } from '@/types'` anywhere in the codebase.

---

## `src/mocks/`

Static data that stands in for an API during development. Each file mirrors a future data source (users, plans, notifications, recaps, stories). The shape of mock objects matches the domain types exactly — mocks are valid instances of the types in `src/types/`.

`index.ts` re-exports everything through a clean public API, so screens import from `@/mocks` not from individual mock files.

**When the backend is ready:** each mock module is replaced with a hook or service that fetches real data. Screen files and components require no changes.

---

## `src/hooks/`

Shared custom hooks that encapsulate reusable stateful logic. Hooks here must be truly reusable — if a hook is only used by one screen and contains logic specific to that screen, it belongs in the screen file, not here.

---

## `src/utils/`

Pure functions with no React or side effects. Organised by domain:

| File | Contents |
|---|---|
| `time.ts` | `diffMins`, `timeAgo`, `formatDate`, `countdownLabel` |
| `plan.ts` | `deriveUrgency`, `getCostLabel`, `getGenderLabel`, `getSpotsVariant` |
| `avatar.ts` | Avatar URL helpers |

---

## Path Aliases

The codebase uses `@/` as a path alias for `src/`. This is configured in `tsconfig.json` and `babel.config.js`. Always use the alias, never relative paths with `../../`.

```ts
// Always
import { spacing } from '@/theme/tokens';

// Never
import { spacing } from '../../theme/tokens';
```
