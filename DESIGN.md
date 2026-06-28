# Redefine Discord Bot Design System

## 1. Atmosphere & Identity

Project Redefine interfaces should feel like a quiet operations room: clear, calm, and grounded even when the content is playful. The Dungeon World browser game adds a darker campfire-and-black-tower tone, but it still avoids pressure, ranking language, or reward hooks. The signature is restrained adventure: ink-dark surfaces, aged parchment, rusty metal rules, dark forest greens, black-bell violet, and Korean copy that sounds like an operator gently opening a scene.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Surface/primary | --surface-primary | #F7F5EF | #090A09 | Page background |
| Surface/secondary | --surface-secondary | #ECE7D8 | #11100C | Panels, canvas shell |
| Surface/elevated | --surface-elevated | #FFFFFF | #18140F | Modals, upgrade cards |
| Surface/canvas | --surface-canvas | #D7D0BA | #050605 | Game field |
| Surface/parchment | --surface-parchment | #D8C7A8 | #241B12 | Character-sheet bands, option cards |
| Surface/iron | --surface-iron | #C0B7A2 | #171717 | Rusted iron, dim UI metal |
| Surface/tower | --surface-tower | #BDB6AA | #070706 | Black tower silhouettes and canvas depth |
| Text/primary | --text-primary | #1C2425 | #E7DDC8 | Main Korean text |
| Text/secondary | --text-secondary | #526060 | #B8AA8D | Supporting text |
| Text/tertiary | --text-tertiary | #717B78 | #7F715B | Metadata |
| Border/default | --border-default | #B9B19D | #5D4A2F | Panels and controls |
| Border/subtle | --border-subtle | #D8D1C0 | #2F2418 | Soft dividers |
| Accent/primary | --accent-primary | #256F5A | #5F7650 | Primary action, player |
| Accent/hover | --accent-hover | #1D5948 | #94815C | Hover/focus |
| Accent/ember | --accent-ember | #A85F24 | #9A6338 | Timers, rust, restrained warnings |
| Accent/brass | --accent-brass | #8F6A2E | #9C7B45 | Brass frames, chest metal, focus lines |
| Accent/bell | --accent-bell | #5E4DB2 | #5D527D | Boss, black-bell curse motif |
| Status/success | --status-success | #1F7A4A | #6D996B | Win, cleared state |
| Status/warning | --status-warning | #A85F24 | #B98A48 | Caution, evolution available |
| Status/error | --status-error | #A53C3C | #A85249 | Low health, danger marks |
| Status/info | --status-info | #315E7C | #6FA7B5 | XP and informational glow |
| Class/fighter | --class-fighter | #8B6F3B | #9D875D | Fighter cards, player, cleave |
| Class/cleric | --class-cleric | #8D8238 | #A59C66 | Cleric cards, pulse, healing light |
| Class/thief | --class-thief | #8E552C | #9A6841 | Thief cards, blade trails |
| Class/druid | --class-druid | #4F7A44 | #667F54 | Druid cards, roots, wild aura |
| Class/wizard | --class-wizard | #5E4DB2 | #6B6090 | Wizard cards, runes, shield |
| Class/ranger | --class-ranger | #687839 | #7E8756 | Ranger cards, arrows, hawk marks |

### Rules

- Game UI uses the dark palette by default.
- Dungeon World surfaces must avoid neon glow and dashboard glass. Prefer ink wash, worn parchment, rusted rules, brass seams, cracked panels, and low-saturation class marks.
- Accent/primary is reserved for the player, start/retry controls, focus rings, and positive progress.
- Accent/bell is only for black-bell curse effects, boss patterns, arcane shield, or special wave language. The black tower and last gate remain the destination hierarchy.
- Class colors are scoped to Dungeon World survivor playbook identity and should stay less dominant than health, XP, enemy, and boss readability colors.
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

- Primary: "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace
- Serif headings: "AppleMyungjo", "Nanum Myeongjo", Georgia, serif

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
- **Map language**: the game field may use procedural canvas art for road, ruins, forest, basin, black tower, fog, and vignette; those are visual-only and do not create collision unless movement rules and tests change.
- **HUD**: health, XP, timer, level, kills, and boss goal sit close to or over the canvas; character sheet panels are secondary.
- **Silhouette language**: playbooks and monsters must be readable by shape before color. Fighter shows shield/shoulders, thief a low blade stance, cleric a halo/sanctuary, druid a root cloak, wizard an angular rune body, ranger bow/cloak/hawk mark. Enemies use ears/spear, droplet mass, empty armor blocks, low wolf body, toothed mimic, hooded cultist, and cracked bell-gate boss forms.

### Playbook Option

- **Structure**: native button with title, role metadata, sheet line, tactical description, and survival method.
- **Variants**: fighter, cleric, thief, druid, wizard, ranger content; same component shell.
- **Spacing**: --space-2 internal rhythm, --space-4 padding.
- **States**: hover, focus, selected-by-click.
- **Accessibility**: full button target, visible focus outline, Korean text wraps by phrase rather than by character where possible.
- **Motion**: 120ms transform lift only.
- **Visual motif**: each option uses a small rulebook seal/crest and compact rune badges, not long hashtag ribbons.

### Loot/Upgrade Card

- **Structure**: recommendation role seal, rarity/family line, title, effect, reason, build direction, class/synergy notes.
- **Variants**: class, rare, uncommon, common.
- **Spacing**: compact on 375px; roomy enough on tablet/desktop for scan order.
- **States**: hover, focus, selected-by-click.
- **Accessibility**: all text remains phrase-wrapped and no tag line may force horizontal scroll.

### Result Ledger

- **Structure**: automatic build name and verdict, run stat strip, run goals, boss contribution, selected upgrades, synergy ledger.
- **Tone**: looks like a run record in a worn playbook, not a dashboard report.
- **Tags**: use small rune/seal badges with short tag names and counts.

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
| Modal shadow | --shadow-ritual | Upgrade/result modal only |
| Grain overlay | token-mixed text color at low opacity | Fixed decorative overlay and panel texture |
