'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@/heroui';
import type { Activity, ActivityCreate, ActivityUpdate } from '@/types/activity';
import {
  ActivityPriority,
  ActivityRecurrence,
  ActivityStatus,
  normalizeDateOnly,
} from '@/types/activity';
import { toast } from '@/lib/toast';

type CompanyOption = {
  id: string;
  label: string;
};

type AtividadesFormModalProps = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  isSubmitting?: boolean;
  activity?: Activity | null;
  defaultAssigneeId?: string;
  defaultAssigneeName?: string | null;
  companyOptions?: CompanyOption[];
  onOpenLinkedObligation?: (obligationId: string) => void;
  onClose: () => void;
  onSubmit: (payload: ActivityCreate | ActivityUpdate) => Promise<void>;
};

type ActivityFormState = {
  title: string;
  description: string;
  status: ActivityStatus | string;
  priority: ActivityPriority | string;
  assigned_to_id: string;
  start_date: string;
  due_date: string;
  end_date: string;
  recurrence: ActivityRecurrence | string;
  reminders: boolean;
  labelsInput: string;
  linked_client_ids: string[];
  linked_obligation_id: string;
};

const statusOptions = [
  { key: ActivityStatus.TODO, label: 'A Fazer' },
  { key: ActivityStatus.IN_PROGRESS, label: 'Em Andamento' },
  { key: ActivityStatus.REVIEW, label: 'Revisão' },
  { key: ActivityStatus.DONE, label: 'Concluído' },
];

const priorityOptions = [
  { key: ActivityPriority.LOW, label: 'Baixa' },
  { key: ActivityPriority.MEDIUM, label: 'Média' },
  { key: ActivityPriority.HIGH, label: 'Alta' },
];

const recurrenceOptions = [
  { key: 'none', label: 'Não recorrente' },
  { key: ActivityRecurrence.DAILY, label: 'Diária' },
  { key: ActivityRecurrence.WEEKLY, label: 'Semanal' },
  { key: ActivityRecurrence.MONTHLY, label: 'Mensal' },
];

const buildInitialState = (
  activity?: Activity | null,
  defaultAssigneeId?: string
): ActivityFormState => ({
  title: activity?.title ?? '',
  description: activity?.description ?? '',
  status: activity?.status ?? ActivityStatus.TODO,
  priority: activity?.priority ?? ActivityPriority.MEDIUM,
  assigned_to_id: activity?.assigned_to_id ?? defaultAssigneeId ?? '',
  start_date: normalizeDateOnly(activity?.start_date) ?? '',
  due_date: normalizeDateOnly(activity?.due_date) ?? '',
  end_date: normalizeDateOnly(activity?.end_date) ?? '',
  recurrence: activity?.recurrence ?? 'none',
  reminders: activity?.reminders ?? false,
  labelsInput: activity?.labels?.join(', ') ?? '',
  linked_client_ids: activity?.linked_client_ids ?? [],
  linked_obligation_id: activity?.linked_obligation_id ?? '',
});

const parseLabels = (input: string) =>
  input
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);

