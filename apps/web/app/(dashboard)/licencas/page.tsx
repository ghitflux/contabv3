"use client";

import { motion } from "framer-motion";
import { LicencasModule } from "@/components/features/licencas/LicencasModule";
import { pageTransition } from "@/lib/animations";

export default function LicencasPage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
    >
      <LicencasModule />
    </motion.div>
  );
}

