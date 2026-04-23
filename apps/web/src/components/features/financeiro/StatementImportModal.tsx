'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Chip,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@/heroui';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from '@/lib/icons';
import { financeApi } from '@/lib/api/endpoints/finance';
import { toast } from '@/lib/toast';
import { PLANO_DE_CONTAS, formatConta } from '@/constants/planoDeContas';
import type { BankAccount } from '@/types/bank-account';
import type {
  StatementImportPreviewResponse,
  StatementImportRow,
  TransactionType,
} from '@/types/finance';

interface StatementImportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccounts: BankAccount[];
  scopeLabel: string;
  onImported?: () => Promise<unknown> | void;
}

const ACCEPTED_STATEMENT_FILES = '.pdf,.ofx,.csv';
const PAGE_SIZE = 10;

type PreviewRowState = StatementImportRow & {
  local_notes: string;
  auto_suggested: boolean;
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value ?? 0)
  );

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const movementLabel = (transactionType: TransactionType) =>
  transactionType === 'receita' ? 'Entrada' : 'Saída';

const fileFormatLabel = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'CSV';
  if (lower.endsWith('.ofx')) return 'OFX';
  if (lower.endsWith('.pdf')) return 'PDF';
  return 'Arquivo';
};

function normalizeStr(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function suggestCategory(description: string, txType: TransactionType): string | null {
  const t = normalizeStr(description);

  if (txType === 'receita') {
    if (/honorar|mensalidade/.test(t)) return '1.1.04';
    if (/comissao/.test(t)) return '1.1.03';
    if (/rendimento|aplicacao|cdb|fundo/.test(t)) return '1.2.02';
    if (/juro recebido/.test(t)) return '1.2.01';
    return null;
  }

  if (/aluguel/.test(t)) return '2.1.01';
  if (/agua|sabesp|caema|saneago|sanasa|embasa|cagepa|agespisa|saaeg/.test(t)) return '2.1.02';
  if (
    /energia eletrica|celpe|coelba|cemig|eletropaulo|copel|enel |elektro|light |neoenergia|equatorial eletric|enerj|ceee/.test(
      t
    )
  )
    return '2.1.03';
  if (/internet|telefon|vivo|claro|\btim\b|\boi\b|nextel|banda larga/.test(t)) return '2.1.04';
  if (
    /tarifa bancaria|taxa bancaria|manutencao conta|anuidade cartao|pacote bancario|cobranca bancaria/.test(
      t
    )
  )
    return '2.1.09';
  if (/software|sistema|licenca|assinatura|saas/.test(t)) return '2.1.08';
  if (/marketing|publicidade|propaganda/.test(t)) return '2.3.01';
  if (/google ads|facebook ads|instagram|trafego pago/.test(t)) return '2.3.02';
  if (/salario|folha de pagamento|pagamento funcionario/.test(t)) return '2.2.01';
  if (/pro.?labore|retirada socio/.test(t)) return '2.2.02';
  if (/\binss\b/.test(t)) return '2.2.03';
  if (/\bfgts\b/.test(t)) return '2.2.04';
  if (/vale alimentacao|vale refeicao|\bva\b|\bvt\b/.test(t)) return '2.2.05';
  if (/\bdas\b|simples nacional/.test(t)) return '2.5.01';
  if (/\birpj\b/.test(t)) return '2.5.02';
  if (/\bcsll\b/.test(t)) return '2.5.03';
  if (/\bpis\b/.test(t)) return '2.5.04';
  if (/\bcofins\b/.test(t)) return '2.5.05';
  if (/\biss\b/.test(t)) return '2.5.06';
  if (/\bicms\b/.test(t)) return '2.5.07';
  if (/\bipi\b/.test(t)) return '2.5.09';
  if (/\biof\b/.test(t)) return '2.4.03';
  if (/\birrf\b/.test(t)) return '2.5.10';
  if (/inss patronal|\bcpp\b/.test(t)) return '2.5.11';
  if (/\bdarf\b|\bgps\b|\bgare\b|\bdae\b/.test(t)) return '2.5.13';
  if (/\biptu\b|\bipva\b/.test(t)) return '2.5.17';
  if (/juro bancario|encargo financeiro/.test(t)) return '2.4.01';
  if (/material escritorio|papelaria/.test(t)) return '2.1.05';

  return null;
}

export function StatementImportModal({
  isOpen,
  onOpenChange,
  bankAccounts,
  scopeLabel,
  onImported,
}: StatementImportModalProps) {
  const [selectedBankId, setSelectedBankId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementImportPreviewResponse | null>(null);
  const [rows, setRows] = useState<PreviewRowState[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      setSelectedBankId('');
      setFile(null);
      setPreview(null);
      setRows([]);
      setPage(1);
      setIsLoadingPreview(false);
      setIsCommitting(false);
    }
  }, [isOpen]);

  const selectedCount = useMemo(() => rows.filter((r) => r.is_selected).length, [rows]);
  const selectedWithoutCategory = useMemo(
    () => rows.some((r) => r.is_selected && !(r.category ?? '').trim()),
    [rows]
  );
  const duplicateCount = useMemo(() => rows.filter((r) => r.duplicate_suspected).length, [rows]);
  const autoSuggestedCount = useMemo(() => rows.filter((r) => r.auto_suggested).length, [rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const handlePreview = async () => {
    if (!selectedBankId) {
      toast.error('Selecione a conta bancária do extrato.');
      return;
    }
    if (!file) {
      toast.error('Selecione um arquivo PDF, OFX ou CSV.');
      return;
    }
    try {
      setIsLoadingPreview(true);
      const response = await financeApi.previewStatementImport(selectedBankId, file);
      setPreview(response);
      setPage(1);
      setRows(
        response.rows.map((row) => {
          const serverCategory = row.category ?? null;
          const suggested =
            serverCategory ?? suggestCategory(row.description, row.transaction_type);
          return {
            ...row,
            category: suggested,
            local_notes: row.notes ?? '',
            auto_suggested: !serverCategory && !!suggested,
          };
        })
      );
    } catch (error) {
      console.error('Erro ao gerar prévia do extrato', error);
      const message = (error as { data?: { detail?: string } })?.data?.detail;
      toast.error(typeof message === 'string' ? message : 'Não foi possível gerar a prévia.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    if (selectedCount === 0) {
      toast.error('Selecione ao menos uma linha para importar.');
      return;
    }
    if (selectedWithoutCategory) {
      toast.error('Todas as linhas selecionadas precisam de categoria.');
      return;
    }
    try {
      setIsCommitting(true);
      const response = await financeApi.commitStatementImport(preview.import_id, {
        rows: rows.map((row) => ({
          row_id: row.id,
          is_selected: row.is_selected,
          category: row.category ?? null,
          notes: row.local_notes.trim() || null,
        })),
      });
      toast.success(
        `${response.imported_count} lançamento(s) importado(s), ${response.skipped_count} ignorado(s).`
      );
      await onImported?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao confirmar importação do extrato', error);
      const message = (error as { data?: { detail?: string } })?.data?.detail;
      toast.error(
        typeof message === 'string' ? message : 'Não foi possível concluir a importação.'
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const updateRowCategory = useCallback((rowId: string, value: string | null) => {
    setRows((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, category: value, auto_suggested: false } : item
      )
    );
  }, []);

  const updateRowNotes = useCallback((rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, local_notes: value } : item))
    );
  }, []);

  const toggleRowSelected = useCallback((rowId: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, is_selected: checked } : item))
    );
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-w-[96vw] w-[96vw] md:max-w-[calc(100vw-17rem)] md:w-[calc(100vw-17rem)] max-h-[92vh]',
        body: 'gap-4',
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-divider pb-3">
              <h3 className="text-lg font-semibold text-foreground">Importar Extrato Bancário</h3>
              <p className="text-sm font-normal text-default-500">{scopeLabel}</p>
            </ModalHeader>

            <ModalBody>
              {!preview ? (
                /* ── Step 1: file selection ── */
                <Card className="border border-divider">
                  <CardBody className="space-y-4 p-5">
                    <Select
                      label="Conta bancária do sistema"
                      placeholder="Selecione a conta correspondente ao extrato"
                      selectedKeys={
                        selectedBankId ? new Set<string>([selectedBankId]) : new Set<string>()
                      }
                      onSelectionChange={(keys) => {
                        if (typeof keys === 'string') return;
                        const arr = [...keys] as string[];
                        setSelectedBankId(arr[0] ?? '');
                      }}
                      isDisabled={bankAccounts.length === 0}
                      variant="bordered"
                      classNames={{
                        trigger: 'bg-content1',
                        popoverContent: 'bg-content1 border border-divider shadow-lg',
                      }}
                    >
                      {bankAccounts.map((bank) => (
                        <SelectItem
                          key={bank.id}
                          textValue={`${bank.name} — ${bank.account_number}`}
                        >
                          {bank.name} — {bank.account_number}
                        </SelectItem>
                      ))}
                    </Select>

                    <div className="rounded-xl border border-dashed border-default-300 p-5 dark:border-default-200">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <UploadIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Arquivo do extrato
                            </p>
                            <p className="text-xs text-default-500">
                              PDF com texto nativo, OFX ou CSV.
                            </p>
                          </div>
                          <input
                            type="file"
                            accept={ACCEPTED_STATEMENT_FILES}
                            className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                            onChange={(event) => {
                              const nextFile = event.target.files?.[0] ?? null;
                              setFile(nextFile);
                            }}
                          />
                          {file && (
                            <div className="flex items-center gap-2 text-sm text-default-600">
                              <FileTextIcon className="h-4 w-4" />
                              <span className="truncate">{file.name}</span>
                              <Chip size="sm" variant="flat" color="primary">
                                {fileFormatLabel(file.name)}
                              </Chip>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {bankAccounts.length === 0 && (
                      <p className="text-sm text-danger">
                        Cadastre ao menos uma conta bancária antes de importar extratos.
                      </p>
                    )}
                  </CardBody>
                </Card>
              ) : (
                /* ── Step 2: preview table ── */
                <div className="flex flex-col gap-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Card className="border border-divider">
                      <CardBody className="space-y-1 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                          Formato
                        </p>
                        <p className="text-base font-bold uppercase text-foreground">
                          {preview.source_format}
                        </p>
                        <p className="truncate text-xs text-default-500">
                          {preview.original_filename}
                        </p>
                      </CardBody>
                    </Card>
                    <Card className="border border-divider">
                      <CardBody className="space-y-1 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                          Conta detectada
                        </p>
                        <p className="text-base font-bold text-foreground">
                          {preview.detected_account_number || 'Não detectada'}
                        </p>
                        <p className="text-xs text-default-500">
                          {preview.detected_bank_name || 'Banco não identificado'}
                        </p>
                      </CardBody>
                    </Card>
                    <Card className="border border-divider">
                      <CardBody className="space-y-1 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                          Período
                        </p>
                        <p className="text-sm font-bold text-foreground">
                          {formatDate(preview.period_start)} até {formatDate(preview.period_end)}
                        </p>
                        <p className="text-xs text-default-500">
                          Saldo inicial {formatCurrency(preview.opening_balance)}
                        </p>
                      </CardBody>
                    </Card>
                    <Card className="border border-divider">
                      <CardBody className="space-y-1 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                          Resumo
                        </p>
                        <p className="text-base font-bold text-foreground">
                          {preview.total_rows} linha(s)
                        </p>
                        <p className="text-xs text-default-500">
                          {duplicateCount} duplicado(s) suspeito(s)
                        </p>
                        <p className="text-xs text-default-500">
                          E {formatCurrency(preview.total_income)} | S{' '}
                          {formatCurrency(preview.total_expense)}
                        </p>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Status bar — dark mode friendly */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/40">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      {selectedCount} de {preview.total_rows} linha(s) selecionada(s) para
                      importação
                    </span>
                    {duplicateCount > 0 && (
                      <Chip size="sm" color="warning" variant="flat">
                        {duplicateCount} duplicado(s) desmarcado(s)
                      </Chip>
                    )}
                    {autoSuggestedCount > 0 && (
                      <Chip
                        size="sm"
                        color="secondary"
                        variant="flat"
                        startContent={<SparklesIcon className="h-3 w-3" />}
                      >
                        {autoSuggestedCount} categoria(s) sugerida(s)
                      </Chip>
                    )}
                    {selectedWithoutCategory && (
                      <Chip size="sm" color="danger" variant="flat">
                        Há linhas selecionadas sem categoria
                      </Chip>
                    )}
                  </div>

                  {/* Table — paginated to 10 items for performance */}
                  <div className="w-full overflow-x-auto rounded-xl border border-divider">
                    <Table
                      aria-label="Prévia da importação de extrato"
                      removeWrapper
                      isStriped
                      classNames={{
                        th: 'bg-default-100 dark:bg-default-50/10 text-default-600 font-semibold text-xs uppercase tracking-wide',
                        td: 'py-2',
                      }}
                    >
                      <TableHeader>
                        <TableColumn width={72}>Importar</TableColumn>
                        <TableColumn width={90}>Data</TableColumn>
                        <TableColumn width={80}>Tipo</TableColumn>
                        <TableColumn width={180}>Descrição</TableColumn>
                        <TableColumn width={110} className="text-right">
                          Valor
                        </TableColumn>
                        <TableColumn width={110} className="text-right">
                          Saldo
                        </TableColumn>
                        <TableColumn width={230}>Categoria</TableColumn>
                        <TableColumn width={160}>Observação</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="Nenhuma linha detectada">
                        {paginatedRows.map((row) => (
                          <TableRow
                            key={row.id}
                            className={
                              row.duplicate_suspected
                                ? 'opacity-60'
                                : row.committed_transaction_id
                                  ? 'opacity-50'
                                  : undefined
                            }
                          >
                            {/* Checkbox */}
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <Checkbox
                                  isSelected={row.is_selected}
                                  onValueChange={(checked) => toggleRowSelected(row.id, checked)}
                                  isDisabled={!!row.committed_transaction_id}
                                />
                                {row.duplicate_suspected && (
                                  <Chip
                                    size="sm"
                                    color="warning"
                                    variant="flat"
                                    startContent={<AlertCircleIcon className="h-3 w-3" />}
                                  >
                                    Duplicado
                                  </Chip>
                                )}
                                {row.committed_transaction_id && (
                                  <Chip size="sm" color="success" variant="flat">
                                    Já importado
                                  </Chip>
                                )}
                              </div>
                            </TableCell>

                            {/* Date */}
                            <TableCell>
                              <span className="text-sm tabular-nums">
                                {formatDate(row.transaction_date)}
                              </span>
                            </TableCell>

                            {/* Type */}
                            <TableCell>
                              <Chip
                                size="sm"
                                color={row.transaction_type === 'receita' ? 'success' : 'danger'}
                                variant="flat"
                              >
                                {movementLabel(row.transaction_type)}
                              </Chip>
                            </TableCell>

                            {/* Description — truncated */}
                            <TableCell>
                              <div className="max-w-[180px] space-y-0.5">
                                <p
                                  className="truncate text-sm font-medium text-foreground"
                                  title={row.description}
                                >
                                  {row.description}
                                </p>
                                {(row.raw_description || row.duplicate_reason) && (
                                  <p className="truncate text-xs text-default-400">
                                    {row.duplicate_reason ?? row.raw_description}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            {/* Amount */}
                            <TableCell className="text-right">
                              <span
                                className={`text-sm font-semibold tabular-nums ${
                                  row.transaction_type === 'receita'
                                    ? 'text-success-600 dark:text-success-400'
                                    : 'text-danger-600 dark:text-danger-400'
                                }`}
                              >
                                {formatCurrency(row.amount_signed)}
                              </span>
                            </TableCell>

                            {/* Balance */}
                            <TableCell className="text-right">
                              <span className="text-sm tabular-nums text-default-600">
                                {row.balance_after != null
                                  ? formatCurrency(row.balance_after)
                                  : '—'}
                              </span>
                            </TableCell>

                            {/* Category — autocomplete with search */}
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-col gap-1">
                                <Autocomplete
                                  aria-label="Categoria"
                                  size="sm"
                                  placeholder="Buscar categoria..."
                                  selectedKey={row.category ?? null}
                                  onSelectionChange={(key) =>
                                    updateRowCategory(row.id, key ? String(key) : null)
                                  }
                                  isDisabled={!row.is_selected}
                                  variant="flat"
                                  isClearable={false}
                                  classNames={{
                                    base: 'max-w-full',
                                    listboxWrapper: 'max-h-[220px]',
                                    popoverContent:
                                      'bg-content1 dark:bg-content1 border border-divider shadow-xl',
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {PLANO_DE_CONTAS.map((conta) => (
                                    <AutocompleteItem
                                      key={conta.codigo}
                                      textValue={formatConta(conta)}
                                    >
                                      {formatConta(conta)}
                                    </AutocompleteItem>
                                  ))}
                                </Autocomplete>
                                {row.auto_suggested && row.category && (
                                  <span className="flex items-center gap-1 text-xs text-secondary-500">
                                    <SparklesIcon className="h-3 w-3" />
                                    Sugerida automaticamente
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Notes */}
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Input
                                size="sm"
                                placeholder="Observação opcional"
                                value={row.local_notes}
                                isDisabled={!row.is_selected}
                                variant="flat"
                                classNames={{
                                  inputWrapper:
                                    'bg-default-100 dark:bg-default-50/10 h-8 min-h-8',
                                  input: 'text-xs',
                                }}
                                onChange={(e) => updateRowNotes(row.id, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-default-400">
                        Página {page} de {pageCount} — {rows.length} linha(s) no total
                      </span>
                      <Pagination
                        total={pageCount}
                        page={page}
                        onChange={setPage}
                        size="sm"
                        showControls
                        classNames={{ cursor: 'bg-primary text-white' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-t border-divider pt-3">
              {preview ? (
                <>
                  <Button
                    variant="light"
                    startContent={<XIcon className="h-4 w-4" />}
                    onPress={() => {
                      setPreview(null);
                      setRows([]);
                      setPage(1);
                    }}
                    isDisabled={isCommitting}
                  >
                    Voltar
                  </Button>
                  <Button
                    color="primary"
                    startContent={<FileSpreadsheetIcon className="h-4 w-4" />}
                    onPress={handleCommit}
                    isLoading={isCommitting}
                    isDisabled={selectedCount === 0 || selectedWithoutCategory}
                  >
                    Confirmar Importação ({selectedCount})
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="light" onPress={onClose} isDisabled={isLoadingPreview}>
                    Cancelar
                  </Button>
                  <Button
                    color="primary"
                    startContent={<UploadIcon className="h-4 w-4" />}
                    onPress={handlePreview}
                    isLoading={isLoadingPreview}
                    isDisabled={bankAccounts.length === 0}
                  >
                    Ler Extrato
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
