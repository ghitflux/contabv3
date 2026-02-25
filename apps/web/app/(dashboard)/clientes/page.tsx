'use client';

import { motion } from "framer-motion";
import { Button, Card, CardBody, CardHeader, Chip, Divider, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@/heroui';
import { pageTransition } from "@/lib/animations";
import { useClients } from '@/hooks/useClients';
import { clientsApi } from '@/lib/api/endpoints/clients';
import { obligationsApi, type ObligationResponse } from '@/lib/api/endpoints/obligations';
import type { ClientListItem, ClientCreate, ClientUserCredentials, ClientStats, RegimeTributario } from '@/types/client';
import { ClientStatus, getDigitsOnly, getRegimeLabel, getStatusLabel } from '@/types/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/ui/SearchInput';
import { PlusIcon, EyeIcon, EditIcon, MoreVerticalIcon, CheckCircleIcon, XCircleIcon, ClockIcon, TrashIcon } from '@/lib/icons';
import { ClientFormModal } from '@/components/features/clientes/ClientFormModal';
import { ClientDetailsModal } from '@/components/features/clientes/ClientDetailsModal';
import { ClientCreatedSuccessModal } from '@/components/features/clientes/ClientCreatedSuccessModal';
import { ClientKPIs } from '@/components/features/clientes/ClientKPIs';
import { ColumnFilter } from '@/components/features/clientes/ColumnFilter';
import { Can } from '@/components/shared/Can';
import { UserRole } from '@/types/user';
import { SnippetCopy } from '@/components/ui/SnippetCopy';
import { toast } from '@/lib/toast';
import { addDays, formatISO } from 'date-fns';

type ObligationAlertGroup = {
  obligation_type_id: string;
  obligation_type_name: string;
  obligation_type_code: string;
  clients: Array<{ id: string; name: string; cnpj: string }>;
};

export default function ClientesPage() {
  const { clients, selectedClient, isLoading, fetchClients, fetchClientById, createClient, updateClient, deleteClient, setSelectedClient } = useClients();
  const router = useRouter();
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [letterFilter, setLetterFilter] = useState('');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [dueTodayAlerts, setDueTodayAlerts] = useState<ObligationAlertGroup[]>([]);
  const [dueInFiveAlerts, setDueInFiveAlerts] = useState<ObligationAlertGroup[]>([]);
  const [openDueInFiveAfterToday, setOpenDueInFiveAfterToday] = useState(false);

  // Column filters
  const [cnpjFilter, setCnpjFilter] = useState<string | undefined>();
  const [regimeFilter, setRegimeFilter] = useState<RegimeTributario | undefined>();

  // Separate modals for create/edit and view
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const { isOpen: isCreatedOpen, onOpen: onCreatedOpen, onClose: onCreatedClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isDueTodayOpen, onOpen: onDueTodayOpen, onClose: onDueTodayClose } = useDisclosure();
  const { isOpen: isDueInFiveOpen, onOpen: onDueInFiveOpen, onClose: onDueInFiveClose } = useDisclosure();
  const [createdCredentials, setCreatedCredentials] = useState<ClientUserCredentials | null>(null);

  const pageSize = 10;

  const loadStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const summary = await clientsApi.statsSummary();
      const byStatus = summary.by_status ?? {};
      const ativos = Number(byStatus.ativo ?? 0);
      const pendentes = Number(byStatus.pendente ?? 0);
      const inativos = Number(byStatus.inativo ?? 0);
      const total = Number(summary.total ?? 0);
      const receita_total = Number(summary.total_revenue ?? 0);
      const chargeable = ativos + pendentes;

      setStats({
        total,
        ativos,
        pendentes,
        inativos,
        receita_total,
        ticket_medio: chargeable > 0 ? receita_total / chargeable : 0,
      });
    } catch (error) {
      console.error('Erro ao carregar KPIs de clientes:', error);
      const status = (error as any)?.status;
      if (status === 401) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.replace('/login');
        return;
      }
      toast.error('Não foi possível carregar os indicadores de clientes.');
    } finally {
      setIsLoadingStats(false);
    }
  }, [router]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const groupObligationsForAlerts = useCallback((items: ObligationResponse[]) => {
    const groups = new Map<string, ObligationAlertGroup>();

    for (const item of items) {
      const key = item.obligation_type_id;
      const existing = groups.get(key);
      const clientEntry = { id: item.client_id, name: item.client_name, cnpj: item.client_cnpj };

      if (!existing) {
        groups.set(key, {
          obligation_type_id: item.obligation_type_id,
          obligation_type_name: item.obligation_type_name,
          obligation_type_code: item.obligation_type_code,
          clients: [clientEntry],
        });
        continue;
      }

      if (!existing.clients.some((c) => c.id === clientEntry.id)) {
        existing.clients.push(clientEntry);
      }
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.obligation_type_name.localeCompare(b.obligation_type_name, 'pt-BR', { sensitivity: 'base' })
    );
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const now = new Date();
        const todayIso = formatISO(now, { representation: 'date' });
        const fiveDaysIso = formatISO(addDays(now, 5), { representation: 'date' });

        const response = await obligationsApi.getAlerts({
          start_date: todayIso,
          end_date: fiveDaysIso,
        });
        if (!active) return;

        const items = response.items ?? [];
        const dueTodayItems = items.filter((item) => item.due_date === todayIso);
        const dueInFiveItems = items.filter((item) => item.due_date === fiveDaysIso);

        const dueTodayGroups = groupObligationsForAlerts(dueTodayItems);
        const dueInFiveGroups = groupObligationsForAlerts(dueInFiveItems);

        setDueTodayAlerts(dueTodayGroups);
        setDueInFiveAlerts(dueInFiveGroups);

        if (dueTodayGroups.length > 0) {
          setOpenDueInFiveAfterToday(dueInFiveGroups.length > 0);
          onDueTodayOpen();
          return;
        }

        if (dueInFiveGroups.length > 0) {
          onDueInFiveOpen();
        }
      } catch (error) {
        console.error('Erro ao carregar alertas de obrigações:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [groupObligationsForAlerts, onDueInFiveOpen, onDueTodayOpen]);

  const handleSearchChange = useCallback((value: unknown) => {
    setSearchQuery(typeof value === 'string' ? value : '');
    setPage(1);
  }, []);

  const handleCnpjChange = useCallback((value: unknown) => {
    setCnpjFilter(typeof value === 'string' && value.trim() ? value : undefined);
    setPage(1);
  }, []);

  const handleRegimeChange = useCallback((value: unknown) => {
    setRegimeFilter((value as RegimeTributario) || undefined);
    setPage(1);
  }, []);

  // Fetch clients on mount and when filters change
  useEffect(() => {
    fetchClients({
      query: searchQuery || undefined,
      cnpj: cnpjFilter || undefined,
      status: (statusFilter as ClientStatus) || undefined,
      regime_tributario: regimeFilter || undefined,
      starts_with: letterFilter || undefined,
      page,
      size: pageSize,
    }).catch((err) => {
      const status = (err as any)?.status;
      if (status === 401) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.replace('/login');
        return;
      }
      toast.error('Não foi possível carregar a lista de clientes.');
    });
  }, [searchQuery, cnpjFilter, statusFilter, regimeFilter, letterFilter, page, fetchClients, router]);

  const handleViewDetails = async (client: ClientListItem) => {
    await fetchClientById(client.id);
    onDetailsOpen();
  };

  const handleSaveClient = async (data: ClientCreate) => {
    try {
      console.log('🚀 Salvando cliente:', data);
      const result = await createClient(data);
      console.log('✅ Cliente criado:', result);

      toast.success('Cliente criado com sucesso!');

      if (result.credentials) {
        setCreatedCredentials(result.credentials);
        // Open after the form closes to avoid stacked modals/focus issues.
        setTimeout(() => onCreatedOpen(), 0);
      }

      // Refresh list
      console.log('🔄 Atualizando lista de clientes...');
      await fetchClients({
        query: searchQuery || undefined,
        cnpj: cnpjFilter || undefined,
        status: (statusFilter as ClientStatus) || undefined,
        regime_tributario: regimeFilter || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      });
      console.log('✅ Lista atualizada!');
      await loadStats();
    } catch (error) {
      console.error('❌ Erro ao salvar cliente:', error);
      toast.error('Não foi possível salvar o cliente.');
      throw error; // Re-throw para o modal tratar
    }
  };

  const handleCloseCreated = () => {
    setCreatedCredentials(null);
    onCreatedClose();
  };

  const handleCloseDetails = () => {
    setSelectedClient(null);
    onDetailsClose();
  };

  const handleCloseDueTodayAlert = () => {
    onDueTodayClose();
    if (openDueInFiveAfterToday) {
      setOpenDueInFiveAfterToday(false);
      onDueInFiveOpen();
    }
  };

  const handleEditClient = async (client: ClientListItem) => {
    await fetchClientById(client.id);
    setEditingClient(client);
    onFormOpen();
  };

  const handleAskDeleteClient = (client: ClientListItem) => {
    setDeletingClient(client);
    onDeleteOpen();
  };

  const handleConfirmDeleteClient = async () => {
    if (!deletingClient) return;

    try {
      setIsDeleting(true);
      await deleteClient(deletingClient.id);
      toast.success('Cadastro excluído com sucesso!');
      onDeleteClose();
      setDeletingClient(null);

      await fetchClients({
        query: searchQuery || undefined,
        cnpj: cnpjFilter || undefined,
        status: (statusFilter as ClientStatus) || undefined,
        regime_tributario: regimeFilter || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      });
      await loadStats();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Não foi possível excluir o cadastro.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDelete = () => {
    if (isDeleting) return;
    setDeletingClient(null);
    onDeleteClose();
  };

  const handleUpdateClient = async (data: ClientCreate) => {
    if (!editingClient) return;

    try {
      await updateClient(editingClient.id, data);
      toast.success('Cliente atualizado com sucesso!');
      setEditingClient(null);

      // Refresh list
      fetchClients({
        query: searchQuery || undefined,
        cnpj: cnpjFilter || undefined,
        status: (statusFilter as ClientStatus) || undefined,
        regime_tributario: regimeFilter || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      }).catch(() => {
        toast.error('Não foi possível atualizar a lista de clientes.');
      });
      await loadStats();
    } catch (error) {
      toast.error('Não foi possível atualizar o cliente.');
      throw error;
    }
  };

  const handleChangeStatus = async (client: ClientListItem, newStatus: ClientStatus) => {
    try {
      await updateClient(client.id, { status: newStatus });
      toast.success(`Status alterado para ${getStatusLabel(newStatus)}`);

      // Refresh list
      fetchClients({
        query: searchQuery || undefined,
        cnpj: cnpjFilter || undefined,
        status: (statusFilter as ClientStatus) || undefined,
        regime_tributario: regimeFilter || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      }).catch(() => {
        toast.error('Não foi possível atualizar a lista de clientes.');
      });
      await loadStats();
    } catch (error) {
      toast.error('Não foi possível alterar o status do cliente.');
    }
  };

  const handleFormClose = () => {
    setEditingClient(null);
    onFormClose();
  };

  const statusColors: Record<ClientStatus, "success" | "warning" | "default"> = {
    ativo: "success",
    pendente: "warning",
    inativo: "default",
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filteredClients = useMemo(() => clients?.items ?? [], [clients]);

  // Debug: log quando clients mudar
  useEffect(() => {
    if (clients) {
      console.log('📊 Clientes atualizados:', {
        total: clients.total,
        page: clients.page,
        size: clients.size,
        pages: clients.pages,
        items: clients.items.length,
      });
      console.log('📋 Lista de clientes:', clients.items.map(c => ({ id: c.id, razao: c.razao_social })));
    }
  }, [clients]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="max-w-full space-y-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Clientes</h1>
          <p className="text-sm text-default-500">Gerenciar clientes do escritório</p>
        </div>
        <Button
          color="primary"
          onPress={onFormOpen}
          startContent={<PlusIcon className="h-5 w-5" />}
          className="w-full sm:w-auto"
        >
          Novo Cliente
        </Button>
      </div>

      {/* KPIs - Only for Admin/Func */}
      <Can roles={[UserRole.ADMIN, UserRole.FUNC]}>
        <ClientKPIs stats={stats} isLoading={isLoading || isLoadingStats} />
      </Can>

      <Card>
        <CardHeader className="flex flex-col items-start gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-6">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lista de Clientes</h2>
              <p className="text-sm text-default-500">
                {clients?.total || 0} cliente{clients?.total !== 1 ? 's' : ''} cadastrado{clients?.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:w-80">
                <SearchInput
                  value={searchQuery}
                  onValueChange={handleSearchChange}
                  placeholder="Buscar por razão social ou CNPJ..."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={statusFilter === '' ? 'solid' : 'bordered'}
                  onPress={() => {
                    setStatusFilter('');
                    setPage(1);
                  }}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'ativo' ? 'solid' : 'bordered'}
                  color="success"
                  onPress={() => {
                    setStatusFilter('ativo');
                    setPage(1);
                  }}
                >
                  Ativos
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'pendente' ? 'solid' : 'bordered'}
                  color="warning"
                  onPress={() => {
                    setStatusFilter('pendente');
                    setPage(1);
                  }}
                >
                  Pendentes
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => {
                    setSearchQuery('');
                    setCnpjFilter(undefined);
                    setRegimeFilter(undefined);
                    setStatusFilter('');
                    setLetterFilter('');
                    setPage(1);
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>

            {/* Alphabetical Filter */}
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={letterFilter === '' ? 'solid' : 'flat'}
                className="min-w-8"
                onPress={() => {
                  setLetterFilter('');
                  setPage(1);
                }}
              >
                Todas
              </Button>
              {alphabet.map((letter) => (
                <Button
                  key={letter}
                  size="sm"
                  variant={letterFilter === letter ? 'solid' : 'flat'}
                  className="min-w-8"
                  onPress={() => {
                    setLetterFilter(letter);
                    setPage(1);
                  }}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table
                  aria-label="Tabela de clientes"
                  removeWrapper
                  className="text-[11px] sm:text-xs"
                  classNames={{
                    th: "px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-default-500 whitespace-nowrap",
                    td: "px-2 py-2 sm:px-3 sm:py-2.5 text-[11px] sm:text-xs whitespace-nowrap",
                    table: "min-w-[1240px]",
                    tr: "cursor-pointer hover:bg-default-100 transition-colors",
                  }}
                >
                  <TableHeader>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        RAZÃO SOCIAL
                        <ColumnFilter
                          type="text"
                          value={searchQuery}
                          onChange={handleSearchChange}
                          placeholder="Filtrar razão social"
                        />
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        CNPJ
                        <ColumnFilter
                          type="text"
                          value={cnpjFilter}
                          onChange={handleCnpjChange}
                          placeholder="Filtrar CNPJ"
                        />
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        CPF
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        CÓDIGO DO SIMPLES
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        <Chip size="sm" variant="flat" color="secondary" className="text-[10px] sm:text-xs">SENHA GOV</Chip>
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        <Chip size="sm" variant="flat" color="primary" className="text-[10px] sm:text-xs">SENHA PREFEITURA</Chip>
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        REGIME
                        <ColumnFilter
                          type="select"
                          value={regimeFilter}
                          onChange={handleRegimeChange}
                          options={[
                            { label: 'Simples Nacional', value: 'simples_nacional' },
                            { label: 'Lucro Presumido', value: 'lucro_presumido' },
                            { label: 'Lucro Real', value: 'lucro_real' },
                            { label: 'MEI', value: 'mei' },
                          ]}
                          placeholder="Filtrar regime"
                        />
                      </div>
                    </TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>AÇÕES</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Nenhum cliente encontrado">
                    {filteredClients.map((client) => (
                      <TableRow key={client.id} onClick={() => handleViewDetails(client)}>
                        <TableCell>
                          <div className="space-y-1">
                            <SnippetCopy
                              text={client.razao_social}
                              textClassName="max-w-[220px] sm:max-w-[320px] md:max-w-[420px] lg:max-w-[520px]"
                            />
                            {client.nome_fantasia && (
                              <p className="text-xs text-default-400">{client.nome_fantasia}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SnippetCopy
                            text={client.cnpj}
                            copyText={getDigitsOnly(client.cnpj)}
                            textClassName="max-w-[120px] sm:max-w-[140px]"
                          />
                        </TableCell>
                        <TableCell>
                          {client.cpf_empresa ? (
                            <SnippetCopy
                              text={client.cpf_empresa}
                              copyText={getDigitsOnly(client.cpf_empresa)}
                              textClassName="max-w-[110px]"
                            />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.codigo_simples ? (
                            <SnippetCopy
                              text={client.codigo_simples}
                              copyText={getDigitsOnly(client.codigo_simples)}
                              textClassName="max-w-[110px]"
                            />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.senha_gov ? (
                            <SnippetCopy text={client.senha_gov} hideByDefault textClassName="max-w-[90px]" />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.senha_prefeitura ? (
                            <SnippetCopy text={client.senha_prefeitura} hideByDefault textClassName="max-w-[90px]" />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getRegimeLabel(client.regime_tributario)}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" color={statusColors[client.status]} variant="flat">
                            {getStatusLabel(client.status)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  aria-label="Ações"
                                >
                                  <MoreVerticalIcon className="h-5 w-5" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Ações do cliente">
                                <DropdownItem
                                  key="view"
                                  startContent={<EyeIcon className="h-4 w-4" />}
                                  onPress={() => handleViewDetails(client)}
                                >
                                  Ver detalhes
                                </DropdownItem>
                                <DropdownItem
                                  key="edit"
                                  startContent={<EditIcon className="h-4 w-4" />}
                                  onPress={() => handleEditClient(client)}
                                >
                                  Editar
                                </DropdownItem>
                                <DropdownItem
                                  key="delete"
                                  startContent={<TrashIcon className="h-4 w-4" />}
                                  onPress={() => handleAskDeleteClient(client)}
                                  color="danger"
                                >
                                  Excluir cadastro
                                </DropdownItem>
                                <DropdownItem
                                  key="status-ativo"
                                  startContent={<CheckCircleIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, ClientStatus.ATIVO)}
                                  className={client.status === ClientStatus.ATIVO ? 'hidden' : ''}
                                >
                                  Marcar como Ativo
                                </DropdownItem>
                                <DropdownItem
                                  key="status-pendente"
                                  startContent={<ClockIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, ClientStatus.PENDENTE)}
                                  className={client.status === ClientStatus.PENDENTE ? 'hidden' : ''}
                                >
                                  Marcar como Pendente
                                </DropdownItem>
                                <DropdownItem
                                  key="status-inativo"
                                  startContent={<XCircleIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, ClientStatus.INATIVO)}
                                  className={client.status === ClientStatus.INATIVO ? 'hidden' : ''}
                                  color="danger"
                                >
                                  Marcar como Inativo
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {clients && clients.pages > 1 && (
                <div className="flex justify-center py-4">
                  <Pagination
                    total={clients.pages}
                    page={page}
                    onChange={setPage}
                    showControls
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Form Modal */}
      <ClientFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSave={editingClient ? handleUpdateClient : handleSaveClient}
        client={selectedClient}
        isEditing={!!editingClient}
      />

      {/* Details Modal */}
      <ClientDetailsModal
        client={selectedClient}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
      />

      {/* Created Success Modal */}
      {createdCredentials && (
        <ClientCreatedSuccessModal
          isOpen={isCreatedOpen}
          onClose={handleCloseCreated}
          access={createdCredentials.access}
          credential={createdCredentials.credential}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={handleCloseDelete} size="md">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">Excluir cadastro</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-600">
                  Tem certeza que deseja excluir o cadastro abaixo?
                </p>
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                  <p className="font-semibold">{deletingClient?.razao_social}</p>
                  <p className="text-xs">{deletingClient?.cnpj}</p>
                </div>
                <p className="text-xs text-default-500">
                  Esta ação remove o cadastro da listagem (exclusão lógica) e não pode ser desfeita pela interface.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={handleCloseDelete} isDisabled={isDeleting}>
                  Cancelar
                </Button>
                <Button color="danger" onPress={handleConfirmDeleteClient} isLoading={isDeleting}>
                  Excluir
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Alerts: Due Today */}
      <Modal isOpen={isDueTodayOpen} onClose={handleCloseDueTodayAlert} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-danger">
                Vencem hoje — pendências
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-600">
                  Atividades com vencimento no mesmo dia e empresas ainda pendentes.
                </p>
                <div className="space-y-4">
                  {dueTodayAlerts.map((group) => (
                    <div key={group.obligation_type_id} className="rounded-lg border border-danger-200 bg-danger-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-danger-800">
                          {group.obligation_type_name}
                        </p>
                        {group.obligation_type_code && (
                          <Chip size="sm" variant="flat" color="danger">
                            {group.obligation_type_code}
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-danger-700 mt-1">
                        {group.clients.length} empresa{group.clients.length === 1 ? '' : 's'} pendente{group.clients.length === 1 ? '' : 's'}
                      </p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-danger-900 space-y-1">
                        {group.clients.map((client) => (
                          <li key={client.id}>
                            {client.name} <span className="text-xs text-danger-700">({client.cnpj})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" onPress={handleCloseDueTodayAlert}>
                  Entendi
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Alerts: Due In 5 Days */}
      <Modal isOpen={isDueInFiveOpen} onClose={onDueInFiveClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Vencem em 5 dias — pendências
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-600">
                  Atividades com 5 dias para o vencimento e empresas ainda pendentes.
                </p>
                <div className="space-y-4">
                  {dueInFiveAlerts.map((group) => (
                    <div key={group.obligation_type_id} className="rounded-lg border border-default-200 bg-default-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {group.obligation_type_name}
                        </p>
                        {group.obligation_type_code && (
                          <Chip size="sm" variant="flat" color="warning">
                            {group.obligation_type_code}
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-default-600 mt-1">
                        {group.clients.length} empresa{group.clients.length === 1 ? '' : 's'} pendente{group.clients.length === 1 ? '' : 's'}
                      </p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-foreground/90 space-y-1">
                        {group.clients.map((client) => (
                          <li key={client.id}>
                            {client.name} <span className="text-xs text-default-500">({client.cnpj})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onDueInFiveClose}>
                  Entendi
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
