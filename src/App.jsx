
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const GRID_SIZE = 10;
const STARTING_HP = 10;
const MAX_HP = 30;
const SWEEP_BATCH_SIZE = 15;
const UPDATE_INTERVAL_MS = 500;
const CELL_COLORS = ["yellow", "green", "blue", "red"];

const DEFAULT_STRATEGY_SETTINGS = {
  green: {
    label: "Always cooperate",
    type: "always-cooperate",
    randomness: 0,
    initialAction: "C",
    punishmentDuration: 2,
  },
  yellow: {
    label: "Grim trigger",
    type: "grim-trigger",
    randomness: 0,
    initialAction: "C",
    punishmentDuration: 3,
  },
  blue: {
    label: "Always defect",
    type: "always-defect",
    randomness: 0,
    initialAction: "D",
    punishmentDuration: 2,
  },
  red: {
    label: "Tit for tat",
    type: "tit-for-tat",
    randomness: 0,
    initialAction: "C",
    punishmentDuration: 2,
  },
};

function createInitialCells() {
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;

    return {
      id: index,
      row,
      col,
      strategy: "C",
      hp: 0,
      alive: false,
      color: "none",
      pairMemory: {},
    };
  });
}

function getCellSymbol(cell) {
  if (!cell || !cell.alive) return "×";

  if (cell.color === "green") return "✓";
  if (cell.color === "yellow") return "?";
  if (cell.color === "red") return "!";
  if (cell.color === "blue") return "#";

  return "✓";
}

function getNeighborPositions(row, col) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (
        nextRow >= 0 &&
        nextRow < GRID_SIZE &&
        nextCol >= 0 &&
        nextCol < GRID_SIZE
      ) {
        neighbors.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return neighbors;
}

function getStrategyConfig(color, strategySettings) {
  return strategySettings[color] ?? DEFAULT_STRATEGY_SETTINGS[color];
}

function resolveStrategyAction(pairState, strategyConfig) {
  let action = strategyConfig.initialAction;

  switch (strategyConfig.type) {
    case "always-cooperate":
      action = "C";
      break;
    case "always-defect":
      action = "D";
      break;
    case "tit-for-tat":
      action = pairState.lastOpponentAction ?? strategyConfig.initialAction;
      break;
    case "grim-trigger":
      action =
        pairState.grimTriggered || pairState.lastOpponentAction === "D"
          ? "D"
          : strategyConfig.initialAction;
      break;
    default:
      action = strategyConfig.initialAction;
  }

  if (pairState.punishmentRemaining > 0) {
    action = "D";
    pairState.punishmentRemaining = Math.max(0, pairState.punishmentRemaining - 1);
  }

  if (strategyConfig.randomness > 0 && Math.random() * 100 < strategyConfig.randomness) {
    action = action === "C" ? "D" : "C";
  }

  return action;
}

