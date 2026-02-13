'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/heroui';
import { BadgeCheck, CalendarDays, CircleDollarSign, ReceiptText } from 'lucide-react';
import { Transaction, TransactionType } from '@/types/finance';

interface ConfirmBaixaLancamentoDialogProps {
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

export function ConfirmBaixaLancamentoDialog({
  isOpen,
  transaction,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmBaixaLancamentoDialogProps) {
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
          <div className="rounded-xl bg-primary/15 p-2 text-primary">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">Confirmar baixa de lançamento</p>
            <p className="text-sm text-default-500">
              O lançamento será marcado como pago com a data atual.
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          {transaction ? (
            <div className="space-y-3 rounded-xl border border-default-200/70 bg-default-50/70 p-4 dark:border-default-100/20 dark:bg-default-100/5">
              <div className="flex items-start gap-2">
                <ReceiptText className="mt-0.5 h-4 w-4 text-default-500" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-default-500">Descrição</p>
                  <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CircleDollarSign className="mt-0.5 h-4 w-4 text-default-500" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-default-500">Valor</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-default-500" />
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
          <Button color="primary" onPress={() => void onConfirm()} isLoading={isLoading}>
            Confirmar baixa
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
