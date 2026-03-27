# BitSearch Admin Design System

## Name
`Aether Console`

## Intent
BitSearch Admin is a high-trust operations console for running a remote MCP service. The UI should feel like a premium control surface rather than a generic SaaS settings page.

## Visual Direction
- Theme: dark technical cockpit
- Mood: calm, dense, precise
- Layout: editorial dashboard with a persistent side rail and stacked control surfaces
- Surfaces: tonal layering, glass-dark cards, no heavy white panels
- Borders: subtle, low-contrast, mostly atmospheric rather than explicit

## Colors
- Background: `#0a0e14`
- Shell: `#10141a`
- Surface: `#161c24`
- Surface Raised: `#1d2631`
- Surface Bright: `#263240`
- Primary: `#00d7f3`
- Primary Soft: `rgba(0, 215, 243, 0.14)`
- Success: `#42d688`
- Warning: `#d8aa57`
- Danger: `#ff8e7d`
- Text Strong: `#f2f5fb`
- Text Soft: `#9fb2c7`
- Border: `rgba(159, 178, 199, 0.14)`

## Typography
- Headlines: `"Space Grotesk", "IBM Plex Sans", sans-serif`
- Body: `"IBM Plex Sans", "Segoe UI", sans-serif`
- Technical values: `"IBM Plex Mono", "SFMono-Regular", monospace`

## Components
- Hero: strong title, operational summary chips, clear environment state
- Metrics: large number first, label second, subtle delta/status context
- Provider cards: compact operational panels with status, key counts, connection settings
- Key pool area: split import workspace and live table
- Logs: compact rows with dense information, status-first scanning

## Motion
- Transition speed: `180ms` to `220ms`
- Interactions should feel crisp, not floaty

## Do
- Use monospaced text for URLs, fingerprints, durations, and endpoint values
- Group controls into thematic surfaces
- Keep hierarchy visible through scale, contrast, and spacing

## Don't
- Do not revert to white cards on a pastel page
- Do not use generic rounded blue SaaS styling
- Do not hide operational state behind too much decoration
