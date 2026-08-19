import React from "react";
import { motion } from "framer-motion";

interface CueCardProps {
  title: string;
  person: string;
  firstInteraction: string;
  lastInteraction: string;
  onClick: () => void;
}

const CueCard: React.FC<CueCardProps> = ({ person, firstInteraction, lastInteraction, title, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, boxShadow: "0px 4px 4px rgba(128, 128, 128, 0.5)" }}
      whileTap={{ scale: 0.95 }}
      transition = {{
        type: "spring",
        stiffness: 200,
        damping: 15,
        duration: 0.8,
      }}
      className="m-4 p-4 rounded-lg bg-gray-700 text-white cursor-pointer shadow-md transition-transform"
      onClick={onClick}
    >
      <p className="font-bold text-xl break-words text-center">{title}</p>
      <p className="font-normal text-base break-words">{person}</p>
      <p className="text-xs text-gray-300 break-words">
        <strong>First Interaction:</strong> {new Date(firstInteraction).toLocaleString()}
      </p>
      <p className="text-xs text-gray-300 break-words">
        <strong>Last Interaction:</strong> {new Date(lastInteraction).toLocaleString()}
      </p>
    </motion.div>
  );
};

export default CueCard;
