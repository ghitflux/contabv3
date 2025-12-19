"use client";

import { motion } from "framer-motion";
import { FinanceiroModule } from "@/components/features/financeiro/FinanceiroModule";
import { pageTransition } from "@/lib/animations";

export default function FinanceiroDashboard() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
    >
      <FinanceiroModule />
    </motion.div>
  );
}
