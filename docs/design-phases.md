# Design Phase Record

Each design phase is completed, verified, and persisted before the next phase begins.

## Required completion cycle

1. Define the phase goal and expected artifact.
2. Produce the artifact.
3. Run the phase-specific checks and tests.
4. Complete the phase checklist.
5. Record the approved outcome in this document.

## Phase 1 — Brand Values

### Goal

Define the product qualities that guide all visual and interaction decisions.

### Approved values

| Value | Product implication |
| --- | --- |
| Modern | Use contemporary, purposeful interface patterns. |
| Calm | Reduce visual noise with restrained color and generous spacing. |
| Premium | Maintain consistent typography, detail, and polish. |
| Clear | Prioritize hierarchy, navigation, and focus on the current task. |
| Professional | Communicate reliability and avoid unnecessary playfulness. |
| Technical | Make structured, capable functionality evident without intimidation. |
| Friendly | Use approachable interaction and supportive language. |

### Brand principle

LehrerMaps organizes complexity instead of making it visible.

### Completion checklist

- [x] Brand values are explicit and actionable.
- [x] Values align with a professional teacher workspace.
- [x] Calmness and clarity take priority over decoration.

## Phase 2 — Target Audience

### Goal

Define the primary user so product and design decisions remain focused.

### Approved audience

LehrerMaps is designed for teachers who organize, prepare, and use teaching materials.

### Explicitly out of scope

- Students
- Parents or guardians
- School administration

### Product implications

| Decision area | Direction |
| --- | --- |
| Language | Support teachers' planning and classroom workflows. |
| Navigation | Prioritize subjects, groups, lesson materials, and schedules. |
| Features | Optimize for preparing, finding, and presenting teaching resources. |
| Access | Do not introduce student, parent, or administrative portals in this scope. |

### Completion checklist

- [x] The primary user is explicit: teachers.
- [x] Non-target audiences are documented.
- [x] The target audience has concrete product implications.

## Phase 3 — Brand Book

### Goal

Establish a coherent visual and interaction direction for LehrerMaps.

### Reference direction

| Reference | Principle adopted |
| --- | --- |
| Apple | Clarity, restraint, and a polished feeling. |
| Notion | Calm content structure and flexible organization. |
| Linear | Precise hierarchy, efficient workflows, and focused states. |
| Craft | Editorial warmth and generous whitespace. |
| GitHub | Familiar, dependable controls for complex content. |
| Raycast | Fast, keyboard-friendly interaction and compact utility. |

### Brand character

LehrerMaps is a calm, premium, professional workspace for teachers. It is technically capable but never visually intimidating. Every screen should help a teacher find, prepare, or present material with confidence.

### Design principles

1. **Clarity before decoration.** Interface elements must support a concrete teaching task.
2. **Calm by default.** Use whitespace, low-contrast surfaces, and progressive disclosure to reduce cognitive load.
3. **Fast when needed.** Frequent actions must be easy to scan, quick to reach, and keyboard-friendly where practical.
4. **Structure makes complexity usable.** Subjects, groups, folders, lessons, and materials need visible hierarchy.
5. **Warm professionalism.** The interface is precise and reliable without becoming cold or bureaucratic.

### Visual language

| Area | Direction |
| --- | --- |
| Layout | Spacious canvas, clear content columns, consistent alignment, and restrained density. |
| Typography | Highly legible sans-serif typography with a strong heading/body hierarchy. |
| Color | Neutral foundation, one confident primary accent, and semantic colors used only for meaning. |
| Surfaces | Soft borders and subtle elevation; avoid decorative gradients and heavy shadows. |
| Icons | Simple, familiar, consistent line icons paired with text when clarity requires it. |
| Motion | Brief and purposeful; animate orientation changes and feedback, never decoration alone. |

### Interaction language

