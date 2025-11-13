"use client";

import { motion } from "framer-motion";
import { ObrigacoesModule } from "@/components/features/obrigacoes/ObrigacoesModule";
import { pageTransition } from "@/lib/animations";

export default function ObrigacoesPage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
    >
      <ObrigacoesModule />
    </motion.div>
  );
}
