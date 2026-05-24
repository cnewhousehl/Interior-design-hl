# Interior Design Studio

A 2D CAD-style tool for planning furniture in an apartment. Upload a floor plan, calibrate the scale, drag furniture from a catalog onto the canvas, see real clearances between pieces, and get theme-matched recommendations from Claude.

## Stack

- **Next.js 15** (App Router) — server API routes keep the Anthropic key off the client.
- **React 19 + react-konva** — 2D scene graph for the canvas.
- **Zustand** — lightweight global state.
- **Tailwind CSS** — styling.
- **Anthropic SDK** — theme-based furniture recommendations.

## Run it

```bash
npm install
cp .env.example .env.local       # optional — add ANTHROPIC_API_KEY for Claude recs
npm run dev
```

Open <http://localhost:3000>.

## Workflow

1. **Upload floor plan** — any PNG/JPG. Your apartment plan works great.
2. **Calibrate scale** — click two points on the image with a known real-world distance (e.g. the bedroom wall labelled `11'0"`) and enter the length. Everything from here on is measured in feet.
3. **Place furniture** — click a piece in the left palette, then click on the canvas. Drag to reposition, double-click to rotate 90°, or use the right panel for exact coords / dims.
4. **Check clearances** — toggle the clearance overlay (Off / Selected / All) to draw dashed clearance rings and live distance labels between pieces. Red = tight (<2'), orange = okay (<3'), green = comfortable.
5. **Theme** — pick a style on the right and hit "Get recommendations" — Claude suggests pieces matching the style and your placed inventory.

## Apartment

Pre-seeded notes for the current apartment (NYC, Norfolk St):
- Living/Dining: 11'0" × 23'6" (258.5 sqft)
- Bedroom: 11'0" × 11'7" (~127 sqft)
- Terrace: 165.5 sqft
- L-shaped kitchen with DW + range on the left wall of the living/dining
- Bathroom + W/D off the entry hallway

These show up in the prompt sent to Claude when asking for recommendations.

## Keyboard

- `Delete` / `Backspace` — remove selected item
- `Esc` — exit place/calibrate mode
- Mouse wheel — zoom in/out (zooms toward cursor)
- Drag empty space — pan
