'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Switch,
} from '@/heroui';
import { DownloadIcon, EyeIcon, PlusIcon, XIcon } from '@/lib/icons';
import { useEffect, useMemo, useState } from 'react';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { clientsApi } from '@/lib/api/endpoints/clients';
import { financeApi } from '@/lib/api/endpoints/finance';
import { licensesApi } from '@/lib/api/endpoints/licenses';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/masks';
import { useAuth } from '@/hooks/auth/AuthContext';
import type { ClientListItem } from '@/types/client';
import type { ObligationListResponse } from '@/types/obligation';
import type { ActivityListResponse } from '@/types/activity';

interface ReportBuilderProps {
  onClose: () => void;
}

type DataSource = 'clients' | 'transactions' | 'obligations' | 'licenses' | 'activities';

const dataSourceFields = {
  clients: [
    'razao_social',
    'nome_fantasia',
    'cnpj',
    'email',
    'status',
    'honorarios_mensais',
    'regime_tributario',
    'tipo_empresa',
    'created_at',
  ],
  transactions: [
    'client_name',
    'client_cnpj',
    'reference_month',
    'due_date',
    'paid_date',
    'transaction_type',
    'payment_status',
    'amount',
    'description',
  ],
  obligations: [
    'client_name',
    'client_cnpj',
    'obligation_type_name',
    'status',
    'priority',
    'due_date',
    'completed_at',
  ],
  licenses: [
    'client_name',
    'license_type',
    'status',
    'registration_number',
    'issuing_authority',
    'issue_date',
    'expiration_date',
    'fee',
    'fee_paid',
  ],
  activities: [
    'title',
    'status',
    'priority',
    'assigned_to_id',
    'due_date',
    'labels',
    'recurrence',
    'created_at',
  ],
};

const dataSourceLabels = {
  clients: 'Clientes',
  transactions: 'Transações Financeiras',
  obligations: 'Obrigações',
  licenses: 'Licenças',
  activities: 'Atividades',
};

const operatorLabels: Record<string, string> = {
  equals: 'Igual a',
  contains: 'Contém',
  greater: 'Maior que',
  less: 'Menor que',
};

const currencyFields = new Set(['amount', 'fee', 'honorarios_mensais']);
const dateFields = new Set([
  'reference_month',
  'due_date',
  'paid_date',
  'issue_date',
  'expiration_date',
]);
const dateTimeFields = new Set(['created_at', 'completed_at']);
const booleanFields = new Set(['fee_paid']);

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const fieldLabels: Record<string, string> = {
  razao_social: 'Razão Social',
  nome_fantasia: 'Nome Fantasia',
  cnpj: 'CNPJ',
  email: 'E-mail',
  status: 'Status',
  honorarios_mensais: 'Honorário Mensal',
  regime_tributario: 'Regime Tributário',
  tipo_empresa: 'Tipo de Empresa',
  created_at: 'Criado em',
  reference_month: 'Competência',
  due_date: 'Vencimento',
  paid_date: 'Pago em',
  description: 'Descrição',
  transaction_type: 'Tipo',
  payment_status: 'Status de Pagamento',
  amount: 'Valor',
  client_name: 'Cliente',
  client_cnpj: 'CNPJ do Cliente',
  obligation_type_name: 'Obrigação',
  priority: 'Prioridade',
  completed_at: 'Concluído em',
  license_type: 'Tipo de Licença',
  registration_number: 'Número de Registro',
  issuing_authority: 'Órgão Emissor',
  issue_date: 'Emissão',
  expiration_date: 'Validade',
  fee: 'Taxa',
  fee_paid: 'Taxa Paga',
  title: 'Título',
  priority: 'Prioridade',
  assigned_to_id: 'Responsável',
  labels: 'Etiquetas',
  recurrence: 'Recorrência',
};

