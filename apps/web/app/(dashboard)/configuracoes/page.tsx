'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/configuracoes/perfil');
  }, [router]);

  return null;
}
