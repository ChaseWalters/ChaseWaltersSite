// Test file to verify TaskInfoModal bonus indicator logic
// This simulates the JSX logic for showing bonus indicators

// Mock tile data
const mockTile = {
    claimedBy: ["Red", "Blue", "Green"],
    task: { name: "Complete a task", value: 5 }
};

// Mock teams data
const mockClaimedTeams = [
    { name: "Red", color: "#e53e3e" },
    { name: "Blue", color: "#3182ce" },
    { name: "Green", color: "#38a169" }
];

// Test different firstClaimBonus values
function testBonusIndicator(firstClaimBonus) {
    console.log(`\nTest: firstClaimBonus = ${firstClaimBonus}`);
    console.log("Claimed by section rendering:");
    
    if (mockClaimedTeams.length === 0) {
        console.log("  No one");
    } else {
        mockClaimedTeams.forEach((team, index) => {
            let display = team.name;
            if (index === 0 && firstClaimBonus > 0) {
                display += ` +${firstClaimBonus}`;
            }
            console.log(`  ${display} (${team.color})`);
        });
    }
}

console.log("Testing TaskInfoModal Bonus Indicator Logic");
console.log("==========================================");

// Test with bonus enabled
testBonusIndicator(2);

// Test with bonus disabled
testBonusIndicator(0);

// Test with no bonus field (undefined)
testBonusIndicator(undefined);

// Test edge case: only one team claimed
console.log("\n\nEdge case: Only one team claimed");
const singleTeam = [{ name: "Red", color: "#e53e3e" }];
console.log("With bonus = 3:");
singleTeam.forEach((team, index) => {
    let display = team.name;
    if (index === 0 && 3 > 0) {
        display += ` +3`;
    }
    console.log(`  ${display} (${team.color})`);
});

console.log("\nWith bonus = 0:");
singleTeam.forEach((team, index) => {
    let display = team.name;
    if (index === 0 && 0 > 0) {
        display += ` +0`;
    }
    console.log(`  ${display} (${team.color})`);
});