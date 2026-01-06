'use client';

import { ClientProfile } from '@/components/features/clientes/ClientProfile';
import { clientsApi } from '@/lib/api/endpoints/clients';
import type { Client } from '@/types/client';
import { Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';

export default function MeusDadosPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyData = async () => {
      try {
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
