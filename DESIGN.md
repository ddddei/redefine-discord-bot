# Redefine Discord Bot Design System

## 1. Atmosphere & Identity

Project Redefine interfaces should feel like a quiet operations room: clear, calm, and grounded even when the content is playful. The Dungeon World browser game adds a darker campfire-and-black-tower tone, but it still avoids pressure, ranking language, or reward hooks. The signature is restrained adventure: ink-dark surfaces, moss-green action, amber warnings, and Korean copy that sounds like an operator gently opening a scene.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Surface/primary | --surface-primary | #F7F5EF | #101417 | Page background |
| Surface/secondary | --surface-secondary | #ECE7D8 | #171E22 | Panels, canvas shell |
| Surface/elevated | --surface-elevated | #FFFFFF | #202A2F | Modals, upgrade cards |
| Surface/canvas | --surface-canvas | #D7D0BA | #0B1012 | Game field |
| Text/primary | --text-primary | #1C2425 | #F1EEE4 | Main Korean text |
| Text/secondary | --text-secondary | #526060 | #B8C2B6 | Supporting text |
| Text/tertiary | --text-tertiary | #717B78 | #7E8A82 | Metadata |
| Border/default | --border-default | #B9B19D | #39464A | Panels and controls |
| Border/subtle | --border-subtle | #D8D1C0 | #263136 | Soft dividers |
| Accent/primary | --accent-primary | #256F5A | #76D0A4 | Primary action, player |
| Accent/hover | --accent-hover | #1D5948 | #9EE2BF | Hover/focus |
| Accent/ember | --accent-ember | #A85F24 | #E4A84F | XP, timers, warnings |
| Accent/bell | --accent-bell | #5E4DB2 | #A795FF | Boss, black-bell motif |
| Status/success | --status-success | #1F7A4A | #7AD28C | Win, cleared state |
| Status/warning | --status-warning | #A85F24 | #E4A84F | Caution, upgrade available |
| Status/error | --status-error | #A53C3C | #FF8A8A | Low health, game over |
| Status/info | --status-info | #315E7C | #83BDE8 | Help and hints |

### Rules

- Game UI uses the dark palette by default.
- Accent/primary is reserved for the player, start/retry controls, focus rings, and positive progress.
- Accent/bell is only for the black bell, tower, boss, or special wave language.
- No raw color values in UI files outside this table.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
| --- | --- | --- | --- | --- |
| Display | 40px | 800 | 1.15 | 0 | Game title, large result |
| H1 | 32px | 800 | 1.2 | 0 | Page title |
| H2 | 24px | 700 | 1.3 | 0 | Panel title, modal heading |
| H3 | 18px | 700 | 1.4 | 0 | Upgrade title, stat group |
| Body/lg | 17px | 500 | 1.65 | 0 | Scene introduction |
| Body | 15px | 400 | 1.6 | 0 | Default text |
| Body/sm | 13px | 400 | 1.5 | 0 | HUD labels, hints |
| Caption | 12px | 600 | 1.4 | 0 | Compact labels |
| Overline | 11px | 700 | 1.3 | 0 | Rare section labels |

### Font Stack

- Primary: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace
- Serif: not used

### Rules

- Korean text must not rely on negative letter spacing.
- Body text stays at 13px or larger on compact HUD elements and 15px or larger in panels.
- Large Korean headings use `clamp()` to prevent awkward mobile wrapping.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
| --- | --- | --- |
| --space-1 | 4px | Fine gaps |
| --space-2 | 8px | Compact inline groups |
| --space-3 | 12px | HUD padding |
| --space-4 | 16px | Default component gap |
| --space-5 | 20px | Panel padding |
| --space-6 | 24px | Section gap |
| --space-8 | 32px | Major layout gap |
| --space-10 | 40px | Page vertical rhythm |
| --space-12 | 48px | Large sections |
| --space-16 | 64px | First viewport spacing |

### Grid

- Max content width: 1440px
- Column system: responsive CSS grid, single column below 900px
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px

### Rules

- The game canvas keeps a stable 16:9 aspect ratio with a minimum playable height.
- HUD and side panels must collapse below the canvas on narrow screens.
- Touch controls are not required for this prototype; keyboard instructions remain visible.

## 5. Components

### Game Shell

- **Structure**: header, responsive play grid, canvas stage, side panel, modal layer.
- **Variants**: title, active play, paused/upgrade, result.
- **Spacing**: --space-3 through --space-8.
- **States**: ready, running, paused, win, game over.
- **Accessibility**: canvas has a text fallback and keyboard focus instructions are visible.
- **Motion**: canvas motion is real-time; DOM transitions use opacity and transform only.

### Command Button

- **Structure**: native `button` with concise label.
- **Variants**: primary, secondary, danger.
- **Spacing**: --space-3 vertical, --space-4 horizontal.
- **States**: hover, active, focus, disabled.
- **Accessibility**: visible focus outline and AA contrast.
- **Motion**: 120ms transform/opacity feedback.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
| --- | --- | --- | --- |
| Micro | 120ms | ease-out | Button press |
| Standard | 220ms | ease-in-out | Modal fade |
| Emphasis | 420ms | cubic-bezier(0.16, 1, 0.3, 1) | Result state |
| Game loop | frame-timed | linear | Canvas movement |

### Rules

- DOM animation only uses `transform` and `opacity`.
- Respect `prefers-reduced-motion` for decorative DOM transitions.
- Continuous game motion remains core gameplay, but pause and result controls must be immediate.

## 7. Depth & Surface

### Strategy

Use borders plus tonal shifts. Shadows are reserved for the modal only.

| Type | Value | Usage |
| --- | --- | --- |
| Default | 1px solid var(--border-default) | Panels, canvas shell |
| Subtle | 1px solid var(--border-subtle) | Inner HUD separators |
| Modal shadow | 0 24px 80px rgba(0, 0, 0, 0.45) | Upgrade/result modal only |
