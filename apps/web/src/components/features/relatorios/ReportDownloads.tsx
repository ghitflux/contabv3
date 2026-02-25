'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Spinner,
  Tabs,
  Tab,
} from '@/heroui';
import { useReportHistory } from '@/hooks/useReportHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/lib/toast';
import { Download, RotateCcw, Trash2 } from 'lucide-react';

interface ReportDownloadsProps {
  onEdit?: () => void;
  refreshKey?: number;
}

const formatLabels: Record<string, { label: string; color: 'primary' | 'success' | 'warning' }> = {
  pdf: { label: 'PDF', color: 'primary' },
  csv: { label: 'CSV', color: 'success' },
  xls: { label: 'XLS', color: 'warning' },
};

const reportTypeLabels: Record<string, string> = {
  dre: 'DRE Simplificada',
  fluxo_caixa: 'Fluxo de Caixa',
  livro_caixa: 'Livro Caixa',
  receitas_cliente: 'Receitas por Cliente',
  despesas_categoria: 'Despesas por Categoria',
  projecao_fluxo: 'Projeção de Fluxo',
  kpis: 'Indicadores Financeiros (KPIs)',
  clientes: 'Relatório de Clientes',
  obrigacoes: 'Relatório de Obrigações',
  licencas: 'Relatório de Licenças',
  auditoria: 'Relatório de Auditoria',
};

function formatDateSafe(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
}

