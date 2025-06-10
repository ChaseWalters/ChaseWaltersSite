// src/components/SharedBoard.jsx
import React from "react";
import { useParams } from "react-router-dom";
import SharedBingoCard from "./SharedBingoCard";

export default function SharedBoard() {
    const { cardId } = useParams();
    return (
        // Removed the p-4 here to avoid extra white padding.
        <div className="min-h-screen">
            <SharedBingoCard cardId={cardId} />
        </div>
    );
}
