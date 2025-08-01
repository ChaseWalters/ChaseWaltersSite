﻿/* eslint-disable no-unused-vars */
import React from "react";
import { motion } from "framer-motion";

const tileVariants = {
    hidden: { opacity: 0, scale: 0.6 },
    visible: { opacity: 1, scale: 1 },
};

const Tile = ({ tile, onClick, claimedTeams = [], canUnlock = false, tileSize = 64, currentTeam }) => {
    const badgeSize = Math.max(18, Math.round(tileSize * 0.22)); // 18px minimum, ~22% of tile

    // Font size for task text (scales with tileSize, clamped for readability)
    const mainFontSize = `clamp(0.55rem, ${tileSize * 0.22}px, 1.1rem)`;
    // Font size for bomb emoji (bigger)
    const bombFontSize = `clamp(1.3em, ${tileSize * 0.6}px, 2.2em)`;

    // 1. Manual unlock: eligible hidden tile
    if (!tile.visible && canUnlock) {
        return (
            <motion.button
                variants={tileVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.2 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onClick(tile)}
                className="relative rounded-lg border-4 border-yellow-400 bg-yellow-50 flex items-center justify-center text-center select-none shadow font-bold text-yellow-800"
                style={{
                    width: tileSize,
                    height: tileSize,
                    minWidth: tileSize,
                    minHeight: tileSize,
                    maxWidth: tileSize,
                    maxHeight: tileSize,
                    aspectRatio: "1 / 1",
                    fontSize: "2rem",
                    cursor: "pointer",
                }}
                aria-label="Unlock this tile"
            >
                ?
            </motion.button>
        );
    }

    // 2. Standard hidden tile (not unlockable)
    if (!tile.visible) {
        return (
            <motion.div
                className="aspect-square rounded-lg border bg-gray-800 border-gray-700 cursor-not-allowed"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                style={{
                    width: tileSize,
                    height: tileSize,
                    minWidth: tileSize,
                    minHeight: tileSize,
                    maxWidth: tileSize,
                    maxHeight: tileSize,
                }}
                aria-label="Hidden tile"
            />
        );
    }

    // 3. Visible tile (can show task, badges, etc)
    // Find if our team claimed it, for color
    let ourColor = undefined;
    if (currentTeam && Array.isArray(tile.claimedBy) && tile.claimedBy.includes(currentTeam.name)) {
        ourColor = currentTeam.color;
    }
    if (currentTeam && tile.claimedBy === currentTeam.name) {
        ourColor = currentTeam.color;
    }

    return (
        <motion.button
            variants={tileVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.25 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onClick(tile)}
            //disabled={tile.completed && !canUnlock}
            className={`relative rounded-lg border overflow-hidden flex items-center justify-center text-center select-none transition-colors duration-150
                ${tile.completed
                    ? ourColor
                        ? ""
                        : "bg-green-500 text-white border-green-600"
                    : "bg-white text-black hover:bg-blue-50 border-gray-300"
                }`}
            style={{
                width: tileSize,
                height: tileSize,
                minWidth: tileSize,
                minHeight: tileSize,
                maxWidth: tileSize,
                maxHeight: tileSize,
                aspectRatio: "1 / 1",
                padding: 2,
                background: tile.completed && ourColor ? ourColor : undefined,
                color: tile.completed && ourColor ? "#fff" : undefined,
                borderColor: tile.completed && ourColor ? ourColor : undefined,
            }}
        >
            <span
                className="block w-full overflow-hidden text-center leading-tight line-clamp-3 break-words px-1"
                style={{
                    fontSize: tile.completed && tile.isMine
                        ? bombFontSize
                        : mainFontSize,
                    fontWeight: tile.completed && tile.isMine ? 600 : 500,
                    paddingTop: `${Math.max(5, tileSize * 0.1)}px`, // Small dynamic buffer (min 2px)
                    paddingBottom: `${Math.max(5, tileSize * 0.1)}px`, // Small dynamic buffer (min 2px)
                }}
            >
                {(tile.completed && tile.isMine)
                    ? <span style={{ fontSize: bombFontSize }} role="img" aria-label="Bomb">💣</span>
                    : tile.task?.name
                }
            </span>
            {/* Checkmark overlay for completed */}
            {tile.completed && (
                <svg
                    className="absolute top-1 right-1 w-4 h-4 text-white opacity-80 pointer-events-none"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.293a1 1 0 111.414-1.414l4.364 4.364 6.657-6.657a1 1 0 011.414 0z"
                        clipRule="evenodd"
                    />
                </svg>
            )}
            {/* Claimed team badges (if any) */}
            {claimedTeams.length > 0 && (
                <div
                    className="absolute bottom-1 left-1 flex flex-row flex-wrap gap-1 z-10 max-w-full"
                    style={{
                        maxWidth: tileSize - 3,
                    }}
                >
                    {claimedTeams.slice(0, 3).map((ct, i) => (
                        <span
                            key={ct.name}
                            className="rounded text-xs px-1 py-0.5"
                            style={{
                                minWidth: badgeSize,
                                maxWidth: badgeSize * 2,
                                fontSize: Math.max(9, badgeSize * 0.55),
                                background: ct.color || "#eee",
                                color: "#fff",
                                border: "1px solid #000",
                                fontWeight: 600,
                                textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={ct.name}
                        >
                            {ct.name.length > 6 ? ct.name.slice(0, 6) + '…' : ct.name}
                        </span>
                    ))}
                    {claimedTeams.length > 3 && (
                        <span
                            className="rounded text-xs px-1 py-0.5 bg-gray-600 border border-black"
                            style={{
                                minWidth: badgeSize,
                                fontSize: Math.max(9, badgeSize * 0.55),
                                color: "#fff",
                            }}
                            title={claimedTeams.slice(3).map(ct => ct.name).join(", ")}
                        >
                            +{claimedTeams.length - 3}
                        </span>
                    )}
                </div>
            )}
        </motion.button>
    );
};

export default Tile;