| Situation | Required behavior |
| --- | --- |
| Primary work | Keep the active teaching task visually dominant. |
| Complex actions | Reveal advanced options progressively instead of exposing every control at once. |
| Feedback | Confirm success clearly, explain errors constructively, and preserve the user's context. |
| Navigation | Make location and hierarchy obvious at all times. |
| Speed | Support predictable shortcuts and quick actions for recurring workflows. |

### Avoid

- Dashboard clutter, dense cards, and competing visual emphasis.
- Decorative effects that weaken readability or make the product feel playful.
- Administration-oriented language and workflows.
- Hidden critical actions or ambiguous icon-only controls.
- Technical terminology where teacher-centered wording is clearer.

### Completion checklist

- [x] The design direction synthesizes the selected reference products.
- [x] Brand character and design principles are explicit.
- [x] Visual and interaction rules are actionable for later phases.
- [x] Exclusions protect the calm, teacher-centered product direction.

## Phase 4 — Design System

### Goal

Define a usable visual system for LehrerMaps across light and dark modes.

### Color tokens

| Token | Light mode | Dark mode | Purpose |
| --- | --- | --- | --- |
| Primary navy | `#173B66` | `#8CBCEB` | Primary actions, navigation, key links. |
| Secondary turquoise | `#0F9E9A` | `#48C7C1` | Supporting actions and active states. |
| Accent orange | `#E87824` | `#FFAE6B` | High-value emphasis; use sparingly. |
| Success green | `#25845D` | `#58C491` | Confirmed and successful states. |
| Warning yellow | `#B77905` | `#F5C85C` | Attention-required states. |
| Error red | `#C83E4D` | `#FF8D99` | Destructive actions and errors. |
| Canvas | `#F7F8FA` | `#12161C` | Application background. |
| Surface | `#FFFFFF` | `#1B222B` | Cards, panels, and raised controls. |
| Text primary | `#18212B` | `#F3F6F9` | High-emphasis content. |
| Text secondary | `#607080` | `#AAB6C3` | Supporting content. |
| Border | `#DCE3EA` | `#303C48` | Low-emphasis structure and separation. |

### Typography

| Role | Specification |
| --- | --- |
| Primary UI font | Inter, with system fallback. |
| Apple system fallback | `-apple-system, BlinkMacSystemFont, "SF Pro Text"`. SF Pro is used only when present on the user's Apple device; it is not bundled. |
| Body | 14–16 px, regular weight, generous line height. |
| Headings | Inter/SF Pro, semibold; use size and spacing before weight for hierarchy. |
| Data | Tabular numerals where dates, times, and schedules must align. |

### Layout and spacing

Use a four-pixel spacing scale: `4, 8, 12, 16, 24, 32, 48, 64` px. Default content padding is 24 px on desktop and 16 px on compact screens. Keep a single dominant action per view and preserve whitespace around dense teaching material.

### Foundations

| Element | Rule |
| --- | --- |
| Radius | 8 px for controls, 12 px for cards and dialogs, 999 px only for compact tags or avatars. |
| Shadows | Use one subtle elevation level for raised surfaces; avoid layered or colored shadows. |
| Icons | Familiar 20 px outline icons; pair with text for destructive, unfamiliar, or important actions. |
| Focus | A visible primary-color focus ring is mandatory for keyboard navigation. |
| Motion | 150–200 ms ease-out for feedback and panel transitions; respect reduced-motion preferences. |

### Component rules

| Component | Direction |
| --- | --- |
| Buttons | Clear primary, secondary, ghost, and destructive hierarchy; 40 px minimum height for standard actions. |
| Cards | Surface background, 12 px radius, light border, restrained padding, and no decorative chrome. |
| Tables | Scannable rows, pinned headers where useful, subdued dividers, and explicit sorting/selection states. |
| Forms | Persistent labels, helpful validation text, clear required-state treatment, and no placeholder-only inputs. |
| Search | Prominent, fast to focus, with a clear empty state and keyboard shortcut affordance when available. |
| Navigation | Stable left-side hierarchy on wide screens; preserve context, active location, and fast access to recent work. |

