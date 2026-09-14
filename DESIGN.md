---
name: Call Coverage
description: A hairline-and-type instrument for reading CRM call coverage at a glance, with zero boxed cards and one accent.
colors:
  ink: "#0a0a0a"
  ground: "#ffffff"
  gray-quiet: "#6b6b6b"
  gray-hairline: "#e3e3e0"
  accent: "#c2410c"
  accent-ink: "#ffffff"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
  value:
    fontFamily: "ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "1.5rem"
    fontWeight: 500
    fontFeature: "tabular-nums"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 500
    letterSpacing: "0.03em"
    textTransform: "uppercase"
rounded:
  none: "0px"
  sm: "4px"
spacing:
  1: "4px"
  2: "8px"
  3: "16px"
  4: "24px"
  5: "40px"
  6: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-primary-disabled:
    backgroundColor: "{colors.gray-hairline}"
    textColor: "{colors.gray-quiet}"
    rounded: "{rounded.sm}"
  stat-cell:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px"
---

# Design System: Call Coverage

## Overview

**Creative North Star: "The Ledger, Not the Dashboard"**

This is an internal coverage instrument, not a SaaS dashboard. It refuses the boxed-card-with-soft-shadow pattern that category defaults to: no card ever gets a background tint, a border-radius above 4px, or a shadow. Instead the page reads like a ledger — hairline rules divide every region, type weight and one accent color carry all hierarchy, and every metric renders in tabular monospace so a manager can scan a column of numbers the way they'd scan a spreadsheet, not a tile grid.

The palette is intentionally starved: near-black ink on white ground (inverted in dark mode), two grays for quiet text and dividers, and exactly one accent used for the histogram fill, focus rings, selection, the primary button, and the error state — never a second hue anywhere, including error, which borrows the same accent rather than introducing red. Density is high and confident; nothing is padded out to look important, and the KPI grid holds nine metrics in fixed positions so a manager builds spatial memory of where each figure lives across repeated reviews.

**Key Characteristics:**
- Hairline dividers replace cards and shadows everywhere
- Exactly one accent (burnt orange / light, warm amber / dark), no incidental colors
- Every metric value is tabular-mono; every label is sans
- Fixed-position KPI grid — same cell holds the same stat every load
- Radius is capped at 4px and reserved for the single interactive button

## Colors

The palette is deliberately narrow: ink, ground, two grays, and one accent — nothing else appears in the UI, in any state, including error.

### Primary
- **Accent** (`#c2410c` light / `#fb923c` dark): the system's only color, reserved for signal, never for large surfaces. Used for the calls-per-lead histogram bars, focus-visible outlines, text-selection background, and the error-state message color.

### Neutral
- **Ink** (`#0a0a0a` light / `#f2f2f0` dark): primary text, the topbar heading, the filled button background.
- **Ground** (`#ffffff` light / `#0a0a0a` dark): page background, button text-on-ink.
- **Gray, quiet** (`#6b6b6b` light / `#9a9a97` dark): secondary text — field labels, hints, distribution counts, empty states.
- **Gray, hairline** (`#e3e3e0` light / `#262624` dark): every 1px divider, disabled-button fill, histogram track background.
- **Accent-ink** (`#ffffff` light / `#0a0a0a` dark): text/selection color rendered on top of the accent (`::selection`).

### Named Rules
**The One Accent Rule.** Exactly one accent color exists in this system. It is never duplicated as a second "error red" or "success green" — the error state (`.state-error`) reuses the same accent token. A screen that introduces a second hue for status is off-system.

**The No-Fill Rule.** Ink and ground never swap roles as decorative background blocks. Ink appears as text or as the single filled button; ground is the page surface everywhere else. Gray-hairline is a divider color, not a surface tint — cards are never given a `background: gray` treatment.

## Typography

