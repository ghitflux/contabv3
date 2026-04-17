'use client';

import { useEffect, useMemo, useState } from 'react';
import {
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
  CheckCircleIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from '@/lib/icons';
import { PlanoDeContasAutocomplete } from '@/components/ui/PlanoDeContasAutocomplete';
import { financeApi } from '@/lib/api/endpoints/finance';
import { toast } from '@/lib/toast';
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

type PreviewRowState = StatementImportRow & {
  local_notes: string;
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));

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

  useEffect(() => {
    if (!isOpen) {
      setSelectedBankId('');
      setFile(null);
      setPreview(null);
      setRows([]);
      setIsLoadingPreview(false);
      setIsCommitting(false);
    }
  }, [isOpen]);

  const selectedCount = useMemo(
    () => rows.filter((row) => row.is_selected).length,
    [rows]
  );

  const selectedWithoutCategory = useMemo(
    () =>
      rows.some((row) => row.is_selected && !(row.category ?? '').trim()),
    [rows]
  );

  const duplicateCount = useMemo(
    () => rows.filter((row) => row.duplicate_suspected).length,
    [rows]
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
      setRows(
        response.rows.map((row) => ({
          ...row,
          local_notes: row.notes ?? '',
        }))
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
      toast.error(typeof message === 'string' ? message : 'Não foi possível concluir a importação.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">Importar Extrato Bancário</h3>
              <p className="text-sm font-normal text-default-500">
                {scopeLabel}
              </p>
            </ModalHeader>
            <ModalBody className="space-y-4">
              {!preview ? (
                <div className="space-y-4">
                  <Card className="border border-default-200/60 dark:border-default-100/20">
                    <CardBody className="space-y-4">
                      <Select
                        label="Conta bancária do sistema"
                        placeholder="Selecione a conta correspondente ao extrato"
                        selectedKeys={selectedBankId ? [selectedBankId] : []}
                        onSelectionChange={(keys) => {
                          const value = Array.from(keys)[0] as string | undefined;
                          setSelectedBankId(value ?? '');
                        }}
                        isDisabled={bankAccounts.length === 0}
                      >
                        {bankAccounts.map((bank) => (
                          <SelectItem key={bank.id}>
                            {bank.name} - {bank.account_number}
                          </SelectItem>
                        ))}
                      </Select>

                      <div className="rounded-xl border border-dashed border-default-300 p-5">
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
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null;
                                setFile(nextFile);
                              }}
                            />
                            {file && (
                              <div className="flex items-center gap-2 text-sm text-default-600">
                                <FileTextIcon className="h-4 w-4" />
                                <span>{file.name}</span>
                                <Chip size="sm" variant="flat">
                                  {fileFormatLabel(file.name)}
                                </Chip>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {bankAccounts.length === 0 && (
                        <p className="text-sm text-danger-500">
                          Cadastre ao menos uma conta bancária antes de importar extratos.
                        </p>
                      )}
                    </CardBody>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Card className="border border-default-200/60 dark:border-default-100/20">
                      <CardBody className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                          Formato
                        </p>
                        <p className="text-lg font-semibold uppercase">
                          {preview.source_format}
                        </p>
                        <p className="text-xs text-default-500">{preview.original_filename}</p>
                      </CardBody>
                    </Card>
                    <Card className="border border-default-200/60 dark:border-default-100/20">
                      <CardBody className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                          Conta detectada
                        </p>
                        <p className="text-base font-semibold">
                          {preview.detected_account_number || 'Não detectada'}
                        </p>
                        <p className="text-xs text-default-500">
                          {preview.detected_bank_name || 'Banco não identificado'}
                        </p>
                      </CardBody>
                    </Card>
                    <Card className="border border-default-200/60 dark:border-default-100/20">
                      <CardBody className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                          Período
                        </p>
                        <p className="text-base font-semibold">
                          {formatDate(preview.period_start)} até {formatDate(preview.period_end)}
                        </p>
                        <p className="text-xs text-default-500">
                          Saldo inicial {formatCurrency(preview.opening_balance)}
                        </p>
                      </CardBody>
                    </Card>
                    <Card className="border border-default-200/60 dark:border-default-100/20">
                      <CardBody className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                          Resumo
                        </p>
                        <p className="text-base font-semibold">
                          {preview.total_rows} linha(s)
                        </p>
                        <p className="text-xs text-default-500">
                          {duplicateCount} duplicado(s) suspeito(s)
                        </p>
                        <p className="text-xs text-default-500">
                          Entradas {formatCurrency(preview.total_income)} | Saídas {formatCurrency(preview.total_expense)}
                        </p>
                      </CardBody>
                    </Card>
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-warning-300/50 bg-warning-50/60 p-3 text-sm text-warning-900 dark:border-warning-700/50 dark:bg-warning-900/10 dark:text-warning-100">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>{selectedCount} linha(s) selecionada(s) para importação</span>
                    </div>
                    <p>
                      Linhas marcadas como duplicado suspeito entram desmarcadas por padrão.
                    </p>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <Table
                      aria-label="Prévia da importação de extrato"
                      removeWrapper
                      className="min-w-[1300px]"
                    >
                      <TableHeader>
                        <TableColumn>Importar</TableColumn>
                        <TableColumn>Data</TableColumn>
                        <TableColumn>Tipo</TableColumn>
                        <TableColumn>Descrição</TableColumn>
                        <TableColumn className="text-right">Valor</TableColumn>
                        <TableColumn className="text-right">Saldo</TableColumn>
                        <TableColumn>Categoria</TableColumn>
                        <TableColumn>Observação</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="Nenhuma linha detectada">
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <Checkbox
                                  isSelected={row.is_selected}
                                  onValueChange={(checked) =>
                                    setRows((prev) =>
                                      prev.map((item) =>
                                        item.id === row.id
                                          ? { ...item, is_selected: checked }
                                          : item
                                      )
                                    )
                                  }
                                />
                                {row.duplicate_suspected && (
                                  <Chip size="sm" color="warning" variant="flat">
                                    Duplicado
                                  </Chip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(row.transaction_date)}</TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                color={row.transaction_type === 'receita' ? 'success' : 'warning'}
                                variant="flat"
                              >
                                {movementLabel(row.transaction_type)}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{row.description}</p>
                                <p className="text-xs text-default-500">
                                  {row.duplicate_reason || row.raw_description || '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(row.amount_signed)}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.balance_after != null ? formatCurrency(row.balance_after) : '-'}
                            </TableCell>
                            <TableCell>
                              <PlanoDeContasAutocomplete
                                value={row.category ?? null}
                                onChange={(value) =>
                                  setRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, category: value ?? null }
                                        : item
                                    )
                                  )
                                }
                                label=""
                                placeholder="Categoria"
                                isDisabled={!row.is_selected}
                                size="sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                size="sm"
                                placeholder="Observação opcional"
                                value={row.local_notes}
                                onValueChange={(value) =>
                                  setRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, local_notes: value }
                                        : item
                                    )
                                  )
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              {preview ? (
                <>
                  <Button
                    variant="light"
                    startContent={<XIcon className="h-4 w-4" />}
                    onPress={() => {
                      setPreview(null);
                      setRows([]);
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
                  >
                    Confirmar Importação
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