### Light and dark mode

Both modes use the same semantic token names, never independent hard-coded component colors. Dark mode reduces glare and preserves contrast; it does not invert every light-mode value mechanically.

### Completion checklist

- [x] Semantic colors cover primary, secondary, accent, success, warning, and error states.
- [x] Light and dark token values are defined.
- [x] Typography, spacing, elevation, radius, icon, focus, and motion rules are specified.
- [x] Component guidance covers buttons, cards, tables, forms, search, and navigation.

## Phase 6 — Surface Modernization

### Goal

Apply the approved brand system to the visible teacher workspace without changing product behavior.

### Applied changes

- Replaced the warm legacy visual tokens with the navy, turquoise, neutral, and semantic token system in both color modes.
- Applied Inter with the Apple system font fallback across the application.
- Replaced the legacy brand mark in the login and application navigation with the selected production SVG.
- Updated the login surface to use a calm Apple-inspired card composition and brand-color gradient.
- Modernized navigation, sidebar surfaces, dashboard cards, focus states, and interaction feedback through shared CSS rules.
- Added a reduced-motion fallback that preserves accessibility.

### Completion checklist

- [x] Login uses the production brand mark and primary navy action color.
- [x] Dashboard, navigation, cards, and sidebar inherit the new token system.
- [x] Dark mode uses dedicated dark tokens rather than a mechanical inversion.
- [x] Keyboard focus and reduced-motion behavior are explicit.

## Phase 7 — Component Consistency

### Goal

Unify recurring interface patterns so teachers learn one reliable interaction language.

### Applied rules

- Dialogs and popups share the same radius, border, elevation, backdrop, and motion treatment.
- Search fields, filters, and PDF controls use one input and focus-state system.
- Lists and tables use subdued headers, stable hover feedback, and consistent separation.
- PDF tools, video surfaces, downloads, and favorite controls use the established semantic color system.

### Completion checklist

- [x] Dialog, popup, search, filter, list, and table treatments are unified.
- [x] PDF and media surfaces use consistent containment and controls.
- [x] Download and favorite states have explicit visual feedback.
- [x] Component styles preserve dark-mode and keyboard-focus behavior.

## Phase 8 — Accessibility Baseline

### Goal

Make the core application shell and global dialogs more accessible to keyboard and screen-reader users.

### Applied changes

- Added a keyboard-visible skip link that moves directly to the main content.
- Added navigation and main-content landmarks to the authenticated application shell.
- Added explicit visible focus styles for controls and interactive roles.
- Added dialog semantics, modal state, labels, and descriptions to confirmation and global-search dialogs.
- Added an explicit label to the global-search input instead of relying on placeholder text.

### Verification boundary

These changes establish accessibility foundations. A complete WCAG conformance claim requires a separate automated and manual audit across every route, state, browser, assistive technology, and responsive breakpoint.

### Completion checklist

- [x] Keyboard users can skip navigation and reach the main workspace.
- [x] Core navigation, main content, and global dialogs expose semantic roles.
- [x] Focus visibility remains clear in light and dark modes.
- [x] The project does not claim full WCAG conformance without an audit.

## Phase 9 — Performance Foundation

### Goal

Keep initial navigation fast while loading feature-heavy tools only when a teacher opens them.

### Applied changes

- Preserved route-level lazy loading for authenticated views and feature-level dynamic imports for QR, terminal, and other optional tools.
- Configured stable production chunks for React, editor, PDF, terminal, and remaining vendor dependencies.
- Kept CSS code splitting enabled and source maps disabled in production output.
- Added content-visibility containment for long home, annual-planning, and PDF thumbnail sections where supported.
- Bumped the service-worker cache and added the production brand SVG to the app shell cache.

### Verification boundary

The optimization settings are source-verified. Bundle size, Lighthouse scores, and runtime performance still require a production build and device/browser measurements.

### Completion checklist

