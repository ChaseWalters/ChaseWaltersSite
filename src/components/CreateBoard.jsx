/* eslint-disable no-unused-vars */
// src/components/CreateBoard.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { hashString } from "../utils/crypto";

// Helper: Creates an initial array of tiles (example: a 5x5 board)
function createInitialTiles(gridSize, mode, teams) {
    const tiles = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
        tiles.push({
            task: { name: `Task ${i + 1}`, difficulty: 1, value: 1 },
            claimedBy: mode === "multi-claim" ? [] : null,
            completed: false,
            visible: true,
            row: Math.floor(i / gridSize),
            col: i % gridSize,
        });
    }
    return tiles;
}

const TEAM_COLORS = [
    "#e53e3e", // red
    "#3182ce", // blue
    "#38a169", // green
    "#d69e2e", // yellow
    "#805ad5", // purple
    "#dd6b20", // orange
];

export default function CreateBoard() {
    const [boardPassword, setBoardPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState("single-claim");
    const [gridSize, setGridSize] = useState(5);

    const [unlockMode, setUnlockMode] = useState("auto"); // "auto" or "manual"
    const [neighborMode, setNeighborMode] = useState("8"); // "4" or "8"

    // Teams state: array of { name, color, captain, password, passwordHash (temp for UI), memberPassword }
    const [teams, setTeams] = useState([
        { name: "Red", color: TEAM_COLORS[0], captain: "", password: "", memberPassword: "" },
        { name: "Blue", color: TEAM_COLORS[1], captain: "", password: "", memberPassword: "" },
    ]);

    const navigate = useNavigate();

    // Add or remove teams
    const addTeam = () => {
        setTeams((prev) => [
            ...prev,
            {
                name: "",
                color: TEAM_COLORS[prev.length % TEAM_COLORS.length],
                captain: "",
                password: "",
                memberPassword: "",
            },
        ]);
    };
    const removeTeam = (idx) => {
        setTeams((prev) => prev.filter((_, i) => i !== idx));
    };

    // Handle team field changes
    const handleTeamChange = (idx, field, value) => {
        setTeams((prev) =>
            prev.map((team, i) =>
                i === idx ? { ...team, [field]: value } : team
            )
        );
    };

    // Create board handler
    const createNewBoard = async () => {
        setLoading(true);
        setError(null);
        try {
            if (teams.length < 2) throw new Error("At least 2 teams required.");
            for (const team of teams) {
                if (!team.name.trim() || !team.captain.trim() || !team.password.trim() || !team.memberPassword.trim()) {
                    throw new Error(
                        "Each team needs a name, captain, and both passwords."
                    );
                }
            }

            const boardId = Math.random().toString(36).substr(2, 9);

            // Hash team passwords
            const teamsWithHash = await Promise.all(
                teams.map(async (team) => ({
                    name: team.name.trim(),
                    color: team.color,
                    captain: team.captain.trim(),
                    passwordHash: await hashString(team.password),
                    memberPasswordHash: await hashString(team.memberPassword),
                }))
            );

            // Hash the board password (optional)
            let boardPasswordHash = null;
            if (boardPassword && boardPassword.trim()) {
                boardPasswordHash = await hashString(boardPassword.trim());
            }

            const newBoard = {
                cardId: boardId,
                mode,
                gridSize,
                teams: teamsWithHash,
                tiles: createInitialTiles(gridSize, mode, teamsWithHash),
                lastUpdated: new Date().toISOString(),
                createdAt: serverTimestamp(),
                boardPasswordHash,
                unlockMode,    // <--- Added!
                neighborMode,  // <--- Added!
            };

            await setDoc(doc(db, "bingoCards", boardId), newBoard);
            setLoading(false);
            navigate(`/shared/${boardId}`);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-2xl font-bold">Create a New Team Board</h2>
            <div className="flex flex-col gap-2 w-full max-w-lg bg-white dark:bg-gray-700 p-4 rounded shadow">
                <label className="flex flex-col gap-1">
                    <span className="font-medium">Claim Mode:</span>
                    <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="p-2 border rounded bg-white text-black"
                    >
                        <option value="single-claim">
                            Only one team can claim each tile
                        </option>
                        <option value="multi-claim">
                            Multiple teams can claim the same tile
                        </option>
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="font-medium">Board Size:</span>
                    <input
                        type="number"
                        min={3}
                        max={15}
                        step={1}
                        value={gridSize}
                        onChange={(e) =>
                            setGridSize(Math.max(3, Math.min(15, Number(e.target.value) || 5)))
                        }
                        className="p-2 border rounded bg-white text-black"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="font-medium">
                        Board Password (for board editing, optional):
                    </span>
                    <input
                        type="text"
                        value={boardPassword}
                        onChange={(e) => setBoardPassword(e.target.value)}
                        placeholder="Enter a board password (optional)"
                        className="p-2 border rounded bg-white text-black"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="font-medium">Unlock Mode:</span>
                    <select
                        value={unlockMode}
                        onChange={(e) => setUnlockMode(e.target.value)}
                        className="p-2 border rounded bg-white text-black"
                    >
                        <option value="auto">Auto-unlock neighbors (classic)</option>
                        <option value="manual">Manual: pick one tile to unlock after claim</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="font-medium">Neighbor Mode for Unlock:</span>
                    <select
                        value={neighborMode}
                        onChange={(e) => setNeighborMode(e.target.value)}
                        className="p-2 border rounded bg-white text-black"
                    >
                        <option value="8">8-direction (N, NE, E, SE, S, SW, W, NW)</option>
                        <option value="4">4-direction (N, E, S, W only)</option>
                    </select>
                </label>
                <hr className="my-2" />
                <h3 className="font-semibold mb-2">Teams</h3>
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
                            onChange={(e) =>
                                handleTeamChange(idx, "name", e.target.value)
                            }
                            className="flex-1 p-2 border rounded"
                        />
                        <input
                            type="color"
                            value={team.color}
                            onChange={(e) =>
                                handleTeamChange(idx, "color", e.target.value)
                            }
                            className="w-10 h-10"
                            style={{ background: team.color }}
                            title="Team color"
                        />
                        <input
                            type="text"
                            placeholder="Captain"
                            value={team.captain}
                            onChange={(e) =>
                                handleTeamChange(idx, "captain", e.target.value)
                            }
                            className="flex-1 p-2 border rounded"
                        />
                        <input
                            type="password"
                            placeholder="Captain Password"
                            value={team.password}
                            onChange={(e) =>
                                handleTeamChange(idx, "password", e.target.value)
                            }
                            className="flex-1 p-2 border rounded"
                        />
                        <input
                            type="password"
                            placeholder="Team Member Password"
                            value={team.memberPassword}
                            onChange={(e) =>
                                handleTeamChange(idx, "memberPassword", e.target.value)
                            }
                            className="flex-1 p-2 border rounded"
                        />
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
                <button
                    onClick={createNewBoard}
                    disabled={loading}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-3"
                >
                    {loading ? "Creating Board..." : "Create Board"}
                </button>
                {error && <p className="text-red-500">{error}</p>}
            </div>
        </div>
    );
}