"use client";

import { motion } from "framer-motion";
import { RelatoriosModule } from "@/components/features/relatorios/RelatoriosModule";
import { pageTransition } from "@/lib/animations";

export default function RelatoriosPage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
    >
      <RelatoriosModule />
    </motion.div>
  );
}

