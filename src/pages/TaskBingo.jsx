/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import Tile from "../components/Tile";
import { Link, useNavigate } from "react-router-dom";
import { hashString } from "../utils/crypto";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Utility
const manhattan = (r, c, center) => Math.abs(r - center) + Math.abs(c - center);
const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Helper: get all neighbor coordinates for a tile
const getNeighborCoords = (row, col, boardSize, neighborMode = "8") => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (neighborMode === "4" && Math.abs(dr) + Math.abs(dc) !== 1)
                continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                neighbors.push([nr, nc]);
            }
        }
    }
    return neighbors;
};

export default function TaskBingo({ tasksPool, setTasksPool }) {
    // Config
    const [configDone, setConfigDone] = useState(false);
    const [boardSize, setBoardSize] = useState(5);
    const [difficultyMode, setDifficultyMode] = useState("distance");
    const [unlockMode, setUnlockMode] = useState("auto"); // "auto" or "manual"
    const [neighborMode, setNeighborMode] = useState("8"); // "4" or "8"
    const [manualUnlockCount, setManualUnlockCount] = useState(2);
    const [enableMines, setEnableMines] = useState(false);
    const [mineCount, setMineCount] = useState(3);
    const [mineDamage, setMineDamage] = useState(10);

    // Board data
    const [board, setBoard] = useState([]); // 2D array of tiles
    const [score, setScore] = useState(0);

    // Manual unlock state
    const [awaitingUnlock, setAwaitingUnlock] = useState(false);
    const [unlockableTiles, setUnlockableTiles] = useState([]);
    const [pendingUnlocks, setPendingUnlocks] = useState([]);
    const [pendingAllowed, setPendingAllowed] = useState(manualUnlockCount);
    const [pendingLastCompleted, setPendingLastCompleted] = useState(null);

    // Mines visual feedback
    const [recentMines, setRecentMines] = useState([]);
    const [minePenalty, setMinePenalty] = useState(0);

    const navigate = useNavigate();

    // --- Setup: Build Board ---
    const initBoard = () => {
        const size = boardSize;
        const center = Math.floor(size / 2);
        let sortedTasks = [...tasksPool];
        if (tasksPool.length === 0) {
            alert("No tasks available! Please add some tasks.");
            return;
        }
        if (difficultyMode === "distance") {
            sortedTasks.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
        } else {
            sortedTasks = shuffle(tasksPool);
        }
        while (sortedTasks.length < size * size) {
            sortedTasks = [...sortedTasks, ...shuffle(tasksPool)];
        }
        const newBoard = [];
        let taskIndex = 0;
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                const distance = manhattan(r, c, center);
                let task;
                if (difficultyMode === "distance") {
                    const tier = Math.min(distance, 4);
                    const tierTasks = sortedTasks.filter((t) => (t.difficulty || 0) === tier);
                    task = tierTasks.length
                        ? tierTasks[Math.floor(Math.random() * tierTasks.length)]
                        : sortedTasks[taskIndex++ % sortedTasks.length];
                } else {
                    task = sortedTasks[taskIndex++ % sortedTasks.length];
                }
                row.push({
                    row: r,
                    col: c,
                    task,
                    visible: r === center && c === center,
                    completed: false,
                    isMine: false,
                });
            }
            newBoard.push(row);
        }

        // Place mines (manual unlock mode only)
        if (unlockMode === "manual" && enableMines && mineCount > 0) {
            const validIndices = [];
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    // Don't put mine on center
                    if (!(r === center && c === center)) {
                        validIndices.push([r, c]);
                    }
                }
            }
            const shuffled = shuffle(validIndices);
            for (let i = 0; i < Math.min(mineCount, shuffled.length); i++) {
                const [r, c] = shuffled[i];
                newBoard[r][c].isMine = true;
            }
        }

        setBoard(newBoard);
        setScore(0);
        setConfigDone(true);
        setAwaitingUnlock(false);
        setUnlockableTiles([]);
        setPendingUnlocks([]);
        setPendingAllowed(manualUnlockCount);
        setPendingLastCompleted(null);
        setRecentMines([]);
        setMinePenalty(0);
    };

    // --- Helper: Get completed coords ---
    const getCompletedCoords = (brd) => {
        const coords = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (brd[r][c].completed) coords.push([r, c]);
            }
        }
        return coords;
    };

    // --- Helper: Get all locked neighbors of all completed tiles ---
    const getAllLockedNeighbors = (brd) => {
        const completedCoords = getCompletedCoords(brd);
        const lockedSet = new Set();
        completedCoords.forEach(([r, c]) => {
            getNeighborCoords(r, c, boardSize, neighborMode).forEach(([nr, nc]) => {
                if (!brd[nr][nc].visible && !brd[nr][nc].completed) {
                    lockedSet.add(`${nr},${nc}`);
                }
            });
        });
        return Array.from(lockedSet).map(str => {
            const [r, c] = str.split(",").map(Number);
            return { row: r, col: c };
        });
    };

    // --- Claim tile (main click) ---
    const handleTileClick = (tile) => {
        if (!tile.visible || tile.completed || awaitingUnlock) return;
        if (unlockMode === "auto") {
            setBoard((prev) => {
                const copy = prev.map((row) => row.map((t) => ({ ...t })));
                copy[tile.row][tile.col].completed = true;
                // Unlock all neighbors of all completed tiles
                const completedCoords = getCompletedCoords(copy);
                completedCoords.forEach(([r, c]) => {
                    getNeighborCoords(r, c, boardSize, neighborMode).forEach(([nr, nc]) => {
                        if (!copy[nr][nc].visible) copy[nr][nc].visible = true;
                    });
                });
                return copy;
            });
            setScore((s) => s + (tile.task?.value || 1));
        } else {
            // MANUAL unlock
            setBoard((prev) => {
                const copy = prev.map((row) => row.map((t) => ({ ...t })));
                copy[tile.row][tile.col].completed = true;
                // Find all locked neighbors of all completed tiles
                const unlockables = getAllLockedNeighbors(copy);
                setUnlockableTiles(unlockables);
                setPendingUnlocks([]);
                setPendingAllowed(manualUnlockCount);
                setPendingLastCompleted({ row: tile.row, col: tile.col });
                setAwaitingUnlock(true);
                return copy;
            });
            setScore((s) => s + (tile.task?.value || 1));
        }
    };

    // --- Manual unlock selection handler ---
    const handleManualUnlockSelect = (tile) => {
        if (!awaitingUnlock) return;
        const key = `${tile.row},${tile.col}`;
        if (!unlockableTiles.some(t => t.row === tile.row && t.col === tile.col)) return;
        setPendingUnlocks(prev => {
            if (prev.some(t => t.row === tile.row && t.col === tile.col)) {
                return prev.filter(t => !(t.row === tile.row && t.col === tile.col));
            } else if (prev.length < pendingAllowed) {
                return [...prev, tile];
            } else {
                return prev;
            }
        });
    };

    // --- Confirm Manual Unlocks (handle mines logic) ---
    const confirmManualUnlocks = () => {
        // Mines logic
        let minesHit = [];
        pendingUnlocks.forEach(tile => {
            if (board[tile.row][tile.col]?.isMine) minesHit.push(tile);
        });

        // Visual feedback
        if (minesHit.length > 0) {
            setRecentMines(minesHit.map(t => `${t.row},${t.col}`));
            setMinePenalty(mineDamage * minesHit.length);
            setTimeout(() => setRecentMines([]), 1500);
            setTimeout(() => setMinePenalty(0), 2000);
        }

        // Reveal the selected tiles, increment score for non-mine tiles, decrease for mines
        setBoard(prev => {
            const copy = prev.map(row => row.map(t => ({ ...t })));
            pendingUnlocks.forEach(tile => {
                if (copy[tile.row][tile.col].isMine) {
                    copy[tile.row][tile.col] = {
                        ...copy[tile.row][tile.col],
                        visible: true,
                        completed: true,
                        task: {
                            ...copy[tile.row][tile.col].task,
                            value: -mineDamage
                        }
                    };
                } else {
                    copy[tile.row][tile.col].visible = true;
                }
            });
            return copy;
        });

        // Score logic: Deduct for mines
        setScore(prev => Math.max(0, prev - (mineDamage * minesHit.length)));

        // If any mines hit, allow replacement unlocks
        let extraAllowed = minesHit.length;
        if (extraAllowed > 0) {
            // Find all remaining eligible locked neighbors
            const updatedBoard = board.map(row => row.map(t => ({ ...t })));
            pendingUnlocks.forEach(tile => {
                updatedBoard[tile.row][tile.col].visible = true;
            });
            const eligible = getAllLockedNeighbors(updatedBoard)
                .filter(t => !pendingUnlocks.some(sel => sel.row === t.row && sel.col === t.col));
            if (eligible.length > 0) {
                setUnlockableTiles(eligible);
                setPendingAllowed(extraAllowed);
                setPendingUnlocks([]);
                // Don't set awaitingUnlock to false yet!
                return;
            }
        }

        // Clean up manual unlock state
        setAwaitingUnlock(false);
        setUnlockableTiles([]);
        setPendingUnlocks([]);
        setPendingAllowed(manualUnlockCount);
        setPendingLastCompleted(null);
    };

    // --- Visible tasks for task list ---
    const visibleTasks = board.flat().filter((t) => t.visible && !t.completed);

    // --- Share Board functionality ---
    const makeBoardSharable = async () => {
        let password = window.prompt("Enter a password for your board (cannot be blank):", "");
        if (!password || password.trim() === "") {
            alert("Board password cannot be blank. Please enter a valid password.");
            return;
        }
        password = password.trim();
        const passwordHash = await hashString(password);
        const boardId = Math.random().toString(36).substr(2, 9);

        const flattenedTiles = board.flat().map((tile) => ({ ...tile }));

        const newBoard = {
            cardId: boardId,
            boardPasswordHash: passwordHash,
            mode: "individual",
            boardSize,
            tiles: flattenedTiles,
            score: score,
            unlockMode,
            manualUnlockCount: unlockMode === "manual" ? manualUnlockCount : null,
            mineCount: enableMines ? mineCount : 0,
            mineDamage: enableMines ? mineDamage : 0,
            neighborMode,
            difficultyMode,
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp(),
        };

        try {
            await setDoc(doc(db, "bingoCards", boardId), newBoard);
            navigate(`/shared/${boardId}`);
        } catch (error) {
            alert("There was an error sharing the board. Please try again.");
        }
    };

    // --- Rendering ---

    if (!configDone) {
        return (
            <motion.div
                className="min-h-screen flex flex-col items-center justify-center p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <ThemeToggle />
                <motion.h1
                    className="text-3xl font-bold"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    Task Bingo – Setup
                </motion.h1>
                <motion.div className="flex flex-col gap-4 w-full max-w-md">
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Board size (odd number 3-19):</span>
                        <input
                            type="number"
                            min={3}
                            max={19}
                            step={2}
                            value={boardSize}
                            onChange={(e) => setBoardSize(parseInt(e.target.value) || 5)}
                            className="border rounded p-2 bg-white text-black dark:bg-gray-800 dark:text-white"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Difficulty mode:</span>
                        <select
                            value={difficultyMode}
                            onChange={(e) => setDifficultyMode(e.target.value)}
                            className="border rounded p-2 bg-white text-black dark:bg-gray-800 dark:text-white"
                        >
                            <option value="distance">Distance-based (harder farther)</option>
                            <option value="random">Random</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Unlock Mode:</span>
                        <select
                            value={unlockMode}
                            onChange={(e) => setUnlockMode(e.target.value)}
                            className="border rounded p-2 bg-white text-black dark:bg-gray-800 dark:text-white"
                        >
                            <option value="auto">Auto-unlock neighbors (classic)</option>
                            <option value="manual">Manual: pick one tile to unlock after claim</option>
                        </select>
                    </label>
                    {unlockMode === "manual" && (
                        <>
                            <label className="flex flex-col gap-1">
                                <span className="font-medium">Manual Unlocks per Completion:</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    value={manualUnlockCount}
                                    onChange={e => setManualUnlockCount(Math.max(1, Math.min(8, Number(e.target.value) || 2)))}
                                    className="p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white w-24"
                                />
                                <span className="text-xs text-gray-500">How many tiles to unlock after completing a tile (default 2)</span>
                            </label>
                            <label className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    checked={enableMines}
                                    onChange={e => setEnableMines(e.target.checked)}
                                />
                                <span className="font-medium">Enable Mines (bombs)</span>
                            </label>
                            {enableMines && (
                                <div className="flex flex-col gap-2 pl-6">
                                    <label>
                                        <span className="font-medium">Number of Mines:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={boardSize * boardSize - 1}
                                            value={mineCount}
                                            onChange={e =>
                                                setMineCount(Math.max(1, Math.min(boardSize * boardSize - 1, Number(e.target.value) || 1)))
                                            }
                                            className="p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white w-24"
                                        />
                                    </label>
                                    <label>
                                        <span className="font-medium">Bomb Damage (points lost):</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={mineDamage}
                                            onChange={e =>
                                                setMineDamage(Math.max(1, Math.min(100, Number(e.target.value) || 10)))
                                            }
                                            className="p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white w-24"
                                        />
                                    </label>
                                </div>
                            )}
                        </>
                    )}
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Neighbor Mode for Unlock:</span>
                        <select
                            value={neighborMode}
                            onChange={(e) => setNeighborMode(e.target.value)}
                            className="border rounded p-2 bg-white text-black dark:bg-gray-800 dark:text-white"
                        >
                            <option value="8">8-direction (N, NE, E, SE, S, SW, W, NW)</option>
                            <option value="4">4-direction (N, E, S, W only)</option>
                        </select>
                    </label>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={initBoard}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-3 mt-2"
                    >
                        Start Game
                    </motion.button>
                </motion.div>
                <Link
                    to="/manage-tasks"
                    className="mt-4 inline-block p-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                    Manage Tasks
                </Link>
            </motion.div>
        );
    }

    // --- Main Game Screen ---
    return (
        <motion.div
            className="min-h-screen flex flex-col md:flex-row p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ThemeToggle />
            <div className="flex-1 flex flex-col items-center">
                <motion.h2
                    className="text-2xl font-bold mb-4"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    Score: {score}
                </motion.h2>
                {/* Manual unlock UI */}
                {awaitingUnlock && (
                    <div className="w-full max-w-md mx-auto mb-3">
                        <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded px-4 py-2 font-semibold text-center mb-2 shadow">
                            Select {pendingAllowed} tiles to unlock.<br />
                            {enableMines && (
                                <span className="text-xs text-yellow-900 dark:text-yellow-100">
                                    Beware: mines may be hidden on this board!
                                </span>
                            )}
                        </div>
                        <div className="text-center mb-2">
                            {pendingUnlocks.length} / {Math.min(pendingAllowed, unlockableTiles.length)} selected
                        </div>
                        <div className="flex justify-center gap-4">
                            <button
                                className={`px-4 py-2 rounded bg-blue-600 text-white font-semibold transition-colors ${pendingUnlocks.length === Math.min(pendingAllowed, unlockableTiles.length)
                                    ? "hover:bg-blue-700"
                                    : "opacity-50 cursor-not-allowed"
                                    }`}
                                disabled={pendingUnlocks.length !== Math.min(pendingAllowed, unlockableTiles.length)}
                                onClick={confirmManualUnlocks}
                            >
                                Confirm Unlocks
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-gray-400 hover:bg-gray-500 text-white font-semibold"
                                onClick={() => {
                                    setAwaitingUnlock(false);
                                    setUnlockableTiles([]);
                                    setPendingUnlocks([]);
                                    setPendingAllowed(manualUnlockCount);
                                    setPendingLastCompleted(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {(minePenalty > 0) && (
                    <div className="mb-3 text-center">
                        <span className="inline-block px-4 py-2 bg-red-700 text-white rounded-lg font-bold text-lg shadow-lg animate-pulse">
                            💥 -{minePenalty} points!
                        </span>
                    </div>
                )}
                <div
                    className="grid gap-1"
                    style={{
                        gridTemplateColumns: `repeat(${boardSize}, 64px)`,
                        width: "fit-content",
                    }}
                >
                    <AnimatePresence>
                        {board.flat().map((tile) => {
                            // Manual unlock highlights
                            let highlight = null;
                            if (awaitingUnlock && unlockableTiles.some(t => t.row === tile.row && t.col === tile.col)) {
                                if (pendingUnlocks.some(t => t.row === tile.row && t.col === tile.col)) {
                                    highlight = "selected";
                                } else {
                                    highlight = "eligible";
                                }
                            }
                            const canUnlock = awaitingUnlock && highlight === "eligible";
                            const showMine = recentMines.includes(`${tile.row},${tile.col}`);

                            const handleClick = () => {
                                if (awaitingUnlock) {
                                    if (highlight === "eligible") handleManualUnlockSelect(tile);
                                } else {
                                    handleTileClick(tile);
                                }
                            };

                            return (
                                <div key={`${tile.row}-${tile.col}`} className="relative">
                                    <Tile
                                        tile={tile}
                                        tileSize={64}
                                        onClick={handleClick}
                                        canUnlock={canUnlock}
                                    />
                                    {highlight === "eligible" && (
                                        <span
                                            className="absolute inset-0 rounded-lg border-4 border-yellow-400 pointer-events-none"
                                            style={{ zIndex: 10 }}
                                        />
                                    )}
                                    {highlight === "selected" && (
                                        <span
                                            className="absolute inset-0 rounded-lg border-4 border-blue-500 pointer-events-none"
                                            style={{ zIndex: 10 }}
                                        />
                                    )}
                                    {showMine && (
                                        <span
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none animate-bounce"
                                            style={{ zIndex: 30, background: "rgba(255,255,255,0.7)" }}
                                        >
                                            <span style={{ fontSize: "2.5em" }} role="img" aria-label="Boom">💣</span>
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </AnimatePresence>
                </div>
                <div className="flex gap-2 mt-6">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setConfigDone(false)}
                        className="p-2 px-4 bg-gray-700 text-white rounded"
                    >
                        Restart
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={makeBoardSharable}
                        className="p-2 px-4 bg-blue-600 text-white rounded"
                    >
                        Share Board
                    </motion.button>
                </div>
            </div>
            {/* --- Solo overall scores and task list --- */}
            <aside className="w-full md:w-72 flex flex-col gap-4">
                <h3 className="text-xl font-bold">Overall Score</h3>
                <div className="p-3 text-2xl font-bold bg-green-100 dark:bg-green-700 rounded text-center shadow">
                    {score}
                </div>
                <h3 className="text-xl font-bold mt-4">
                    Available Tasks ({visibleTasks.length})
                </h3>
                <div className="flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
                    {visibleTasks.map((t, idx) => (
                        <motion.div
                            key={idx}
                            className="border p-2 rounded-lg shadow flex flex-col gap-1 bg-white dark:bg-gray-700"
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.05 * idx }}
                        >
                            <span className="font-semibold">{t.task?.name}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                {t.task?.description}
                            </span>
                            {t.task?.difficulty != null && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Difficulty: {t.task.difficulty}
                                </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Value: {t.task?.value ?? 1}
                            </span>
                        </motion.div>
                    ))}
                </div>
                {enableMines && unlockMode === "manual" && (
                    <div className="mt-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded px-4 py-2 font-semibold shadow">
                        <span role="img" aria-label="mine">💣</span> Mines on board: <b>{mineCount}</b><br />
                        Bomb damage: <b>{mineDamage}</b> points
                    </div>
                )}
            </aside>
        </motion.div>
    );
}