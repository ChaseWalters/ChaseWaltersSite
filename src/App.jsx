// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TaskBingo from "./pages/TaskBingo";
import ManageTasks from "./pages/ManageTasks";
import SharedBoard from "./components/SharedBoard";
import CreateBoard from "./components/CreateBoard";

function App() {
    const [tasksPool, setTasksPool] = useState([
        {
            name: "Complete 1 achievement task",
            description: "Complete one achievement task in OSRS",
            difficulty: 1,
            value: 2
        },
        {
            name: "10kc at a wildy boss",
            description: "Achieve 10 kill count at a wilderness boss",
            difficulty: 3,
            value: 5
        },
        {
            name: "25k fishing xp",
            description: "Gain 25,000 fishing experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "Full tree run",
            description: "Complete a full tree run",
            difficulty: 2,
            value: 3
        },
        {
            name: "25 laps of agility or sep",
            description: "Complete 25 laps of agility (or SEP equivalent)",
            difficulty: 2,
            value: 3
        },
        {
            name: "Do 10 kills vorkath",
            description: "Defeat Vorkath 10 times",
            difficulty: 4,
            value: 6
        },
        {
            name: "2 gauntlet attempt/run",
            description: "Attempt or complete 2 runs of the Gauntlet",
            difficulty: 3,
            value: 4
        },
        {
            name: "Attempt to Pk for 30 mins",
            description: "Engage in PKing for 30 minutes",
            difficulty: 3,
            value: 4
        },
        {
            name: "100k cooking xp",
            description: "Gain 100,000 cooking experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "50k herblore",
            description: "Gain 50,000 Herblore experience",
            difficulty: 2,
            value: 3
        },
        {
            name: "5 tempoross games",
            description: "Participate in 5 Tempoross games",
            difficulty: 2,
            value: 3
        },
        {
            name: "Kill hespori",
            description: "Defeat Hespori",
            difficulty: 3,
            value: 4
        },
        {
            name: "Solo raid run",
            description: "Complete a raid run on your own",
            difficulty: 4,
            value: 6
        },
        {
            name: "50k thieving experience",
            description: "Gain 50,000 Thieving experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "5 zulrah runs",
            description: "Complete 5 runs of Zulrah",
            difficulty: 3,
            value: 4
        },
        {
            name: "5 dt2 boss attempt/run",
            description: "Attempt or complete 5 runs of Dragon Slayer II",
            difficulty: 4,
            value: 6
        },
        {
            name: "5 chaos ele kills",
            description: "Defeat Chaos Elemental 5 times",
            difficulty: 3,
            value: 4
        },
        {
            name: "25k mining xp",
            description: "Gain 25,000 Mining experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "Jad run for the pet bby",
            description: "Attempt the Jad run, aiming for the pet",
            difficulty: 4,
            value: 6
        },
        {
            name: "50k woodcutting xp",
            description: "Gain 50,000 Woodcutting experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "Complete a slayer task",
            description: "Finish a Slayer task",
            difficulty: 2,
            value: 3
        },
        {
            name: "10 barrows runs",
            description: "Complete 10 runs of Barrows",
            difficulty: 3,
            value: 4
        },
        {
            name: "100k construction xp",
            description: "Gain 100,000 Construction experience",
            difficulty: 2,
            value: 3
        },
        {
            name: "Go for a champion scroll for 1 hour",
            description: "Play for 1 hour in hopes of obtaining a champion scroll",
            difficulty: 2,
            value: 3
        },
        {
            name: "100k fetching xp",
            description: "Gain 100,000 Fetching experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "50k firemaking",
            description: "Gain 50,000 Firemaking experience",
            difficulty: 1,
            value: 2
        },
        {
            name: "2 attempts/kills at muspah",
            description: "Attempt or kill Muspah twice",
            difficulty: 3,
            value: 4
        },
        {
            name: "Barb assault run",
            description: "Complete a Barbarian Assault run",
            difficulty: 2,
            value: 3
        }
    ]);

    return (
        <Routes>
            <Route path="/" element={<Home tasksPool={tasksPool} setTasksPool={setTasksPool} />} />  
            <Route path="/manage-tasks" element={<ManageTasks tasksPool={tasksPool} setTasksPool={setTasksPool} />} />
            <Route path="/shared/:cardId" element={<SharedBoard />} />
        </Routes>
    );
}

export default App;