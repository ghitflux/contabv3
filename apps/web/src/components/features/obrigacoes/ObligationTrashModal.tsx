'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@/heroui';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { obligationsApi, type ObligationResponse } from '@/lib/api/endpoints/obligations';
import { toast } from '@/lib/toast';

type MatrixCategory = 'clients' | 'office';

interface ObligationTrashModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  category: MatrixCategory;
  year: number;
  month: number;
  title?: string;
  onRestored?: () => Promise<void> | void;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluida',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const datePart = value.split('T')[0];
  if (!datePart) return '-';
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
};

export function ObligationTrashModal({
  isOpen,
  onOpenChange,
  category,
  year,
  month,
  title,
  onRestored,
}: ObligationTrashModalProps) {
  const [items, setItems] = useState<ObligationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadDeletedObligations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await obligationsApi.getObligations({
        year,
        month,
        category,
        include_deleted: true,
        deleted_only: true,
        page: 1,
        size: 200,
      });
      setItems(response.items);
    } catch (error) {
      console.error('Erro ao carregar lixeira de obrigacoes', error);
      toast.error('Nao foi possivel carregar a lixeira de obrigacoes.');
    } finally {
      setIsLoading(false);
    }
  }, [category, month, year]);

  useEffect(() => {
    if (!isOpen) return;
    void loadDeletedObligations();
  }, [isOpen, loadDeletedObligations]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return items;
    return items.filter((item) => {
      return (
        item.client_name.toLowerCase().includes(normalizedSearch) ||
        item.client_cnpj.includes(normalizedSearch) ||
        item.obligation_type_name.toLowerCase().includes(normalizedSearch) ||
        (item.description || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [items, search]);

  const handleRestore = async (obligationId: string) => {
    try {
      setRestoringId(obligationId);
      await obligationsApi.restoreObligation(obligationId);
      setItems((prev) => prev.filter((item) => item.id !== obligationId));
      toast.success('Obrigacao restaurada com sucesso.');
      await onRestored?.();
    } catch (error) {
      console.error('Erro ao restaurar obrigacao', error);
      const detail = (error as { data?: { detail?: string } })?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Nao foi possivel restaurar a obrigacao.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-danger" />
              {title || 'Lixeira de Obrigacoes'}
            </ModalHeader>
            <ModalBody className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar na lixeira..."
                  startContent={<Search className="h-4 w-4 text-default-400" />}
                  size="sm"
                  className="sm:max-w-sm"
                />
                <Button variant="flat" onPress={loadDeletedObligations} isLoading={isLoading}>
                  Atualizar
                </Button>
              </div>

              <Table aria-label="Obrigacoes excluidas" removeWrapper>
                <TableHeader>
                  <TableColumn>Excluido em</TableColumn>
                  <TableColumn>Empresa</TableColumn>
                  <TableColumn>Obrigacao</TableColumn>
                  <TableColumn>Vencimento</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn className="text-right">Acao</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={isLoading ? 'Carregando...' : 'Nenhuma obrigacao na lixeira'}
                >
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateTime(item.deleted_at)}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-default-800">{item.client_name}</p>
                          <p className="text-xs text-default-500">{item.client_cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-default-800">{item.obligation_type_name}</p>
                          <p className="text-xs text-default-500">{item.description || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(item.due_date)}</TableCell>
                      <TableCell>{STATUS_LABELS[item.status] || item.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<RotateCcw className="h-4 w-4" />}
                          onPress={() => handleRestore(item.id)}
                          isLoading={restoringId === item.id}
                        >
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Fechar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
