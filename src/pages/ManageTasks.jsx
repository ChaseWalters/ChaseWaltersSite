/* eslint-disable no-unused-vars */
// src/pages/ManageTasks.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function ManageTasks({ tasksPool, setTasksPool }) {
    const [sortField, setSortField] = useState("difficulty");
    const [sortDir, setSortDir] = useState("asc");
    const [newTask, setNewTask] = useState({
        name: "",
        description: "",
        difficulty: 1,
        value: 1,
    });
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    const navigate = useNavigate();

    // Sorting tasks for display
    const sortedTasks = tasksPool
        .map((task, index) => ({ ...task, originalIndex: index }))
        .sort((a, b) => {
            const diff = a[sortField] - b[sortField];
            return sortDir === "asc" ? diff : -diff;
        });

    // Delete a specific task by index
    const handleDelete = (index) => {
        setTasksPool((prev) => prev.filter((_, i) => i !== index));
        if (editingIndex === index) {
            setEditingIndex(null);
            setEditingTask(null);
        }
    };

    // Begin editing a card
    const handleEdit = (index, task) => {
        setEditingIndex(index);
        setEditingTask({ ...task });
    };

    // Save changes to a task
    const handleSaveEdit = (index) => {
        const newTasks = [...tasksPool];
        newTasks[index] = editingTask;
        setTasksPool(newTasks);
        setEditingIndex(null);
        setEditingTask(null);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingTask(null);
    };

    // Add a new task to the pool
    const handleAddTask = () => {
        if (newTask.name.trim() === "") return;
        setTasksPool((prev) => [...prev, newTask]);
        setNewTask({
            name: "",
            description: "",
            difficulty: 1,
            value: 1,
        });
    };

    // File upload for importing tasks.
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                if (Array.isArray(json)) {
                    setTasksPool((prev) => [...prev, ...json]);
                } else {
                    alert("Uploaded file must be a JSON array of tasks");
                }
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    // Export the current list of tasks as a JSON file.
    const handleExportTasks = () => {
        const dataStr = JSON.stringify(tasksPool, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tasks.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="min-h-screen p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <ThemeToggle />
            <h1 className="text-3xl font-bold mb-4 text-center">Manage Tasks</h1>

            {/* Flex container for Import/Export (left) and New Task (right) */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Import / Export Section */}
                <div className="flex-1 p-4 bg-white dark:bg-gray-800 rounded shadow">
                    <h2 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
                        Import / Export Tasks
                    </h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                Import Tasks
                            </span>
                            <input
                                type="file"
                                accept="application/json"
                                onChange={handleFileUpload}
                                className="p-2 border rounded"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                Export Tasks
                            </span>
                            <button
                                onClick={handleExportTasks}
                                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
                            >
                                Export Tasks
                            </button>
                        </div>
                    </div>
                </div>

                {/* New Task Form */}
                <div className="flex-1 p-4 bg-white dark:bg-gray-800 rounded shadow">
                    <h2 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
                        Add New Task
                    </h2>
                    <div className="flex flex-col gap-2">
                        <input
                            type="text"
                            placeholder="Task Name"
                            value={newTask.name}
                            onChange={(e) =>
                                setNewTask({ ...newTask, name: e.target.value })
                            }
                            className="border p-2 rounded text-black"
                        />
                        <textarea
                            placeholder="Task Description"
                            value={newTask.description}
                            onChange={(e) =>
                                setNewTask({ ...newTask, description: e.target.value })
                            }
                            className="border p-2 rounded text-black"
                        />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    Difficulty
                                </label>
                                <input
                                    type="number"
                                    placeholder="Difficulty"
                                    value={newTask.difficulty}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            difficulty: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="border p-2 rounded w-full text-black"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    Value
                                </label>
                                <input
                                    type="number"
                                    placeholder="Value"
                                    value={newTask.value}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            value: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="border p-2 rounded w-full text-black"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleAddTask}
                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded mt-2"
                        >
                            Add Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Task List as Scrollable Cards */}
            <h2 className="text-2xl font-bold mb-4 text-center">Task List</h2>
            <div className="max-h-[600px] overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {sortedTasks.map((task) => (
                    <div
                        key={task.originalIndex}
                        className="bg-white dark:bg-gray-800 p-4 rounded shadow h-60 flex flex-col"
                    >
                        {editingIndex === task.originalIndex ? (
                            <>
                                <input
                                    type="text"
                                    value={editingTask.name}
                                    onChange={(e) =>
                                        setEditingTask({ ...editingTask, name: e.target.value })
                                    }
                                    className="border p-1 rounded mb-2 text-black"
                                />
                                <textarea
                                    value={editingTask.description}
                                    onChange={(e) =>
                                        setEditingTask({
                                            ...editingTask,
                                            description: e.target.value,
                                        })
                                    }
                                    className="border p-1 rounded mb-2 text-black h-16 overflow-y-auto"
                                    placeholder="Description"
                                />
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="number"
                                        value={editingTask.difficulty}
                                        onChange={(e) =>
                                            setEditingTask({
                                                ...editingTask,
                                                difficulty: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="border p-1 rounded w-full text-black"
                                        placeholder="Difficulty"
                                    />
                                    <input
                                        type="number"
                                        value={editingTask.value}
                                        onChange={(e) =>
                                            setEditingTask({
                                                ...editingTask,
                                                value: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="border p-1 rounded w-full text-black"
                                        placeholder="Value"
                                    />
                                </div>
                                <div className="flex gap-2 mt-auto justify-end">
                                    <button
                                        onClick={() => handleSaveEdit(task.originalIndex)}
                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="font-bold text-xl mb-1 text-gray-900 dark:text-gray-100">
                                    {task.name}
                                </h3>
                                <p
                                    className="mb-2 text-gray-700 dark:text-gray-300 flex-grow overflow-hidden"
                                    style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: "vertical",
                                    }}
                                >
                                    {task.description}
                                </p>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-900 dark:text-gray-100">
                                        Difficulty: {task.difficulty}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                        Value: {task.value}
                                    </span>
                                </div>
                                <div className="flex gap-2 mt-auto justify-end">
                                    <button
                                        onClick={() => handleEdit(task.originalIndex, task)}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(task.originalIndex)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-center mt-6">
                <button
                    onClick={() => navigate("/")}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded"
                >
                    Back to Setup
                </button>
            </div>
        </div>
    );
}