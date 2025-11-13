"use client"

import { motion } from "framer-motion"
import { AtividadesModule } from "@/components/features/atividades/AtividadesModule"
import { pageTransition } from "@/lib/animations"

export default function AtividadesPage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
    >
      <AtividadesModule />
    </motion.div>
  )
}

