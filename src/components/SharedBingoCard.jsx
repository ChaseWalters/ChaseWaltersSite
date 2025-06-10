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
    const [authorized, setAuthorized] = useState(false); // to track password authorization
    const navigate = useNavigate();

    useEffect(() => {
        const cardRef = doc(db, "bingoCards", cardId);
        const unsubscribe = onSnapshot(
            cardRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setCardData(docSnapshot.data());
                } else {
                    console.error("Document does not exist!");
                }
            },
            (error) => {
                console.error("Error with onSnapshot:", error);
            }
        );
        return () => unsubscribe();
    }, [cardId]);

    // If not authorized yet and boardPassword exists, prompt the user.
    const ensureAuthorization = async () => {
        if (cardData?.boardPasswordHash) {
            const input = window.prompt("Enter the board password to unlock this tile:");
            const inputHash = await hashString(input);
            if (inputHash === cardData.boardPasswordHash) {
                setAuthorized(true);
                return true;
            } else {
                alert("Incorrect password!");
                return false;
            }
        }
        return true;
    };

    // Helper: Given a tile (with row, col) and boardSize, return indices of adjacent neighbors.
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

    const claimTile = async (tileIndex) => {
        if (!cardData) return;
        // If not authorized, prompt for the password.
        if (!authorized) {
            const authResult = await ensureAuthorization();
            if (!authResult) return;
        }
        const newTiles = [...cardData.tiles];
        const boardSize = cardData.boardSize || 9;
        const tile = newTiles[tileIndex];

        if (!tile.visible) {
            console.warn(`Tile ${tileIndex} is locked.`);
            return;
        }
        if (tile.completed) {
            console.warn(`Tile ${tileIndex} is already completed.`);
            return;
        }

        // Mark the tile as completed.
        newTiles[tileIndex] = {
            ...tile,
            completed: true,
            // Remove claimedBy field entirely (or leave it out)
        };

        // Unlock adjacent neighbors (3x3 grid around the tile)
        const neighborIndices = getNeighborIndices(tile, boardSize);
        neighborIndices.forEach((nIndex) => {
            if (nIndex >= 0 && nIndex < newTiles.length) {
                if (!newTiles[nIndex].visible) {
                    newTiles[nIndex] = {
                        ...newTiles[nIndex],
                        visible: true,
                    };
                }
            }
        });

        // Update score: add this tile's value
        const currentScore = cardData.score || 0;
        const tileValue = tile.task?.value || 1;
        const newScore = currentScore + tileValue;

        try {
            await updateDoc(doc(db, "bingoCards", cardId), {
                tiles: newTiles,
                score: newScore,
                lastUpdated: new Date().toISOString(),
            });
            console.log(`Tile ${tileIndex} claimed`);
        } catch (error) {
            console.error("Error claiming tile:", error);
        }
    };

    if (!cardData) {
        return <p>Loading board...</p>;
    }

    const boardSize = cardData.boardSize || 9;

    return (
        // Removed extra padding by using p-0 at base.
        <motion.div
            className="min-h-screen flex flex-col md:flex-row p-0 md:p-4 gap-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
                    Score: {cardData.score || 0}
                </motion.h2>
                <div
                    className="grid gap-1"
                    style={{
                        gridTemplateColumns: `repeat(${boardSize}, 64px)`,
                        width: "fit-content",
                    }}
                >
                    <AnimatePresence>
                        {cardData.tiles.map((tile, index) => (
                            <Tile
                                key={`${Math.floor(index / boardSize)}-${index % boardSize}`}
                                tile={tile}
                                onClick={() => {
                                    if (tile.visible && !tile.completed) {
                                        claimTile(index);
                                    }
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            <aside className="w-full md:w-72 flex flex-col gap-4">
                <h3 className="text-xl font-bold">
                    Available Tasks (
                    {cardData.tiles.filter((t) => t.visible && !t.completed).length})
                </h3>
                <div className="flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
                    {cardData.tiles
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
        </motion.div>
    );
}
