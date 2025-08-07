# MineTasker – Task Bingo Board App

Welcome to MineTasker, an interactive bingo-style task board inspired by OSRS (Old School RuneScape) and designed for both solo and team play. Create, manage, and share custom boards featuring tasks, achievements, and even mines (bombs).

## Features

- **Create Boards**: Solo or team-based boards with customizable size and difficulty.
- **Task Pool**: Manage your own set of tasks and import/export them via JSON.
- **Team Play**: Teams with captain/member roles and color-coded scoring.
- **Mines (Bombs)**: Add mines to make boards more challenging, with customizable damage.
- **Unlock Modes**: Choose auto or manual neighbor unlocks for advanced gameplay.
- **Dark/Light Mode**: Modern UI with dark mode enabled by default.
- **Share Boards**: Generate a shareable link for anyone to join your board.
- **Responsive Design**: Works great on desktop and mobile.

## Board Creation Settings Guide

When creating a board, you can customize the following options:

- **Board Type**  
  - _Solo (individual)_: One player claims tasks and unlocks tiles.
  - _Team (multiplayer)_: Teams compete for tasks. Each team has a captain/member password.

- **Board Size**  
  - Number of tiles per side (must be odd, e.g., 5 for a 5x5 board).
  - Larger boards allow more tasks and challenge.

- **Allow Duplicate Tasks**  
  - If enabled, tasks will repeat as needed to fill the board.
  - If disabled, you must provide enough unique tasks to fill the board.

- **Difficulty Mode**  
  - _Distance-based_: Tasks with higher difficulty are placed farther from the center of the board.
  - _Random_: Tasks are randomly assigned to tiles.

- **Unlock Mode**  
  - _Auto_: After claiming a tile, all its neighbors are automatically unlocked.
  - _Manual_: After claiming, you choose which tiles to unlock (more strategic).

- **Manual Unlocks per Completion**  
  - Number of tiles you can unlock after completing a task (only for manual unlock mode).

- **Enable Mines (Bombs)**  
  - If enabled, mines (bombs) are randomly placed on the board (never in the center).
  - Stepping on a mine deducts points and immediately completes the tile.

- **Number of Mines**  
  - Total number of mines placed on the board.

- **Bomb Damage**  
  - Points lost when a mine is claimed.

- **Neighbor Mode for Unlock**  
  - _8-direction_: North, NE, East, SE, South, SW, West, NW.
  - _4-direction_: Only North, East, South, West.

- **Board Password**  
  - Required to create and share a board. Protects against unauthorized edits.

- **Per-Team Unlocks**  
  - (Team boards only) Each team unlocks and sees only their own tiles.

- **First Claim Bonus**  
  - (Team boards only) Bonus points for the first team to claim a tile.

---

When you create a board, all these settings will be saved and used for gameplay.  
To play, share your board link with friends or teammates!

---

## Getting Started Custom Usage

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/ChaseWalters/ChaseWaltersSite.git
cd ChaseWaltersSite
npm install
```

### Development

Start the local dev server (with hot reload):

```bash
npm run dev
```

Open [http://localhost:5173/ChaseWaltersSite](http://localhost:5173/ChaseWaltersSite) in your browser.

### Production Build

```bash
npm run build
```

The static site output will be in the `dist/` folder.

### Deployment

Deploy to GitHub Pages using the included script:

```bash
npm run deploy
```

**Note:** The app is designed for deployment under the `/ChaseWaltersSite/` subdirectory on GitHub Pages.

## Configuration

- **Firebase**: The app uses Firebase Firestore for real-time board sharing. Update your Firebase credentials in `src/firebase.js` if you fork the project.
- **Tailwind CSS**: Styles are managed via Tailwind; see `tailwind.config.js` and `src/index.css`.

## File Structure

```
src/
  components/       # Core React components (SharedBingoCard, ThemeToggle, etc.)
  pages/            # Main app pages (Home, ManageTasks, TaskBingo)
  utils/            # Utility functions (crypto.js)
  firebase.js       # Firebase config
  App.jsx           # Main app router
  index.css         # Tailwind CSS setup
public/
  vite.svg          # App icon
README.md           # This file
```

## Contributing

Suggestions, and feedback are welcome!

## License & Usage Warning

This project is released under the [CC BY-NC 4.0 License](LICENSE).  
You **must give credit**, **cannot use for commercial purposes**, and **MUST use your own database/Firebase instance** if copying or modifying the project.  
Do **not** use the database credentials or API keys from this repository.

---

**Chase Walters**  
[GitHub Profile](https://github.com/ChaseWalters)
