// Test file to verify first claim bonus logic
// This simulates the exact logic used in SharedBingoCard.jsx

// Mock card data with first claim bonus
const mockCardData = {
    mode: "teams",
    firstClaimBonus: 2, // 2 points for first claim
    teams: [
        { name: "Red", color: "#e53e3e" },
        { name: "Blue", color: "#3182ce" },
        { name: "Green", color: "#38a169" }
    ],
    tiles: [
        // Tile 0: Red claimed first, Blue claimed second
        {
            claimedBy: ["Red", "Blue"],
            task: { value: 5 }
        },
        // Tile 1: Blue claimed first only
        {
            claimedBy: ["Blue"],
            task: { value: 3 }
        },
        // Tile 2: Green claimed first, Red claimed second
        {
            claimedBy: ["Green", "Red"],
            task: { value: 4 }
        },
        // Tile 3: Red claimed first only
        {
            claimedBy: ["Red"],
            task: { value: 2 }
        },
        // Tile 4: Not claimed by anyone
        {
            claimedBy: [],
            task: { value: 1 }
        }
    ]
};

// Replicate the getTeamScores function logic
function getTeamScores(cardData) {
    if (!cardData || cardData.mode !== "teams") return [];
    const firstClaimBonus = cardData.firstClaimBonus || 0;
    
    return (cardData.teams || []).map((t) => {
        const claimed = cardData.tiles.filter(tile => {
            const claimedBy = Array.isArray(tile.claimedBy)
                ? tile.claimedBy
                : tile.claimedBy
                    ? [tile.claimedBy]
                    : [];
            return claimedBy.includes(t.name);
        });
        
        let score = claimed.reduce((sum, tile) => sum + (typeof tile.task?.value === "number" ? tile.task.value : 1), 0);
        
        // Add first claim bonus if enabled
        if (firstClaimBonus > 0) {
            const firstClaims = claimed.filter(tile => {
                const claimedBy = Array.isArray(tile.claimedBy)
                    ? tile.claimedBy
                    : tile.claimedBy
                        ? [tile.claimedBy]
                        : [];
                return claimedBy.length > 0 && claimedBy[0] === t.name;
            });
            score += firstClaims.length * firstClaimBonus;
        }
        
        return { ...t, score };
    });
}

// Test cases
console.log("Testing First Claim Bonus Logic");
console.log("================================");

// Test 1: With first claim bonus enabled (2 points)
console.log("\nTest 1: First claim bonus = 2 points");
const scores = getTeamScores(mockCardData);
scores.forEach(team => {
    console.log(`${team.name}: ${team.score} points`);
});

// Expected results:
// Red: Claims tiles 0 (5 pts), 2 (4 pts), 3 (2 pts) = 11 pts base
//      First claims: tile 0, tile 3 = 2 tiles × 2 bonus = 4 bonus
//      Total: 11 + 4 = 15 points
// Blue: Claims tiles 0 (5 pts), 1 (3 pts) = 8 pts base
//       First claims: tile 1 = 1 tile × 2 bonus = 2 bonus
//       Total: 8 + 2 = 10 points
// Green: Claims tile 2 (4 pts) = 4 pts base
//        First claims: tile 2 = 1 tile × 2 bonus = 2 bonus
//        Total: 4 + 2 = 6 points

console.log("\nExpected:");
console.log("Red: 15 points (11 base + 4 bonus)");
console.log("Blue: 10 points (8 base + 2 bonus)");
console.log("Green: 6 points (4 base + 2 bonus)");

// Test 2: With first claim bonus disabled (0 points)
console.log("\n\nTest 2: First claim bonus = 0 points (disabled)");
const mockCardDataNoBonus = {
    ...mockCardData,
    firstClaimBonus: 0
};
const scoresNoBonus = getTeamScores(mockCardDataNoBonus);
scoresNoBonus.forEach(team => {
    console.log(`${team.name}: ${team.score} points`);
});

console.log("\nExpected:");
console.log("Red: 11 points (no bonus)");
console.log("Blue: 8 points (no bonus)");
console.log("Green: 4 points (no bonus)");

// Test 3: Check for correct first claim detection
console.log("\n\nTest 3: First claim detection details");
mockCardData.tiles.forEach((tile, index) => {
    const claimedBy = Array.isArray(tile.claimedBy) ? tile.claimedBy : [];
    const firstClaimer = claimedBy.length > 0 ? claimedBy[0] : "None";
    console.log(`Tile ${index}: Claimed by [${claimedBy.join(", ")}], First claimer: ${firstClaimer}`);
});