# Darwin's Dilemma

A cellular strategy simulation inspired by the prisoner's dilemma, built with React and Vite. In this game, each living cell follows a strategy such as cooperation, defection, grim trigger, or tit-for-tat and interacts with nearby neighbors to compete for survival in a dynamic population grid.

## Overview

Darwin's Dilemma turns classic game theory into an interactive, visual survival experiment. The simulation lets you:

- paint cells in different colors to create competing populations
- choose from multiple strategic behaviors for each group
- run the world in real time and watch population dynamics evolve
- tune rules like randomness and punishment duration
- monitor live analytics and leaderboard trends over time

## Features

- 10x10 evolutionary arena
- Color-coded strategy groups: green, yellow, blue, and red
- Multiple strategy presets:
  - always cooperate
  - grim trigger
  - always defect
  - tit for tat
- Real-time round simulation with adjustable settings
- Population analytics and leaderboard view
- Manual painting and erasing of live cells
- Reset and stop controls for experimenting with different scenarios

## Tech Stack

- React 19
- Vite
- JavaScript
- CSS for the game UI and layout

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run the app locally

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal, usually:

```bash
http://localhost:5173
```

## Available Scripts

```bash
npm run dev     # start the Vite development server
npm run build   # create a production build
npm run preview # preview the production build locally
npm run lint    # run the project linter
```

## How to Use

1. Open the app and click the "Explore the simulation" button.
2. Pick a color from the palette and paint cells into the arena.
3. Choose the strategy controls tab to adjust behavior for each group.
4. Press Start to begin the simulation.
5. Observe how cooperation, betrayal, and punishment affect the population over time.
6. Use Reset to clear the board and test a new setup.

## Project Structure

```text
.
├── public/
├── src/
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Notes

This project is a strategy prototype and visualization experiment rather than a production game engine. It is intended for learning, exploration, and interactive simulation of evolutionary behavior under repeated prisoner's dilemma decisions.

## Contributing

Pull requests and experimentation are welcome. If you want to extend the simulation, consider adding:

- more strategies
- richer terrain rules
- stronger visualization tools
- save/load presets for simulations
