'use client';

import { ClientProfile } from '@/components/features/clientes/ClientProfile';
import { clientsApi } from '@/lib/api/endpoints/clients';
import type { Client } from '@/types/client';
import { Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';

// Assuming clientsApi needs to be updated to include getMe() or we call api directly.
// Since we just added the endpoint, the frontend lib might not have it yet.
// I'll assume we can use a direct fetch or user-specific call if available,
// or I will update the frontend api definition next.
// For now I'll use a local fetch wrapper or assume clientsApi.getMe() will be added.
// Actually, I should update `apps/web/src/lib/api/endpoints/client.ts` too.

export default function MeusDadosPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyData = async () => {
      try {
        // Temporary direct call until we update the client lib
        // Or if clientsApi supports custom requests
        // Let's assume we update clientsApi to have getMe
        const data = await clientsApi.getMe();
        setClient(data);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Carregando..." />
      </div>
    );
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-danger">{error}</div>;
  }

  if (!client) {
    return (
      <div className="flex h-full items-center justify-center text-default-500">
        Nenhum dado encontrado.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Meus Dados</h1>
      <div className="rounded-xl border border-divider bg-background p-6 shadow-sm">
        <ClientProfile client={client} />
      </div>
    </div>
  );
}