function applyAliveTick(cells, strategySettings) {
  const nextCells = cells.map((cell) => {
    if (!cell) return null;
    return {
      ...cell,
      pairMemory: { ...cell.pairMemory },
    };
  });

  const aliveCells = nextCells.filter((cell) => cell && cell.alive);
  const processedPairs = new Set();

  for (const cell of aliveCells) {
    const neighbors = getNeighborPositions(cell.row, cell.col);

    for (const neighborPosition of neighbors) {
      const neighborIndex =
        neighborPosition.row * GRID_SIZE + neighborPosition.col;
      const neighbor = nextCells[neighborIndex];

      if (!neighbor || !neighbor.alive) continue;

      const pairKey =
        cell.id < neighbor.id
          ? `${cell.id}-${neighbor.id}`
          : `${neighbor.id}-${cell.id}`;

      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const cellPairState =
        cell.pairMemory[pairKey] ?? {
          lastOpponentAction: null,
          punishmentRemaining: 0,
          grimTriggered: false,
        };
      const neighborPairState =
        neighbor.pairMemory[pairKey] ?? {
          lastOpponentAction: null,
          punishmentRemaining: 0,
          grimTriggered: false,
        };

      const cellConfig = getStrategyConfig(cell.color, strategySettings);
      const neighborConfig = getStrategyConfig(neighbor.color, strategySettings);

      const cellAction = resolveStrategyAction(cellPairState, cellConfig);
      const neighborAction = resolveStrategyAction(neighborPairState, neighborConfig);

      if (cellAction === "C" && neighborAction === "C") {
        cell.hp += 3;
        neighbor.hp += 3;
      } else if (cellAction === "D" && neighborAction === "C") {
        cell.hp += 5;
        neighbor.hp -= 3;
      } else if (cellAction === "C" && neighborAction === "D") {
        cell.hp -= 3;
        neighbor.hp += 5;
      } else {
        cell.hp += 1;
        neighbor.hp += 1;
      }

      cell.hp = Math.max(0, Math.min(MAX_HP, cell.hp));
      neighbor.hp = Math.max(0, Math.min(MAX_HP, neighbor.hp));

      cell.strategy = cellAction;
      neighbor.strategy = neighborAction;

      cellPairState.lastOpponentAction = neighborAction;
      neighborPairState.lastOpponentAction = cellAction;

      if (cellAction === "D") {
        cellPairState.punishmentRemaining = Math.max(
          cellPairState.punishmentRemaining,
          cellConfig.punishmentDuration
        );
      }

      if (neighborAction === "D") {
        neighborPairState.punishmentRemaining = Math.max(
          neighborPairState.punishmentRemaining,
          neighborConfig.punishmentDuration
        );
      }

      if (cellConfig.type === "grim-trigger" && neighborAction === "D") {
        cellPairState.grimTriggered = true;
      } else if (cellConfig.type !== "grim-trigger") {
        cellPairState.grimTriggered = false;
      }

      if (neighborConfig.type === "grim-trigger" && cellAction === "D") {
        neighborPairState.grimTriggered = true;
      } else if (neighborConfig.type !== "grim-trigger") {
        neighborPairState.grimTriggered = false;
      }

      cell.pairMemory[pairKey] = cellPairState;
      neighbor.pairMemory[pairKey] = neighborPairState;
    }
  }

  for (let index = 0; index < nextCells.length; index += 1) {
    const cell = nextCells[index];

    if (!cell) continue;

    if (cell.hp <= 0) {
      nextCells[index] = {
        ...cell,
        alive: false,
        hp: 0,
      };
    }
  }

  return nextCells;
}

function applyDeadTick(cells) {
  const nextCells = cells.map((cell) => (cell ? { ...cell } : null));

  for (let index = 0; index < nextCells.length; index += 1) {
    const deadCell = nextCells[index];

    if (!deadCell || deadCell.alive) continue;

    const neighbors = getNeighborPositions(
      Math.floor(index / GRID_SIZE),
      index % GRID_SIZE
    );

    const sameColorSupport = {};
    for (const color of CELL_COLORS) {
      sameColorSupport[color] = 0;
    }

    for (const neighborPosition of neighbors) {
      const neighbor = nextCells[
        neighborPosition.row * GRID_SIZE + neighborPosition.col
      ];

      if (!neighbor || !neighbor.alive) continue;

      if (neighbor.hp > 15) {
        sameColorSupport[neighbor.color] += neighbor.hp;
      }
    }

    const qualifyingColors = CELL_COLORS.filter((color) => {
      const matchingNeighbors = neighbors.filter((neighborPosition) => {
        const neighbor = nextCells[
          neighborPosition.row * GRID_SIZE + neighborPosition.col
        ];

        return (
          neighbor &&
          neighbor.alive &&
          neighbor.color === color &&
          neighbor.hp > 15
        );
      });

      return matchingNeighbors.length >= 3;
    });

    if (qualifyingColors.length === 0) continue;

    const chosenColor = qualifyingColors.reduce((bestColor, currentColor) => {
      if (sameColorSupport[currentColor] > sameColorSupport[bestColor]) {
        return currentColor;
      }
      return bestColor;
    }, qualifyingColors[0]);

    const supportScore = sameColorSupport[chosenColor];
    const reproductionConditionMet =
      supportScore > 0 &&
      qualifyingColors.some((color) => color === chosenColor);

    if (!reproductionConditionMet) continue;

    if (Math.random() < 0.07) {
      nextCells[index] = {
        ...deadCell,
        alive: true,
        hp: STARTING_HP,
        color: chosenColor,
        strategy: chosenColor,
        pairMemory: {},
      };
    }
  }

  return nextCells;
}