**Body/Label/Headline Font:** system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`)
**Value Font:** system mono stack (`ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`)

**Character:** A plain, native-feeling system pairing with one deliberate split: every number in the UI renders in monospace with tabular figures, every word renders in sans. The split is semantic, not decorative — it tells a manager "this is data" versus "this is a label" before they've read a single glyph.

### Hierarchy
- **Headline** (600, 1.25rem, `-0.01em` tracking): the single page title, "Call Coverage," in the topbar.
- **Title** (600, 0.95rem): section headers ("Calls per Lead," "Outcome Breakdown").
- **Value** (500, 1.5rem, tabular-nums mono): every KPI value in the stat grid — the largest text on the page besides the headline, and the only place size itself signals importance.
- **Body** (400, 0.9rem): filter inputs, table cells, state/empty messages.
- **Label** (500, 0.72rem, `0.03em` tracking, uppercase): stat-grid labels and table column headers — small, quiet, and consistently uppercase wherever a value or row needs a header.

### Named Rules
**The Tabular Numerals Rule.** Every rendered metric — KPI values, histogram counts/percentages, outcome-table counts — carries `font-variant-numeric: tabular-nums` in the mono stack via the shared `.num` class. A number that isn't monospaced is a bug, not a style choice.

## Layout

Single column, max-width 860px, centered, with generous outer padding (40px top, 24px sides, 64px bottom) — this is a one-view instrument, not a multi-column dashboard. Vertical rhythm runs on the 4/8/16/24/40/64px spacing scale; sections stack with a full 64px gap between them, while related elements (a stat's label and value) sit 4px apart. The KPI grid is a fixed 3-column layout (2 columns under 640px, 1 column under 420px) — it reflows column count responsively but the stat order itself never changes, preserving each KPI's position within the sequence.

## Elevation & Depth

There is no shadow vocabulary in this system — zero `box-shadow` declarations anywhere in the stylesheet. Depth and grouping are conveyed entirely by 1px hairline borders (`--gray-2` / `--gray-hairline`) and by whitespace rhythm, never by elevation.

### Named Rules
**The Hairline-Only Rule.** All separation — between the topbar and body, between stat cells, between table rows — is a single 1px border in the hairline-gray token. No double borders, no gradient fades standing in for shadows, no blurred glows.

## Shapes

Radius is nearly absent and used exactly once: the primary button carries 4px corners (`--radius: 4px` inline value), the only rounded shape in the interface. Every other surface — filter inputs, the stat grid, the histogram track, the table — is hard-cornered (0px). Inputs and selects have no border box at all; they're cut down to a single 1px bottom border, no fill, no outline, so the field reads as a line in the page rather than a boxed control. (The browser's native scrollbar thumb renders at 8px radius as OS chrome, not part of this radius scale — it isn't an authored component and shouldn't be copied into new UI as a system value.)

## Components

### Buttons
- **Shape:** hard-edged with a single soft corner (4px radius) — the one rounded shape in the system.
- **Primary:** ink-filled (`#0a0a0a`), ground-colored text, 1px ink border, padding `8px 16px`, font-weight 600 at 0.85rem. No other button style exists in the shipped UI.
- **Hover / Focus:** hover drops opacity to 0.82 (no color shift, no shadow, no scale); focus uses the shared `:focus-visible` 2px accent outline, offset 2px.
- **Disabled:** fill and border drop to hairline-gray, text drops to quiet-gray, cursor becomes not-allowed. No opacity trick here — disabled gets its own flat color state.

### Cards / Containers
This system has no card component. The KPI grid is a hairline-ruled table of cells, not boxed cards: `border-top` + `border-left` on the grid, `border-right` + `border-bottom` on each cell, producing a shared-edge grid with no radius, no fill, no shadow, 16px internal padding per cell.

### Inputs / Fields
- **Style:** no box at all — transparent background, no border except a single 1px bottom hairline, no radius. Date/owner selects render in sans, free-text-shaped values (the date inputs) render in mono at 0.9rem.
- **Hover:** the bottom hairline darkens from `gray-hairline` to `gray-quiet`.
- **Focus:** the shared 2px accent outline, offset 2px — same treatment as every other focusable element, no bespoke focus ring per input.

### Navigation
No navigation exists — this is a single, un-routed view. The topbar holds only the page heading and the filter row (owner select, start/end date, Load button), separated from the body by one hairline.

### The Calls-per-Lead Histogram (signature component)
A horizontal bar-per-bucket histogram (buckets: 0 / 1 / 2 / 3+ calls) built from a single accent color at variable opacity rather than a color ramp or a second hue — bar length encodes the count's share, opacity encodes a second signal (rarer, more-called buckets read visually bolder even at a short bar length: 0.35 / 0.55 / 0.75 / 1.0 across the four buckets). Track is hairline-gray, 6px tall, no radius.

## Do's and Don'ts

### Do:
- **Do** render every metric value — KPI, histogram count, table count — through the `.num` class (mono, tabular-nums). A number in the sans body font is off-system.
- **Do** keep the KPI grid's stat order fixed across reloads; a manager's spatial memory of "connect rate is top-right" is a stated product requirement, not incidental.
- **Do** use the single accent for every signal color, including error states — never introduce a second hue for status.
- **Do** separate regions with a 1px hairline border in `gray-hairline`; that is the system's only depth device.

### Don't:
- **Don't** add `box-shadow` anywhere. This build ships with zero shadows; a shadowed card is the exact pattern the system was built to refuse.
- **Don't** give any surface a fill or radius beyond the single 4px button. Stat cells, inputs, and the histogram track are all hard-cornered and unfilled.
- **Don't** introduce a second accent color, a status-color palette, or any color outside ink/ground/two grays/one accent.
- **Don't** style a metric value in the sans body font — every number is mono with tabular figures, no exceptions.
</content>