export function AtividadesFormModal({
  isOpen,
  mode,
  isSubmitting = false,
  activity,
  defaultAssigneeId,
  defaultAssigneeName,
  companyOptions = [],
  onOpenLinkedObligation,
  onClose,
  onSubmit,
}: AtividadesFormModalProps) {
  const [formState, setFormState] = useState<ActivityFormState>(() =>
    buildInitialState(activity, defaultAssigneeId)
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormState(buildInitialState(activity, defaultAssigneeId));
  }, [isOpen, activity, defaultAssigneeId]);

  const isAssigneeLocked = Boolean(defaultAssigneeId) && mode === 'create';
  const isLinkedToObligation = Boolean(formState.linked_obligation_id);

  const assigneeDescription = useMemo(() => {
    if (isAssigneeLocked) return 'Responsável padrão: você.';
    if (defaultAssigneeName) return `Responsável padrão sugerido: ${defaultAssigneeName}.`;
    return 'Informe o ID do usuário responsável.';
  }, [defaultAssigneeName, isAssigneeLocked]);

  const handleSubmit = async () => {
    const title = formState.title.trim();
    const assignedToId = formState.assigned_to_id || defaultAssigneeId || '';
    const startDate = normalizeDateOnly(formState.start_date);
    const dueDate = normalizeDateOnly(formState.due_date);
    const endDate = normalizeDateOnly(formState.end_date);
    const recurrence = formState.recurrence !== 'none' ? formState.recurrence : null;

    if (!assignedToId) {
      toast.error('Informe o responsável da atividade.');
      return;
    }
    if (!title) {
      toast.error('Informe o título da atividade.');
      return;
    }
    if (recurrence && !dueDate) {
      toast.error('Atividade recorrente precisa de data de vencimento.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast.error('A data de início deve ser anterior à data de fim.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      toast.error('A data de vencimento não pode ser anterior ao início.');
      return;
    }
    if (endDate && dueDate && dueDate > endDate) {
      toast.error('A data de vencimento não pode ser posterior ao fim.');
      return;
    }

    const payload: ActivityCreate | ActivityUpdate = {
      title,
      description: formState.description.trim() || null,
      status: formState.status || ActivityStatus.TODO,
      priority: formState.priority || ActivityPriority.MEDIUM,
      assigned_to_id: assignedToId,
      start_date: startDate || null,
      due_date: dueDate || null,
      end_date: endDate || null,
      recurrence,
      labels: parseLabels(formState.labelsInput),
      linked_client_ids: formState.linked_client_ids,
      linked_obligation_id: formState.linked_obligation_id || null,
      reminders: formState.reminders,
    };

    await onSubmit(payload);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              {mode === 'create' ? 'Criar Nova Atividade' : 'Editar Atividade'}
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label="Título *"
                placeholder="Nome da atividade"
                value={formState.title}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, title: value }))}
              />

              <Textarea
                label="Descrição"
                placeholder="Descreva a atividade..."
                value={formState.description}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, description: value }))}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  selectedKeys={formState.status ? [formState.status] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ActivityStatus | undefined;
                    if (value) {
                      setFormState((prev) => ({ ...prev, status: value }));
                    }
                  }}
                >
                  {statusOptions.map((status) => (
                    <SelectItem key={status.key}>{status.label}</SelectItem>
                  ))}
                </Select>

                <Select
                  label="Prioridade"
                  selectedKeys={formState.priority ? [formState.priority] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ActivityPriority | undefined;
                    if (value) {
                      setFormState((prev) => ({ ...prev, priority: value }));
                    }
                  }}
                >
                  {priorityOptions.map((priority) => (
                    <SelectItem key={priority.key}>{priority.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Responsável"
                  placeholder="ID do responsável"
                  isDisabled={isAssigneeLocked}
                  value={formState.assigned_to_id || defaultAssigneeId || ''}
                  description={assigneeDescription}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, assigned_to_id: value }))
                  }
                />

                <Select
                  label="Recorrência"
                  selectedKeys={[formState.recurrence || 'none']}
                  onSelectionChange={(keys) => {
                    const value = (Array.from(keys)[0] as string | undefined) ?? 'none';
                    setFormState((prev) => ({ ...prev, recurrence: value }));
                  }}
                >
                  {recurrenceOptions.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Data de Início"
                  type="date"
                  value={formState.start_date}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, start_date: value }))
                  }
                />

                <Input
                  label="Data de Vencimento"
                  type="date"
                  value={formState.due_date}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, due_date: value }))}
                />

                <Input
                  label="Data de Fim"
                  type="date"
                  value={formState.end_date}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, end_date: value }))}
                />
              </div>

              <Select
                label="Empresas vinculadas"
                selectionMode="multiple"
                selectedKeys={new Set(formState.linked_client_ids)}
                onSelectionChange={(keys) => {
                  if (keys === 'all') {
                    setFormState((prev) => ({
                      ...prev,
                      linked_client_ids: companyOptions.map((option) => option.id),
                    }));
                    return;
                  }
                  setFormState((prev) => ({
                    ...prev,
                    linked_client_ids: Array.from(keys).map((item) => item.toString()),
                  }));
                }}
                description="Vincule a atividade às empresas obrigadas."
              >
                {companyOptions.map((company) => (
                  <SelectItem key={company.id}>{company.label}</SelectItem>
                ))}
              </Select>

              {isLinkedToObligation && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <Input
                    label="Obrigação vinculada"
                    value={formState.linked_obligation_id}
                    isReadOnly
                    className="pointer-events-none"
                  />
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => onOpenLinkedObligation?.(formState.linked_obligation_id)}
                  >
                    Abrir obrigação vinculada
                  </Button>
                </div>
              )}

              <Input
                label="Etiquetas"
                placeholder="Fiscal, Urgente, Cliente"
                value={formState.labelsInput}
                description="Separe as etiquetas por vírgula."
                onValueChange={(value) => setFormState((prev) => ({ ...prev, labelsInput: value }))}
              />

              <Checkbox
                isSelected={formState.reminders}
                onValueChange={(checked) =>
                  setFormState((prev) => ({ ...prev, reminders: checked }))
                }
              >
                Ativar lembretes
              </Checkbox>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
                {mode === 'create' ? 'Criar Atividade' : 'Salvar Alterações'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
