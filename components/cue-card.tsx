"use client";

import React from "react";
import { motion } from "framer-motion";

interface CueCardProps {
  person: string;
  firstInteraction: string;
  lastInteraction: string;
  title: string;
  onClick: () => void;
  isActive?: boolean;
  isAnnotatedByUser?: boolean;
  isInProgress?: boolean;
}

const CueCard: React.FC<CueCardProps> = ({
  person, firstInteraction, lastInteraction, title, onClick,
  isActive = false, isAnnotatedByUser = false, isInProgress = false,
}) => (
  <motion.div
    whileHover={{ scale: 1.05, boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)" }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 200, damping: 15 }}
    className={`mb-4 p-4 rounded-md cursor-pointer shadow-sm border ${
      isActive
        ? "bg-primary text-primary-foreground border-primary shadow-md"
        : "bg-secondary text-secondary-foreground border-sidebar-border"
    } ${isAnnotatedByUser ? "ring ring-offset-2 ring-primary" : ""}`}
    onClick={onClick}
  >
    <p className="font-bold text-lg break-words text-center">{title}</p>
    <p className="font-medium text-sm break-words mt-2">{person}</p>
    <p className="text-xs break-words mt-1"><strong>First Interaction:</strong> {new Date(firstInteraction).toLocaleString()}</p>
    <p className="text-xs break-words mt-1"><strong>Last Interaction:</strong> {new Date(lastInteraction).toLocaleString()}</p>
    {isInProgress && (
      <p className="w-fit rounded-[20px] px-2 py-2 justify-items-center text-right text-sm text-primary-50 bg-yellow-600 text-white">In Progress</p>
    )}
    {isAnnotatedByUser && (
      <p className="w-fit rounded-[20px] px-2 py-2 justify-items-center text-right text-sm text-primary-50 bg-green-600 text-white">Annotated ✓</p>
    )}
  </motion.div>
);

export default CueCard;
