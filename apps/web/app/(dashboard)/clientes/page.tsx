'use client';

import { motion } from "framer-motion";
import { Button, Card, CardBody, CardHeader, Chip, Divider, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@/heroui';
import { pageTransition } from "@/lib/animations";
import { useClients } from '@/hooks/useClients';
import type { ClientListItem, ClientStatus, ClientCreate, ClientUserCredentials, RegimeTributario } from '@/types/client';
import { formatCNPJ, getRegimeLabel, getStatusLabel } from '@/types/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/ui/SearchInput';
import { PlusIcon, EyeIcon, EditIcon, MoreVerticalIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@/lib/icons';
import { ClientFormModal } from '@/components/features/clientes/ClientFormModal';
import { ClientDetailsModal } from '@/components/features/clientes/ClientDetailsModal';
import { ClientCreatedSuccessModal } from '@/components/features/clientes/ClientCreatedSuccessModal';
import { ClientKPIs } from '@/components/features/clientes/ClientKPIs';
import { ColumnFilter } from '@/components/features/clientes/ColumnFilter';
import { Can } from '@/components/shared/Can';
import { UserRole } from '@/types/user';
import { SnippetCopy } from '@/components/ui/SnippetCopy';
import { toast } from '@/lib/toast';

export default function ClientesPage() {
  const { clients, selectedClient, isLoading, fetchClients, fetchClientById, createClient, updateClient, setSelectedClient } = useClients();
  const router = useRouter();
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [letterFilter, setLetterFilter] = useState('');
  const [page, setPage] = useState(1);

  // Column filters
  const [cnpjFilter, setCnpjFilter] = useState('');
  const [regimeFilter, setRegimeFilter] = useState<RegimeTributario | undefined>();
  const [honorariosRange, setHonorariosRange] = useState<[number, number] | undefined>();

  // Separate modals for create/edit and view
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const { isOpen: isCreatedOpen, onOpen: onCreatedOpen, onClose: onCreatedClose } = useDisclosure();
  const [createdCredentials, setCreatedCredentials] = useState<ClientUserCredentials | null>(null);

  const pageSize = 10;

  // Mock stats (TODO: fetch from API)
  const stats = clients ? {
    total: clients.total,
    ativos: clients.items.filter(c => c.status === 'ativo').length,
    pendentes: clients.items.filter(c => c.status === 'pendente').length,
    inativos: clients.items.filter(c => c.status === 'inativo').length,
    receita_total: clients.items.reduce((sum, c) => sum + c.honorarios_mensais, 0),
    ticket_medio: clients.total > 0 ? clients.items.reduce((sum, c) => sum + c.honorarios_mensais, 0) / clients.total : 0,
  } : null;

  // Fetch clients on mount and when filters change
  useEffect(() => {
    fetchClients({
      query: searchQuery || undefined,
      status: (statusFilter as ClientStatus) || undefined,
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
  }, [searchQuery, statusFilter, letterFilter, page, fetchClients]);

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
        status: (statusFilter as ClientStatus) || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      });
      console.log('✅ Lista atualizada!');
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

  const handleEditClient = async (client: ClientListItem) => {
    await fetchClientById(client.id);
    setEditingClient(client);
    onFormOpen();
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
        status: (statusFilter as ClientStatus) || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      }).catch(() => {
        toast.error('Não foi possível atualizar a lista de clientes.');
      });
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
        status: (statusFilter as ClientStatus) || undefined,
        starts_with: letterFilter || undefined,
        page,
        size: pageSize,
      }).catch(() => {
        toast.error('Não foi possível atualizar a lista de clientes.');
      });
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

  // Apply column filters client-side
  const filteredClients = clients?.items.filter((client) => {
    // CNPJ filter
    if (cnpjFilter && !client.cnpj.toLowerCase().includes(cnpjFilter.toLowerCase())) {
      console.log(`❌ Cliente ${client.razao_social} filtrado por CNPJ`);
      return false;
    }

    // Regime filter
    if (regimeFilter && client.regime_tributario !== regimeFilter) {
      console.log(`❌ Cliente ${client.razao_social} filtrado por regime`);
      return false;
    }

    // Honorários range filter
    if (honorariosRange) {
      const [min, max] = honorariosRange;
      if (client.honorarios_mensais < min || client.honorarios_mensais > max) {
        console.log(`❌ Cliente ${client.razao_social} filtrado por honorários`);
        return false;
      }
    }

    return true;
  }) || [];

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
      className="space-y-6 max-w-full overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-default-500">Gerenciar clientes do escritório</p>
        </div>
        <Button color="primary" onPress={onFormOpen} startContent={<PlusIcon className="h-5 w-5" />}>
          Novo Cliente
        </Button>
      </div>

      {/* KPIs - Only for Admin/Func */}
      <Can roles={[UserRole.ADMIN, UserRole.FUNC]}>
        <ClientKPIs stats={stats} isLoading={isLoading} />
      </Can>

      <Card>
        <CardHeader className="flex flex-col items-start gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-6">
          <div className="flex w-full items-center justify-between">
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
                  onValueChange={setSearchQuery}
                  placeholder="Buscar por razão social ou CNPJ..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={statusFilter === '' ? 'solid' : 'bordered'}
                  onPress={() => setStatusFilter('')}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'ativo' ? 'solid' : 'bordered'}
                  color="success"
                  onPress={() => setStatusFilter('ativo')}
                >
                  Ativos
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'pendente' ? 'solid' : 'bordered'}
                  color="warning"
                  onPress={() => setStatusFilter('pendente')}
                >
                  Pendentes
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => {
                    setSearchQuery('');
                    setCnpjFilter('');
                    setRegimeFilter(undefined);
                    setHonorariosRange(undefined);
                    setStatusFilter('');
                    setLetterFilter('');
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
                onPress={() => setLetterFilter('')}
              >
                Todas
              </Button>
              {alphabet.map((letter) => (
                <Button
                  key={letter}
                  size="sm"
                  variant={letterFilter === letter ? 'solid' : 'flat'}
                  className="min-w-8"
                  onPress={() => setLetterFilter(letter)}
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
                    table: "min-w-full",
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
                          onChange={setSearchQuery}
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
                          onChange={setCnpjFilter}
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
                          onChange={setRegimeFilter}
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
                            <SnippetCopy text={client.razao_social} />
                            {client.nome_fantasia && (
                              <p className="text-xs text-default-400">{client.nome_fantasia}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SnippetCopy text={client.cnpj} />
                        </TableCell>
                        <TableCell>
                          {client.cpf_empresa ? (
                            <SnippetCopy text={client.cpf_empresa} />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.codigo_simples ? (
                            <SnippetCopy text={client.codigo_simples} />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.senha_gov ? (
                            <SnippetCopy text={client.senha_gov} hideByDefault />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.senha_prefeitura ? (
                            <SnippetCopy text={client.senha_prefeitura} hideByDefault />
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
                                  key="status-ativo"
                                  startContent={<CheckCircleIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, 'ativo')}
                                  className={client.status === 'ativo' ? 'hidden' : ''}
                                >
                                  Marcar como Ativo
                                </DropdownItem>
                                <DropdownItem
                                  key="status-pendente"
                                  startContent={<ClockIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, 'pendente')}
                                  className={client.status === 'pendente' ? 'hidden' : ''}
                                >
                                  Marcar como Pendente
                                </DropdownItem>
                                <DropdownItem
                                  key="status-inativo"
                                  startContent={<XCircleIcon className="h-4 w-4" />}
                                  onPress={() => handleChangeStatus(client, 'inativo')}
                                  className={client.status === 'inativo' ? 'hidden' : ''}
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
    </motion.div>
  );
}