function formatDateTimeSafe(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

export function ReportDownloads({ onEdit, refreshKey }: ReportDownloadsProps) {
  const [activeTab, setActiveTab] = useState<'ativos' | 'excluidos'>('ativos');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    history: activeHistory,
    isLoading: isActiveLoading,
    refresh: refreshActive,
    downloadReport,
    deleteReport,
  } = useReportHistory({
    size: 20,
    autoFetch: true,
  });

  const {
    history: deletedHistory,
    isLoading: isDeletedLoading,
    refresh: refreshDeleted,
    restoreReport,
  } = useReportHistory({
    size: 20,
    autoFetch: true,
    include_deleted: true,
    deleted_only: true,
  });

  useEffect(() => {
    if (refreshKey === undefined) return;
    void Promise.all([refreshActive(), refreshDeleted()]).catch((error) => {
      console.error('Erro ao atualizar histórico após gerar relatório', error);
    });
  }, [refreshKey, refreshActive, refreshDeleted]);

  const activeItems = useMemo(() => activeHistory?.items ?? [], [activeHistory]);
  const deletedItems = useMemo(() => deletedHistory?.items ?? [], [deletedHistory]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refreshActive(), refreshDeleted()]);
    } catch (error) {
      console.error('Erro ao atualizar histórico de downloads', error);
      toast.error('Não foi possível atualizar os downloads.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownload = async (reportId: string, fileName?: string) => {
    try {
      setDownloadingId(reportId);
      await downloadReport(reportId, fileName);
      toast.success('Download iniciado com sucesso.');
    } catch (error) {
      console.error('Erro ao baixar relatório', error);
      toast.error('Não foi possível baixar o relatório.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    const confirmed = window.confirm('Mover este relatório para o histórico de excluídos?');
    if (!confirmed) return;

    try {
      setDeletingId(reportId);
      await deleteReport(reportId);
      await refreshDeleted();
      toast.success('Relatório movido para excluídos.');
    } catch (error) {
      console.error('Erro ao excluir relatório', error);
      toast.error('Não foi possível excluir o relatório.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (reportId: string) => {
    try {
      setRestoringId(reportId);
      await restoreReport(reportId);
      await refreshActive();
      toast.success('Relatório restaurado com sucesso.');
    } catch (error) {
      console.error('Erro ao restaurar relatório', error);
      toast.error('Não foi possível restaurar o relatório.');
    } finally {
      setRestoringId(null);
    }
  };

  if (isActiveLoading && !activeHistory && isDeletedLoading && !deletedHistory) {
    return (
      <Card className="border border-default-200 dark:border-default-800/40">
        <CardBody className="flex items-center justify-center gap-2">
          <Spinner size="sm" /> Carregando relatórios gerados...
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border border-default-200 dark:border-default-800/40">
      <CardBody className="p-0">
        <div className="flex flex-col gap-3 border-b border-default-200 p-4 dark:border-default-800/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Relatórios gerados</h3>
            <p className="text-sm text-default-500">
              {activeHistory?.total ?? 0} arquivo{(activeHistory?.total ?? 0) !== 1 ? 's' : ''}{' '}
              disponível{(activeHistory?.total ?? 0) !== 1 ? 'is' : ''} para download
            </p>
          </div>
          <Button
            size="sm"
            variant="flat"
            onPress={handleRefresh}
            isLoading={isRefreshing}
            className="w-full sm:w-auto"
          >
            Atualizar
          </Button>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as 'ativos' | 'excluidos')}
          className="px-4 pt-4"
          color="primary"
          classNames={{
            tabList: 'max-w-full overflow-x-auto no-scrollbar gap-1 px-1',
            tab: 'whitespace-nowrap',
          }}
        >
          <Tab key="ativos" title={`Ativos (${activeHistory?.total ?? 0})`} className="pb-4">
            {activeItems.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="font-semibold">Nenhum relatório ativo no momento.</p>
                <p className="text-default-500 text-sm">
                  Use a aba de Relatórios Essenciais ou Relatório Customizado para gerar novos
                  arquivos.
                </p>
                {onEdit && (
                  <Button color="primary" variant="flat" size="sm" onPress={onEdit}>
                    Criar relatório customizado
                  </Button>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table
                  aria-label="Relatórios gerados para download"
                  removeWrapper
                  className="min-w-[980px]"
                >
                  <TableHeader>
                    <TableColumn>Título</TableColumn>
                    <TableColumn>Formato</TableColumn>
                    <TableColumn>Período</TableColumn>
                    <TableColumn>Gerado em</TableColumn>
                    <TableColumn>Ações</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {activeItems.map((item) => {
                      const formatInfo = formatLabels[item.format] || {
                        label: item.format.toUpperCase(),
                        color: 'primary' as const,
                      };
                      const periodStart = item.filters_used?.period_start;
                      const periodEnd = item.filters_used?.period_end;
                      const reportTypeLabel =
                        reportTypeLabels[item.report_type] || item.report_type.replace(/_/g, ' ');
                      const period =
                        periodStart && periodEnd
                          ? `${formatDateSafe(periodStart)} a ${formatDateSafe(periodEnd)}`
                          : 'Período não informado';

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold">{reportTypeLabel}</TableCell>
                          <TableCell>
                            <Chip size="sm" color={formatInfo.color} variant="flat">
                              {formatInfo.label}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-sm text-default-500">{period}</TableCell>
                          <TableCell className="text-sm text-default-500">
                            {formatDateTimeSafe(item.generated_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="bordered"
                                startContent={<Download className="h-4 w-4" />}
                                onPress={() =>
                                  handleDownload(item.id, item.file_path?.split(/[\\/]/).pop())
                                }
                                isLoading={downloadingId === item.id}
                                isDisabled={Boolean(deletingId) || Boolean(restoringId)}
                              >
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                color="danger"
                                startContent={<Trash2 className="h-4 w-4" />}
                                onPress={() => handleDelete(item.id)}
                                isLoading={deletingId === item.id}
                                isDisabled={Boolean(downloadingId) || Boolean(restoringId)}
                              >
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Tab>

          <Tab key="excluidos" title={`Excluídos (${deletedHistory?.total ?? 0})`} className="pb-4">
            {deletedItems.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="font-semibold">Nenhum relatório excluído.</p>
                <p className="text-default-500 text-sm">
                  Relatórios removidos aparecerão aqui para restauração.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table
                  aria-label="Histórico de relatórios excluídos"
                  removeWrapper
                  className="min-w-[900px]"
                >
                  <TableHeader>
                    <TableColumn>Título</TableColumn>
                    <TableColumn>Formato</TableColumn>
                    <TableColumn>Período</TableColumn>
                    <TableColumn>Excluído em</TableColumn>
                    <TableColumn>Ações</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {deletedItems.map((item) => {
                      const formatInfo = formatLabels[item.format] || {
                        label: item.format.toUpperCase(),
                        color: 'primary' as const,
                      };
                      const periodStart = item.filters_used?.period_start;
                      const periodEnd = item.filters_used?.period_end;
                      const reportTypeLabel =
                        reportTypeLabels[item.report_type] || item.report_type.replace(/_/g, ' ');
                      const period =
                        periodStart && periodEnd
                          ? `${formatDateSafe(periodStart)} a ${formatDateSafe(periodEnd)}`
                          : 'Período não informado';

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold">{reportTypeLabel}</TableCell>
                          <TableCell>
                            <Chip size="sm" color={formatInfo.color} variant="flat">
                              {formatInfo.label}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-sm text-default-500">{period}</TableCell>
                          <TableCell className="text-sm text-default-500">
                            {formatDateTimeSafe(item.deleted_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              startContent={<RotateCcw className="h-4 w-4" />}
                              onPress={() => handleRestore(item.id)}
                              isLoading={restoringId === item.id}
                              isDisabled={Boolean(downloadingId) || Boolean(deletingId)}
                            >
                              Restaurar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
}
