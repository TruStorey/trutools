# Site styles

The palette icon at the right of the navbar switches the whole site between ten
looks. It is purely cosmetic: every style renders the same tools, with the same
behaviour, from the same markup. The choice is remembered in your browser and
nothing else.

## The styles

| Style | What it looks like | Based on |
|---|---|---|
| **Glass** | Liquid-glass cards over a soft colour mesh. The default, and the original look. | Glassmorphism, and Apple's Liquid Glass. Built with [`@glasscn`](https://glasscn-components.vercel.app)'s pure-CSS `liquid` variant. |
| **Spotlight** | Near-black, lit from above in violet. Card borders and surfaces glow where the pointer is. | The cursor-following "spotlight card" common on developer-tool landing pages, plus a stage light over a dot grid. |
| **Clay** | Lighter lavender dusk, everything rounded. Cards and chosen options look raised, inputs pressed in. | Claymorphism: soft, inflated 3D surfaces made from layered inner and outer shadows. |
| **Terminal** | Green monospace text on black, scanlines, a blinking cursor. | Green-phosphor CRT terminals. |
| **Tinted** | Each section owns a hue — crypto purple, networking blue, data formats teal, text amber, system coral — and its cards, heading and open panel take it. | Colour-coding by category, the way a well-kept set of folder tabs or a transit map does it. |
| **Blueprint** | White linework on drafting blue, a two-scale grid, square corners, dashed dimension lines. | Architectural blueprints and cyanotype drawings. |
| **Swiss** | Flat black, white type, a 12-column grid and a single red disc. Red marks the open tool. | The International Typographic Style: grid, sans-serif, asymmetry, one accent colour. |
| **Vapor** | Purple-to-magenta sky, a banded sunset sun, a neon grid floor. Pink edges with cyan offset shadows. | Vaporwave and outrun: 1980s retro-futurism. |
| **Glitch** | Black with static and torn colour bands. Text splits into red and cyan on hover. | Glitch art: RGB channel separation and scan artefacts. |
| **Sticky** | Sticky notes on a dark felt board, coloured by section and slightly askew. The open tool is a ruled notepad sheet in its section's colour. | A kanban wall of sticky notes. |

Animation in Vapor, Glitch and Terminal stops when the system asks for reduced
motion.

## How it works

### The attribute

The chosen style lives in one place: `data-style` on `<html>`. Every rule that
differs between styles is CSS keyed off it, in the *Site styles* and
*Backgrounds* sections at the end of `app/globals.css`.

