import React from "react";

export default function TaskInfoModal({ tile, claimedTeams, canClaim, onClaim, onClose }) {
    const task = tile.task || {};
    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={onClose}
        >
            <div
                className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full"
                onClick={e => e.stopPropagation()}
            >
                <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold mb-2">
                    {tile.isMine ? "BOMB" : (task.name || "No Task")}
                </h2>
                <p className="mb-2 text-gray-700 dark:text-gray-300">
                    {tile.isMine ? "Don't step on these" : (task.description || "No description")}
                </p>
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