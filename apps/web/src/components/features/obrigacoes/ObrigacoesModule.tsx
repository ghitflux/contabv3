'use client';

import { motion } from "framer-motion";
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { pageTransition } from "@/lib/animations";
import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Progress,
  Select,
  SelectItem,
} from '@/heroui';
import { CheckCircleIcon, DownloadIcon, RefreshIcon, SearchIcon } from '@/lib/icons';
import { useMemo, useState } from 'react';
import { ObligationCompletionModal } from './ObligationCompletionModal';
import type { ObligationResponse } from '@/lib/api/endpoints/obligations';
import { useObligationsMatrix } from '@/hooks/useObligationsMatrix';
import { RegimeTributario, TipoEmpresa, getRegimeLabel, getTipoEmpresaLabel } from '@/types/client';

const RECURRENCE_LABELS: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

const CATEGORY_MAP: Record<string, string> = {
  DAS_MEI_MENSAL: 'Imposto',
  DASN_SIMEI_ANUAL: 'Declaração',
  PGDAS_MENSAL: 'Declaração',
  DAS_MENSAL: 'Imposto',
  EFD_CONTRIBUICOES: 'Declaração',
  EFD_ICMS_IPI_MENSAL: 'Declaração',
  DIEF_MENSAL: 'Declaração',
  ICMS_ANTECIPACAO_MENSAL: 'Imposto',
  ISS_MENSAL: 'Imposto',
  PIS_COFINS_MENSAL: 'Imposto',
  ICMS_NORMAL_MENSAL: 'Imposto',
  IPI_MENSAL: 'Imposto',
  IRPJ_CSLL_TRIMESTRAL: 'Imposto',
  ECD_ANUAL: 'Declaração',
  ECF_ANUAL: 'Declaração',
  LALUR_ANUAL: 'Declaração',
  NFS_E_MENSAL: 'Declaração',
  FOLHA_PAGAMENTO_MENSAL: 'Relatórios',
  ESOCIAL_MENSAL: 'Declaração',
  DCTF_WEB_MENSAL: 'Declaração',
  FGTS_MENSAL: 'Imposto',
  EFD_REINF_MENSAL: 'Declaração',
  MIT_MENSAL: 'Declaração',
  DECIMO_TERCEIRO_1_ANUAL: 'Relatórios',
  DECIMO_TERCEIRO_2_ANUAL: 'Relatórios',
  DCTF_WEB_13_ANUAL: 'Declaração',
  PARCELAMENTOS_MENSAL: 'Imposto',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  em_andamento: 'Em andamento',
  cancelada: 'Cancelada',
};

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'primary'> = {
  pendente: 'warning',
  concluida: 'success',
  atrasada: 'danger',
  em_andamento: 'primary',
  cancelada: 'default',
};

const REGIME_ORDER = [
  RegimeTributario.MEI,
  RegimeTributario.SIMPLES_NACIONAL,
  RegimeTributario.LUCRO_PRESUMIDO,
  RegimeTributario.LUCRO_REAL,
];

const statusButtonClass = 'bg-slate-900 hover:bg-slate-800 text-white';

const formatDueDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const getRegimeLabelSafe = (regime?: string) => {
  if (!regime) return 'Regime não informado';
  if (Object.values(RegimeTributario).includes(regime as RegimeTributario)) {
    return getRegimeLabel(regime as RegimeTributario);
  }
  return regime;
};

