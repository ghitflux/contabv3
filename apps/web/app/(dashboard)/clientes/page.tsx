'use client';

import { motion } from "framer-motion";
import { Button, Card, CardBody, CardHeader, Chip, Divider, Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@/heroui';
import { pageTransition } from "@/lib/animations";
import { useClients } from '@/hooks/useClients';
import type { ClientListItem, ClientStatus, ClientCreate, ClientUserCredentials, RegimeTributario } from '@/types/client';
import { formatCNPJ, getRegimeLabel, getStatusLabel } from '@/types/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/ui/SearchInput';
import { PlusIcon, EyeIcon } from '@/lib/icons';
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
  const { clients, selectedClient, isLoading, fetchClients, fetchClientById, createClient, setSelectedClient } = useClients();
  const router = useRouter();
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
        router.replace('/auth/login');
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
    const result = await createClient(data);

    if (result.credentials) {
      setCreatedCredentials(result.credentials);
      // Open after the form closes to avoid stacked modals/focus issues.
      setTimeout(() => onCreatedOpen(), 0);
    }
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
  };

  const handleCloseCreated = () => {
    setCreatedCredentials(null);
    onCreatedClose();
  };

  const handleCloseDetails = () => {
    setSelectedClient(null);
    onDetailsClose();
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
      return false;
    }

    // Regime filter
    if (regimeFilter && client.regime_tributario !== regimeFilter) {
      return false;
    }

    // Honorários range filter
    if (honorariosRange) {
      const [min, max] = honorariosRange;
      if (client.honorarios_mensais < min || client.honorarios_mensais > max) {
        return false;
      }
    }

    return true;
  }) || [];

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

      {/* KPIs - Only for Admin */}
      <Can roles={[UserRole.ADMIN]}>
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
                        <Chip size="sm" variant="flat" color="secondary" className="text-[10px] sm:text-xs">SENHA GOV</Chip>
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        <Chip size="sm" variant="flat" color="success" className="text-[10px] sm:text-xs">LOGIN SEG. DESEMPREGO</Chip>
                      </div>
                    </TableColumn>
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        <Chip size="sm" variant="flat" color="warning" className="text-[10px] sm:text-xs">SENHA SEG. DESEMPREGO</Chip>
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
                    <TableColumn>
                      <div className="flex items-center gap-1">
                        HONORÁRIOS
                        <ColumnFilter
                          type="range"
                          value={honorariosRange}
                          onChange={setHonorariosRange}
                          min={0}
                          max={10000}
                        />
                      </div>
                    </TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>AÇÕES</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Nenhum cliente encontrado">
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.razao_social}</p>
                            {client.nome_fantasia && (
                              <p className="text-xs text-default-500">{client.nome_fantasia}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{formatCNPJ(client.cnpj)}</code>
                        </TableCell>
                        <TableCell>
                          {client.senha_gov ? (
                            <SnippetCopy text={client.senha_gov} hideByDefault />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.login_seg_desemp ? (
                            <SnippetCopy text={client.login_seg_desemp} />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.senha_seg_desemp ? (
                            <SnippetCopy text={client.senha_seg_desemp} hideByDefault />
                          ) : (
                            <span className="text-default-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getRegimeLabel(client.regime_tributario)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {client.honorarios_mensais.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" color={statusColors[client.status]} variant="flat">
                            {getStatusLabel(client.status)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={() => handleViewDetails(client)}
                            aria-label="Ver detalhes"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Button>
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
        onClose={onFormClose}
        onSave={handleSaveClient}
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
