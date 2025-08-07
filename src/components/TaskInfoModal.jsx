/* eslint-disable no-unused-vars */
import React from "react";

export default function TaskInfoModal({ tile, claimedTeams = [], firstClaimBonusInfo = null, canClaim, onClaim, onClose }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-xs w-full">
            <h3 className="text-xl font-bold mb-2">
                {tile.task?.name || (tile.isMine ? "Mine!" : "Task")}
            </h3>
            <div className="mb-2 text-gray-700 dark:text-gray-200">
                {tile.task?.description}
            </div>
            {tile.isMine ? (
                <div className="text-red-600 font-bold text-lg mb-2">
                    💣 Mine! {tile.task?.value ? `Penalty: ${tile.task.value}` : ""}
                </div>
            ) : (
                <div className="mb-2 text-gray-700 dark:text-gray-200">
                    <span className="font-bold">Value:</span> {tile.task?.value ?? 1}
                </div>
            )}
            <div className="mb-2">
                <span className="font-bold">Claimed by:</span>
                <div className="flex flex-col gap-1 mt-1">
                    {claimedTeams.length === 0 && <span className="text-gray-500">Unclaimed</span>}
                    {claimedTeams.map((t, idx) => (
                        <span
                            key={t.name}
                            className="rounded px-2 py-1 font-semibold flex items-center"
                            style={{
                                background: t.color,
                                color: "#fff",
                                fontWeight: idx === 0 ? 700 : 500,
                                fontSize: idx === 0 ? "1em" : "0.95em"
                            }}
                        >
                            {t.name}
                            {firstClaimBonusInfo &&
                                idx === 0 &&
                                firstClaimBonusInfo.firstTeam === t.name &&
                                !tile.isMine && (
                                    <span className="ml-2 bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded text-xs font-bold">
                                        +{firstClaimBonusInfo.bonus}
                                    </span>
                                )}
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex gap-3 mt-4 justify-end">
                {canClaim && (
                    <button
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
                        onClick={onClaim}
                    >
                        Claim
                    </button>
                )}
                <button
                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded font-semibold"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
}