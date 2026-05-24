# Plan — Interior Design Studio

A designer-grade 2D/3D apartment planner. Upload a floor plan, calibrate scale, draw walls and doors, place furniture from a curated catalog, see live clearances and validation, get theme-matched recommendations from Claude, and export a shopping list.

## Stack

- **Next.js 15** (App Router) — server API routes keep the Anthropic key off the client
- **React 19 + react-konva** — 2D scene graph
- **Three.js + React-Three-Fiber + drei** — 3D walk-around preview
- **Zustand + zundo** — state with undo/redo (100-step history)
- **Tailwind CSS** + Inter / Fraunces / JetBrains Mono typography
- **lucide-react** icons
- **Anthropic SDK** — theme recs + floor-plan vision

## Run it

```bash
npm install
cp .env.example .env.local       # optional — add ANTHROPIC_API_KEY for Claude
npm run dev
```

Open <http://localhost:3000>.

## Workflow

1. **Upload** any PNG/JPG floor plan.
2. **Calibrate** — pick two points on a known wall, enter the distance (e.g. `11'7"`). Everything from here on is measured in real feet.
3. **Auto-detect** (optional) — Claude vision identifies rooms + doors from the image.
4. **Draw walls + doors** manually if you want exact geometry — walls snap to ortho, doors snap onto the nearest wall.
5. **Place furniture** — click a piece, hover to see the ghost preview with wall-snap, click to drop.
6. **Check clearances** — toggle clearance overlay (Off/Selected/All) to see live distances between pieces, between pieces and walls, and recommended-clearance rings.
7. **Traffic paths** — draw a polyline through walkways; the issues panel warns if anything narrows it below 3'.
8. **Fixtures** — drop outlets / switches / vents / lights / radiators on the plan so you remember the constraints.
9. **Theme** — pick a style for a mood board (5-swatch palette, paint pairings, materials, notes) + Claude-powered recommendations.
10. **Shop tab** — see your placed items grouped by status (Owned / Ordered / Wishlist / Considering), with prices and CSV export.
11. **Compare** — switch to AB view to put your live scene next to any saved layout at matched scale.
12. **3D** — switch to 3D for a walk-around preview using catalog heights and the ceiling-height setting.

## Features

### Spatial / measurement
- Image-upload + 2-point scale calibration
- Pan / zoom / fit-to-view
- 1' grid with major lines every 5'
- Real-world feet everywhere (cursor coords, dimensions, distances)
- Wall drawing with ortho-snap + length labels
- Door drawing with auto-snap onto the nearest wall, swing arcs rendered
- Window drawing
- Measure tool — click two points for a persistent dimension line
- Traffic path tool — polyline with min-width validation
- Furniture-to-furniture distance lines (color-coded by gap size)
- Furniture-to-wall distance lines (color-coded)
- Recommended clearance rings around each piece
- Alignment guides when dragging (magenta lines on center-alignment)
- Wall-snap on placement and drag-release
- Arrow-key nudge (0.1' / 1' with Shift)
- Cursor coordinates + scale indicator
- North arrow rotatable to match your floor plan's orientation
- Sun path overlay (East → South → West, rotated by north)

### Furniture & catalog
- 33-item curated catalog across 7 categories with real dimensions, recommended clearances, theme tags, default heights and price ranges
- L-shaped sofas rendered as actual L-polygons (with cutouts)
- Hover ghost while placing
- Multi-select via shift/cmd/ctrl-click
- Drag, rotate (90° double-click, 5° with shift-double-click), arrow-nudge
- Per-piece dimensions / position / rotation overrides
- Status (owned / ordered / wishlist / considering) with color-coded stroke
- Per-piece price + retailer + product URL + notes + color
- Per-piece visibility toggle (hidden pieces excluded from canvas, 3D, clearance, shopping list)
- Duplicate / delete
- Conversation-zone overlay around selected sofas (10' diameter)
- TV-viewing wedge in front of selected TV stands (1.5–2.5× screen-diagonal)

### Issues panel (live validation)
- Furniture overlap
- Wall crossings
- Door swing blocking
- Tight clearances (under 60% of recommended)
- Traffic path narrowing below min width
- Click any issue to select the offending piece

### Fixtures
- 7 kinds: outlet, switch, vent, ceiling-light, wall-light, radiator, plumbing
- Drop via the fixture tool, kind picker in the right panel
- Ceiling- and wall-lights render a soft light cone
- Shift-click to remove

### Themes & recommendations
- 9 styles: mid-century modern, Scandinavian, industrial, japandi, coastal, boho, modern farmhouse, minimalist, art deco
- Mood board per theme — 5-swatch palette, paint pairings (Farrow & Ball + Benjamin Moore), material chips, design notes
- "Get recommendations" → Claude returns 6–10 matching pieces with reasons (falls back to local catalog filter when no API key)
- Catalog items matching the active theme get a ★

### Floor-plan vision
- "Auto-detect" — Claude Sonnet vision endpoint returns room bounding boxes + door hinge points and swing direction
- Rooms get labeled and tinted on the canvas; doors render with their swing arc

### Shopping & sharing
- Shop tab grouped by status with booked total + estimated total cards
- CSV export with every column (dimensions, status, price, retailer, URL, notes)
- Copy-share-URL encodes the scene (minus floor-plan image) to a hash; viewers paste the URL to load it
- localStorage layouts — save, load, rename, overwrite, delete; survives reloads

### Views
- **2D** — the full editor
- **3D** — walk-around preview with extruded walls (at ceiling height), tinted room floors, extruded furniture, orbit controls
- **AB (Compare)** — side-by-side at matched scale of the live scene vs. any saved layout

### Layers panel
Toggle visibility per element type: furniture, walls, doors, windows, rooms, notes/measurements, traffic paths, fixtures, conversation/TV zones.

### Keyboard
- `V` Select · `W` Walls · `D` Doors · `M` Measure · `T` Traffic · `O` Outlet · `N` Note
- `Cmd/Ctrl+Z` undo · `Cmd/Ctrl+Shift+Z` (or `Cmd/Ctrl+Y`) redo
- `F` fit to view
- `Arrow keys` nudge selection (0.1' / 1' with Shift)
- `Delete` / `Backspace` remove selection
- `Esc` exit drawing mode / clear selection
- `Mouse wheel` zoom toward cursor · `drag empty space` pan

## Apartment context

Built around an NYC one-bedroom (Norfolk St) with these dimensions baked into the Claude prompt:
- Living/Dining: 11'0" × 23'6" (258.5 sqft)
- Bedroom: 11'0" × 11'7" (~127 sqft)
- Terrace: 165.5 sqft
- L-shaped kitchen integrated into the living/dining
- Bathroom + W/D off the entry hallway
