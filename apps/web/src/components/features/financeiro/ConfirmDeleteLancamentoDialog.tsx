'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/heroui';
import { AlertTriangle, CalendarDays, CircleDollarSign, ReceiptText, Trash2 } from 'lucide-react';
import { Transaction, TransactionType } from '@/types/finance';

interface ConfirmDeleteLancamentoDialogProps {
  isOpen: boolean;
  transaction: Transaction | null;
  isLoading?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
};

const getTypeLabel = (type: TransactionType) =>
  type === TransactionType.RECEITA ? 'Contas a Receber' : 'Contas a Pagar';

export function ConfirmDeleteLancamentoDialog({
  isOpen,
  transaction,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteLancamentoDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onCancel();
      }}
      isDismissable={!isLoading}
      hideCloseButton={isLoading}
    >
      <ModalContent>
        <ModalHeader className="flex items-start gap-3">
          <div className="rounded-xl bg-danger/15 p-2 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">Confirmar exclusão de lançamento</p>
            <p className="text-sm text-default-500">
              O lançamento será movido para a lixeira e poderá ser restaurado depois.
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          {transaction ? (
            <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
              <div className="flex items-start gap-2">
                <ReceiptText className="mt-0.5 h-4 w-4 text-danger" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-default-500">Descrição</p>
                  <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CircleDollarSign className="mt-0.5 h-4 w-4 text-danger" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-default-500">Valor</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-danger" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-default-500">Vencimento</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(transaction.due_date)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-default-500">
                Tipo: <span className="font-medium text-default-700">{getTypeLabel(transaction.transaction_type)}</span>
              </p>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel} isDisabled={isLoading}>
            Cancelar
          </Button>
          <Button
            color="danger"
            variant="solid"
            startContent={<Trash2 className="h-4 w-4" />}
            onPress={() => void onConfirm()}
            isLoading={isLoading}
          >
            Excluir lançamento
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