export function ReportBuilder({ onClose }: ReportBuilderProps) {
  const { user } = useAuth();
  const isAdminOrFunc = user?.role !== 'cliente';
  const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? '';
  const [reportName, setReportName] = useState('');
  const [dataSource, setDataSource] = useState<DataSource>('clients');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: string }>>(
    []
  );
  const [groupBy, setGroupBy] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reportRows, setReportRows] = useState<Record<string, any>[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isOfficeReport, setIsOfficeReport] = useState(false);

  const availableFields = dataSourceFields[dataSource];
  const supportsClientFilter = useMemo(
    () => ['clients', 'transactions', 'obligations', 'licenses'].includes(dataSource),
    [dataSource]
  );

  useEffect(() => {
    if (!supportsClientFilter) {
      setSelectedClientId(null);
      setIsOfficeReport(false);
    }
  }, [supportsClientFilter]);

  useEffect(() => {
    if (!isAdminOrFunc || !supportsClientFilter) return;
    let active = true;
    (async () => {
      try {
        const res = await clientsApi.list({ query: clientSearch || undefined, size: 20 });
        if (active) setClientOptions(res.items);
      } catch (error) {
        console.error('Erro ao buscar clientes para relatório', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [clientSearch, isAdminOrFunc, supportsClientFilter]);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const addFilter = () => {
    setFilters([...filters, { field: availableFields[0], operator: 'equals', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, key: string, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [key]: value };
    setFilters(newFilters);
  };

  const resolveClientFilter = () => {
    if (!isAdminOrFunc || !supportsClientFilter) return null;
    if (isOfficeReport && OFFICE_CLIENT_ID) return OFFICE_CLIENT_ID;
    return selectedClientId;
  };

  const fetchRowsForSource = async () => {
    const clientId = resolveClientFilter();
    switch (dataSource) {
      case 'clients': {
        const response = await clientsApi.list({ page: 1, size: 100 });
        return response.items
          .filter((client) => (!clientId ? true : client.id === clientId))
          .map((client) => ({
            razao_social: client.razao_social,
            nome_fantasia: client.nome_fantasia,
            cnpj: client.cnpj,
            email: client.email,
            status: client.status,
            honorarios_mensais: client.honorarios_mensais,
            regime_tributario: client.regime_tributario,
            tipo_empresa: client.tipo_empresa,
            created_at: client.created_at,
          }));
      }
      case 'transactions': {
        const response = await financeApi.getTransactions({
          client_id: clientId || undefined,
          page: 1,
          size: 100,
        });
        return response.items.map((tx) => ({
          client_name: tx.client_name,
          client_cnpj: tx.client_cnpj,
          reference_month: tx.reference_month,
          due_date: tx.due_date,
          paid_date: tx.paid_date,
          transaction_type: tx.transaction_type,
          payment_status: tx.payment_status,
          amount: tx.amount,
          description: tx.description,
        }));
      }
      case 'obligations': {
        const params = new URLSearchParams();
        if (clientId) params.append('client_id', clientId);
        params.append('skip', '0');
        params.append('limit', '100');
        const queryString = params.toString();
        const endpoint = queryString ? `/obligations?${queryString}` : '/obligations';
        const response = await apiClient.get<ObligationListResponse>(endpoint);
        return response.items.map((obligation) => ({
          client_name: obligation.client_name,
          client_cnpj: obligation.client_cnpj,
          obligation_type_name: obligation.obligation_type_name,
          status: obligation.status,
          priority: obligation.priority,
          due_date: obligation.due_date,
          completed_at: obligation.completed_at,
        }));
      }
      case 'licenses': {
        const response = await licensesApi.list({
          client_id: clientId || undefined,
          page: 1,
          size: 100,
        });
        return response.items.map((license) => ({
          client_name: license.client_name,
          license_type: license.license_type,
          status: license.status,
          registration_number: license.registration_number,
          issuing_authority: license.issuing_authority,
          issue_date: license.issue_date,
          expiration_date: license.expiration_date,
          fee: license.fee,
          fee_paid: license.fee_paid,
        }));
      }
      case 'activities': {
        const params = new URLSearchParams();
        params.append('skip', '0');
        params.append('limit', '100');
        const response = await apiClient.get<ActivityListResponse>(`/activities?${params}`);
        return response.items.map((activity) => ({
          title: activity.title,
          status: activity.status,
          priority: activity.priority,
          assigned_to_id: activity.assigned_to_id,
          due_date: activity.due_date,
          labels: activity.labels,
          recurrence: activity.recurrence,
          created_at: activity.created_at,
        }));
      }
      default:
        return [];
    }
  };

  const toComparable = (value: unknown) => {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return value;
  };

  const parseComparable = (value: unknown) => {
    const raw = toComparable(value);
    if (typeof raw === 'number') {
      return { type: 'number', value: raw };
    }
    const text = String(raw).trim();
    const asNumber = Number(text);
    if (!Number.isNaN(asNumber) && text !== '') {
      return { type: 'number', value: asNumber };
    }
    const asDate = Date.parse(text);
    if (!Number.isNaN(asDate)) {
      return { type: 'date', value: asDate };
    }
    return { type: 'string', value: text.toLowerCase() };
  };

  const applyFilters = (rows: Record<string, any>[]) => {
    if (filters.length === 0) return rows;
    return rows.filter((row) =>
      filters.every((filter) => {
        const rawValue = row[filter.field];
        const left = parseComparable(rawValue);
        const right = parseComparable(filter.value);

        if (filter.operator === 'equals') {
          return String(left.value) === String(right.value);
        }
        if (filter.operator === 'contains') {
          return String(left.value).includes(String(right.value));
        }
        if (filter.operator === 'greater') {
          return left.value > right.value;
        }
        if (filter.operator === 'less') {
          return left.value < right.value;
        }
        return true;
      })
    );
  };

  const applySort = (rows: Record<string, any>[]) => {
    const primaryKey = groupBy || sortBy;
    const secondaryKey = groupBy && sortBy && groupBy !== sortBy ? sortBy : null;
    if (!primaryKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      const leftPrimary = parseComparable(a[primaryKey]);
      const rightPrimary = parseComparable(b[primaryKey]);
      if (leftPrimary.value === rightPrimary.value && secondaryKey) {
        const leftSecondary = parseComparable(a[secondaryKey]);
        const rightSecondary = parseComparable(b[secondaryKey]);
        if (leftSecondary.value === rightSecondary.value) return 0;
        return leftSecondary.value > rightSecondary.value ? 1 : -1;
      }
      if (leftPrimary.value === rightPrimary.value) return 0;
      return leftPrimary.value > rightPrimary.value ? 1 : -1;
    });
    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  };

  const loadReportRows = async () => {
    const requiresClient = isAdminOrFunc && supportsClientFilter;
    if (requiresClient && isOfficeReport && !OFFICE_CLIENT_ID) {
      toast.error('Nenhum cliente de escritório configurado.');
      return [];
    }

    setIsLoading(true);
    try {
      const rows = await fetchRowsForSource();
      const filtered = applyFilters(rows);
      return applySort(filtered);
    } catch (error) {
      console.error('Erro ao gerar relatório', error);
      toast.error('Não foi possível gerar o relatório. Tente novamente.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldLabel = (field: string) => fieldLabels[field] || field;

  const resolveScopeLabel = (rows?: Record<string, any>[]) => {
    if (!isAdminOrFunc || !supportsClientFilter) return 'Meu acesso';
    if (isOfficeReport) return 'Escritório';
    if (selectedClientId) {
      const selected = clientOptions.find((client) => client.id === selectedClientId);
      if (selected) return selected.nome_fantasia || selected.razao_social;
      if (rows && rows.length > 0) {
        const sample = rows[0];
        return (
          sample.client_name ||
          sample.razao_social ||
          sample.nome_fantasia ||
          sample.client_cnpj ||
          'Cliente selecionado'
        );
      }
      return 'Cliente selecionado';
    }
    return 'Todos os clientes';
  };

  const buildFiltersSummary = () => {
    if (filters.length === 0) return 'Nenhum';
    return filters
      .map((filter) => {
        const label = getFieldLabel(filter.field);
        const operator = operatorLabels[filter.operator] || filter.operator;
        const value = filter.value?.trim() ? filter.value.trim() : '(vazio)';
        return `${label} ${operator} ${value}`;
      })
      .join(' | ');
  };

  const buildFileName = (extension: string) => {
    const baseName =
      reportName.trim() || `relatorio-${dataSourceLabels[dataSource] || dataSource}`;
    const sanitized = sanitizeFileName(baseName);
    const safeName = sanitized || 'relatorio';
    return `${safeName}.${extension}`;
  };

  const resolveBooleanLabel = (raw: unknown) => {
    if (typeof raw === 'boolean') return raw ? 'Sim' : 'Não';
    if (typeof raw === 'number') return raw === 0 ? 'Não' : 'Sim';
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (!normalized) return '';
      const ascii = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (['true', 'sim', 'yes', '1', 'pago', 'paga'].includes(ascii)) return 'Sim';
      if (['false', 'nao', 'no', '0', 'nao pago', 'nao_pago', 'nao-pago'].includes(ascii)) {
        return 'Não';
      }
    }
    return null;
  };

  const formatExportValue = (field: string, value: unknown) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (booleanFields.has(field)) {
      const booleanLabel = resolveBooleanLabel(value);
      if (booleanLabel !== null) return booleanLabel;
    }
    if (currencyFields.has(field)) {
      const numericValue =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isNaN(numericValue)) return formatCurrency(numericValue);
      return String(value);
    }
    if (dateTimeFields.has(field)) {
      const formatted = formatDateTime(value as string | Date);
      return formatted || String(value);
    }
    if (dateFields.has(field)) {
      const formatted = formatDate(value as string | Date);
      return formatted || String(value);
    }
    return String(value);
  };

  const exportToCSV = async () => {
    const data = await loadReportRows();
    const fields = selectedFields.length > 0 ? selectedFields : availableFields;
    if (data.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = fields.map((f) => escapeCsv(getFieldLabel(f))).join(',');
    const rows = data.map((item) =>
      fields
        .map((field) => {
          const value = (item as any)[field];
          return escapeCsv(formatExportValue(field, value));
        })
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFileName('csv');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToXLSX = async () => {
    const data = await loadReportRows();
    const fields = selectedFields.length > 0 ? selectedFields : availableFields;
    if (data.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const headers = fields.map((field) => getFieldLabel(field));
    const rows = data.map((item) =>
      fields.map((field) => formatExportValue(field, (item as any)[field]))
    );

    const filtersSummary = buildFiltersSummary();
    const groupLabel = groupBy ? getFieldLabel(groupBy) : 'Nenhum';
    const sortLabel = sortBy
      ? `${getFieldLabel(sortBy)} (${sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})`
      : 'Nenhum';
    const title = reportName.trim() || `Relatório - ${dataSourceLabels[dataSource]}`;
    const metaRows = [
      [title],
      ['Fonte', dataSourceLabels[dataSource]],
      ['Escopo', resolveScopeLabel(data)],
      ['Gerado em', formatDateTime(new Date())],
      ['Registros', String(data.length)],
      ['Campos', headers.join(', ') || 'Todos'],
      ['Filtros', filtersSummary],
      ['Agrupar por', groupLabel],
      ['Ordenar por', sortLabel],
    ];

    const sheetData = [...metaRows, [], headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const totalColumns = Math.max(headers.length, 1);
    const lastColumnIndex = totalColumns - 1;
    const merges: XLSX.Range[] = [];

    if (headers.length > 1) {
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } });
      for (let row = 1; row < metaRows.length; row += 1) {
        merges.push({ s: { r: row, c: 1 }, e: { r: row, c: lastColumnIndex } });
      }
    }

    if (merges.length > 0) {
      worksheet['!merges'] = merges;
    }

    const columnWidths = headers.map((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...rows.map((row) => String(row[index] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 12), 42) };
    });
    if (columnWidths.length > 0) {
      worksheet['!cols'] = columnWidths;
    }

    const workbook = XLSX.utils.book_new();
    const sheetName = (dataSourceLabels[dataSource] || 'Relatorio').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, buildFileName('xlsx'));
  };

  const exportToPDF = async () => {
    const data = await loadReportRows();
    const fields = selectedFields.length > 0 ? selectedFields : availableFields;
    if (data.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const title = reportName.trim() || `Relatório - ${dataSourceLabels[dataSource]}`;
    const filtersSummary = buildFiltersSummary();
    const groupLabel = groupBy ? getFieldLabel(groupBy) : 'Nenhum';
    const sortLabel = sortBy
      ? `${getFieldLabel(sortBy)} (${sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})`
      : 'Nenhum';
    const scopeLabel = resolveScopeLabel(data);
    const fieldsSummary = fields.map((field) => getFieldLabel(field)).join(', ') || 'Todos';
    const generatedAt = formatDateTime(new Date());
    const tableHeaders = fields.map((field) => getFieldLabel(field));
    const tableRows = data.map((item) =>
      fields.map((field) => formatExportValue(field, (item as any)[field]))
    );

    const landscape = fields.length > 6;
    const doc = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const headerHeight = 64;
    const accentHeight = 4;

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setFillColor(233, 179, 8);
    doc.rect(0, headerHeight - accentHeight, pageWidth, accentHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, marginX, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Gerado em ${generatedAt}`, marginX, 54);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    let cursorY = headerHeight + 20;
    const maxWidth = pageWidth - marginX * 2;

    const addMetaLine = (label: string, value: string) => {
      const text = `${label}: ${value || '-'}`;
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, marginX, cursorY);
      cursorY += lines.length * 14;
    };

    addMetaLine('Fonte', dataSourceLabels[dataSource]);
    addMetaLine('Escopo', scopeLabel);
    addMetaLine('Registros', String(data.length));
    addMetaLine('Campos', fieldsSummary);
    addMetaLine('Filtros', filtersSummary);
    addMetaLine('Agrupar por', groupLabel);
    addMetaLine('Ordenar por', sortLabel);

    const tableStartY = cursorY + 10;
    const baseFontSize = fields.length > 8 ? 7 : fields.length > 6 ? 8 : 9;
    const columnStyles: Record<number, { halign?: 'left' | 'right' | 'center' }> = {};
    fields.forEach((field, index) => {
      if (currencyFields.has(field)) columnStyles[index] = { halign: 'right' };
      if (['status', 'priority', 'payment_status'].includes(field)) {
        columnStyles[index] = { ...(columnStyles[index] || {}), halign: 'center' };
      }
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: tableStartY,
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: baseFontSize,
        cellPadding: 4,
        textColor: [33, 37, 41],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [233, 179, 8],
        textColor: [24, 24, 27],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      columnStyles,
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Página ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 20, {
        align: 'right',
      });
    }

    doc.save(buildFileName('pdf'));
  };

  useEffect(() => {
    if (!showPreview) return;
    let active = true;
    (async () => {
      const rows = await loadReportRows();
      if (active) setReportRows(rows);
    })();
    return () => {
      active = false;
    };
  }, [showPreview, dataSource, filters, groupBy, sortBy, sortOrder, selectedClientId, isOfficeReport, isAdminOrFunc, supportsClientFilter]);

  const reportData = showPreview ? reportRows : [];
  const displayFields = selectedFields.length > 0 ? selectedFields : availableFields;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-lg font-semibold">Criar Novo Relatório</h3>
        <Button variant="light" isIconOnly onPress={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Report Name */}
        <div className="space-y-2">
          <Input
            label="Nome do Relatório"
            placeholder="Ex: Relatório de Clientes Ativos"
            value={reportName}
            onValueChange={setReportName}
          />
        </div>

        {/* Data Source */}
        <div className="space-y-2">
          <Select
            label="Fonte de Dados"
            selectedKeys={[dataSource]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as DataSource;
              setDataSource(selected);
              setSelectedFields([]);
              setFilters([]);
              setGroupBy('');
              setSortBy('');
            }}
          >
            {Object.entries(dataSourceLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Fields Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Campos a Exibir</label>
          <div className="grid grid-cols-2 gap-3 p-4 border border-divider rounded-lg">
            {availableFields.map((field) => (
              <Checkbox
                key={field}
                isSelected={selectedFields.includes(field)}
                onValueChange={() => toggleField(field)}
              >
                {fieldLabels[field] || field}
              </Checkbox>
            ))}
          </div>
          <p className="text-sm text-default-500">
            {selectedFields.length === 0
              ? 'Todos os campos serão exibidos'
              : `${selectedFields.length} campos selecionados`}
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Filtros</label>
            <Button
              variant="bordered"
              size="sm"
              onPress={addFilter}
              startContent={<PlusIcon className="h-4 w-4" />}
            >
              Adicionar Filtro
            </Button>
          </div>
          <div className="space-y-2">
            {filters.map((filter, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Select
                  selectedKeys={[filter.field]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    updateFilter(index, 'field', selected);
                  }}
                  className="w-[180px]"
                >
                  {availableFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {fieldLabels[field] || field}
                    </SelectItem>
                  ))}
                </Select>
                <Select
                  selectedKeys={[filter.operator]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    updateFilter(index, 'operator', selected);
                  }}
                  className="w-[140px]"
                >
                  <SelectItem key="equals">Igual a</SelectItem>
                  <SelectItem key="contains">Contém</SelectItem>
                  <SelectItem key="greater">Maior que</SelectItem>
                  <SelectItem key="less">Menor que</SelectItem>
                </Select>
                <Input
                  placeholder="Valor"
                  value={filter.value}
                  onValueChange={(value) => updateFilter(index, 'value', value)}
                  className="flex-1"
                />
                <Button variant="light" isIconOnly onPress={() => removeFilter(index)}>
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Client / Office scope */}
        {isAdminOrFunc && supportsClientFilter && (
          <div className="space-y-3">
            <Switch
              isSelected={isOfficeReport}
              onValueChange={(value) => {
                setIsOfficeReport(value);
                if (value) setSelectedClientId(null);
              }}
            >
              Relatório do escritório
            </Switch>
            {!isOfficeReport && (
              <div className="space-y-2">
                <Input
                  label="Cliente"
                  placeholder="Buscar por nome/razão social"
                  value={clientSearch}
                  onValueChange={setClientSearch}
                />
                <Select
                  label="Selecionar cliente"
                  selectedKeys={selectedClientId ? [selectedClientId] : []}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as string;
                    setSelectedClientId(key || null);
                    setIsOfficeReport(false);
                  }}
                >
                  {clientOptions.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nome_fantasia || client.razao_social}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Grouping and Sorting */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select
              label="Agrupar Por"
              selectedKeys={groupBy && groupBy !== 'none' ? [groupBy] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setGroupBy(selected === 'none' ? '' : selected || '');
              }}
              placeholder="Nenhum"
            >
              <SelectItem key="none">Nenhum</SelectItem>
              {availableFields.map((field) => (
                <SelectItem key={field}>{fieldLabels[field] || field}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ordenar Por</label>
            <div className="flex gap-2">
              <Select
                selectedKeys={sortBy && sortBy !== 'none' ? [sortBy] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setSortBy(selected === 'none' ? '' : selected || '');
                }}
                placeholder="Nenhum"
                className="flex-1"
                label="Ordenar Por"
              >
                <SelectItem key="none">Nenhum</SelectItem>
                {availableFields.map((field) => (
                  <SelectItem key={field}>{fieldLabels[field] || field}</SelectItem>
                ))}
              </Select>
              <Select
                selectedKeys={[sortOrder]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as 'asc' | 'desc';
                  setSortOrder(selected);
                }}
                className="w-[120px]"
              >
                <SelectItem key="asc">Crescente</SelectItem>
                <SelectItem key="desc">Decrescente</SelectItem>
              </Select>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Prévia do Relatório</label>
            <div className="border border-divider rounded-lg overflow-auto max-h-[400px]">
              <Table aria-label="Preview table">
                <TableHeader>
                  {displayFields.map((field) => (
                    <TableColumn key={field}>{fieldLabels[field] || field}</TableColumn>
                  ))}
                </TableHeader>
                <TableBody>
                  {reportData.slice(0, 10).map((item, index) => (
                    <TableRow key={index}>
                      {displayFields.map((field) => (
                        <TableCell key={field}>
                          {isLoading ? '...' : String((item as any)[field] ?? '-')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-default-500">
              Mostrando {Math.min(10, reportData.length)} de {reportData.length} registros
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-between pt-4 border-t border-divider">
          <Button
            variant="bordered"
            onPress={() => setShowPreview(!showPreview)}
            startContent={<EyeIcon className="h-4 w-4" />}
          >
            {showPreview ? 'Ocultar' : 'Visualizar'} Prévia
          </Button>
          <div className="flex gap-2">
            <Button
              variant="bordered"
              onPress={exportToCSV}
              startContent={<DownloadIcon className="h-4 w-4" />}
            >
              CSV
            </Button>
            <Button
              variant="bordered"
              onPress={exportToXLSX}
              startContent={<DownloadIcon className="h-4 w-4" />}
            >
              XLSX
            </Button>
            <Button
              variant="bordered"
              onPress={exportToPDF}
              startContent={<DownloadIcon className="h-4 w-4" />}
            >
              PDF
            </Button>
            <Button
              color="primary"
              onPress={() => {
                alert('Relatório salvo com sucesso!');
              }}
            >
              Salvar Relatório
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
