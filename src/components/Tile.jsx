/* eslint-disable no-unused-vars */
/* /src/components/Tile.jsx */
import React from "react";
import { motion } from "framer-motion";

const tileVariants = {
    hidden: { opacity: 0, scale: 0.6 },
    visible: { opacity: 1, scale: 1 },
};

const Tile = ({ tile, onClick }) => {
    if (tile.visible) {
        return (
            <motion.button
                variants={tileVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.25 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onClick(tile)}
                disabled={tile.completed}
                className={`relative aspect-square rounded-lg border overflow-hidden flex items-center justify-center text-center p-1 text-xs md:text-sm select-none ${tile.completed
                        ? "bg-green-500 text-white border-green-600"
                        : "bg-white text-black hover:bg-blue-50 border-gray-300"
                    }`}
            >
                <span className="text-[0.6rem] md:text-xs text-center leading-tight line-clamp-3">
                    {tile.task?.name}
                    {tile.completed && (
                        <svg
                            className="absolute top-1 right-1 w-4 h-4 text-white opacity-70 pointer-events-none"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.293a1 1 0 111.414-1.414l4.364 4.364 6.657-6.657a1 1 0 011.414 0z"
                                clipRule="evenodd"
                            />
                        </svg>
                    )}
                </span>
            </motion.button>
        );
    }
    return (
        <motion.div
            className="aspect-square rounded-lg border bg-gray-800 border-gray-700 cursor-not-allowed"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
        />
    );
};

export default Tile;
