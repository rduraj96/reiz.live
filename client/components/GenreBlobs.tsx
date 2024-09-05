import React from "react";
import { motion } from "framer-motion";
import { RadioStation } from "../app/types";

interface GenreBlobsProps {
  genre: string;
  station: RadioStation | null;
}

const genreColors: { [key: string]: string } = {
  pop: "#FF69B4",
  rock: "#8B0000",
  jazz: "#4B0082",
  classical: "#DAA520",
  electronic: "#00CED1",
};

const GenreBlobs: React.FC<GenreBlobsProps> = ({ genre, station }) => {
  const blobColor = genreColors[genre] || "#6B8E23";

  return (
    <>
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"
        style={{ backgroundColor: blobColor }}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 90, 180],
          borderRadius: [
            "60% 40% 30% 70% / 60% 30% 70% 40%",
            "30% 60% 70% 40% / 50% 60% 30% 60%",
            "60% 40% 30% 70% / 60% 30% 70% 40%",
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"
        style={{ backgroundColor: blobColor }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, -90, -180],
          borderRadius: [
            "50% 50% 50% 70% / 50% 50% 70% 60%",
            "80% 30% 50% 50% / 50% 50% 30% 60%",
            "50% 50% 50% 70% / 50% 50% 70% 60%",
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
      {station && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="text-4xl font-bold text-foreground mix-blend-difference">
            {station.name}
          </div>
        </motion.div>
      )}
    </>
  );
};

export default GenreBlobs;
