# 03_UI_Spec — Design System

Rules: plain CSS with CSS custom properties. **No UI framework, no icon font, no web fonts.** All tokens live in `src/ui/tokens.css`. Components never hard-code colours.

## 1. Colour Tokens

### Brand / semantic (same in both themes unless noted)
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-bg` | `#F7F8FA` | `#0F1115` | page background |
| `--color-surface` | `#FFFFFF` | `#171A21` | cards, popup body |
| `--color-surface-2` | `#EEF0F4` | `#1F232C` | hover rows, inputs |
| `--color-border` | `#D9DDE5` | `#2C313C` | dividers, input borders |
| `--color-text` | `#14171F` | `#ECEFF5` | primary text |
| `--color-text-muted` | `#5B6475` | `#9AA3B5` | secondary text |
| `--color-primary` | `#2563EB` | `#5B8DEF` | primary buttons, active toggles |
| `--color-primary-hover` | `#1D4ED8` | `#7AA2F3` | hover |
| `--color-primary-contrast` | `#FFFFFF` | `#0B1220` | text on primary |
| `--color-success` | `#15803D` | `#4ADE80` | enabled / ok |
| `--color-warning` | `#B45309` | `#FBBF24` | paused / caution |
| `--color-danger` | `#B91C1C` | `#F87171` | errors, destructive |
| `--color-focus-ring` | `#2563EB` | `#5B8DEF` | 2px outline, 2px offset |
| `--color-overlay` | `rgba(15,17,21,.5)` | `rgba(0,0,0,.65)` | modal scrim |

Contrast requirement: text/background pairs ≥ 4.5:1 (body), ≥ 3:1 (large text, UI borders). Verify with a script in `tests/a11y/contrast.test.ts` using the table above.

### Toolbar icon states (PNG, 16/32/48/128)
- Active: primary `#2563EB` shield
- Disabled: grey `#8A93A5` shield
- Degraded: active shield + red `#DC2626` dot
- Paused site: active shield + amber `#F59E0B` dot

## 2. Theme Rules
1. Default theme = `system` (`prefers-color-scheme`). User override stored in `settings.theme` (`system|light|dark`).
2. Theme applied by setting `data-theme="light|dark"` on `<html>` before first paint (inline-free: set from a tiny external `theme-boot.js` loaded synchronously in `<head>`).
3. Only tokens change between themes. No component may branch on theme in CSS.
4. Dark theme avoids pure black `#000` backgrounds and pure white text.
5. Shadows in dark theme are replaced by 1px borders.

## 3. Typography
System font stacks only (zero cost, zero load time).
- `--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", sans-serif`
- `--font-mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

| Token | Size / Line height | Weight | Use |
|-------|-------------------|--------|-----|
| `--text-display` | 40px / 44px | 700 | popup hero number |
| `--text-h1` | 24px / 32px | 600 | options page title |
| `--text-h2` | 18px / 24px | 600 | section headings |
| `--text-body` | 14px / 20px | 400 | default |
| `--text-small` | 12px / 16px | 400 | captions, hints |
| `--text-mono` | 13px / 20px | 400 | rule editor |

Minimum interactive text size: 13px. Numbers use `font-variant-numeric: tabular-nums`.

## 4. Spacing, Radius, Elevation, Motion
- Spacing scale (4px base): `--space-1: 4px`, `-2: 8px`, `-3: 12px`, `-4: 16px`, `-5: 24px`, `-6: 32px`, `-7: 48px`.
- Popup padding: `--space-4`. Options content max-width: `720px`, sidebar `220px`.
- Radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`, `--radius-pill: 999px`.
- Elevation (light only): `--shadow-1: 0 1px 2px rgba(20,23,31,.08)`, `--shadow-2: 0 6px 20px rgba(20,23,31,.12)`.
- Motion: `--dur-fast: 120ms`, `--dur-base: 200ms`, easing `cubic-bezier(.2,.8,.2,1)`. Respect `prefers-reduced-motion: reduce` → all durations 0ms.
- Touch/click target ≥ 32×32 px.

## 5. Core Components and States

### Toggle switch (`<button role="switch" aria-checked>`)
| State | Visual |
|-------|--------|
| off | track `--color-border`, knob `--color-surface` |
| on | track `--color-primary`, knob `--color-primary-contrast` |
| hover | track lightens/darkens 8% |
| focus-visible | 2px `--color-focus-ring` outline, 2px offset |
| disabled | 50% opacity, `cursor: not-allowed` |
| busy | knob replaced by 12px spinner; clicks ignored |

### Button
Variants: `primary`, `secondary` (surface-2 + border), `danger`, `ghost`. Height 36px, padding 0 `--space-4`, radius `--radius-md`.
States: default, hover, active (translateY 1px), focus-visible, disabled, loading (spinner + label retained).

### Text input / textarea
Border `--color-border`; focus border `--color-primary` + ring; invalid border `--color-danger` + message under field in `--text-small`; disabled 50% opacity. Rule editor uses `--font-mono` and shows line numbers in a gutter.

### List row (allowlist, filter lists)
Height 48px, hover bg `--color-surface-2`, trailing action aligned right. Empty state: centred icon (SVG inline), one sentence, optional action.

### Badge / Pill
`success`, `warning`, `danger`, `neutral`. 12px text, padding 2px 8px, radius pill.

### Toast
Bottom-center, max 1 visible, auto-dismiss 4 s (8 s for errors), `role="status"` (errors `role="alert"`), dismiss button.

### Modal (confirm)
Scrim `--color-overlay`, panel `--color-surface`, radius `--radius-lg`, focus trapped, Esc closes, default focus on Cancel.

### Skeleton
Rect with `--color-surface-2`, shimmer animation (disabled under reduced motion).

### Banner (inline)
Variants warning/danger; icon + message + optional action; `role="alert"` for danger.

## 6. Accessibility Requirements
- Full keyboard operation, visible focus on every control.
- All icons have `aria-label` or are `aria-hidden` with adjacent text.
- Switch state announced via `aria-checked`; live regions for counter changes use `aria-live="polite"` throttled to 1 update/s.
- Layout works at 200% zoom; popup width fixed 360px, options responsive from 360px up.

## 7. Iconography
Inline SVG only, stored in `src/ui/icons.ts` as template strings. 20px grid, 1.75px stroke, `currentColor`.
