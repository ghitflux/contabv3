'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
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
import { RotateCcw, Trash2 } from 'lucide-react';
import { financeApi } from '@/lib/api/endpoints/finance';
import type { Transaction, TransactionFilters } from '@/types/finance';
import { getTransactionTypeLabel } from '@/types/finance';
import { toast } from '@/lib/toast';

interface TransactionTrashModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: TransactionFilters;
  title?: string;
  onRestored?: () => Promise<void> | void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

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

export function TransactionTrashModal({
  isOpen,
  onOpenChange,
  filters,
  title = 'Lixeira de Lançamentos',
  onRestored,
}: TransactionTrashModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  const loadDeletedTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeApi.getTransactions({
        ...filters,
        include_deleted: true,
        deleted_only: true,
        page: 1,
        size: 200,
      });
      setTransactions(response.items);
    } catch (error) {
      console.error('Erro ao carregar lixeira de lançamentos', error);
      toast.error('Não foi possível carregar a lixeira.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!isOpen) return;
    void loadDeletedTransactions();
  }, [isOpen, loadDeletedTransactions]);

  const handleRestore = async (transactionId: string) => {
    try {
      setRestoringId(transactionId);
      await financeApi.restoreTransaction(transactionId);
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== transactionId));
      toast.success('Lançamento restaurado com sucesso.');
      await onRestored?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
    } catch (error) {
      console.error('Erro ao restaurar lançamento', error);
      const errorDetail = (error as { data?: { detail?: string } })?.data?.detail;
      const message =
        typeof errorDetail === 'string' ? errorDetail : 'Não foi possível restaurar o lançamento.';
      toast.error(message);
    } finally {
      setRestoringId(null);
    }
  };

  const handlePurge = async () => {
    if (transactions.length === 0) {
      toast.error('A lixeira já está vazia.');
      return;
    }

    const confirmed = window.confirm(
      `Remover permanentemente ${transactions.length} lançamento(s) da lixeira?`
    );
    if (!confirmed) return;

    try {
      setIsPurging(true);
      const response = await financeApi.purgeTransactionTrash(filters);
      setTransactions([]);
      toast.success(`${response.deleted} lançamento(s) removido(s) permanentemente.`);
      await onRestored?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
    } catch (error) {
      console.error('Erro ao limpar lixeira de lançamentos', error);
      toast.error('Não foi possível limpar a lixeira.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="4xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-danger" />
              {title}
            </ModalHeader>
            <ModalBody className="space-y-3">
              <div className="flex justify-end gap-2">
                <Button
                  color="danger"
                  variant="flat"
                  onPress={handlePurge}
                  isDisabled={transactions.length === 0}
                  isLoading={isPurging}
                >
                  Limpar lixeira
                </Button>
                <Button variant="flat" onPress={loadDeletedTransactions} isLoading={isLoading}>
                  Atualizar
                </Button>
              </div>
              <Table aria-label="Lançamentos excluídos" removeWrapper>
                <TableHeader>
                  <TableColumn>Excluído em</TableColumn>
                  <TableColumn>Vencimento</TableColumn>
                  <TableColumn>Tipo</TableColumn>
                  <TableColumn>Descrição</TableColumn>
                  <TableColumn className="text-right">Valor</TableColumn>
                  <TableColumn className="text-right">Ação</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={isLoading ? 'Carregando...' : 'Nenhum lançamento na lixeira'}
                >
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDateTime(transaction.deleted_at)}</TableCell>
                      <TableCell>{formatDate(transaction.due_date)}</TableCell>
                      <TableCell>
                        {getTransactionTypeLabel(transaction)}
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          startContent={<RotateCcw className="h-4 w-4" />}
                          onPress={() => handleRestore(transaction.id)}
                          isLoading={restoringId === transaction.id}
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
