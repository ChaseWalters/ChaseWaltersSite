/* eslint-disable no-unused-vars */
// src/components/SharedBingoCard.jsx
import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
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

    useEffect(() => {
        const cardRef = doc(db, "bingoCards", cardId);
        const unsubscribe = onSnapshot(cardRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setCardData(docSnapshot.data());
            } else {
                setCardData(null);
            }
        });
        return () => unsubscribe();
    }, [cardId]);

    // Login for team/captain/member
    const handleLogin = async () => {
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
    };

    // Helper: Given a tile (with row, col) and boardSize, return indices of adjacent neighbors (8-way)
    const getNeighborIndices = (tile, boardSize) => {
        const neighbors = [];
        const { row, col } = tile;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                    neighbors.push(nr * boardSize + nc);
                }
            }
        }
        return neighbors;
    };

    // Claim tile logic for this team (captain only)
    const claimTile = async (tileIndex) => {
        if (!cardData || !team) return;
        if (role !== "captain") return; // Only captains can claim

        const mode = cardData.mode || "single-claim";
        const boardSize = cardData.gridSize || 5;
        const newTiles = [...cardData.tiles];
        const tile = newTiles[tileIndex];

        if (!tile.visible) return;
        if (mode === "multi-claim") {
            if (Array.isArray(tile.claimedBy) && tile.claimedBy.includes(team.name)) return;
            newTiles[tileIndex] = {
                ...tile,
                claimedBy: [...(tile.claimedBy || []), team.name],
                completed: true,
            };
        } else {
            if (tile.claimedBy) return;
            newTiles[tileIndex] = {
                ...tile,
                claimedBy: team.name,
                completed: true,
            };
        }

        // --- NEW UNLOCK LOGIC: unlock neighbors of all completed tiles for this team
        // Find all indices of completed tiles for this team
        const completedIndices = newTiles
            .map((t, i) => {
                let completed = false;
                if (mode === "multi-claim") {
                    completed = Array.isArray(t.claimedBy) && t.claimedBy.includes(team.name);
                } else {
                    completed = t.claimedBy === team.name;
                }
                return completed ? i : null;
            })
            .filter(i => i !== null);

        // For each completed tile, unlock all invisible neighbors
        completedIndices.forEach((i) => {
            const t = newTiles[i];
            const neighbors = getNeighborIndices(t, boardSize);
            neighbors.forEach(nIdx => {
                if (nIdx >= 0 && nIdx < newTiles.length && !newTiles[nIdx].visible) {
                    newTiles[nIdx] = {
                        ...newTiles[nIdx],
                        visible: true,
                    };
                }
            });
        });

        try {
            await updateDoc(doc(db, "bingoCards", cardId), {
                tiles: newTiles,
                lastUpdated: new Date().toISOString(),
            });
        } catch (error) {
            setLoginError("Failed to claim tile.");
        }
    };

    // Only show tiles claimed/unlocked by this team
    function getVisibleTilesForTeam() {
        if (!cardData || !team) return [];
        const mode = cardData.mode || "single-claim";
        return cardData.tiles.map((tile) => {
            let completed = false;
            if (mode === "multi-claim") {
                completed = Array.isArray(tile.claimedBy) && tile.claimedBy.includes(team.name);
            } else {
                completed = tile.claimedBy === team.name;
            }
            return {
                ...tile,
                completed,
                visible: tile.visible,
            };
        });
    }

    function getTeamScores() {
        if (!cardData) return [];
        const mode = cardData.mode || "single-claim";
        return (cardData.teams || []).map((t) => {
            const claimed = cardData.tiles.filter(tile => {
                if (mode === "multi-claim") return Array.isArray(tile.claimedBy) && tile.claimedBy.includes(t.name);
                return tile.claimedBy === t.name;
            });
            const score = claimed.reduce((sum, tile) => sum + (tile.task?.value || 1), 0);
            return { ...t, score };
        });
    }

    // Captain: switch team logic
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

    // Login UI
    if (!team) {
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

    const boardSize = cardData.gridSize || 5;
    const mode = cardData.mode || "single-claim";
    const teams = cardData.teams || [];
    const teamScores = getTeamScores();
    const visibleTiles = getVisibleTilesForTeam();

    return (
        <motion.div
            className="min-h-screen flex flex-col md:flex-row p-0 md:p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ThemeToggle />
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
                            {t.name === team.name && (
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
            <div className="flex-1 flex flex-col items-center">
                <motion.h2
                    className="text-2xl font-bold mb-4"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
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
                        <>
                            <button
                                className="ml-4 px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs"
                                onClick={() => setShowSwitch(true)}
                            >
                                Switch Team
                            </button>
                        </>
                    )}
                </motion.h2>
                {showSwitch && (
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
                                        if (role === "captain" && tile.visible && !tile.completed) {
                                            claimTile(index);
                                        }
                                    }}
                                />
                                {tile.claimedBy && (
                                    <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap">
                                        {mode === "multi-claim"
                                            ? (Array.isArray(tile.claimedBy) ? tile.claimedBy : []).map((tn, i) => {
                                                const t = teams.find(tt => tt.name === tn);
                                                return (
                                                    <span
                                                        key={tn}
                                                        className="px-1 py-0.5 rounded text-xs"
                                                        style={{
                                                            background: t?.color || "#eee",
                                                            color: "#fff",
                                                            border: "1px solid #000",
                                                        }}
                                                    >
                                                        {tn}
                                                    </span>
                                                );
                                            })
                                            : (() => {
                                                const t = teams.find(tt => tt.name === tile.claimedBy);
                                                return (
                                                    <span
                                                        className="px-1 py-0.5 rounded text-xs"
                                                        style={{
                                                            background: t?.color || "#eee",
                                                            color: "#fff",
                                                            border: "1px solid #000",
                                                        }}
                                                    >
                                                        {tile.claimedBy}
                                                    </span>
                                                );
                                            })()
                                        }
                                    </div>
                                )}
                            </div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}