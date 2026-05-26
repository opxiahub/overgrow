# Overgrow

Overgrow is a two-player hex territory game. Players take turns expanding across a 9x9 hex grid by cloning into adjacent cells or jumping two cells away. Every landing converts neighboring enemy cells, so a single move can swing control of the board.

Play the hosted version at [overgrow.opxia.com](https://overgrow.opxia.com/).

![Overgrow gameplay screenshot](public/overgrow.png)

## What It Provides

- Local two-player hot-seat gameplay on one device.
- A complete rules loop: select, split, leap, convert, skip blocked turns, and end the game.
- Player names, live score tracking, territory bar, undo, reset, and menu controls.
- A fully client-side implementation with no backend or account system.

## How To Play

1. Enter names for both players and start the game.
2. On your turn, select one of your cells.
3. Choose a highlighted destination:
   - Split: move one hex. The original cell stays and a new cell is created.
   - Leap: move two hexes. The original cell is removed and placed at the destination.
4. After landing, all adjacent enemy cells convert to your color.
5. The game ends when neither player can move. The player with more cells wins.

If a player has no legal move, their turn is skipped. If both players are blocked, the board is scored.

## Run Locally

Requirements:

- Node.js 20 or later
- npm

```bash
git clone https://github.com/opxiahub/overgrow.git
cd overgrow
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

For a production build:

```bash
npm run build
npm run preview
```

## Docker

```bash
docker build -t overgrow .
docker run --rm -p 8080:8080 overgrow
```

Open [http://localhost:8080](http://localhost:8080).

## Technical Flow

Overgrow is a static React app built with Vite.

- `src/App.jsx` contains the game state, hex-grid math, move validation, conversion rules, and UI rendering.
- The board uses an odd-r offset coordinate grid and converts positions to cube coordinates for reliable hex distance checks.
- Legal destinations are empty cells at distance `1` for splits or distance `2` for leaps.
- Moves update a cloned board, convert adjacent opponent cells, then advance or skip turns based on available legal moves.
- The board is rendered as SVG, while the rest of the interface is standard React and CSS.

## Scripts

```bash
npm run dev       # Start the Vite dev server
npm run build     # Create a production build in dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

## License

Overgrow is released under the [MIT License](LICENSE).
