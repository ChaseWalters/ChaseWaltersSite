// Simple test component to verify UI rendering
import React, { useState } from 'react';
import TaskInfoModal from '../src/components/TaskInfoModal.jsx';

// Mock tile data for testing
const mockTile = {
    claimedBy: ["Red", "Blue"],
    task: {
        name: "Test Task",
        description: "This is a test task",
        value: 5,
        difficulty: 3
    }
};

const mockClaimedTeams = [
    { name: "Red", color: "#e53e3e" },
    { name: "Blue", color: "#3182ce" }
];

export default function TestModalComponent() {
    const [firstClaimBonus, setFirstClaimBonus] = useState(2);
    const [showModal, setShowModal] = useState(false);

    return (
        <div style={{ padding: '20px' }}>
            <h1>First Claim Bonus Test</h1>
            
            <div style={{ marginBottom: '20px' }}>
                <label>
                    First Claim Bonus: 
                    <input 
                        type="number" 
                        value={firstClaimBonus} 
                        onChange={(e) => setFirstClaimBonus(Number(e.target.value))}
                        style={{ marginLeft: '10px', padding: '5px' }}
                    />
                </label>
            </div>

            <button onClick={() => setShowModal(true)}>
                Open Modal (Red claimed first, Blue second)
            </button>

            {showModal && (
                <TaskInfoModal
                    tile={mockTile}
                    claimedTeams={mockClaimedTeams}
                    firstClaimBonus={firstClaimBonus}
                    canClaim={false}
                    onClaim={() => {}}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}