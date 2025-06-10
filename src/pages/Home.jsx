// src/pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center p-6">
            <h1 className="text-4xl font-bold">Welcome to Task Bingo 🎯</h1>
            <p className="text-lg max-w-xl text-gray-700">
                Complete tasks and unlock the board like Minesweeper! Choose your board size, task difficulty, and get productive with a gamified twist.
            </p>
            <button
                onClick={() => navigate("/game")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-4 text-lg"
            >
                Start Game
            </button>
        </div>
    );
}