The list of styles, the default and the storage key are in
`lib/site-style.ts`. It has no React in it, so the root layout can inline a
small script from it into `<head>`. That script reads `localStorage` and sets
`data-style` **before first paint**, so a returning visitor never sees Glass
flash up before their own style. The approach is the one in Next's own guide,
`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.

`components/site-style/site-style-provider.tsx` holds the same value in React
for the switcher, and re-applies the attribute on mount. That is needed in
development, where Strict Mode's remount resets `<html>` to the attributes React
manages and drops this one.

The only thing stored is the style's name, under `trutools:style`. No cookie,
nothing sent to the server.

### The markup does not change

There is one set of markup, and it is Glass's. Tool cards are still
`GlassCard`s and the search is still a `GlassInput` in every style. The other
styles restyle them from CSS, which is why the right look is there before
hydration.

To make that possible, elements carry hooks for the CSS to find:

| Hook | On |
|---|---|
| `data-surface="card"`, `"panel"`, `"input"` | Tool cards, the open tool panel, the search box |
| `data-section` | Cards, open panels and section headings, for the per-section colours in Tinted and Sticky |
| `data-expanded` | The card whose panel is open |
| `data-ui="navbar"`, `"wordmark"`, `"island"` | The header, the logo link, the status island |
| `data-ui="segmented"`, `"indicator"`, `"segment"`, `"pill"`, `"chip"` | Toggle groups, their sliding indicator, in-panel options, language pills, the Browser/API button |
| `data-ui="control"`, `"well"`, `"kbd"` | Form inputs, code and output boxes, the search shortcut hint |
| `data-ui="copy"`, `"copy-icon"` | Labelled copy buttons, and the per-row copy icon |
| `data-ui="section-title"`, `"caption"`, `"icon-chip"`, `"path"` | Section headings, control captions, the tool icon square, the `/verb/tool` path |

Dialogs, dropdown menus and tooltips are found by the `data-slot` the shadcn
components already set.

The style rules are deliberately **unlayered**. Tailwind's utilities sit in a
cascade layer, and unlayered CSS beats any layer, so a style can override a
glass utility class without `!important`.

### One palette per style

Each style sets a small palette of `--ui-*` variables on `:root`, and one shared
block applies them to the navbar, island, toggles, pills, form controls, code
boxes, copy buttons, popovers, selection colour and scrollbars:

| Variable | Used for |
|---|---|
| `--ui-bar`, `--ui-bar-border` | Navbar fill and bottom edge |
| `--ui-island`, `--ui-island-fg`, `--ui-island-shadow` | The status island |
| `--ui-surface`, `--ui-border`, `--ui-popover`, `--ui-popover-shadow` | Toggle groups, dialogs, menus, tooltips |
| `--ui-radius`, `--ui-radius-inner`, `--ui-radius-lg` | Corner radii, outer to inner |
| `--ui-accent`, `--ui-accent-fg` | Selected options, copy-button hover, text selection |
| `--ui-control`, `--ui-control-border`, `--ui-focus` | Inputs, unselected pills, chips |
| `--ui-well`, `--ui-well-border` | Code and output boxes |
| `--ui-heading`, `--ui-caption`, `--ui-chip`, `--ui-chip-fg`, `--ui-scroll` | Headings, captions, icon squares, scrollbar thumb |

Each style's own section then adds what a palette cannot express: shapes, fonts,
glows, offsets.

A few styles redefine the shadcn colour tokens too (`--foreground`,
`--muted-foreground`, `--ring` and so on), which re-colours every component that
uses them. Terminal does it site-wide. Sticky does it inside a note, so text on
yellow paper turns to ink.

### Backgrounds

Glass's ambient mesh is `body::before`. Every other style replaces that layer
with its own, and some use `body::after` for a second fixed layer: Spotlight's
dot grid, Terminal's scanlines, Vapor's grid floor, Glitch's scan bar and
Sticky's flecks. Grain textures are inline SVG fractal noise, with the noise
mapped into the alpha channel, so it can sit over any colour.

## Adding a style

1. **Add it to `SITE_STYLES`** in `lib/site-style.ts`, with a label and a
   one-line description. The switcher and the pre-paint script both read that
   list.
2. **Add a block to `app/globals.css`** under `:root[data-style="<id>"]`. Set
   every `--ui-*` variable, then style `[data-surface]` and add whatever the
   shared block cannot do.
3. **Add its background** in the *Backgrounds* section.

Things that have caught out the existing ones:

- **Never add rules for Glass.** Shared rules use
  `:root:not([data-style="glass"])`, so Glass stays exactly as its markup draws
  it.
- **A gradient is not a colour.** A variable holding a gradient has to be
  applied with the `background` shorthand, not `background-color`. It cannot be
  a `::selection` colour either, so give those styles a solid selection colour.
- **Variables resolve where they are declared.** A `--ui-*` value that uses
  `var(--hue)` on `:root` is fixed there, using `:root`'s hue. Per-section
  colours therefore have to be written on the element that has the section,
  which is how Tinted's panels and icon squares do it.
- **The island's corners are set inline** by Motion, so a square island needs
  `border-radius: … !important`. That is the one place it is used.
- **The open panel holds real forms and output.** Check it is still readable,
  and keep code boxes dark enough for the syntax colours. Paper-coloured panels
  re-point the `--ui-*` variables on the panel itself, as Sticky's does.
- **Respect reduced motion** for anything that moves on its own.
