'use client';

import { motion } from 'framer-motion';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { pageTransition } from '@/lib/animations';
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
  Tab,
  Tabs,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from '@/heroui';
import { CheckCircleIcon, DownloadIcon, RefreshIcon, SearchIcon } from '@/lib/icons';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ObligationCompletionModal } from './ObligationCompletionModal';
import { ObligationTrashModal } from './ObligationTrashModal';
import {
  obligationsApi,
  type ObligationCreateRequest,
  type ObligationResponse,
  type ObligationTypeResponse,
  type ObligationUpdateRequest,
} from '@/lib/api/endpoints/obligations';
import { useObligationsMatrix } from '@/hooks/useObligationsMatrix';
import { RegimeTributario, TipoEmpresa, getRegimeLabel, getTipoEmpresaLabel } from '@/types/client';
import { useAuth } from '@/hooks/auth/AuthContext';
import { UserRole } from '@/types/user';
import { toast } from '@/lib/toast';

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

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const REGIME_ORDER = [
  RegimeTributario.MEI,
  RegimeTributario.SIMPLES_NACIONAL,
  RegimeTributario.LUCRO_PRESUMIDO,
  RegimeTributario.LUCRO_REAL,
];

const statusButtonClass = 'bg-slate-900 hover:bg-slate-800 text-white';
const QUICK_LETTERS = ['todos', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
type MatrixCategory = 'clients' | 'office';
type ObligationEditorForm = {
  obligation_type_id: string;
  due_date: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
  description: string;
};

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
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isCliente = user?.role === UserRole.CLIENTE;
  const canManageObligations =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.FUNC ||
    user?.role === UserRole.CLIENTE;
  const currentDate = new Date();
  const [competency, setCompetency] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [categoryTab, setCategoryTab] = useState<MatrixCategory>('clients');
  const [search, setSearch] = useState('');
  const [startsWith, setStartsWith] = useState<string>('todos');
  const [regimeFilter, setRegimeFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<ObligationResponse | null>(null);
  const [obligationTypes, setObligationTypes] = useState<ObligationTypeResponse[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSavingObligation, setIsSavingObligation] = useState(false);
  const [editingObligationId, setEditingObligationId] = useState<string | null>(null);
  const [selectedRowForEditor, setSelectedRowForEditor] = useState<{
    client_id: string;
    client_name: string;
    client_cnpj: string;
  } | null>(null);
  const [editorForm, setEditorForm] = useState<ObligationEditorForm>({
    obligation_type_id: '',
    due_date: '',
    priority: 'media',
    status: 'pendente',
    description: '',
  });
  const normalizedSearch = search.trim();
  const invalidPeriod = Boolean(dueDateFrom && dueDateTo && dueDateFrom > dueDateTo);
  const obligationIdFromQuery = searchParams.get('id');

  // Parse competency to get month and year
  const [yearStr, monthStr] = competency.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monthStr) || new Date().getMonth() + 1;

  // Use real API
  const {
    data: matrixData,
    loading,
    error,
    fetchMatrix,
    undoObligation,
  } = useObligationsMatrix({
    month,
    year,
    search: normalizedSearch || undefined,
    startsWith: categoryTab === 'clients' && startsWith !== 'todos' ? startsWith : undefined,
    category: categoryTab,
    dueDateFrom: invalidPeriod ? undefined : dueDateFrom || undefined,
    dueDateTo: invalidPeriod ? undefined : dueDateTo || undefined,
  });

  useEffect(() => {
    if (!isCliente) return;
    if (categoryTab === 'office') {
      setCategoryTab('clients');
    }
  }, [isCliente, categoryTab]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const items = await obligationsApi.getObligationTypes(true);
        if (active) {
          setObligationTypes(items);
        }
      } catch (err) {
        console.error('Erro ao carregar tipos de obrigação', err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!obligationIdFromQuery) return;

    let active = true;
    (async () => {
      try {
        const obligation = await obligationsApi.getObligationById(obligationIdFromQuery);
        if (!active) return;
        setSelectedObligation(obligation);
        setIsModalOpen(true);
      } catch (error) {
        if (!active) return;
        console.error('Erro ao abrir obrigação por parâmetro de rota', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [obligationIdFromQuery]);

  const filteredRows = useMemo(() => {
    return matrixData.filter((row) => {
      if (categoryTab === 'office') {
        return true;
      }
      if (regimeFilter !== 'todos' && row.client_regime_tributario !== regimeFilter) {
        return false;
      }
      if (tipoFilter !== 'todos' && row.client_tipo_empresa !== tipoFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      return (
        row.client_name.toLowerCase().includes(normalizedSearch.toLowerCase()) ||
        row.client_cnpj.includes(normalizedSearch)
      );
    });
  }, [matrixData, categoryTab, regimeFilter, tipoFilter, normalizedSearch]);

  const groupedRows = useMemo(() => {
    if (categoryTab === 'office') {
      return {
        escritorio: filteredRows,
      };
    }

    const groups: Record<string, typeof filteredRows> = {};
    for (const row of filteredRows) {
      const key = row.client_regime_tributario || 'indefinido';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    }
    return groups;
  }, [filteredRows, categoryTab]);

  const orderedGroups = useMemo(() => {
    if (categoryTab === 'office') {
      return ['escritorio'];
    }
    const extra = Object.keys(groupedRows).filter(
      (regime) => !REGIME_ORDER.includes(regime as RegimeTributario)
    );
    return [...REGIME_ORDER, ...extra] as string[];
  }, [groupedRows, categoryTab]);

  const resetFilters = () => {
    setSearch('');
    setStartsWith('todos');
    setRegimeFilter('todos');
    setTipoFilter('todos');
    setDueDateFrom('');
    setDueDateTo('');
  };

  const extractApiErrorMessage = (error: unknown, fallback: string) => {
    const detail = (error as { data?: { detail?: string } })?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const closeEditor = () => {
    if (isSavingObligation) return;
    setIsEditorOpen(false);
    setEditingObligationId(null);
    setSelectedRowForEditor(null);
    setIsEditorLoading(false);
    setEditorForm({
      obligation_type_id: '',
      due_date: '',
      priority: 'media',
      status: 'pendente',
      description: '',
    });
  };

  const openCreateEditor = (row: {
    client_id: string;
    client_name: string;
    client_cnpj: string;
  }) => {
    const defaultDueDate =
      dueDateFrom || dueDateTo || `${year}-${String(month).padStart(2, '0')}-20`;
    setSelectedRowForEditor(row);
    setEditingObligationId(null);
    setEditorForm({
      obligation_type_id: '',
      due_date: defaultDueDate,
      priority: 'media',
      status: 'pendente',
      description: `Referência: ${String(month).padStart(2, '0')}/${year}`,
    });
    setIsEditorOpen(true);
  };

  const openEditEditor = async (
    row: {
      client_id: string;
      client_name: string;
      client_cnpj: string;
    },
    obligationId: string
  ) => {
    try {
      setSelectedRowForEditor(row);
      setEditingObligationId(obligationId);
      setIsEditorOpen(true);
      setIsEditorLoading(true);
      const obligation = await obligationsApi.getObligationById(obligationId);
      setEditorForm({
        obligation_type_id: obligation.obligation_type_id,
        due_date: obligation.due_date.split('T')[0] || obligation.due_date,
        priority: (obligation.priority as ObligationEditorForm['priority']) || 'media',
        status: (obligation.status as ObligationEditorForm['status']) || 'pendente',
        description: obligation.description || '',
      });
    } catch (error) {
      console.error('Erro ao carregar obrigação para edição', error);
      toast.error(
        extractApiErrorMessage(error, 'Não foi possível carregar os dados da obrigação.')
      );
      closeEditor();
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleSaveObligation = async () => {
    if (!selectedRowForEditor) {
      toast.error('Selecione a empresa para salvar a obrigação.');
      return;
    }
    if (!editorForm.due_date) {
      toast.error('Informe o vencimento da obrigação.');
      return;
    }
    if (!editingObligationId && !editorForm.obligation_type_id) {
      toast.error('Selecione o tipo de obrigação.');
      return;
    }

    try {
      setIsSavingObligation(true);
      if (editingObligationId) {
        const payload: ObligationUpdateRequest = {
          due_date: editorForm.due_date,
          priority: editorForm.priority,
          status: editorForm.status,
          description: editorForm.description || null,
        };
        await obligationsApi.updateObligation(editingObligationId, payload);
        toast.success('Obrigação atualizada com sucesso.');
      } else {
        const payload: ObligationCreateRequest = {
          client_id: selectedRowForEditor.client_id,
          obligation_type_id: editorForm.obligation_type_id,
          due_date: editorForm.due_date,
          priority: editorForm.priority,
          description: editorForm.description || null,
        };
        await obligationsApi.createObligation(payload);
        toast.success('Obrigação criada com sucesso.');
      }
      closeEditor();
      await fetchMatrix();
    } catch (error) {
      console.error('Erro ao salvar obrigação', error);
      toast.error(extractApiErrorMessage(error, 'Não foi possível salvar a obrigação.'));
    } finally {
      setIsSavingObligation(false);
    }
  };

  const handleDeleteObligation = async (obligationId: string) => {
    const confirmed = window.confirm('Tem certeza que deseja excluir esta obrigação?');
    if (!confirmed) return;
    try {
      await obligationsApi.deleteObligation(obligationId);
      toast.success('Obrigação excluída com sucesso.');
      await fetchMatrix();
    } catch (error) {
      console.error('Erro ao excluir obrigação', error);
      toast.error(extractApiErrorMessage(error, 'Não foi possível excluir a obrigação.'));
    }
  };

  const handleOpenModal = (
    row: (typeof matrixData)[number],
    obligation: (typeof row.obligations)[number]
  ) => {
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
      obligation_type_name:
        obligation.obligation_type_name || obligation.obligation_type_code || 'Obrigação',
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

  const emptyStateLabel =
    categoryTab === 'office'
      ? 'Nenhuma obrigação do escritório encontrada para os filtros selecionados.'
      : 'Nenhuma empresa encontrada para os filtros selecionados.';

  const renderPanelContent = () => (
    <Card className="mt-6">
      <CardBody className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <MonthYearPicker
            label="Competência"
            value={competency}
            onChange={setCompetency}
            size="sm"
          />
          <DatePickerField
            label="Vencimento de"
            value={dueDateFrom}
            onChange={setDueDateFrom}
            size="sm"
          />
          <DatePickerField
            label="Vencimento até"
            value={dueDateTo}
            onChange={setDueDateTo}
            size="sm"
          />
          <Input
            placeholder={categoryTab === 'office' ? 'Buscar no escritório...' : 'Buscar empresa...'}
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

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canManageObligations && (
            <Button size="sm" variant="bordered" onPress={() => setIsTrashModalOpen(true)}>
              Lixeira
            </Button>
          )}
          <Button size="sm" variant="bordered" onPress={resetFilters}>
            Limpar filtros
          </Button>
        </div>

        {categoryTab === 'clients' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
                  )),
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
                  )),
                ]}
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-default-500">Filtro rápido por letra</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_LETTERS.map((letter) => (
                  <Button
                    key={letter}
                    size="sm"
                    variant={startsWith === letter ? 'solid' : 'bordered'}
                    onPress={() => setStartsWith(letter)}
                  >
                    {letter === 'todos' ? 'Todos' : letter}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {invalidPeriod && (
          <div className="text-sm text-danger">
            O período de vencimento é inválido: a data inicial deve ser anterior à final.
          </div>
        )}

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
          <div className="text-center py-12 text-default-400 text-sm">{emptyStateLabel}</div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="space-y-6">
            {orderedGroups.map((group) => {
              const rows = groupedRows[group] || [];
              if (rows.length === 0) return null;

              return (
                <section key={group} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-default-800">
                      {categoryTab === 'office' ? 'Escritório' : getRegimeLabelSafe(group)}
                    </h3>
                    <span className="text-xs text-default-400">
                      {rows.length} {rows.length === 1 ? 'empresa' : 'empresas'}
                    </span>
                  </div>
                  <Accordion variant="splitted" className="gap-3" selectionMode="multiple">
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
                          <div className="space-y-3">
                            {canManageObligations && (
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  startContent={<Plus className="h-4 w-4" />}
                                  onPress={() =>
                                    openCreateEditor({
                                      client_id: row.client_id,
                                      client_name: row.client_name,
                                      client_cnpj: row.client_cnpj,
                                    })
                                  }
                                >
                                  Nova Obrigação
                                </Button>
                              </div>
                            )}

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
                                      const category =
                                        CATEGORY_MAP[obligation.obligation_type_code || ''] || '-';
                                      const periodicity =
                                        RECURRENCE_LABELS[obligation.recurrence || ''] ||
                                        obligation.recurrence ||
                                        '-';
                                      const statusLabel =
                                        STATUS_LABELS[obligation.status] || obligation.status;
                                      const statusColor =
                                        STATUS_COLORS[obligation.status] || 'default';
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
                                          <td className="px-3 py-3 text-default-600">
                                            {periodicity}
                                          </td>
                                          <td className="px-3 py-3 text-default-600">
                                            {formatDueDate(obligation.due_date)}
                                          </td>
                                          <td className="px-3 py-3">
                                            <Chip size="sm" variant="flat" color={statusColor}>
                                              {statusLabel}
                                            </Chip>
                                          </td>
                                          <td className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                              {isCompleted ? (
                                                <>
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
                                                        handleDownloadReceipt(
                                                          obligation.receipt_url as string
                                                        )
                                                      }
                                                      className="min-w-unit-6"
                                                      title="Baixar comprovante"
                                                    >
                                                      <DownloadIcon className="h-4 w-4" />
                                                    </Button>
                                                  )}
                                                </>
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

                                              {canManageObligations && (
                                                <>
                                                  <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    onPress={() =>
                                                      openEditEditor(
                                                        {
                                                          client_id: row.client_id,
                                                          client_name: row.client_name,
                                                          client_cnpj: row.client_cnpj,
                                                        },
                                                        obligation.id
                                                      )
                                                    }
                                                    title="Editar obrigação"
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() =>
                                                      handleDeleteObligation(obligation.id)
                                                    }
                                                    title="Excluir obrigação"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
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
  );

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

      <Tabs
        selectedKey={categoryTab}
        onSelectionChange={(key) => setCategoryTab(key as MatrixCategory)}
        color="primary"
      >
        <Tab key="clients" title="Empresas">
          {renderPanelContent()}
        </Tab>
        {!isCliente && (
          <Tab key="office" title="Escritório">
            {renderPanelContent()}
          </Tab>
        )}
      </Tabs>

      <Modal isOpen={isEditorOpen} onOpenChange={(open) => (!open ? closeEditor() : null)}>
        <ModalContent>
          <>
            <ModalHeader>{editingObligationId ? 'Editar Obrigação' : 'Nova Obrigação'}</ModalHeader>
            <ModalBody className="space-y-3">
              {selectedRowForEditor && (
                <div className="rounded-medium border border-default-200 p-3 text-sm">
                  <p className="font-semibold text-default-800">
                    {selectedRowForEditor.client_name}
                  </p>
                  <p className="text-default-500">{selectedRowForEditor.client_cnpj}</p>
                </div>
              )}

              {isEditorLoading ? (
                <p className="text-sm text-default-500">Carregando dados da obrigação...</p>
              ) : (
                <>
                  <Select
                    label="Tipo de Obrigação"
                    selectedKeys={
                      editorForm.obligation_type_id ? [editorForm.obligation_type_id] : []
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;
                      setEditorForm((prev) => ({
                        ...prev,
                        obligation_type_id: value || '',
                      }));
                    }}
                    isDisabled={Boolean(editingObligationId)}
                  >
                    {obligationTypes.map((type) => (
                      <SelectItem key={type.id}>{type.name}</SelectItem>
                    ))}
                  </Select>

                  <DatePickerField
                    label="Vencimento"
                    value={editorForm.due_date}
                    onChange={(value) => setEditorForm((prev) => ({ ...prev, due_date: value }))}
                    size="md"
                  />

                  <Select
                    label="Prioridade"
                    selectedKeys={[editorForm.priority]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as ObligationEditorForm['priority'];
                      if (value) {
                        setEditorForm((prev) => ({ ...prev, priority: value }));
                      }
                    }}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key}>{label}</SelectItem>
                    ))}
                  </Select>

                  {editingObligationId && (
                    <Select
                      label="Status"
                      selectedKeys={[editorForm.status]}
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0] as ObligationEditorForm['status'];
                        if (value) {
                          setEditorForm((prev) => ({ ...prev, status: value }));
                        }
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key}>{label}</SelectItem>
                      ))}
                    </Select>
                  )}

                  <Textarea
                    label="Descrição"
                    placeholder="Informações adicionais da obrigação"
                    value={editorForm.description}
                    onValueChange={(value) =>
                      setEditorForm((prev) => ({ ...prev, description: value }))
                    }
                    minRows={3}
                  />
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={closeEditor} isDisabled={isSavingObligation}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={handleSaveObligation}
                isLoading={isSavingObligation}
                isDisabled={isEditorLoading}
              >
                {editingObligationId ? 'Salvar Alterações' : 'Criar Obrigação'}
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <ObligationTrashModal
        isOpen={isTrashModalOpen}
        onOpenChange={setIsTrashModalOpen}
        category={categoryTab}
        year={year}
        month={month}
        title={categoryTab === 'office' ? 'Lixeira do Escritorio' : 'Lixeira por Empresa'}
        onRestored={async () => {
          await fetchMatrix();
        }}
      />

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
