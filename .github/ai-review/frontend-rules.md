# Frontend Review Guidelines (Orbit Angular Client)

Review any changes in `frontend/` against these architectural and code quality rules:

## Technology Stack & Component Architecture
- **Framework**: Angular 21 Standalone components with SCSS, Signals, and Angular CDK.
- **Component File Structure**: Every component must strictly adhere to the 4-file structure:
  - `<name>.component.ts`
  - `<name>.component.html`
  - `<name>.component.scss`
  - `<name>.component.spec.ts`
  - **Strict: Never use inline templates (`template: '...'`) or inline styles (`styles: ['...']`)**.
- **Dev Server Port**: Default frontend port is 4200.

## Reactivity & State Management
- Prefer Angular Signals (`signal`, `computed`, `linkedSignal`) for component reactive state.
- If RxJS Observables are used, prevent memory leaks. Ensure subscriptions are either handled via the `async` pipe or destroyed cleanly using `takeUntilDestroyed()`.
- Avoid unnecessary effects (`effect()`) for state derivations that should be computed signals (`computed()`).

## Design System & Styling
- Use Orbit design system CSS custom properties instead of hardcoded hex colors:
  - `--orbit-bg` (`#121214`)
  - `--orbit-surface` (`#18181B`)
  - `--orbit-elevated` (`#27272A`)
  - `--orbit-border` (`#2E2E33`)
  - `--orbit-accent` (`#F59E0B`)
  - `--orbit-text-primary` (`#EDEDEF`)
  - `--orbit-text-muted` (`#A1A1AA`)
- Flag hardcoded colors that bypass design tokens.

## Iconography & UI Consistency
- Maintain icon style consistency across the repository.
- Do not mix multiple conflicting icon libraries. Flag instances where icon styles clash or look inconsistent.
- Never use raw OS emojis for UI actions, buttons, or status indicators.

## Responsive Parity
- Ensure layouts do not employ hardcoded fixed widths that break mobile viewports (target: Desktop `1440x900`, Mobile `390x844`).
