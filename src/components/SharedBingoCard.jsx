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

    // Manual unlock state
    const [pendingManualUnlocks, setPendingManualUnlocks] = useState(null);
    const [pendingClaimTileIndex, setPendingClaimTileIndex] = useState(null);

    // Tile scaling
    const [tileSize, setTileSize] = useState(64);

    // MINES: Animation and penalty tracking
    const [recentMines, setRecentMines] = useState([]);
    const [minePenalty, setMinePenalty] = useState(0);

    // --- For solo mode point tracking (not persisted) ---
    const [soloScorePenalty, setSoloScorePenalty] = useState(0);

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

    // --- Early loading/error states ---
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

    // --- Extract key settings ---
    const isSoloMode = cardData && cardData.mode === "individual";
    const isTeamMode = cardData && (cardData.mode === "teams" || cardData.mode === "multi-claim");
    const perTeamUnlocks = !!cardData.perTeamUnlocks;
    const manualUnlockCount = cardData?.manualUnlockCount || 1;
    const unlockMode = cardData?.unlockMode || "auto";
    const boardSize = cardData.gridSize || cardData.boardSize || 5;
    const teams = cardData.teams || [];
    const mineCount = cardData.mineCount || 0;
    const mineDamage = cardData.mineDamage || 0;

    // --- Login/Password UI ---
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
    if (isTeamMode && !team) {
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

    // --- Team login logic ---
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

    // --- Team scoring ---
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
            // Subtract mine penalties (optional: you can persist penalties in the future)
            return { ...t, score };
        });
    }

    // --- Neighbor helpers (for unlock logic) ---
    function getNeighborIndices(tile, boardSize, neighborMode = "8") {
        const neighbors = [];
        const { row, col } = tile;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                if (neighborMode === "4" && Math.abs(dr) + Math.abs(dc) !== 1) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                    neighbors.push(nr * boardSize + nc);
                }
            }
        }
        return neighbors;
    }

    // Returns eligible locked neighbors (for manual unlock) for THIS team
    function getEligibleLockedNeighbors(tiles, boardSize, neighborMode, teamName) {
        const completedIndices = tiles
            .map((t, i) => {
                if (isTeamMode) {
                    const claimedBy = Array.isArray(t.claimedBy) ? t.claimedBy : t.claimedBy ? [t.claimedBy] : [];
                    if (claimedBy.includes(teamName)) return i;
                    return null;
                } else {
                    if (t.completed) return i;
                    return null;
                }
            })
            .filter(i => i !== null);

        const lockedSet = new Set();
        completedIndices.forEach(idx => {
            const t = tiles[idx];
            const neighbors = getNeighborIndices(t, boardSize, cardData.neighborMode || "8");
            neighbors.forEach(nIdx => {
                if (
                    isTeamMode
                        ? !(Array.isArray(tiles[nIdx].visibleTeams) && tiles[nIdx].visibleTeams.includes(teamName))
                        : !tiles[nIdx].visible
                ) {
                    lockedSet.add(nIdx);
                }
            });
        });
        return Array.from(lockedSet);
    }

    // --- Team switch (captain only) ---
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

    // --- Claim tile logic (auto/manual) ---
    const claimTile = async (tileIndex) => {
        if (!cardData) return;

        const newTiles = [...cardData.tiles];
        const tile = newTiles[tileIndex];

        if (isTeamMode) {
            if (!team || role !== "captain") return;
            // Only claim if visible for this team
            let isVisible = true;
            if (perTeamUnlocks) {
                const visTeams = Array.isArray(tile.visibleTeams) ? tile.visibleTeams : [];
                isVisible = visTeams.includes(team.name);
            } else if (!tile.visible) {
                isVisible = false;
            }
            if (!isVisible) return;

            // Multi-claim: only block if this team already claimed
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
            if (claimedBy.includes(team.name)) return;
            claimedBy.push(team.name);
            if (!visibleTeams.includes(team.name)) visibleTeams.push(team.name);

            newTiles[tileIndex] = {
                ...tile,
                claimedBy,
                visibleTeams,
                completed: true,
            };

            if (unlockMode === "manual") {
                // MANUAL: prompt for neighbors to unlock for THIS team only
                const eligible = getEligibleLockedNeighbors(newTiles, boardSize, cardData.neighborMode || "8", team?.name);
                if (eligible.length === 0) {
                    await confirmManualUnlocks([], tileIndex);
                    return;
                }
                setPendingManualUnlocks({
                    allowed: manualUnlockCount,
                    eligible,
                    selected: eligible.length < manualUnlockCount ? [...eligible] : []
                });
                setPendingClaimTileIndex(tileIndex);
                return;
            }

            // AUTO unlock: neighbors become visible for THIS team only
            if (perTeamUnlocks) {
                const completedIndices = newTiles
                    .map((t, i) => {
                        const tClaimed = Array.isArray(t.claimedBy) ? t.claimedBy : t.claimedBy ? [t.claimedBy] : [];
                        return tClaimed.includes(team?.name) ? i : null;
                    })
                    .filter(i => i !== null);

                completedIndices.forEach((i) => {
                    const t = newTiles[i];
                    const neighbors = getNeighborIndices(t, boardSize, cardData.neighborMode || "8");
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
                // Classic unlock for all teams (rare)
                const completedIndices = newTiles
                    .map((t, i) => t.completed ? i : null)
                    .filter(i => i !== null);
                completedIndices.forEach((i) => {
                    const t = newTiles[i];
                    const neighbors = getNeighborIndices(t, boardSize, cardData.neighborMode || "8");
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
        } else {
            // --- SOLO MODE ---
            if (!tile.visible || tile.completed) return;
            newTiles[tileIndex] = {
                ...tile,
                completed: true,
            };

            if (unlockMode === "manual") {
                const eligible = getEligibleLockedNeighbors(newTiles, boardSize, cardData.neighborMode || "8", null);
                if (eligible.length === 0) {
                    await confirmManualUnlocks([], tileIndex);
                    return;
                }
                setPendingManualUnlocks({
                    allowed: manualUnlockCount,
                    eligible,
                    selected: eligible.length < manualUnlockCount ? [...eligible] : []
                });
                setPendingClaimTileIndex(tileIndex);
                return;
            }
            // --- AUTO UNLOCK LOGIC ---
            const completedIndices = newTiles
                .map((t, i) => t.completed ? i : null)
                .filter(i => i !== null);

            completedIndices.forEach((i) => {
                const t = newTiles[i];
                const neighbors = getNeighborIndices(t, boardSize, cardData.neighborMode || "8");
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

        try {
            await updateDoc(doc(db, "bingoCards", cardId), {
                tiles: newTiles,
                lastUpdated: new Date().toISOString(),
            });
        } catch (error) {
            setLoginError("Failed to claim tile.");
        }
    };

    // --- Manual Unlock Selection Handler (for teams, only unlocks for this team) ---
    async function confirmManualUnlocks(selected = null, claimTileIndex = null) {
        const selectedIndices = selected !== null ? selected : (pendingManualUnlocks ? pendingManualUnlocks.selected : []);
        const claimIdx = claimTileIndex !== null ? claimTileIndex : pendingClaimTileIndex;
        const isTeam = isTeamMode;
        const teamName = team?.name;
        const newTiles = [...cardData.tiles];

        // --- MINE LOGIC ---
        const mineDamage = cardData.mineDamage || 0;
        let minesHit = [];
        selectedIndices.forEach(idx => {
            if (newTiles[idx]?.isMine) minesHit.push(idx);
        });

        // Deduct mineDamage per mine hit, and show animation
        if (minesHit.length > 0) {
            setRecentMines(minesHit);
            setMinePenalty(mineDamage * minesHit.length);
            setTimeout(() => setRecentMines([]), 1600);
            setTimeout(() => setMinePenalty(0), 1800);

            // --- Optional: For teams, you'd update score in DB if you persist penalties. ---
            // For solo, just show a penalty notification.
            if (!isTeam) {
                setSoloScorePenalty((prev) => prev + mineDamage * minesHit.length);
            }
        }

        // Mark the tile just claimed for this team
        if (claimIdx !== null && newTiles[claimIdx]) {
            if (isTeam) {
                let t = newTiles[claimIdx];
                let claimedBy = Array.isArray(t.claimedBy) ? [...t.claimedBy] : t.claimedBy ? [t.claimedBy] : [];
                let visibleTeams = Array.isArray(t.visibleTeams) ? [...t.visibleTeams] : t.visibleTeams ? [t.visibleTeams] : [];
                if (!claimedBy.includes(teamName)) claimedBy.push(teamName);
                if (!visibleTeams.includes(teamName)) visibleTeams.push(teamName);
                newTiles[claimIdx] = {
                    ...t,
                    claimedBy,
                    visibleTeams,
                    completed: true,
                };
            } else {
                newTiles[claimIdx] = { ...newTiles[claimIdx], completed: true };
            }
        }

        // Unlock chosen neighbors for THIS team only
        selectedIndices.forEach(idx => {
            if (isTeam) {
                let nTile = newTiles[idx];
                let nVisTeams = Array.isArray(nTile.visibleTeams) ? [...nTile.visibleTeams] : [];
                if (!nVisTeams.includes(teamName)) nVisTeams.push(teamName);
                newTiles[idx] = { ...nTile, visibleTeams: nVisTeams };
            } else {
                newTiles[idx] = { ...newTiles[idx], visible: true };
            }
        });

        // --- Allow extra unlock per mine triggered ---
        let extraAllowed = 0;
        if (minesHit.length > 0) {
            extraAllowed = minesHit.length;
        }
        if (extraAllowed > 0) {
            // Find all remaining eligible locked neighbors
            const eligible = getEligibleLockedNeighbors(newTiles, boardSize, cardData.neighborMode || "8", isTeam ? teamName : null);
            // Remove any already selected or just unlocked
            const newEligible = eligible.filter(idx => !selectedIndices.includes(idx));
            if (newEligible.length > 0) {
                setPendingManualUnlocks({
                    allowed: extraAllowed,
                    eligible: newEligible,
                    selected: [],
                });
                // Don't clear pendingClaimTileIndex yet!
                return;
            }
        }

        try {
            await updateDoc(doc(db, "bingoCards", cardId), {
                tiles: newTiles,
                lastUpdated: new Date().toISOString(),
            });
        } catch (error) {
            setLoginError("Failed to unlock tiles.");
        }

        setPendingManualUnlocks(null);
        setPendingClaimTileIndex(null);
    }

    // --- Tiles for board (per-team visibility) ---
    function getVisibleTiles() {
        if (!cardData) return [];
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
            return cardData.tiles.map((tile, idx) => ({
                ...tile,
                completed: claimedByTeam(tile),
                visible: Array.isArray(tile.visibleTeams)
                    ? tile.visibleTeams.includes(team.name)
                    : !!tile.visible,
                __index: idx
            }));
        }
        // SOLO MODE
        return cardData.tiles.map((tile, idx) => ({
            ...tile,
            completed: !!tile.completed,
            visible: !!tile.visible,
            __index: idx
        }));
    }

    // Helper: get all claimed teams for a tile (for badges/colors)
    const getClaimedTeams = (tile) => {
        const claimedBy = Array.isArray(tile.claimedBy)
            ? tile.claimedBy
            : tile.claimedBy
                ? [tile.claimedBy]
                : [];
        return claimedBy.map((tn) => teams.find((t) => t.name === tn)).filter(Boolean);
    };

    // Manual unlock: handle tile selection
    const handleManualUnlockSelect = (idx) => {
        if (!pendingManualUnlocks) return;
        if (!pendingManualUnlocks.eligible.includes(idx)) return;
        setPendingManualUnlocks(prev => {
            const already = prev.selected.includes(idx);
            let sel;
            if (already) {
                sel = prev.selected.filter(i => i !== idx);
            } else if (prev.selected.length < prev.allowed) {
                sel = [...prev.selected, idx];
            } else {
                sel = prev.selected;
            }
            return { ...prev, selected: sel };
        });
    };

    // --- Manual unlock confirm logic ---
    const canConfirmManualUnlocks =
        !!pendingManualUnlocks &&
        pendingManualUnlocks.selected.length === Math.min(
            pendingManualUnlocks.allowed,
            pendingManualUnlocks.eligible.length
        );

    // --- Render ---
    return (
        <motion.div
            className="min-h-screen flex flex-col md:flex-row p-0 md:p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ThemeToggle />
            {/* Team sidebar */}
            {isTeamMode && (
                <aside className="w-full md:w-72 flex flex-col gap-4">
                    <h3 className="text-xl font-bold">Team Scores</h3>
                    <div className="flex flex-col gap-2">
                        {getTeamScores().map((t) => (
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
                        Available Tasks ({getVisibleTiles().filter((t) => t.visible && !t.completed).length})
                    </h3>
                    <div className="flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
                        {getVisibleTiles()
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
                    {/* --- Mines Info --- */}
                    {mineCount > 0 && unlockMode === "manual" && (
                        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded px-4 py-2 font-semibold shadow">
                            <span role="img" aria-label="mine">💣</span> Mines on board: <b>{mineCount}</b><br />
                            Bomb damage: <b>{mineDamage}</b> points
                        </div>
                    )}
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
                {/* --- Tile size bar goes here --- */}
                <div className="mb-4 w-full flex flex-row justify-center items-center">
                    <label className="mr-2 font-semibold text-xs text-gray-700 dark:text-gray-400">
                        Tile Size
                    </label>
                    <input
                        type="range"
                        min={40}
                        max={120}
                        value={tileSize}
                        onChange={e => setTileSize(Number(e.target.value))}
                        className="w-32"
                    />
                    <span className="ml-2 text-xs">{tileSize}px</span>
                </div>
                {/* Captain Switch Team Popup */}
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
                {/* Manual unlock UI */}
                {pendingManualUnlocks && (
                    <div className="w-full max-w-md mx-auto mb-3">
                        <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded px-4 py-2 font-semibold text-center mb-2 shadow">
                            Select {pendingManualUnlocks.allowed} tiles to unlock.<br />
                            {mineCount > 0 && (
                                <span className="text-xs text-yellow-900 dark:text-yellow-100">
                                    Beware: mines may be hidden on this board!
                                </span>
                            )}
                        </div>
                        <div className="text-center mb-2">
                            {pendingManualUnlocks.selected.length} / {Math.min(pendingManualUnlocks.allowed, pendingManualUnlocks.eligible.length)} selected
                        </div>
                        <div className="flex justify-center gap-4">
                            <button
                                className={`px-4 py-2 rounded bg-blue-600 text-white font-semibold transition-colors ${canConfirmManualUnlocks ? "hover:bg-blue-700" : "opacity-50 cursor-not-allowed"}`}
                                disabled={!canConfirmManualUnlocks}
                                onClick={() => confirmManualUnlocks()}
                            >
                                Confirm Unlocks
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-gray-400 hover:bg-gray-500 text-white font-semibold"
                                onClick={() => {
                                    setPendingManualUnlocks(null);
                                    setPendingClaimTileIndex(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {/* Penalty Notification */}
                {(minePenalty > 0) && (
                    <div className="mb-3 text-center">
                        <span className="inline-block px-4 py-2 bg-red-700 text-white rounded-lg font-bold text-lg shadow-lg animate-pulse">
                            💥 -{minePenalty} points!
                        </span>
                    </div>
                )}
                {/* Bingo Grid */}
                <div
                    className="grid gap-1"
                    style={{
                        gridTemplateColumns: `repeat(${boardSize}, ${tileSize}px)`,
                        width: "fit-content",
                    }}
                >
                    <AnimatePresence>
                        {getVisibleTiles().map((tile) => {
                            const realIdx = tile.__index;

                            // Manual unlock logic: highlights & click
                            let highlight = null;
                            if (pendingManualUnlocks) {
                                if (pendingManualUnlocks.eligible.includes(realIdx)) {
                                    if (pendingManualUnlocks.selected.includes(realIdx)) {
                                        highlight = "selected";
                                    } else {
                                        highlight = "eligible";
                                    }
                                }
                            }
                            const canUnlock = pendingManualUnlocks && highlight === "eligible";

                            // Multi-claim logic
                            const alreadyClaimedByTeam =
                                isTeamMode && team
                                    ? (Array.isArray(tile.claimedBy)
                                        ? tile.claimedBy.includes(team.name)
                                        : tile.claimedBy === team.name)
                                    : false;

                            // Claim logic
                            const isClaimable =
                                (isTeamMode &&
                                    role === "captain" &&
                                    tile.visible &&
                                    !alreadyClaimedByTeam) ||
                                (!isTeamMode && tile.visible && !tile.completed);

                            // Unified click handler
                            const handleTileClick = () => {
                                if (pendingManualUnlocks) {
                                    if (highlight === "eligible") {
                                        handleManualUnlockSelect(realIdx);
                                    }
                                } else if (isClaimable) {
                                    claimTile(realIdx);
                                }
                            };

                            // Show mine animation if detonated
                            const showMine = recentMines.includes(realIdx);

                            return (
                                <div key={realIdx} className="relative">
                                    <Tile
                                        tile={tile}
                                        tileSize={tileSize}
                                        onClick={handleTileClick}
                                        canUnlock={canUnlock}
                                        claimedTeams={isTeamMode ? getClaimedTeams(tile) : []}
                                        currentTeam={isTeamMode ? team : null}
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
            </div>
        </motion.div>
    );
}