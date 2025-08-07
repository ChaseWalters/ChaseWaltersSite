/* eslint-disable no-unused-vars */
// src/components/SharedBingoCard.jsx
import React, { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { hashString } from "../utils/crypto";
import Tile from "./Tile";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import TaskInfoModal from "./TaskInfoModal";

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

    // Tile scaling and rules
    const [tileSize, setTileSize] = useState(64);
    const [showTeamBadges, setShowTeamBadges] = useState(true);

    // MINES: Animation and penalty tracking
    const [recentMines, setRecentMines] = useState([]);
    const [minePenalty, setMinePenalty] = useState(0);

    const [showEarlyConfirmModal, setShowEarlyConfirmModal] = useState(false);
    const [selectedTile, setSelectedTile] = useState(null);

    const [loginTimestamp, setLoginTimestamp] = useState(null);
    const SESSION_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours in ms
    const [sessionExpired, setSessionExpired] = useState(false);


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

    useEffect(() => {
        function updateTileSize() {
            // Estimate header/controls height (adjust as needed)
            const headerHeight = 140; // e.g., title + controls + some margin
            const availableHeight = window.innerHeight - headerHeight;

            // Board size (number of tiles per row/col)
            // Use cardData.boardSize or default to 5
            const gridSize = cardData?.gridSize || cardData?.boardSize || 5;

            // Calculate tile size
            // Subtract 8px for each gap between tiles (e.g., gap-1 = 0.25rem = 4px)
            // So total gaps = (gridSize - 1) * gap
            const gap = 4;
            const totalGaps = (gridSize - 1) * gap;
            const maxTileSize = Math.floor((availableHeight - totalGaps) / gridSize);

            // Clamp tile size
            const clampedSize = Math.max(40, Math.min(120, maxTileSize));

            setTileSize(clampedSize);
        }

        updateTileSize();
        window.addEventListener("resize", updateTileSize);
        return () => window.removeEventListener("resize", updateTileSize);
    }, [cardData?.gridSize, cardData?.boardSize]);

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

    const visibleTiles = getVisibleTiles ? getVisibleTiles() : [];
    const bombsHit = visibleTiles.filter(t => t.isMine && t.completed).length;
    const minesLeft = mineCount - bombsHit;

    // --- Login/Password UI ---
    if (isSoloMode && !soloAccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-gray-100 dark:bg-gray-900">
                <ThemeToggle />
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Enter Board Password</h2>
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
                                setLoginTimestamp(Date.now());
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
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-gray-100 dark:bg-gray-900">
                <ThemeToggle />
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Team Login</h2>
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

    function getSoloScore() {
        if (!cardData || cardData.mode !== "individual") return 0;
        return cardData.tiles
            .filter(t => t.completed)
            .reduce((sum, t) => sum + (typeof t.task?.value === "number" ? t.task.value : 1), 0);
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
            setLoginTimestamp(Date.now());
            return;
        }
        if (enteredHash === found.memberPasswordHash) {
            setTeam(found);
            setRole("member");
            setLoginTimestamp(Date.now());
            return;
        }
        setLoginError("Incorrect password.");
    }

    // --- Team scoring ---
    function getTeamScores() {
        if (!cardData || !isTeamMode) return [];
        const firstClaimBonus = cardData?.firstClaimBonus ?? 0;
        return (cardData.teams || []).map((t) => {
            let score = 0;
            const claimed = cardData.tiles.filter(tile => {
                const claimedBy = Array.isArray(tile.claimedBy)
                    ? tile.claimedBy
                    : tile.claimedBy
                        ? [tile.claimedBy]
                        : [];
                return claimedBy.includes(t.name);
            });
            claimed.forEach(tile => {
                const claimedBy = Array.isArray(tile.claimedBy)
                    ? tile.claimedBy
                    : tile.claimedBy
                        ? [tile.claimedBy]
                        : [];
                // Add tile value
                score += typeof tile.task?.value === "number" ? tile.task.value : 1;
                // Add first claim bonus ONLY if this team is first to claim, bonus is enabled, and tile is not mine
                if (
                    firstClaimBonus > 0 &&
                    claimedBy.length > 0 &&
                    claimedBy[0] === t.name &&
                    !tile.isMine
                ) {
                    score += firstClaimBonus;
                }
            });
            return { ...t, score };
        });
    }

    // Helper to show first claim bonus in modal
    function getTileFirstClaimBonusInfo(tile) {
        const firstClaimBonus = cardData?.firstClaimBonus ?? 0;
        const claimedBy = Array.isArray(tile.claimedBy)
            ? tile.claimedBy
            : tile.claimedBy
                ? [tile.claimedBy]
                : [];
        if (firstClaimBonus > 0 && claimedBy.length > 0 && !tile.isMine) {
            return {
                firstTeam: claimedBy[0],
                bonus: firstClaimBonus
            };
        }
        return null;
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

        // Session checks
        if (loginTimestamp && Date.now() - loginTimestamp > SESSION_MAX_AGE) {
            setSessionExpired(true);
            return;
        }
        if (!navigator.onLine) {
            setLoginError("You appear to be offline. Please reconnect and try again.");
            setSessionExpired(true);
            return;
        }

        // --- Fetch latest board from Firestore ---
        const cardRef = doc(db, "bingoCards", cardId);
        let latestDoc;
        try {
            latestDoc = await getDoc(cardRef);
        } catch (err) {
            setLoginError("Could not load latest board data.");
            return;
        }
        if (!latestDoc.exists()) {
            setLoginError("Board not found.");
            return;
        }
        const latestBoard = latestDoc.data();
        const newTiles = [...latestBoard.tiles];
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

            // BOMB LOGIC: If team claims a mine, mark as completed, claimed, visible and negative value
            if (tile.isMine) {
                if (!claimedBy.includes(team.name)) claimedBy.push(team.name);
                if (!visibleTeams.includes(team.name)) visibleTeams.push(team.name);
                newTiles[tileIndex] = {
                    ...tile,
                    claimedBy,
                    visibleTeams,
                    completed: true,
                    task: {
                        ...tile.task,
                        value: -mineDamage
                    }
                };
            } else {
                // Normal claim for non-mine
                claimedBy.push(team.name);
                if (!visibleTeams.includes(team.name)) visibleTeams.push(team.name);
                newTiles[tileIndex] = {
                    ...tile,
                    claimedBy,
                    visibleTeams,
                    completed: true,
                };
            }

            if (unlockMode === "manual") {
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
            if (tile.isMine) {
                newTiles[tileIndex] = {
                    ...tile,
                    completed: true,
                    visible: true,
                    task: {
                        ...tile.task,
                        value: -mineDamage
                    }
                };
            } else {
                newTiles[tileIndex] = {
                    ...tile,
                    completed: true,
                    visible: true
                };
            }

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
            await updateDoc(cardRef, {
                tiles: newTiles,
                lastUpdated: new Date().toISOString(),
            });
        } catch (error) {
            setLoginError("Failed to claim tile.");
            setSessionExpired(true);
        }
    };

    // --- Manual Unlock Selection Handler (for teams, only unlocks for this team) ---
    async function confirmManualUnlocks(selected = null, claimTileIndex = null) {
        const selectedIndices = selected !== null ? selected : (pendingManualUnlocks ? pendingManualUnlocks.selected : []);
        const claimIdx = claimTileIndex !== null ? claimTileIndex : pendingClaimTileIndex;
        const isTeam = isTeamMode;
        const teamName = team?.name;
        const newTiles = [...cardData.tiles];
        const mineDamage = cardData.mineDamage || 0;

        // Animate mine hit
        let minesHit = [];
        selectedIndices.forEach(idx => {
            if (newTiles[idx]?.isMine) minesHit.push(idx);
        });
        if (minesHit.length > 0) {
            setRecentMines(minesHit);
            setMinePenalty(mineDamage * minesHit.length);
            setTimeout(() => setRecentMines([]), 1600);
            setTimeout(() => setMinePenalty(0), 1800);
        }

        // Mark the tile just claimed for this team/solo
        if (claimIdx !== null && newTiles[claimIdx]) {
            if (isTeam) {
                let t = newTiles[claimIdx];
                let claimedBy = Array.isArray(t.claimedBy) ? [...t.claimedBy] : t.claimedBy ? [t.claimedBy] : [];
                let visibleTeams = Array.isArray(t.visibleTeams) ? [...t.visibleTeams] : t.visibleTeams ? [t.visibleTeams] : [];
                if (!claimedBy.includes(teamName)) claimedBy.push(teamName);
                if (!visibleTeams.includes(teamName)) visibleTeams.push(teamName);
                // If it's a mine, set value negative
                if (t.isMine) {
                    newTiles[claimIdx] = {
                        ...t,
                        claimedBy,
                        visibleTeams,
                        completed: true,
                        task: {
                            ...t.task,
                            value: -mineDamage
                        }
                    };
                } else {
                    newTiles[claimIdx] = {
                        ...t,
                        claimedBy,
                        visibleTeams,
                        completed: true,
                    };
                }
            } else {
                let t = newTiles[claimIdx];
                // If it's a mine, set value negative
                if (t.isMine) {
                    newTiles[claimIdx] = {
                        ...t,
                        completed: true,
                        visible: true,
                        task: {
                            ...t.task,
                            value: -mineDamage
                        }
                    };
                } else {
                    newTiles[claimIdx] = { ...t, completed: true, visible: true };
                }
            }
        }

        // Unlock chosen neighbors for THIS team only (solo and team)
        if (isTeam) {
            selectedIndices.forEach(idx => {
                let nTile = newTiles[idx];
                let nVisTeams = Array.isArray(nTile.visibleTeams) ? [...nTile.visibleTeams] : nTile.visibleTeams ? [nTile.visibleTeams] : [];
                let nClaimedBy = Array.isArray(nTile.claimedBy) ? [...nTile.claimedBy] : nTile.claimedBy ? [nTile.claimedBy] : [];
                if (!nVisTeams.includes(teamName)) nVisTeams.push(teamName);

                if (nTile.isMine) {
                    if (!nClaimedBy.includes(teamName)) nClaimedBy.push(teamName);
                    newTiles[idx] = {
                        ...nTile,
                        visibleTeams: nVisTeams,
                        claimedBy: nClaimedBy,
                        completed: true,
                        task: {
                            ...nTile.task,
                            value: -mineDamage
                        }
                    };
                } else {
                    newTiles[idx] = { ...nTile, visibleTeams: nVisTeams };
                }
            });
        } else {
            // SOLO
            let allWereMines = true;
            selectedIndices.forEach(idx => {
                let nTile = newTiles[idx];
                if (nTile.isMine) {
                    newTiles[idx] = {
                        ...nTile,
                        visible: true,
                        completed: true,
                        task: {
                            ...nTile.task,
                            value: -mineDamage
                        }
                    };
                } else {
                    allWereMines = false;
                    // Only reveal, don't complete for regular tasks!
                    newTiles[idx] = { ...nTile, visible: true, completed: false };
                }
            });

            // After revealing, check if all picks were mines and if there are tasks left
            // Only allow a "free" extra pick if ALL picks were mines AND user actually picked something
            if (
                selectedIndices.length > 0 &&
                allWereMines &&
                newTiles.some(t => !t.visible && !t.completed && !t.isMine)
            ) {
                // Allow one more pick
                const eligible = newTiles
                    .map((t, idx) => (!t.visible && !t.completed && !t.isMine ? idx : null))
                    .filter(idx => idx !== null);
                if (eligible.length > 0) {
                    setPendingManualUnlocks({
                        allowed: 1,
                        eligible,
                        selected: []
                    });
                    return;
                }
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
    const canConfirmManualUnlocks = !!pendingManualUnlocks; // Always true if in unlock phase

    function renderSoloSidebar() {
        if (!isSoloMode) return null;
        const visibleTiles = getVisibleTiles();
        const visibleTasks = visibleTiles.filter(t => t.visible && !t.completed);

        return (
            <aside className="w-full md:w-72 flex flex-col gap-4">
                <h3 className="text-xl font-bold">Overall Score</h3>
                <div className="p-3 text-2xl font-bold bg-green-100 dark:bg-green-700 rounded text-center shadow">
                    {getSoloScore()}
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
                {mineCount > 0 && unlockMode === "manual" && (
                    <div className="mt-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded px-4 py-2 font-semibold shadow">
                        <span role="img" aria-label="mine">💣</span> Mines left: <b>{minesLeft}</b><br />
                        Bomb damage: <b>{mineDamage}</b> points
                    </div>
                )}
            </aside>
        );
    }

    // --- Render ---
    return (
        <motion.div
            className="h-screen overflow-hidden flex flex-col md:flex-row p-0 md:p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ThemeToggle />
            {isSoloMode ? renderSoloSidebar() : isTeamMode && (
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
                    {/* Mines Info */}
                    {mineCount > 0 && unlockMode === "manual" && (
                        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded px-4 py-2 font-semibold shadow">
                            <span role="img" aria-label="mine">💣</span> Mines left: <b>{minesLeft}</b><br />
                            Bomb damage: <b>{mineDamage}</b> points
                        </div>
                    )}
                </aside>
            )}
            <div className="flex-1 flex flex-col items-center relative">
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
                    <button
                        className={`mr-2 px-1 py-0.5 rounded text-xs border 
        ${showTeamBadges ? "bg-blue-400 text-black-700 border-blue-300" : "bg-gray-100 text-gray-600 border-gray-300"}
        hover:bg-blue-200 hover:text-blue-800 transition`}
                        onClick={() => setShowTeamBadges(v => !v)}
                    >
                        {showTeamBadges ? "Hide Team Badges" : "Show Team Badges"}
                    </button>
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
                                className={`px-4 py-2 rounded bg-blue-600 text-white font-semibold transition-colors ${canConfirmManualUnlocks ? "hover:bg-blue-700" : "opacity-50 cursor-not-allowed"
                                    }`}
                                disabled={!canConfirmManualUnlocks}
                                onClick={() => {
                                    if (
                                        pendingManualUnlocks.selected.length < Math.min(pendingManualUnlocks.allowed, pendingManualUnlocks.eligible.length)
                                    ) {
                                        setShowEarlyConfirmModal(true);
                                    } else {
                                        confirmManualUnlocks();
                                    }
                                }}
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
                {showEarlyConfirmModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-xs w-full text-center">
                            <div className="mb-4 text-lg font-semibold text-red-700 dark:text-red-300">
                                {pendingManualUnlocks.selected.length === 0
                                    ? "No Tiles Selected"
                                    : "Fewer Than Allowed Unlocks"}
                            </div>
                            <div className="mb-4 text-gray-700 dark:text-gray-200">
                                {pendingManualUnlocks.selected.length === 0
                                    ? (
                                        <>
                                            You have not selected any unlocks.<br />
                                            <b>You will not get these unlocks back.</b><br />
                                            Are you sure you want to skip your unlocks?
                                        </>
                                    ) : (
                                        <>
                                            You have selected fewer than the allowed number of unlocks.<br />
                                            <b>You will not get these unlocks back.</b><br />
                                            Are you sure you want to confirm?
                                        </>
                                    )
                                }
                            </div>
                            <div className="flex gap-4 justify-center">
                                <button
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
                                    onClick={() => {
                                        setShowEarlyConfirmModal(false);
                                        confirmManualUnlocks();
                                    }}
                                >
                                    Yes, Confirm
                                </button>
                                <button
                                    className="bg-gray-400 hover:bg-gray-500 text-white rounded px-4 py-2"
                                    onClick={() => setShowEarlyConfirmModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
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
                                } else if (tile.visible) {
                                    setSelectedTile(tile); // Open modal for ANY visible tile
                                }
                            };

                            // Show mine animation if detonated
                            const showMine = recentMines.includes(realIdx);

                            return (
                                <div key={realIdx} className="relative">
                                    <Tile
                                        tile={tile}
                                        tileSize={tileSize}
                                        onClick={() => {
                                            if (pendingManualUnlocks) {
                                                if (highlight === "eligible") {
                                                    handleManualUnlockSelect(realIdx);
                                                }
                                            } else if (tile.visible) {
                                                setSelectedTile(tile);
                                            }
                                        }}
                                        canUnlock={canUnlock}
                                        claimedTeams={isTeamMode ? getClaimedTeams(tile) : []}
                                        currentTeam={isTeamMode ? team : null}
                                        showTeamBadges={showTeamBadges}
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
            {(isTeamMode || isSoloMode) && (
                <aside className="w-full md:w-72 flex flex-col gap-4 md:ml-6 h-screen pb-8">
                    <h3 className="text-xl font-bold py-2">
                        Available Tasks ({getVisibleTiles().filter((t) => t.visible && !t.completed).length})
                    </h3>
                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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
                </aside>
            )}
            {selectedTile && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
                    onClick={() => setSelectedTile(null)}
                    tabIndex={-1}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="max-w-xs w-full"
                    >
                        <TaskInfoModal
                            tile={selectedTile}
                            claimedTeams={isTeamMode ? getClaimedTeams(selectedTile) : []}
                            firstClaimBonusInfo={isTeamMode ? getTileFirstClaimBonusInfo(selectedTile) : null}
                            canClaim={
                                (!isTeamMode && selectedTile.visible && !selectedTile.completed)
                                || (isTeamMode && team && role === "captain" && selectedTile.visible &&
                                    !(
                                        Array.isArray(selectedTile.claimedBy)
                                            ? selectedTile.claimedBy.includes(team.name)
                                            : selectedTile.claimedBy === team.name
                                    )
                                )
                            }
                            onClaim={() => {
                                claimTile(selectedTile.__index);
                                setSelectedTile(null);
                            }}
                            onClose={() => setSelectedTile(null)}
                        />
                    </div>
                </div>
            )}
            {sessionExpired && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg text-center">
                        <h2 className="text-xl font-bold mb-2 text-red-600 dark:text-red-400">Session Expired</h2>
                        <p className="mb-4 text-gray-700 dark:text-gray-200">
                            Your session has expired (over 24 hours). Please log in again to continue.
                        </p>
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
                            onClick={() => {
                                setTeam(null);
                                setSoloAccess(false);
                                setLoginTimestamp(null);
                                setSessionExpired(false);
                            }}
                        >
                            Log In Again
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}