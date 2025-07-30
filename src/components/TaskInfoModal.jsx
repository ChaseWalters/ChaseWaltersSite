import React from "react";

export default function TaskInfoModal({ tile, claimedTeams, canClaim, onClaim, onClose }) {
    const task = tile.task || {};
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={onClose}
        >
            <div
                className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full"
                onClick={e => e.stopPropagation()} // Prevents closing modal when clicking inside card
            >
                <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
                    onClick={onClose}
                >×</button>
                <h2 className="text-xl font-bold mb-2">{task.name || "No Task"}</h2>
                <p className="mb-2 text-gray-700 dark:text-gray-300">{task.description || "No description"}</p>
                <div className="mb-2 text-sm">
                    <div>Difficulty: {task.difficulty ?? "N/A"}</div>
                    <div>Value: {task.value ?? 1}</div>
                </div>
                <div className="mb-3">
                    <span className="font-semibold">Claimed by:</span>
                    {claimedTeams.length === 0
                        ? <span className="ml-1 text-gray-500">No one</span>
                        : claimedTeams.map(team => (
                            <span
                                key={team.name}
                                className="inline-block ml-2 px-2 py-0.5 rounded text-white text-xs"
                                style={{ background: team.color }}>{team.name}</span>
                        ))}
                </div>
                {canClaim && (
                    <button
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
                        onClick={onClaim}
                    >Claim This Tile</button>
                )}
            </div>
        </div>
    );
}