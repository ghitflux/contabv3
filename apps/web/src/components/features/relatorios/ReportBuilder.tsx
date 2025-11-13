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
} from '@/heroui';
import { DownloadIcon, EyeIcon, PlusIcon, XIcon } from '@/lib/icons';
import { useState } from 'react';

interface ReportBuilderProps {
  onClose: () => void;
}

type DataSource = 'clients' | 'transactions' | 'obligations' | 'licenses' | 'activities';

const dataSourceFields = {
  clients: ['name', 'cnpj', 'email', 'city', 'state', 'status', 'monthlyFee', 'dueDay'],
  transactions: ['date', 'description', 'category', 'type', 'amount', 'status'],
  obligations: ['type', 'status', 'dueDate', 'completedDate'],
  licenses: ['type', 'status', 'issueDate', 'expiryDate', 'fee', 'feePaid'],
  activities: ['title', 'status', 'priority', 'assignedTo', 'dueDate', 'labels'],
};

const dataSourceLabels = {
  clients: 'Clientes',
  transactions: 'Transações Financeiras',
  obligations: 'Obrigações',
  licenses: 'Licenças',
  activities: 'Atividades',
};

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  cnpj: 'CNPJ',
  email: 'E-mail',
  city: 'Cidade',
  state: 'Estado',
  status: 'Status',
  monthlyFee: 'Honorário Mensal',
  dueDay: 'Dia de Vencimento',
  date: 'Data',
  description: 'Descrição',
  category: 'Categoria',
  type: 'Tipo',
  amount: 'Valor',
  dueDate: 'Vencimento',
  completedDate: 'Data de Conclusão',
  issueDate: 'Data de Emissão',
  expiryDate: 'Data de Expiração',
  fee: 'Taxa',
  feePaid: 'Taxa Paga',
  title: 'Título',
  priority: 'Prioridade',
  assignedTo: 'Responsável',
  labels: 'Etiquetas',
};

export function ReportBuilder({ onClose }: ReportBuilderProps) {
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

  const availableFields = dataSourceFields[dataSource];

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

  const generateReport = () => {
    // Mock data generation - in real app, this would fetch from API
    const mockData = [
      { id: '1', name: 'Exemplo 1', status: 'ativo' },
      { id: '2', name: 'Exemplo 2', status: 'inativo' },
    ];
    return mockData;
  };

  const exportToCSV = () => {
    const data = generateReport();
    const fields = selectedFields.length > 0 ? selectedFields : availableFields;

    const headers = fields.map((f) => fieldLabels[f] || f).join(',');
    const rows = data.map((item) => fields.map((field) => (item as any)[field] || '').join(','));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName || 'relatorio'}.csv`;
    a.click();
  };

  const exportToXLSX = () => {
    alert('Exportação XLSX será implementada com a biblioteca xlsx');
  };

  const exportToPDF = () => {
    alert('Exportação PDF será implementada com a biblioteca jsPDF');
  };

  const reportData = showPreview ? generateReport() : [];
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
                        <TableCell key={field}>{String((item as any)[field] || '-')}</TableCell>
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
