'use client';

import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { Button, Card, CardBody, Input, Progress } from '@/heroui';
import { CheckCircleIcon, DownloadIcon, RefreshIcon, SearchIcon } from '@/lib/icons';
import { useMemo, useState } from 'react';

type ObligationKey =
  | 'DCTFWeb'
  | 'EFD-Contribuições'
  | 'ECD'
  | 'ECF'
  | 'ISS'
  | 'FGTS'
  | 'INSS/eSocial';

type ObligationStatus = 'pending' | 'completed';

interface ClientInfo {
  id: string;
  name: string;
  cnpj: string;
}

interface ClientObligations {
  clientId: string;
  obligations: Record<ObligationKey, ObligationStatus>;
}

const OBLIGATION_TYPES: ObligationKey[] = [
  'DCTFWeb',
  'EFD-Contribuições',
  'ECD',
  'ECF',
  'ISS',
  'FGTS',
  'INSS/eSocial',
];

const CLIENTS: ClientInfo[] = [
  {
    id: '1',
    name: 'Tech Solutions Ltda',
    cnpj: '12.345.678/0001-90',
  },
  {
    id: '2',
    name: 'Comércio ABC S.A.',
    cnpj: '98.765.432/0001-10',
  },
  {
    id: '3',
    name: 'Indústria XYZ Ltda',
    cnpj: '11.222.333/0001-44',
  },
];

const INITIAL_OBLIGATIONS: ClientObligations[] = [
  {
    clientId: '1',
    obligations: {
      DCTFWeb: 'completed',
      'EFD-Contribuições': 'pending',
      ECD: 'pending',
      ECF: 'pending',
      ISS: 'pending',
      FGTS: 'pending',
      'INSS/eSocial': 'pending',
    },
  },
  {
    clientId: '2',
    obligations: {
      DCTFWeb: 'pending',
      'EFD-Contribuições': 'pending',
      ECD: 'pending',
      ECF: 'pending',
      ISS: 'pending',
      FGTS: 'pending',
      'INSS/eSocial': 'pending',
    },
  },
  {
    clientId: '3',
    obligations: {
      DCTFWeb: 'pending',
      'EFD-Contribuições': 'pending',
      ECD: 'pending',
      ECF: 'pending',
      ISS: 'pending',
      FGTS: 'pending',
      'INSS/eSocial': 'pending',
    },
  },
];

const statusButtonClass = 'bg-slate-900 hover:bg-slate-800 text-white';

const statusConfig: Record<
  ObligationStatus,
  {
    container: string;
    label: string;
  }
> = {
  pending: {
    container: '',
    label: 'Baixar',
  },
  completed: {
    container: 'bg-success-50 border border-success-200',
    label: 'Baixado',
  },
};

export function ObrigacoesModule() {
  const [competency, setCompetency] = useState('2025-10');
  const [search, setSearch] = useState('');
  const [clientObligations, setClientObligations] =
    useState<ClientObligations[]>(INITIAL_OBLIGATIONS);

  const handleMarkAsCompleted = (clientId: string, obligationType: ObligationKey) => {
    setClientObligations((prev) =>
      prev.map((row) =>
        row.clientId === clientId
          ? {
              ...row,
              obligations: {
                ...row.obligations,
                [obligationType]: 'completed',
              },
            }
          : row
      )
    );
  };

  const handleUndo = (clientId: string, obligationType: ObligationKey) => {
    setClientObligations((prev) =>
      prev.map((row) =>
        row.clientId === clientId
          ? {
              ...row,
              obligations: {
                ...row.obligations,
                [obligationType]: 'pending',
              },
            }
          : row
      )
    );
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientObligations;
    return clientObligations.filter((row) => {
      const client = CLIENTS.find((c) => c.id === row.clientId);
      if (!client) return false;
      return (
        client.name.toLowerCase().includes(term) ||
        client.cnpj.replace(/\D/g, '').includes(term.replace(/\D/g, ''))
      );
    });
  }, [clientObligations, search]);

  const getClientInfo = (id: string) => CLIENTS.find((client) => client.id === id);

  const renderActionCell = (row: ClientObligations, obligationType: ObligationKey) => {
    const status = row.obligations[obligationType];
    if (status === 'completed') {
      return (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="flat"
            color="success"
            radius="sm"
            startContent={<CheckCircleIcon className="h-4 w-4" />}
            className="font-medium"
          >
            Baixado
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="sm"
            onPress={() => handleUndo(row.clientId, obligationType)}
            aria-label="Desfazer"
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button isIconOnly size="sm" variant="light" radius="sm" aria-label="Download">
            <DownloadIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        radius="sm"
        className={statusButtonClass}
        onPress={() => handleMarkAsCompleted(row.clientId, obligationType)}
      >
        Baixar
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Baixa de Obrigações</h1>
        <p className="text-default-500 mt-1">
          Clique em &quot;Baixar&quot; para marcar a obrigação como entregue. Você pode desfazer a
          qualquer momento.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <MonthYearPicker
                label="Competência"
                value={competency}
                onChange={setCompetency}
                size="sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-default-600 sr-only md:not-sr-only">
                Buscar empresa
              </label>
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onValueChange={setSearch}
                startContent={<SearchIcon className="h-4 w-4 text-default-400" />}
                size="sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-default-500">
                  <th className="px-4 py-3 bg-default-100 rounded-l-lg">Empresa / CNPJ</th>
                  {OBLIGATION_TYPES.map((type) => (
                    <th
                      key={type}
                      className="px-3 py-3 text-center bg-default-100 whitespace-nowrap"
                    >
                      {type}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center bg-default-100 rounded-r-lg">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const client = getClientInfo(row.clientId);
                  if (!client) return null;
                  const total = OBLIGATION_TYPES.length;
                  const completed = OBLIGATION_TYPES.reduce(
                    (acc, type) => acc + (row.obligations[type] === 'completed' ? 1 : 0),
                    0
                  );

                  return (
                    <tr
                      key={row.clientId}
                      className="border-b border-default-200 last:border-none hover:bg-default-50 transition-colors"
                    >
                      <td className="px-4 py-4 align-top">
                        <div>
                          <p className="font-medium text-sm text-foreground">{client.name}</p>
                          <p className="text-xs text-default-500 font-mono">{client.cnpj}</p>
                        </div>
                      </td>
                      {OBLIGATION_TYPES.map((type) => (
                        <td
                          key={`${row.clientId}-${type}`}
                          className="px-3 py-4 text-center align-middle"
                        >
                          {renderActionCell(row, type)}
                        </td>
                      ))}
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Progress
                            aria-label="Progresso de obrigações"
                            value={(completed / total) * 100}
                            size="sm"
                            className="max-w-[120px]"
                          />
                          <span className="text-xs font-medium text-default-500">
                            {completed}/{total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 && (
            <div className="text-center py-12 text-default-400 text-sm">
              Nenhuma empresa encontrada para a pesquisa realizada.
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
