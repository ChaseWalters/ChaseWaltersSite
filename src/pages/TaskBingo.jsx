/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import SharedBingoCard from "../components/SharedBingoCard";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "../components/ThemeToggle";
import { hashString } from "../utils/crypto";
import Tile from "../components/Tile";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const manhattan = (r, c, center) => Math.abs(r - center) + Math.abs(c - center);

const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Helper: get all 8-neighbor coordinates for a tile
const getNeighborCoords = (row, col, boardSize) => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
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
    const [configDone, setConfigDone] = useState(false);
    const [boardSize, setBoardSize] = useState(9);
    const [difficultyMode, setDifficultyMode] = useState("distance");
    const [board, setBoard] = useState([]);
    const [score, setScore] = useState(0);
    const [sortField, setSortField] = useState("difficulty");
    const [sortDir, setSortDir] = useState("asc");

    const navigate = useNavigate();

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                if (Array.isArray(json)) {
                    setTasksPool((prev) => [...prev, ...json]);
                } else {
                    alert("Uploaded file must be a JSON array of tasks");
                }
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    const initBoard = () => {
        const size = boardSize;
        const center = Math.floor(size / 2);
        let sortedTasks = [...tasksPool];
        if (tasksPool.length === 0) {
            console.error("No tasks available! Please add some tasks.");
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
                });
            }
            newBoard.push(row);
        }
        setBoard(newBoard);
        setScore(0);
        setConfigDone(true);
    };

    // UNLOCK LOGIC: when a tile is completed, unlock ALL neighbors of ALL completed tiles
    const handleTileClick = (tile) => {
        if (!tile.visible || tile.completed) return;
        setBoard((prev) => {
            // Deep copy board
            const copy = prev.map((row) => row.map((t) => ({ ...t })));
            // Mark this tile as completed
            const t = copy[tile.row][tile.col];
            t.completed = true;

            // Gather all completed tile coords
            const completedCoords = [];
            for (let r = 0; r < boardSize; r++) {
                for (let c = 0; c < boardSize; c++) {
                    if (copy[r][c].completed) completedCoords.push([r, c]);
                }
            }
            // For each completed tile, unlock all its neighbors
            completedCoords.forEach(([r, c]) => {
                getNeighborCoords(r, c, boardSize).forEach(([nr, nc]) => {
                    if (!copy[nr][nc].visible) copy[nr][nc].visible = true;
                });
            });
            return copy;
        });
        setScore((s) => s + (tile.task?.value || 1));
    };

    const visibleTasks = board.flat().filter((t) => t.visible && !t.completed);

    // --- The "Share Board" functionality ---
    const makeBoardSharable = async () => {
        let password = window.prompt("Enter a password for your board (cannot be blank):", "");
        if (!password || password.trim() === "") {
            alert("Board password cannot be blank. Please enter a valid password.");
            return;
        }
        password = password.trim();

        // Hash the user's password using our helper
        const passwordHash = await hashString(password);

        // Generate a unique board ID
        const boardId = Math.random().toString(36).substr(2, 9);

        // Flatten the board array if needed.
        const flattenedTiles = board.flat().map((tile) => ({ ...tile }));

        // Build the new board document—store the hash instead of the plain text.
        const newBoard = {
            cardId: boardId,
            boardPasswordHash: passwordHash,
            mode: "individual",
            boardSize, // assuming boardSize is a defined state variable
            teams: [],
            tiles: flattenedTiles,
            score: score, // make sure to include the current score
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp(),
        };

        try {
            await setDoc(doc(db, "bingoCards", boardId), newBoard);
            navigate(`/shared/${boardId}`);
        } catch (error) {
            console.error("Error sharing board:", error);
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
                            onChange={(e) => setBoardSize(parseInt(e.target.value) || 9)}
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

    // Game screen: Local board view
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
                <div
                    className="grid gap-1"
                    style={{
                        gridTemplateColumns: `repeat(${boardSize}, 64px)`, // fixed width per tile
                        width: "fit-content",
                    }}
                >
                    <AnimatePresence>
                        {board.flat().map((tile) => (
                            <Tile key={`${tile.row}-${tile.col}`} tile={tile} onClick={handleTileClick} />
                        ))}
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
            <aside className="w-full md:w-72 flex flex-col gap-4">
                <h3 className="text-xl font-bold">Available Tasks ({visibleTasks.length})</h3>
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
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t.task?.description}</span>
                            {t.task?.difficulty != null && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">Difficulty: {t.task.difficulty}</span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">Value: {t.task?.value ?? 1}</span>
                        </motion.div>
                    ))}
                </div>
            </aside>
        </motion.div>
    );
}