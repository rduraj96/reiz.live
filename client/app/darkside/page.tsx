"use client";

import { motion } from "framer-motion";
import React from "react";
import DarkSide from "../(components)/DarkSide";

type Props = {};

const page = (props: Props) => {
  return (
    <motion.div
      key="easter-egg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.5, duration: 1 }}
      className="easter-egg"
    >
      <DarkSide />
    </motion.div>
  );
};

export default page;