export function ObrigacoesModule() {
  const currentDate = new Date();
  const [competency, setCompetency] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [search, setSearch] = useState('');
  const [regimeFilter, setRegimeFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<ObligationResponse | null>(null);

  // Parse competency to get month and year
  const [yearStr, monthStr] = competency.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monthStr) || new Date().getMonth() + 1;

  // Use real API
  const { data: matrixData, loading, error, fetchMatrix, undoObligation } = useObligationsMatrix({
    month,
    year,
    search: search.trim() || undefined,
  });

  const filteredRows = useMemo(() => {
    return matrixData.filter((row) => {
      if (regimeFilter !== 'todos' && row.client_regime_tributario !== regimeFilter) {
        return false;
      }
      if (tipoFilter !== 'todos' && row.client_tipo_empresa !== tipoFilter) {
        return false;
      }
      if (!search) return true;
      return (
        row.client_name.toLowerCase().includes(search.toLowerCase()) ||
        row.client_cnpj.includes(search)
      );
    });
  }, [matrixData, regimeFilter, tipoFilter, search]);

  const groupedByRegime = useMemo(() => {
    const groups: Record<string, typeof filteredRows> = {};
    for (const row of filteredRows) {
      const key = row.client_regime_tributario || 'indefinido';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    }
    return groups;
  }, [filteredRows]);

  const orderedRegimes = useMemo(() => {
    const extra = Object.keys(groupedByRegime).filter(
      (regime) => !REGIME_ORDER.includes(regime as RegimeTributario)
    );
    return [...REGIME_ORDER, ...extra] as string[];
  }, [groupedByRegime]);

  const handleOpenModal = (row: typeof matrixData[number], obligation: (typeof row.obligations)[number]) => {
    if (!obligation?.id) {
      console.error('Obligation not found');
      return;
    }

    const mockObligation: ObligationResponse = {
      id: obligation.id,
      client_id: row.client_id,
      client_name: row.client_name,
      client_cnpj: row.client_cnpj,
      obligation_type_id: obligation.obligation_type_code || obligation.id,
      obligation_type_name: obligation.obligation_type_name || obligation.obligation_type_code || 'Obrigação',
      obligation_type_code: obligation.obligation_type_code || '',
      due_date: obligation.due_date || new Date().toISOString(),
      status: obligation.status,
      priority: 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      receipt_url: obligation.receipt_url,
    };

    setSelectedObligation(mockObligation);
    setIsModalOpen(true);
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    setSelectedObligation(null);
    await fetchMatrix();
  };

  const handleUndo = async (obligationId: string) => {
    try {
      await undoObligation(obligationId);
    } catch (err) {
      console.error('Error undoing obligation:', err);
    }
  };

  const handleDownloadReceipt = async (receiptUrl: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const normalizedReceipt = receiptUrl.startsWith('/uploads/receipts/')
        ? receiptUrl.replace('/uploads/receipts/', '/obligations/receipts/')
        : receiptUrl;
      const absoluteUrl = normalizedReceipt.startsWith('http')
        ? normalizedReceipt
        : `${normalizedBase}${normalizedReceipt.startsWith('/') ? '' : '/'}${normalizedReceipt}`;

      const token = localStorage.getItem('access_token');
      const response = await fetch(absoluteUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar comprovante (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error('Erro ao baixar comprovante:', err);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground">Baixa de Obrigações</h1>
        <p className="text-default-500 mt-1">
          Organize as obrigações por regime e acompanhe a entrega por empresa.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            <MonthYearPicker
              label="Competência"
              value={competency}
              onChange={setCompetency}
              size="sm"
            />
            <Select
              selectedKeys={[regimeFilter]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setRegimeFilter(selected || 'todos');
              }}
              label="Regime"
              size="sm"
            >
              {[
                <SelectItem key="todos">Todos os regimes</SelectItem>,
                ...Object.values(RegimeTributario).map((regime) => (
                  <SelectItem key={regime}>{getRegimeLabel(regime)}</SelectItem>
                ))
              ]}
            </Select>
            <Select
              selectedKeys={[tipoFilter]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setTipoFilter(selected || 'todos');
              }}
              label="Tipo de Empresa"
              size="sm"
            >
              {[
                <SelectItem key="todos">Todos os tipos</SelectItem>,
                ...Object.values(TipoEmpresa).map((tipo) => (
                  <SelectItem key={tipo}>{getTipoEmpresaLabel(tipo)}</SelectItem>
                ))
              ]}
            </Select>
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startContent={<SearchIcon className="text-default-400" />}
              size="sm"
              classNames={{
                input: 'text-sm',
                inputWrapper: 'h-10',
              }}
            />
          </div>

          {loading && (
            <div className="text-center py-12">
              <p className="text-default-500">Carregando obrigações...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-danger">{error}</p>
            </div>
          )}

          {!loading && !error && filteredRows.length === 0 && (
            <div className="text-center py-12 text-default-400 text-sm">
              Nenhuma empresa encontrada para os filtros selecionados.
            </div>
          )}

          {!loading && !error && filteredRows.length > 0 && (
            <div className="space-y-6">
              {orderedRegimes.map((regime) => {
                const rows = groupedByRegime[regime] || [];
                if (rows.length === 0) return null;

                return (
                  <section key={regime} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-default-800">
                        {getRegimeLabelSafe(regime)}
                      </h3>
                      <span className="text-xs text-default-400">
                        {rows.length} {rows.length === 1 ? 'empresa' : 'empresas'}
                      </span>
                    </div>
                    <Accordion
                      variant="splitted"
                      className="gap-3"
                      selectionMode="multiple"
                    >
                      {rows.map((row) => {
                        const progressValue = row.total > 0 ? (row.completed / row.total) * 100 : 0;
                        const sortedObligations = [...row.obligations].sort((a, b) => {
                          const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
                          const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
                          return aDate - bDate;
                        });

                        return (
                          <AccordionItem
                            key={row.client_id}
                            aria-label={row.client_name}
                            title={
                              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-default-900">
                                    {row.client_name}
                                  </p>
                                  <p className="text-xs text-default-500">{row.client_cnpj}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {row.client_tipo_empresa && (
                                    <Chip size="sm" variant="flat" color="primary">
                                      {getTipoEmpresaLabel(row.client_tipo_empresa)}
                                    </Chip>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Progress
                                      aria-label="Progresso de obrigações"
                                      value={progressValue}
                                      size="sm"
                                      className="w-24"
                                    />
                                    <span className="text-xs font-medium text-default-500">
                                      {row.completed}/{row.total}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            }
                          >
                            {sortedObligations.length === 0 ? (
                              <div className="py-6 text-sm text-default-400">
                                Nenhuma obrigação gerada para esta competência.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="border-b border-default-200 text-left text-xs uppercase text-default-500">
                                      <th className="px-3 py-2">Obrigação</th>
                                      <th className="px-3 py-2">Tipo</th>
                                      <th className="px-3 py-2">Periodicidade</th>
                                      <th className="px-3 py-2">Vencimento</th>
                                      <th className="px-3 py-2">Status</th>
                                      <th className="px-3 py-2 text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedObligations.map((obligation) => {
                                      const category = CATEGORY_MAP[obligation.obligation_type_code || ''] || '-';
                                      const periodicity =
                                        RECURRENCE_LABELS[obligation.recurrence || ''] ||
                                        obligation.recurrence ||
                                        '-';
                                      const statusLabel = STATUS_LABELS[obligation.status] || obligation.status;
                                      const statusColor = STATUS_COLORS[obligation.status] || 'default';
                                      const isCompleted = obligation.status === 'concluida';

                                      return (
                                        <tr
                                          key={obligation.id}
                                          className="border-b border-default-100 text-sm"
                                        >
                                          <td className="px-3 py-3 font-medium text-default-900">
                                            {obligation.obligation_type_name ||
                                              obligation.obligation_type_code ||
                                              'Obrigação'}
                                          </td>
                                          <td className="px-3 py-3 text-default-600">{category}</td>
                                          <td className="px-3 py-3 text-default-600">{periodicity}</td>
                                          <td className="px-3 py-3 text-default-600">
                                            {formatDueDate(obligation.due_date)}
                                          </td>
                                          <td className="px-3 py-3">
                                            <Chip size="sm" variant="flat" color={statusColor}>
                                              {statusLabel}
                                            </Chip>
                                          </td>
                                          <td className="px-3 py-3 text-right">
                                            {isCompleted ? (
                                              <div className="flex items-center justify-end gap-1">
                                                <Button
                                                  isIconOnly
                                                  size="sm"
                                                  variant="light"
                                                  color="success"
                                                  className="min-w-unit-6"
                                                  title="Obrigação concluída"
                                                >
                                                  <CheckCircleIcon className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  isIconOnly
                                                  size="sm"
                                                  variant="light"
                                                  onPress={() => handleUndo(obligation.id)}
                                                  className="min-w-unit-6"
                                                  title="Desfazer baixa"
                                                >
                                                  <RefreshIcon className="h-4 w-4" />
                                                </Button>
                                                {obligation.receipt_url && (
                                                  <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    onPress={() =>
                                                      handleDownloadReceipt(obligation.receipt_url as string)
                                                    }
                                                    className="min-w-unit-6"
                                                    title="Baixar comprovante"
                                                  >
                                                    <DownloadIcon className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            ) : (
                                              <Button
                                                size="sm"
                                                radius="sm"
                                                className={statusButtonClass}
                                                onPress={() => handleOpenModal(row, obligation)}
                                              >
                                                Baixar
                                              </Button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </section>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {selectedObligation && (
        <ObligationCompletionModal
          obligation={selectedObligation}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedObligation(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}
    </motion.div>
  );
}
