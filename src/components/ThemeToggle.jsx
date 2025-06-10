/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaMoon, FaSun } from "react-icons/fa";

export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

    useEffect(() => {
        localStorage.setItem("theme", theme);
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return (
        <div className="absolute top-4 right-4 z-50">
            <button
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-md hover:scale-110 transition duration-300"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={theme}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {theme === "light" ? (
                            <FaMoon className="text-gray-800" />
                        ) : (
                            <FaSun className="text-yellow-300" />
                        )}
                    </motion.div>
                </AnimatePresence>
            </button>
        </div>
    );
}
