/* eslint-disable no-unused-vars */
// src/components/SharedBingoCard.jsx
import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { hashString } from "../utils/crypto";
import Tile from "./Tile";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

export default function SharedBingoCard({ cardId }) {
    const [cardData, setCardData] = useState(null);
    const [teamName, setTeamName] = useState("");
    const [teamPassword, setTeamPassword] = useState("");
    const [team, setTeam] = useState(null);
    const [role, setRole] = useState(""); // "captain" | "member"
    const [loginError, setLoginError] = useState(null);

    // For switching teams (captain only)
    const [showSwitch, setShowSwitch] = useState(false);
    const [switchTeamName, setSwitchTeamName] = useState("");
    const [switchTeamPassword, setSwitchTeamPassword] = useState("");
    const [switchError, setSwitchError] = useState(null);

    const [soloAccess, setSoloAccess] = useState(false);
    const [soloPassword, setSoloPassword] = useState("");
    const [soloError, setSoloError] = useState("");

    useEffect(() => {
        const cardRef = doc(db, "bingoCards", cardId);
        const unsubscribe = onSnapshot(cardRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setCardData(docSnapshot.data());
            } else {
                setCardData(undefined); // undefined for "not found"
            }
        });
        return () => unsubscribe();
    }, [cardId]);

    if (cardData === null) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <ThemeToggle />
                <span className="text-lg text-gray-700 dark:text-gray-200">Loading board...</span>
            </div>
        );
    }
    if (cardData === undefined) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <ThemeToggle />
                <span className="text-xl text-red-500">Board not found.</span>
            </div>
        );
    }

    // --- Per-team unlock setting ---
    const isSoloMode = cardData && cardData.mode === "individual";
    const isTeamMode = cardData && (cardData.mode === "teams" || cardData.mode === "multi-claim");
    const perTeamUnlocks = !!cardData.perTeamUnlocks; // If not set, defaults to false (legacy boards)


    if (isSoloMode && !soloAccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
                <ThemeToggle />
                <h2 className="text-2xl font-bold mb-2">Enter Board Password</h2>
                <div className="flex flex-col gap-2 bg-white dark:bg-gray-700 p-4 rounded shadow">
                    <input
                        type="password"
                        placeholder="Board password"
                        value={soloPassword}
                        onChange={e => {
                            setSoloPassword(e.target.value);
                            setSoloError("");
                        }}
                        className="p-2 border rounded bg-white text-black"
                    />
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded p-2 mt-2"
                        onClick={async () => {
                            setSoloError("");
                            if (!soloPassword) {
                                setSoloError("Enter the board password.");
                                return;
                            }
                            const enteredHash = await hashString(soloPassword);
                            if (enteredHash === cardData.boardPasswordHash) {
                                setSoloAccess(true);
                            } else {
                                setSoloError("Incorrect password.");
                            }
                        }}
                    >
                        Enter
                    </button>
                    {soloError && <p className="text-red-500">{soloError}</p>}
                </div>
            </div>
        );
    }
    else if (isTeamMode && !team) { // Login UI for team mode
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
                <ThemeToggle />
                <h2 className="text-2xl font-bold mb-2">Team Login</h2>
                <div className="flex flex-col gap-2 bg-white dark:bg-gray-700 p-4 rounded shadow">
                    <label>
                        <span className="font-medium">Select team:</span>
                        <select
                            value={teamName}
                            onChange={e => {
                                setTeamName(e.target.value);
                                setLoginError(null);
                            }}
                            className="p-2 border rounded bg-white text-black"
                        >
                            <option value="">-- Select Team --</option>
                            {(cardData?.teams || []).map(t => (
                                <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="font-medium">Team password:</span>
                        <input
                            type="password"
                            value={teamPassword}
                            onChange={e => setTeamPassword(e.target.value)}
                            className="p-2 border rounded bg-white text-black"
                        />
                    </label>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded p-2 mt-2"
                        onClick={handleLogin}
                    >
                        Login
                    </button>
                    {loginError && <p className="text-red-500">{loginError}</p>}
                </div>
            </div>
        );
    }

    // Helper: Given a tile (with row, col) and boardSize, return indices of adjacent neighbors (8-way)
    const getNeighborIndices = (tile, boardSize, neighborMode = "8") => {
        const neighbors = [];
        const { row, col } = tile;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                // If in 4-direction mode, only N/E/S/W (no diagonals)
                if (neighborMode === "4" && Math.abs(dr) + Math.abs(dc) !== 1) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                    neighbors.push(nr * boardSize + nc);
                }
            }
        }
        return neighbors;
    };

    // Login logic
    async function handleLogin() {
        setLoginError(null);
        if (!teamName || !teamPassword) {
            setLoginError("Select a team and enter password.");
            return;
        }
        const found = (cardData?.teams || []).find(t => t.name === teamName);
        if (!found) {
            setLoginError("Team not found.");
            return;
        }
        const enteredHash = await hashString(teamPassword);
        if (enteredHash === found.passwordHash) {
            setTeam(found);
            setRole("captain");
            return;
        }
        if (enteredHash === found.memberPasswordHash) {
            setTeam(found);
            setRole("member");
            return;
        }
        setLoginError("Incorrect password.");
    }

    // --- Claim tile logic (captain only for team mode, all users for solo) ---
    const claimTile = async (tileIndex) => {
        if (!cardData) return;

        const boardSize = cardData.gridSize || cardData.boardSize || 5;
        const neighborMode = cardData.neighborMode || "8"; // Use board's neighbor mode

        const newTiles = [...cardData.tiles];
        const tile = newTiles[tileIndex];

        // --- TEAM MODE (multi-claim, per-team unlocks) ---
        if (isTeamMode) {
            // Only captains can claim
            if (!team || role !== "captain") return;

            // Only claim if visible for this team if perTeamUnlocks is enabled
            let isVisible = true;
            if (perTeamUnlocks) {
                const visTeams = Array.isArray(tile.visibleTeams) ? tile.visibleTeams : [];
                isVisible = visTeams.includes(team.name);
            } else if (!tile.visible) {
                isVisible = false;
            }
            if (!isVisible) return;

            // Multi-claim logic
            let claimedBy = Array.isArray(tile.claimedBy)
                ? [...tile.claimedBy]
                : tile.claimedBy
                    ? [tile.claimedBy]
                    : [];
            let visibleTeams = Array.isArray(tile.visibleTeams)
                ? [...tile.visibleTeams]
                : tile.visibleTeams
                    ? [tile.visibleTeams]
                    : [];

            if (claimedBy.includes(team.name)) return; // already claimed by this team
            claimedBy.push(team.name);
            if (!visibleTeams.includes(team.name)) visibleTeams.push(team.name);

            newTiles[tileIndex] = {
                ...tile,
                claimedBy,
                visibleTeams,
                completed: true,
            };

            // UNLOCK LOGIC: unlock neighbors for your team only (perTeamUnlocks)
            if (perTeamUnlocks) {
                // Find all indices of completed tiles for this team
                const completedIndices = newTiles
                    .map((t, i) => {
                        const tClaimed = Array.isArray(t.claimedBy) ? t.claimedBy : t.claimedBy ? [t.claimedBy] : [];
                        return tClaimed.includes(team?.name) ? i : null;
                    })
                    .filter(i => i !== null);

                completedIndices.forEach((i) => {
                    const t = newTiles[i];
                    const neighbors = getNeighborIndices(t, boardSize, neighborMode);
                    neighbors.forEach(nIdx => {
                        if (nIdx >= 0 && nIdx < newTiles.length) {
                            let nTile = newTiles[nIdx];
                            let nVisTeams = Array.isArray(nTile.visibleTeams) ? [...nTile.visibleTeams] : [];
                            if (!nVisTeams.includes(team.name)) nVisTeams.push(team.name);
                            newTiles[nIdx] = { ...nTile, visibleTeams: nVisTeams };
                        }
                    });
                });
            } else {
                // Classic unlock for all teams (rare, probably not used)
                const completedIndices = newTiles
                    .map((t, i) => t.completed ? i : null)
                    .filter(i => i !== null);

                completedIndices.forEach((i) => {
                    const t = newTiles[i];
                    const neighbors = getNeighborIndices(t, boardSize, neighborMode);
                    neighbors.forEach(nIdx => {
                        if (nIdx >= 0 && nIdx < newTiles.length && !newTiles[nIdx].visible) {
                            newTiles[nIdx] = {
                                ...newTiles[nIdx],
                                visible: true,
                            };
                        }
                    });
                });
            }
        }
        // --- SOLO MODE ---
        else {
            if (!tile.visible || tile.completed) return;

            newTiles[tileIndex] = {
                ...tile,
                completed: true,
            };

            // Unlock all neighbors of all completed tiles globally
            const completedIndices = newTiles
                .map((t, i) => t.completed ? i : null)
                .filter(i => i !== null);

            completedIndices.forEach((i) => {
                const t = newTiles[i];
                const neighbors = getNeighborIndices(t, boardSize, neighborMode);
                neighbors.forEach(nIdx => {
                    if (nIdx >= 0 && nIdx < newTiles.length && !newTiles[nIdx].visible) {
                        newTiles[nIdx] = {
                            ...newTiles[nIdx],
                            visible: true,
                        };
                    }
                });
            });
        }

        // --- SAVE TO FIRESTORE ---
        try {
            await updateDoc(doc(db, "bingoCards", cardId), {
                tiles: newTiles,
                lastUpdated: new Date().toISOString(),
            });
        } catch (error) {
            setLoginError("Failed to claim tile.");
        }
    };

    // --- Tiles for board (per-team visibility) ---
    function getVisibleTiles() {
        if (!cardData) return [];
        // If this is a team board, use team logic (unchanged)
        if (cardData.mode === "teams" || cardData.mode === "multi-claim") {
            if (!team) return [];
            const claimedByTeam = (tile) => {
                const claimedBy = Array.isArray(tile.claimedBy)
                    ? tile.claimedBy
                    : tile.claimedBy
                        ? [tile.claimedBy]
                        : [];
                return claimedBy.includes(team.name);
            };
            return cardData.tiles.map(tile => ({
                ...tile,
                completed: claimedByTeam(tile),
                visible: Array.isArray(tile.visibleTeams)
                    ? tile.visibleTeams.includes(team.name)
                    : !!tile.visible
            }));
        }
        // --- SOLO MODE: just use tile.visible and tile.completed ---
        return cardData.tiles.map(tile => ({
            ...tile,
            completed: !!tile.completed,
            visible: !!tile.visible
        }));
    }


    // --- Team scores (only for team mode) ---
    function getTeamScores() {
        if (!cardData || !isTeamMode) return [];
        return (cardData.teams || []).map((t) => {
            const claimed = cardData.tiles.filter(tile => {
                const claimedBy = Array.isArray(tile.claimedBy)
                    ? tile.claimedBy
                    : tile.claimedBy
                        ? [tile.claimedBy]
                        : [];
                return claimedBy.includes(t.name);
            });
            const score = claimed.reduce((sum, tile) => sum + (tile.task?.value || 1), 0);
            return { ...t, score };
        });
    }

    // --- Captain: switch team logic ---
    const handleSwitchTeam = async () => {
        setSwitchError(null);
        if (!switchTeamName || !switchTeamPassword) {
            setSwitchError("Select a team and enter password.");
            return;
        }
        const found = (cardData?.teams || []).find(t => t.name === switchTeamName);
        if (!found) {
            setSwitchError("Team not found.");
            return;
        }
        const enteredHash = await hashString(switchTeamPassword);
        if (enteredHash === found.passwordHash) {
            setTeam(found);
            setRole("captain");
            setTeamName(found.name);
            setShowSwitch(false);
            setSwitchTeamName("");
            setSwitchTeamPassword("");
            return;
        }
        setSwitchError("Incorrect password.");
    };

    const boardSize = cardData.gridSize || cardData.boardSize || 5;
    const teams = cardData.teams || [];
    const teamScores = getTeamScores();
    const visibleTiles = getVisibleTiles();

    // Helper: get all claimed teams for a tile (for badges/colors)
    const getClaimedTeams = (tile) => {
        const claimedBy = Array.isArray(tile.claimedBy)
            ? tile.claimedBy
            : tile.claimedBy
                ? [tile.claimedBy]
                : [];
        return claimedBy.map((tn) => teams.find((t) => t.name === tn)).filter(Boolean);
    };

    return (
        <motion.div
            className="min-h-screen flex flex-col md:flex-row p-0 md:p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ThemeToggle />
            {/* Team scores and task list: Only for team mode */}
            {isTeamMode && (
                <aside className="w-full md:w-72 flex flex-col gap-4">
                    <h3 className="text-xl font-bold">Team Scores</h3>
                    <div className="flex flex-col gap-2">
                        {teamScores.map((t) => (
                            <div
                                key={t.name}
                                className="flex items-center gap-2 p-2 rounded"
                                style={{ background: t.color, color: "#fff" }}
                            >
                                <span className="font-bold">{t.name}</span>
                                <span className="ml-auto text-lg font-mono">{t.score}</span>
                                {team && t.name === team.name && (
                                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-0.5 rounded">You</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <h3 className="text-xl font-bold mt-4">
                        Available Tasks ({visibleTiles.filter((t) => t.visible && !t.completed).length})
                    </h3>
                    <div className="flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
                        {visibleTiles
                            .filter((t) => t.visible && !t.completed)
                            .map((t, idx) => (
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
                </aside>
            )}
            <div className="flex-1 flex flex-col items-center">
                <motion.h2
                    className="text-2xl font-bold mb-4"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    {isTeamMode && team ? (
                        <>
                            Team: <span style={{ color: team.color }}>{team.name}</span>
                            <span className="ml-2 text-xs px-2 py-0.5 rounded"
                                style={{
                                    background: role === "captain" ? "#2563eb" : "#6b7280",
                                    color: "#fff",
                                }}
                            >
                                {role === "captain" ? "Captain" : "Member"}
                            </span>
                            {role === "captain" && (
                                <button
                                    className="ml-4 px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs"
                                    onClick={() => setShowSwitch(true)}
                                >
                                    Switch Team
                                </button>
                            )}
                        </>
                    ) : (
                        <>Task Bingo Board</>
                    )}
                </motion.h2>
                {/* Captain switch team UI (only for team mode/captain) */}
                {isTeamMode && role === "captain" && showSwitch && (
                    <div className="mb-4 p-4 bg-gray-200 dark:bg-gray-700 rounded shadow w-full max-w-xs flex flex-col gap-2">
                        <h3 className="font-bold text-lg">Switch Team (Captain)</h3>
                        <label>
                            <span className="font-medium">Select team:</span>
                            <select
                                value={switchTeamName}
                                onChange={e => {
                                    setSwitchTeamName(e.target.value);
                                    setSwitchError(null);
                                }}
                                className="p-2 border rounded bg-white text-black w-full"
                            >
                                <option value="">-- Select Team --</option>
                                {(cardData?.teams || []).map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span className="font-medium">Captain password:</span>
                            <input
                                type="password"
                                value={switchTeamPassword}
                                onChange={e => setSwitchTeamPassword(e.target.value)}
                                className="p-2 border rounded bg-white text-black w-full"
                            />
                        </label>
                        <div className="flex gap-2 mt-2">
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1"
                                onClick={handleSwitchTeam}
                            >
                                Switch
                            </button>
                            <button
                                className="bg-gray-400 hover:bg-gray-500 text-white rounded px-2 py-1"
                                onClick={() => setShowSwitch(false)}
                            >
                                Cancel
                            </button>
                        </div>
                        {switchError && <p className="text-red-500">{switchError}</p>}
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
                        {visibleTiles.map((tile, index) => (
                            <div key={index} className="relative">
                                <Tile
                                    tile={tile}
                                    onClick={() => {
                                        // Team mode: only captains, solo: always
                                        if (
                                            (isTeamMode && role === "captain" && tile.visible && !tile.completed) ||
                                            (!isTeamMode && tile.visible && !tile.completed)
                                        ) {
                                            claimTile(index);
                                        }
                                    }}
                                    claimedTeams={isTeamMode ? getClaimedTeams(tile) : []}
                                />
                                {/* Team claim badges handled by Tile itself */}
                            </div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}