function applySweep(cells, strategySettings) {
  const aliveTickCells = applyAliveTick(cells, strategySettings);
  return applyDeadTick(aliveTickCells);
}

function getPopulationCounts(cells) {
  const counts = { yellow: 0, green: 0, blue: 0, red: 0, dead: 0 };

  for (const cell of cells) {
    if (!cell) continue;

    if (!cell.alive) {
      counts.dead += 1;
      continue;
    }

    if (cell.color in counts) {
      counts[cell.color] += 1;
    }
  }

  return counts;
}

function App() {
  const [screen, setScreen] = useState("home");
  const [cells, setCells] = useState(createInitialCells());
  const [round, setRound] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedColor, setSelectedColor] = useState("green");
  const [eraseMode, setEraseMode] = useState(false);
  const [arenaTab, setArenaTab] = useState("arena");
  const [selectedStrategyColor, setSelectedStrategyColor] = useState("red");
  const [strategySettings, setStrategySettings] = useState(DEFAULT_STRATEGY_SETTINGS);
  const [history, setHistory] = useState([
    { sweep: 0, yellow: 0, green: 0, blue: 0, red: 0, dead: 0 },
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelection, setDragSelection] = useState(null);
  const intervalRef = useRef(null);

  const totalAliveCells = cells.filter((cell) => cell && cell.alive).length;
  const colorCounts = CELL_COLORS.reduce((counts, color) => {
    counts[color] = cells.filter(
      (cell) => cell && cell.alive && cell.color === color
    ).length;
    return counts;
  }, {});

  const deadCount = cells.filter((cell) => !cell || !cell.alive).length;
  const totalColoredCells = Math.max(1, totalAliveCells);

  const leaderboard = useMemo(() => {
    const values = [
      ...CELL_COLORS.map((color) => ({
        color,
        label: color.charAt(0).toUpperCase() + color.slice(1),
        count: colorCounts[color],
      })),
      { color: "dead", label: "Dead", count: deadCount },
    ];

    return values
      .sort((a, b) => b.count - a.count)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [colorCounts, deadCount]);

  const maxLeaderboardValue = Math.max(1, ...leaderboard.map((entry) => entry.count));

  const analyticsHistory = useMemo(() => history.slice(-45), [history]);
  const analyticsMaxValue = useMemo(
    () => Math.max(1, ...analyticsHistory.flatMap((entry) => [entry.yellow, entry.green, entry.blue, entry.red, entry.dead])),
    [analyticsHistory]
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  function paintCell(cellId) {
    setCells((previousCells) =>
      previousCells.map((cell) => {
        if (!cell || cell.id !== cellId) return cell;

        if (eraseMode) {
          return {
            ...cell,
            alive: false,
            hp: 0,
            color: "none",
            strategy: "C",
          };
        }

        return {
          ...cell,
          alive: true,
          hp: STARTING_HP,
          color: selectedColor,
          strategy: selectedColor,
        };
      })
    );
  }

  function handleCellMouseDown(index) {
    setIsDragging(true);
    setDragSelection({ currentIndex: index });
    paintCell(index);
  }

  function handleCellMouseEnter(index) {
    if (!isDragging || !dragSelection) return;

    setDragSelection({ currentIndex: index });
    paintCell(index);
  }

  useEffect(() => {
    if (!isDragging) return undefined;

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragSelection(null);
    };

    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  function simulateRound(sweeps = 1) {
    setCells((previousCells) => {
      let nextCells = previousCells.map((cell) => {
        if (!cell || !cell.alive) {
          return cell ? { ...cell, hp: 0 } : null;
        }

        return { ...cell, hp: STARTING_HP, pairMemory: { ...cell.pairMemory } };
      });

      for (let sweep = 0; sweep < sweeps; sweep += 1) {
        nextCells = applySweep(nextCells, strategySettings);
      }

      const counts = getPopulationCounts(nextCells);
      setHistory((previousHistory) => {
        const lastEntry = previousHistory[previousHistory.length - 1];
        const nextSweep = (lastEntry?.sweep ?? 0) + sweeps;

        return [
          ...previousHistory,
          {
            sweep: nextSweep,
            yellow: counts.yellow,
            green: counts.green,
            blue: counts.blue,
            red: counts.red,
            dead: counts.dead,
          },
        ];
      });

      return nextCells;
    });

    setRound((previousRound) => previousRound + sweeps);
  }

  function stopSimulation() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRunning(false);
  }

  function startSimulation() {
    if (intervalRef.current) {
      return;
    }

    setIsRunning(true);
    simulateRound(SWEEP_BATCH_SIZE);
    intervalRef.current = setInterval(() => {
      simulateRound(SWEEP_BATCH_SIZE);
    }, UPDATE_INTERVAL_MS);
  }

  function resetGame() {
    stopSimulation();
    setCells(createInitialCells());
    setRound(0);
    setHistory([{ sweep: 0, yellow: 0, green: 0, blue: 0, red: 0, dead: 0 }]);
  }

  function handleStrategySettingChange(field, value) {
    setStrategySettings((previousSettings) => ({
      ...previousSettings,
      [selectedStrategyColor]: {
        ...previousSettings[selectedStrategyColor],
        [field]: value,
      },
    }));
  }

  if (screen === "home") {
    return (
      <main className="app home-screen">
        <div className="brand">DARWIN'S DILEMMA</div>

        <div className="hero">
          <div className="eyebrow">A STRATEGY SIMULATION</div>

          <h1>Survival is a cooperation game</h1>

          <p className="subtitle">
            Every decision has a consequence.
            <br />
            Every round changes the population.
          </p>

          <button
            className="primary-button"
            onClick={() => setScreen("game")}
          >
            Explore the simulation →
          </button>

          <div className="feature-row">
            <div className="feature">
              <span>01</span>
              <strong>COOPERATE</strong>
              <p>Build mutual trust</p>
            </div>
            <div className="feature">
              <span>02</span>
              <strong>DEFECT</strong>
              <p>Take the risk</p>
            </div>
            <div className="feature">
              <span>03</span>
              <strong>SURVIVE</strong>
              <p>Adapt each round</p>
            </div>
          </div>
        </div>

        <footer>HACKATHON PROJECT · MULTIPLAYER SIMULATION</footer>
      </main>
    );
  }

  const selectedStrategyConfig = strategySettings[selectedStrategyColor];

  const renderArenaTab = () => {
    if (arenaTab === "analytics") {
      return (
        <section className="analytics-panel">
          <div className="panel analytics-shell">
            <div className="panel-heading compact-heading">
              <div>
                <h2>Evolution analytics</h2>
                <p>Population by sweep over time.</p>
              </div>
            </div>

            <div className="chart-wrapper">
              <svg viewBox="0 0 680 260" role="img" aria-label="Evolution analytics chart">
                <g>
                  {[0, 1, 2, 3, 4].map((step) => {
                    const y = 26 + (step * 56);
                    return (
                      <line
                        key={`grid-${step}`}
                        x1="60"
                        x2="640"
                        y1={y}
                        y2={y}
                        stroke="rgba(213, 227, 255, 0.13)"
                        strokeWidth="1"
                      />
                    );
                  })}
                  <line x1="60" x2="640" y1="230" y2="230" stroke="rgba(213,227,255,0.5)" />
                  <line x1="60" x2="60" y1="30" y2="230" stroke="rgba(213,227,255,0.5)" />
                </g>

                <g>
                  {CELL_COLORS.map((color) => {
                    const points = analyticsHistory
                      .map((entry, index) => {
                        const x = 60 + (index / Math.max(1, analyticsHistory.length - 1)) * 580;
                        const y = 230 - (entry[color] / analyticsMaxValue) * 180;
                        return `${x},${y}`;
                      })
                      .join(" ");

                    return (
                      <polyline
                        key={color}
                        points={points}
                        fill="none"
                        stroke={
                          color === "green"
                            ? "#5ecf62"
                            : color === "yellow"
                              ? "#f0d355"
                              : color === "blue"
                                ? "#5aa5ff"
                                : "#e35d57"
                        }
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </g>

                <g>
                  <text x="35" y="110" fill="#d3d9e4" transform="rotate(-90 35 110)" fontSize="11">
                    No. of cells
                  </text>
                  <text x="300" y="252" fill="#d3d9e4" fontSize="11">
                    No. of sweeps
                  </text>
                </g>
              </svg>
            </div>

            <div className="chart-legend">
              {CELL_COLORS.map((color) => (
                <span key={color}>
                  <i className={`legend-${color}`} />
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (arenaTab === "strategy") {
      return (
        <section className="strategy-panel">
          <div className="panel strategy-shell">
            <div className="panel-heading compact-heading">
              <div>
                <h2>Strategy customiser</h2>
                <p>Fine tune each preset around the prisoner's dilemma.</p>
              </div>
            </div>

            <div className="strategy-grid">
              <div className="strategy-list">
                {Object.entries(strategySettings).map(([color, config]) => (
                  <button
                    key={color}
                    type="button"
                    className={`strategy-card ${selectedStrategyColor === color ? "selected" : ""}`}
                    onClick={() => setSelectedStrategyColor(color)}
                  >
                    <span className={`strategy-swatch ${color}`} />
                    <div>
                      <strong>{config.label}</strong>
                      <small>{color.charAt(0).toUpperCase() + color.slice(1)} cells</small>
                    </div>
                  </button>
                ))}
              </div>

              <div className="strategy-controls">
                <div className="setting-row">
                  <label htmlFor="randomness-slider">Randomness</label>
                  <span>{selectedStrategyConfig.randomness}%</span>
                </div>
                <input
                  id="randomness-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={selectedStrategyConfig.randomness}
                  onChange={(event) =>
                    handleStrategySettingChange("randomness", Number(event.target.value))
                  }
                />

                <div className="setting-row">
                  <label htmlFor="initial-action">Initial action</label>
                </div>
                <div className="choice-row" id="initial-action">
                  <button
                    type="button"
                    className={selectedStrategyConfig.initialAction === "C" ? "segmented selected" : "segmented"}
                    onClick={() => handleStrategySettingChange("initialAction", "C")}
                  >
                    Cooperate
                  </button>
                  <button
                    type="button"
                    className={selectedStrategyConfig.initialAction === "D" ? "segmented selected" : "segmented"}
                    onClick={() => handleStrategySettingChange("initialAction", "D")}
                  >
                    Defect
                  </button>
                </div>

                <div className="setting-row">
                  <label htmlFor="punishment-slider">Punishment duration</label>
                  <span>{selectedStrategyConfig.punishmentDuration} turns</span>
                </div>
                <input
                  id="punishment-slider"
                  type="range"
                  min="0"
                  max="8"
                  value={selectedStrategyConfig.punishmentDuration}
                  onChange={(event) =>
                    handleStrategySettingChange("punishmentDuration", Number(event.target.value))
                  }
                />
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="arena-layout">
        <div className="panel arena-panel">
          <div className="panel-heading">
            <div>
              <h2>Population grid</h2>
              <p>Click a colour, then click cells to keep them alive.</p>
            </div>
            <span className="live-tag">10 × 10 GRID</span>
          </div>

          <div className="color-picker" aria-label="Cell colour picker">
            {CELL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-option ${selectedColor === color ? "selected" : ""} ${color}`}
                onClick={() => {
                  setEraseMode(false);
                  setSelectedColor(color);
                }}
                title={`Select ${color} cells`}
              >
                <span>{getCellSymbol({ alive: true, color })}</span>
              </button>
            ))}
            <button
              type="button"
              className={`color-option erase-option ${eraseMode ? "selected" : ""}`}
              onClick={() => setEraseMode(true)}
              title="Erase cells"
            >
              <span>×</span>
            </button>
          </div>

          <div className="cell-grid">
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
              const cell = cells[index];
              const isAlive = cell && cell.alive;

              return (
                <button
                  key={cell ? cell.id : `empty-${index}`}
                  type="button"
                  className={`cell ${isAlive ? cell.color : "empty"}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleCellMouseDown(index);
                  }}
                  onMouseEnter={() => handleCellMouseEnter(index)}
                  title={
                    isAlive
                      ? `Cell ${index + 1}: ${cell.color} alive, HP ${cell.hp}/${MAX_HP}`
                      : `Cell ${index + 1}: dead`
                  }
                >
                  <span className="cell-mark">{getCellSymbol(cell)}</span>
                  {isAlive && (
                    <div className="hp-bar">
                      <div
                        className="hp-fill"
                        style={{
                          width: `${Math.max(0, (cell.hp / MAX_HP) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="legend">
            <span>
              <i className="legend-green" /> Green
            </span>
            <span>
              <i className="legend-yellow" /> Yellow
            </span>
            <span>
              <i className="legend-blue" /> Blue
            </span>
            <span>
              <i className="legend-red" /> Red
            </span>
            <span>
              <i className="legend-grey" /> Dead
            </span>
          </div>
        </div>

        <aside className="panel controls-panel">
          <h2>Live Leaderboard</h2>
          <div className="leaderboard-list">
            {leaderboard.map((entry) => (
              <div className="leaderboard-row" key={entry.color}>
                <span className="leaderboard-rank">{entry.rank}</span>
                <div className="leaderboard-track">
                  <div
                    className={`leaderboard-fill ${entry.color}`}
                    style={{ width: `${(entry.count / maxLeaderboardValue) * 100}%` }}
                  />
                </div>
                <span className="leaderboard-label">
                  {entry.label}
                  <strong>{((entry.count / Math.max(1, cells.length)) * 100).toFixed(0)}%</strong>
                </span>
              </div>
            ))}
          </div>

          <div className="controls-actions">
            <button
              className="control-button start-button"
              onClick={startSimulation}
              disabled={isRunning}
            >
              <span aria-hidden="true">→</span>
              Start
            </button>
            <button
              className="control-button stop-button"
              onClick={stopSimulation}
              disabled={!isRunning}
            >
              <span aria-hidden="true">❚❚</span>
              Stop
            </button>
            <button className="control-button reset-button" onClick={resetGame}>
              Reset
            </button>
          </div>

          <div className="demo-note">
            <strong>Rules</strong>
            <p>
              Every alive cell interacts with adjacent neighbors using its current
              strategy profile. Each pair keeps independent history so one neighbor
              does not set the fate of another.
            </p>
          </div>
        </aside>
      </section>
    );
  };

  return (
    <main className="app game-screen">
      <header className="topbar">
        <button className="back-button" onClick={() => setScreen("home")}>
          ← Home
        </button>
        <div className="brand">DARWIN'S DILEMMA</div>
        <div className="round-label">SWEEP {round}</div>
      </header>

      <section className="game-heading with-tabs">
        <div>
          <div className="eyebrow">LIVE SIMULATION · DEMO</div>
          <h1>The arena</h1>
          <p>Click cells to toggle life, then run the simulation.</p>
        </div>

        <div className="arena-tabs" aria-label="Simulation tabs">
          <button
            type="button"
            className={arenaTab === "arena" ? "tab-button active" : "tab-button"}
            onClick={() => setArenaTab("arena")}
          >
            Arena
          </button>
          <button
            type="button"
            className={arenaTab === "analytics" ? "tab-button active" : "tab-button"}
            onClick={() => setArenaTab("analytics")}
          >
            Evolution Analytics
          </button>
          <button
            type="button"
            className={arenaTab === "strategy" ? "tab-button active" : "tab-button"}
            onClick={() => setArenaTab("strategy")}
          >
            Strategy customiser
          </button>
        </div>
      </section>

      {renderArenaTab()}

      <footer className="game-footer">DARWIN'S DILEMMA · STRATEGY PROTOTYPE</footer>
    </main>
  );
}

export default App;