- [x] Heavy tools remain lazy-loaded rather than entering the initial route by default.
- [x] Production bundle chunking is explicit.
- [x] The service-worker cache version updates with the new brand asset.
- [x] No performance score is claimed without a production measurement.

## Phase 10 — Quality Verification

### Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| Responsive test harness | Pass | `node scripts/lehrermaps-responsive-launch.mjs` completed successfully. |
| PWA static distribution integrity | Pass | `npm run test:pwa` found the current `client/dist` manifest and referenced assets. |
| PWA runtime audit | Blocked | No reachable local application server was available at ports 8090, 5173, or 5174. |
| Light/dark browser review | Blocked | Requires a running browser-accessible application. |
| Console review | Blocked | Requires a running browser-accessible application. |
| Lighthouse | Not run | Requires a reachable application URL and a browser runtime. |

### Verification boundary

The responsive harness passed. The runtime PWA audit did not fail because of a detected application defect; it could not connect to a local server. Do not interpret the blocked browser checks as passes.

### Completion checklist

- [x] Existing responsive harness executed successfully.
- [x] Existing PWA audit executed and its result recorded honestly.
- [ ] Start the current app in a reachable local or staging environment.
- [ ] Re-run PWA runtime, responsive viewport, light/dark, console, and Lighthouse checks.

## Phase 11 — Documentation

### Goal

Document the project structure, visual system, logo family, frontend components, CSS/JavaScript conventions, backend/API surface, and PWA setup.

### Deliverable

`docs/technical-reference.md` is the maintained technical reference. It documents the requested folders, colors, icons, logos, components, CSS, JavaScript, API, and manifest. It also records that the application uses Node.js/Express and has no PHP runtime or PHP source files.

### Completion checklist

- [x] Architecture and folders are documented.
- [x] Brand, colors, icons, and logo family are documented.
- [x] Frontend components, CSS, JavaScript loading, backend, API, and PWA files are documented.
- [x] The PHP request is resolved accurately: PHP is not part of this codebase.

## Logo Exploration — Pending Selection

### Goal

Explore five directions for the LehrerMaps logo family before committing production assets to the application.

### Preview candidates

| Candidate | Direction | Preview |
| --- | --- | --- |
| A | Folded map + location pin | `docs/assets/logo-concepts/logo-a-map-pin-preview.png` |
| B | Folded map + laptop | `docs/assets/logo-concepts/logo-b-map-laptop-preview.png` |
| C | Folded map + teacher | `docs/assets/logo-concepts/logo-c-map-teacher-preview.png` |
| D | Folded map + book | `docs/assets/logo-concepts/logo-d-map-book-preview.png` |
| E | Minimal map-inspired abstract mark | `docs/assets/logo-concepts/logo-e-minimal-preview.png` |

### Selected direction

Candidate E is the selected logo direction. Its simple three-panel map and connected route remain recognizable at small sizes and avoid literal classroom imagery.

### Production family

| Variant | SVG | Transparent PNG |
| --- | --- | --- |
| Full color | `client/public/brand/lehrermaps-mark.svg` | `client/public/brand/lehrermaps-mark.png` |
| Monochrome navy | `client/public/brand/lehrermaps-mark-mono.svg` | `client/public/brand/lehrermaps-mark-mono.png` |
| Light-background | `client/public/brand/lehrermaps-mark-light.svg` | `client/public/brand/lehrermaps-mark-light.png` |
| Dark-background | `client/public/brand/lehrermaps-mark-dark.svg` | `client/public/brand/lehrermaps-mark-dark.png` |

Every PNG is exported at 1024 × 1024 with an alpha channel. PWA-specific icon sizes are produced in the PWA Branding phase.

### Completion checklist

- [x] Five distinct logo directions were generated and saved as previews.
- [x] Every preview follows the defined navy/turquoise/orange brand palette.
- [x] Candidate E is selected.
- [x] Editable SVG and transparent PNG production variants are created.
- [ ] PWA-specific icon sizes are created in the PWA Branding phase.
