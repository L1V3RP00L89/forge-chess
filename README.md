# Web Chess 1.0

A browser chess app for playing, importing, and reviewing games with Stockfish-powered analysis.

## Features

- **Play against AI**: Challenge the Stockfish engine directly in your browser with adjustable difficulty levels.
- **AI Watch Mode**: Automate AI vs. AI matches with full playback controls (pause/resume, speed adjustment, step mode).
- **Advanced Game Analysis**: 
  - **Winrate Graph**: Interactive, clickable game evaluation graph with vertical markers.
  - **Engine Lines & WDL**: View detailed engine analysis, full lines, and Win/Draw/Loss probability breakdowns.
  - **Visual Board Indicators**: SVG board arrows indicating the played move (orange), best engine move (green), and alternative lines (blue).
- **Opening Explorer**: Automatic opening names lookup and identification.
- **Premium UI/UX**: Keyboard navigation, clickable move transcript, high-quality SVG iconography, and a fast, responsive design.
- **Batch Game Review**: Effortlessly load, review, and analyze multiple games seamlessly.
- **Installable app metadata**: PWA manifest and app icon are configured for hosted releases.

## Technology Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Chess Logic**: `chess.js`
- **Chess Engine**: `stockfish.js`
- **UI Components**: `react-chessboard` and `lucide-react`

## Quality Gates

Run the same checks used by CI:

```bash
npm audit
npm run lint
npm test -- --run
npm run build
```

## Stockfish Assets

Local browser engine files are synced from the installed `stockfish` npm package:

```bash
npm run sync:stockfish
```

The bundled Stockfish engine assets in `public/engine` are GPL-3.0 licensed. See `public/engine/Copying.txt`.

## Opening Explorer

The Lichess Opening Explorer endpoints require an API token. Paste a session-only token in the app when using Masters/Lichess book stats. Local ECO opening names continue to work offline from `src/assets/eco.json`.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd web-chess
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Continuous Deployment

This project includes a GitHub Actions workflow that audits dependencies, lints, tests, builds, and then deploys to GitHub Pages whenever code is pushed to the `main` branch.

## License

Application code is distributed under the MIT License where applicable. Bundled Stockfish engine assets are distributed under GPL-3.0.
