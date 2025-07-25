/* eslint-disable no-unused-vars */
// src/pages/Home.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { hashString } from "../utils/crypto";
import ThemeToggle from "../components/ThemeToggle";
import { FaEye, FaEyeSlash } from "react-icons/fa";

// Default team colors
const TEAM_COLORS = [
    "#e53e3e", // red
    "#3182ce", // blue
    "#38a169", // green
    "#d69e2e", // yellow
    "#805ad5", // purple
    "#dd6b20", // orange
];

// Utility functions
const manhattan = (r, c, center) => Math.abs(r - center) + Math.abs(c - center);
const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

export default function Home({ tasksPool, setTasksPool }) {
    const navigate = useNavigate();

    // Board config
    const [boardType, setBoardType] = useState("solo");
    const [boardSize, setBoardSize] = useState(5);
    const [difficultyMode, setDifficultyMode] = useState("distance");
    const [unlockMode, setUnlockMode] = useState("auto");
    const [neighborMode, setNeighborMode] = useState("8");
    const [boardPassword, setBoardPassword] = useState("");
    const [perTeamUnlocks, setPerTeamUnlocks] = useState(true); // NEW
    const [firstClaimBonus, setFirstClaimBonus] = useState(1); // default +1
    const [manualUnlockCount, setManualUnlockCount] = useState(2);
    const [enableMines, setEnableMines] = useState(false);
    const [mineCount, setMineCount] = useState(3);
    const [mineDamage, setMineDamage] = useState(10);
    const [allowDuplicates, setAllowDuplicates] = useState(true);


    // Teams state
    const [teams, setTeams] = useState([
        { name: "Red", color: TEAM_COLORS[0], password: "", memberPassword: "" },
        { name: "Blue", color: TEAM_COLORS[1], password: "", memberPassword: "" },
    ]);
    // Password vis state for each team
    const [passwordVis, setPasswordVis] = useState([
        { captain: false, member: false },
        { captain: false, member: false }
    ]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Team handlers
    const addTeam = () => {
        setTeams((prev) => [
            ...prev,
            {
                name: "",
                color: TEAM_COLORS[prev.length % TEAM_COLORS.length],
                password: "",
                memberPassword: "",
            },
        ]);
        setPasswordVis((prev) => [...prev, { captain: false, member: false }]);
    };
    const removeTeam = (idx) => {
        setTeams((prev) => prev.filter((_, i) => i !== idx));
        setPasswordVis((prev) => prev.filter((_, i) => i !== idx));
    };
    const handleTeamChange = (idx, field, value) => {
        setTeams((prev) =>
            prev.map((team, i) =>
                i === idx ? { ...team, [field]: value } : team
            )
        );
    };

    const handleBoardSizeChange = (value) => {
        let size = parseInt(value, 10) || 3;
        if (size < 3) size = 3;
        if (size > 15) size = 15;
        if (size % 2 === 0) size += 1; // Snap to next odd if even
        setBoardSize(size);
        // Also clamp mine count (if mines enabled)
        if (enableMines && mineCount > size * size - 1) {
            setMineCount(size * size - 1);
        }
    };

    const handleMineCountChange = (value) => {
        let maxMines = boardSize * boardSize - 1;
        let mines = parseInt(value, 10) || 1;
        if (mines > maxMines) mines = maxMines;
        if (mines < 1) mines = 1;
        setMineCount(mines);
    };

    // Main board creation handler
    const handleShareBoard = async () => {
        setError(null);
        setLoading(true);

        const numTiles = boardSize * boardSize;
        const numTasks = tasksPool.length;
        const bombsNeededIfNoDuplicates = Math.max(0, numTiles - numTasks);

        // Validation
        if (boardSize % 2 === 0) {
            setError("Board size must be an odd number (e.g., 3, 5, 7, etc).");
            setLoading(false);
            return;
        }
        if (enableMines && mineCount > numTiles - 1) {
            setError(`Number of mines cannot exceed total tiles minus one (${numTiles - 1}).`);
            setLoading(false);
            return;
        }
        if (!allowDuplicates) {
            if (numTasks + (enableMines ? mineCount : 0) < numTiles) {
                setError(
                    `Not enough tasks and bombs to fill the board. You need at least ${bombsNeededIfNoDuplicates} bombs for missing tasks, or add more tasks.`
                );
                setLoading(false);
                return;
            }
            if (enableMines && mineCount < bombsNeededIfNoDuplicates) {
                setError(
                    `You must have at least ${bombsNeededIfNoDuplicates} bombs for missing tasks.`
                );
                setLoading(false);
                return;
            }
        } else {
            if (numTasks < numTiles && !enableMines) {
                setError("Not enough tasks to fill the board. Please add more tasks or enable bombs/duplicates.");
                setLoading(false);
                return;
            }
        }
        if (!boardPassword || !boardPassword.trim()) {
            setError("Please set a board password (for editing/sharing).");
            setLoading(false);
            return;
        }
        if (boardType === "team") {
            if (teams.length < 2) {
                setError("At least 2 teams required.");
                setLoading(false);
                return;
            }
            for (const team of teams) {
                if (!team.name.trim() || !team.password.trim() || !team.memberPassword.trim()) {
                    setError("Each team needs a name and both passwords.");
                    setLoading(false);
                    return;
                }
                if (team.password.trim() === team.memberPassword.trim()) {
                    setError(`Captain and Team Member passwords must be different for team "${team.name || '(unnamed)'}".`);
                    setLoading(false);
                    return;
                }
            }
        }

        // Build teams with password hashes
        let teamsWithHash = [];
        if (boardType === "team") {
            teamsWithHash = await Promise.all(
                teams.map(async (team) => ({
                    name: team.name.trim(),
                    color: team.color,
                    passwordHash: await hashString(team.password),
                    memberPasswordHash: await hashString(team.memberPassword),
                }))
            );
        }

        // Populate tiles (tasks and bombs)
        let tileTasks = [];
        let bombIndices = [];

        if (allowDuplicates) {
            tileTasks = shuffle([...tasksPool]);
            while (tileTasks.length < numTiles - (enableMines ? mineCount : 0)) {
                tileTasks = [...tileTasks, ...shuffle(tasksPool)];
            }
            tileTasks = tileTasks.slice(0, numTiles - (enableMines ? mineCount : 0));
        } else {
            tileTasks = shuffle([...tasksPool]).slice(0, numTiles - (enableMines ? mineCount : 0));
        }

        // Prepare bomb indices so that center tile is never a bomb
        const center = Math.floor(boardSize / 2);
        const allIndices = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (!(r === center && c === center)) {
                    allIndices.push(r * boardSize + c);
                }
            }
        }
        bombIndices = enableMines
            ? shuffle(allIndices).slice(0, mineCount)
            : [];

        // Assign tasks and bombs to tiles
        let tiles = [];
        let taskIndex = 0;
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                const idx = r * boardSize + c;
                const isMine = bombIndices.includes(idx);
                let task = null;
                if (!isMine && taskIndex < tileTasks.length) {
                    task = tileTasks[taskIndex++];
                    if (difficultyMode === "distance") {
                        const distance = manhattan(r, c, center);
                        const tierTasks = tasksPool.filter(
                            (t) => (t.difficulty || 0) === Math.min(distance, 4)
                        );
                        if (tierTasks.length > 0) {
                            task = tierTasks[Math.floor(Math.random() * tierTasks.length)];
                        }
                    }
                }
                const tile = {
                    row: r,
                    col: c,
                    task,
                    completed: false,
                    visible: r === center && c === center,
                    isMine,
                };
                if (boardType === "team") {
                    tile.claimedBy = null;
                    if (perTeamUnlocks) {
                        if (r === center && c === center) {
                            tile.visibleTeams = teamsWithHash.map(t => t.name);
                        } else {
                            tile.visibleTeams = [];
                        }
                    }
                }
                tiles.push(tile);
            }
        }

        // Board doc
        const boardId = Math.random().toString(36).substr(2, 9);
        const boardPasswordHash = await hashString(boardPassword.trim());
        const newBoard = {
            cardId: boardId,
            boardPasswordHash,
            mode: boardType === "team" ? "teams" : "individual",
            boardSize,
            gridSize: boardSize,
            unlockMode,
            manualUnlockCount: unlockMode === "manual" ? manualUnlockCount : null,
            mineCount: enableMines ? mineCount : 0,
            mineDamage: enableMines ? mineDamage : 0,
            neighborMode,
            difficultyMode,
            teams: boardType === "team" ? teamsWithHash : [],
            tiles,
            score: 0,
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp(),
            perTeamUnlocks: boardType === "team" ? perTeamUnlocks : false,
            firstClaimBonus: boardType === "team" ? firstClaimBonus : 0,
            allowDuplicates,
        };

        try {
            await setDoc(doc(db, "bingoCards", boardId), newBoard);
            setLoading(false);
            navigate(`/shared/${boardId}`);
        } catch (e) {
            setError("Error sharing board: " + e.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
            <ThemeToggle />
            <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-center mb-2">Create a Board</h1>
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Board Type:</span>
                        <select
                            value={boardType}
                            onChange={e => setBoardType(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
                        >
                            <option value="solo">Solo (individual)</option>
                            <option value="team">Team (multiplayer)</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Board Size:</span>
                        <input
                            type="number"
                            min={3}
                            max={15}
                            step={2}
                            value={boardSize}
                            onChange={e => handleBoardSizeChange(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
                        />
                        <span className="text-xs text-gray-500">
                            Must be odd (3, 5, 7, ...). No even sizes allowed.
                        </span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={allowDuplicates}
                            onChange={e => setAllowDuplicates(e.target.checked)}
                        />
                        <span className="font-medium">Allow duplicate tasks (fill with repeats if needed)</span>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Difficulty Mode:</span>
                        <select
                            value={difficultyMode}
                            onChange={e => setDifficultyMode(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
                        >
                            <option value="distance">Distance-based (harder farther)</option>
                            <option value="random">Random</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">Unlock Mode:</span>
                        <select
                            value={unlockMode}
                            onChange={e => setUnlockMode(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
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
                            {/* --- MINES FEATURE --- */}
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
                                            onChange={e => handleMineCountChange(e.target.value)}
                                            className="p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white w-24"
                                        />
                                        <span className="text-xs text-gray-500 ml-2">
                                            Max: {boardSize * boardSize - 1}
                                        </span>
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
                            onChange={e => setNeighborMode(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
                        >
                            <option value="8">8-direction (N, NE, E, SE, S, SW, W, NW)</option>
                            <option value="4">4-direction (N, E, S, W only)</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-medium">
                            Board Password (for board editing and sharing):
                        </span>
                        <input
                            type="password"
                            value={boardPassword}
                            onChange={e => setBoardPassword(e.target.value)}
                            placeholder="Enter a board password"
                            className="p-2 border rounded bg-white text-black"
                        />
                    </label>
                    {/* Per-team unlocks option, only for team mode */}
                    {boardType === "team" && (
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={perTeamUnlocks}
                                onChange={e => setPerTeamUnlocks(e.target.checked)}
                            />
                            <span className="font-medium">
                                Per-team unlocks (each team only unlocks and sees their own tiles)
                            </span>
                        </label>
                    )}
                    {boardType === "team" && (
                        <label className="flex items-center gap-2 mt-2">
                            <span className="font-medium">First Claim Bonus:</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={firstClaimBonus}
                                onChange={e => setFirstClaimBonus(Number(e.target.value))}
                                className="p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white w-20"
                            />
                            <span className="text-sm">points for first team to claim a tile (default 1)</span>
                        </label>
                    )}
                </div>
                {boardType === "team" && (
                    <div>
                        <h2 className="text-xl font-semibold mt-4 mb-2">Teams</h2>
                        {teams.map((team, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col md:flex-row gap-2 mb-2 p-2 border rounded"
                                style={{ borderColor: team.color }}
                            >
                                <input
                                    type="text"
                                    placeholder="Team Name"
                                    value={team.name}
                                    onChange={e => handleTeamChange(idx, "name", e.target.value)}
                                    className="flex-1 p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="color"
                                    value={team.color}
                                    onChange={e => handleTeamChange(idx, "color", e.target.value)}
                                    className="w-10 h-10"
                                    style={{ background: team.color }}
                                    title="Team color"
                                />
                                <div className="relative flex-1">
                                    <input
                                        type={passwordVis[idx]?.captain ? "text" : "password"}
                                        placeholder="Captain Password"
                                        value={team.password}
                                        onChange={e => handleTeamChange(idx, "password", e.target.value)}
                                        className="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300"
                                        tabIndex={-1}
                                        onClick={() =>
                                            setPasswordVis((prev) =>
                                                prev.map((vis, i) =>
                                                    i === idx ? { ...vis, captain: !vis.captain } : vis
                                                )
                                            )
                                        }
                                        aria-label={passwordVis[idx]?.captain ? "Hide password" : "Show password"}
                                    >
                                        {passwordVis[idx]?.captain ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                <div className="relative flex-1">
                                    <input
                                        type={passwordVis[idx]?.member ? "text" : "password"}
                                        placeholder="Team Member Password"
                                        value={team.memberPassword}
                                        onChange={e => handleTeamChange(idx, "memberPassword", e.target.value)}
                                        className="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300"
                                        tabIndex={-1}
                                        onClick={() =>
                                            setPasswordVis((prev) =>
                                                prev.map((vis, i) =>
                                                    i === idx ? { ...vis, member: !vis.member } : vis
                                                )
                                            )
                                        }
                                        aria-label={passwordVis[idx]?.member ? "Hide password" : "Show password"}
                                    >
                                        {passwordVis[idx]?.member ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {teams.length > 2 && (
                                    <button
                                        type="button"
                                        className="bg-red-500 text-white px-2 rounded"
                                        onClick={() => removeTeam(idx)}
                                        title="Remove team"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded p-2 mt-2"
                            onClick={addTeam}
                        >
                            Add Team
                        </button>
                    </div>
                )}
                <button
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-4 text-lg"
                    onClick={handleShareBoard}
                    disabled={loading}
                >
                    {loading ? "Creating Board..." : "Share Board"}
                </button>
                <button
                    onClick={() => navigate("/manage-tasks")}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded p-3 mt-2"
                >
                    Manage Tasks
                </button>
                {error && <p className="text-red-500 text-center">{error}</p>}
            </div>
        </div>
    );
}