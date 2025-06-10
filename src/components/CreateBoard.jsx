// src/components/CreateBoard.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Helper: Creates an initial array of tiles (example: a 5x5 board)
function createInitialTiles() {
    const tiles = [];
    const gridSize = 5; // you can also let the user choose this
    for (let i = 0; i < gridSize * gridSize; i++) {
        tiles.push({
            task: { name: `Task ${i + 1}`, difficulty: 1, value: 1 },
            claimed: false,
            claimedBy: null,
            row: Math.floor(i / gridSize),
            col: i % gridSize,
        });
    }
    return tiles;
}

export default function CreateBoard() {
    const [boardPassword, setBoardPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const createNewBoard = async () => {
        setLoading(true);
        try {
            // Generate a random board ID.
            const boardId = Math.random().toString(36).substr(2, 9);
            const newBoard = {
                cardId: boardId,
                boardPassword: boardPassword || "defaultPassword",
                mode: "individual",
                teams: [],
                tiles: createInitialTiles(),
                lastUpdated: new Date().toISOString(),
                createdAt: serverTimestamp(),
            };

            // Create the new board document in Firestore.
            await setDoc(doc(db, "bingoCards", boardId), newBoard);
            setLoading(false);

            // Navigate to the shareable board view (e.g., /shared/:cardId).
            navigate(`/shared/${boardId}`);
        } catch (err) {
            console.error("Error creating board:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-2xl font-bold">Create a New Board</h2>
            <label className="flex flex-col gap-1">
                <span className="font-medium">Board Password (for editing):</span>
                <input
                    type="text"
                    value={boardPassword}
                    onChange={(e) => setBoardPassword(e.target.value)}
                    placeholder="Enter a board password (optional)"
                    className="p-2 border rounded bg-white text-black"
                />
            </label>
            <button
                onClick={createNewBoard}
                disabled={loading}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-3"
            >
                {loading ? "Creating Board..." : "Create Board"}
            </button>
            {error && <p className="text-red-500">{error}</p>}
        </div>
    );
}
