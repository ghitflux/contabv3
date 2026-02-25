'use client';

import {
  Card,
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Chip,
  Spinner,
} from '@heroui/react';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, RefreshIcon } from '@/lib/icons';
import { useUserManagement } from '@/hooks/useUserManagement';
import type { User } from '@/types/user';

export default function UsuariosPage() {
  const {
    isOpen: isFormOpen,
    onOpen: openFormModal,
    onOpenChange: onFormOpenChange,
  } = useDisclosure();
  const {
    isOpen: isTrashOpen,
    onOpen: openTrashModal,
    onOpenChange: onTrashOpenChange,
  } = useDisclosure();
  const { users, isLoading, fetchUsers, createUser, updateUser, deactivateUser, activateUser, deleteUser } =
    useUserManagement();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'func',
  });

  useEffect(() => {
    fetchUsers({ page: 1, limit: 100 });
  }, [fetchUsers]);

  const filteredUsers = users.filter(
    (user) =>
      (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === 'all' ||
        (statusFilter === 'active' ? user.is_active : !user.is_active))
  );
  const inactiveUsers = users.filter((user) => !user.is_active);

  const handleCreateUser = useCallback(() => {
    setSelectedUser(null);
    setFormData({ name: '', email: '', password: '', role: 'func' });
    openFormModal();
  }, [openFormModal]);

  const handleEditUser = useCallback(
    (user: User) => {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
      });
      openFormModal();
    },
    [openFormModal]
  );

  const handleSaveUser = useCallback(async () => {
    try {
      if (!formData.name || !formData.email) {
        toast.error('Preencha todos os campos');
        return;
      }

      if (selectedUser) {
        await updateUser(selectedUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role as any,
        });
        toast.success('Usuário atualizado!');
      } else {
        if (!formData.password) {
          toast.error('Defina uma senha para o novo usuário');
          return;
        }
        await createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        toast.success('Usuário criado!');
        await fetchUsers({ page: 1, limit: 100 });
      }
      onFormOpenChange();
    } catch (error) {
      toast.error('Erro ao salvar usuário');
    }
  }, [selectedUser, formData, createUser, updateUser, onFormOpenChange, fetchUsers]);

  const handleDeactivateUser = useCallback(
    async (user: User) => {
      if (!window.confirm(`Desativar usuário ${user.name}?`)) return;

      try {
        setProcessingUserId(user.id);
        await deactivateUser(user.id);
        toast.success('Usuário movido para a lixeira.');
        await fetchUsers({ page: 1, limit: 100 });
      } catch (error) {
        toast.error('Erro ao desativar usuário');
      } finally {
        setProcessingUserId(null);
      }
    },
    [deactivateUser, fetchUsers]
  );

  const handleActivateUser = useCallback(
    async (user: User) => {
      try {
        setProcessingUserId(user.id);
        await activateUser(user.id);
        toast.success(`Usuário ${user.name} ativado.`);
        await fetchUsers({ page: 1, limit: 100 });
      } catch (error) {
        toast.error('Erro ao ativar usuário');
      } finally {
        setProcessingUserId(null);
      }
    },
    [activateUser, fetchUsers]
  );

  const handleDeleteUser = useCallback(
    async (user: User) => {
      if (
        !window.confirm(
          `Excluir permanentemente o usuário ${user.name}? Esta ação não pode ser desfeita.`
        )
      ) {
        return;
      }
      try {
        setProcessingUserId(user.id);
        await deleteUser(user.id);
        toast.success('Usuário excluído permanentemente.');
        await fetchUsers({ page: 1, limit: 100 });
      } catch (error) {
        toast.error('Erro ao excluir usuário');
      } finally {
        setProcessingUserId(null);
      }
    },
    [deleteUser, fetchUsers]
  );

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <Card className="p-6">
        <div className="flex flex-col gap-3 mb-6 md:flex-row md:justify-between md:items-center">
          <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
          <div className="flex gap-2">
            <Button
              variant="bordered"
              startContent={<TrashIcon className="h-4 w-4" />}
              onPress={openTrashModal}
            >
              Lixeira ({inactiveUsers.length})
            </Button>
            <Button
              color="primary"
              startContent={<PlusIcon className="h-5 w-5" />}
              onClick={handleCreateUser}
            >
              Novo Usuário
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            isClearable
            placeholder="Buscar usuários..."
            startContent={<SearchIcon className="h-4 w-4" />}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="md:flex-1"
          />
          <Select
            label="Status"
            selectedKeys={[statusFilter]}
            onChange={(e) =>
              setStatusFilter((e.target.value as 'all' | 'active' | 'inactive') || 'all')
            }
            className="md:w-56"
          >
            <SelectItem key="all">Todos</SelectItem>
            <SelectItem key="active">Ativos</SelectItem>
            <SelectItem key="inactive">Inativos</SelectItem>
          </Select>
        </div>

        {/* Users Table */}
        <div className="w-full overflow-x-auto">
          <Table aria-label="Tabela de usuários" className="min-w-[760px]">
            <TableHeader>
              <TableColumn>NOME</TableColumn>
              <TableColumn>EMAIL</TableColumn>
              <TableColumn>CARGO</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>AÇÕES</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={isLoading ? undefined : 'Nenhum usuário encontrado'}
              isLoading={isLoading}
              loadingContent={<Spinner />}
            >
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={user.is_active ? 'success' : 'danger'}
                    >
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={() => handleEditUser(user)}
                        isDisabled={processingUserId === user.id}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      {user.is_active ? (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="warning"
                          onClick={() => handleDeactivateUser(user)}
                          isDisabled={processingUserId === user.id}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="success"
                            onClick={() => handleActivateUser(user)}
                            isDisabled={processingUserId === user.id}
                          >
                            <RefreshIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onClick={() => handleDeleteUser(user)}
                            isDisabled={processingUserId === user.id}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* User Form Modal */}
      <Modal isOpen={isFormOpen} onOpenChange={onFormOpenChange} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{selectedUser ? 'Editar Usuário' : 'Novo Usuário'}</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Nome"
              placeholder="Nome do usuário"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              type="email"
              label="Email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Select
              label="Cargo"
              selectedKeys={[formData.role]}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <SelectItem key="admin">
                Administrador
              </SelectItem>
              <SelectItem key="func">
                Funcionário
              </SelectItem>
              <SelectItem key="cliente">
                Cliente
              </SelectItem>
            </Select>
            {!selectedUser && (
              <Input
                type="password"
                label="Senha"
                placeholder="Senha inicial (mín. 8 caracteres)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="default" variant="light" onPress={() => onFormOpenChange()}>
              Cancelar
            </Button>
            <Button color="primary" onClick={handleSaveUser}>
              {selectedUser ? 'Atualizar' : 'Criar'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Trash Modal */}
      <Modal isOpen={isTrashOpen} onOpenChange={onTrashOpenChange} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Lixeira de Usuários</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  Usuários inativos podem ser reativados. Exclusão remove o registro permanentemente.
                </p>
                <div className="w-full overflow-x-auto">
                  <Table aria-label="Usuários inativos" className="min-w-[720px]">
                    <TableHeader>
                      <TableColumn>NOME</TableColumn>
                      <TableColumn>EMAIL</TableColumn>
                      <TableColumn>CARGO</TableColumn>
                      <TableColumn className="text-right">AÇÕES</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="Nenhum usuário inativo na lixeira.">
                      {inactiveUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell className="capitalize">{user.role}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                color="success"
                                startContent={<RefreshIcon className="h-4 w-4" />}
                                onPress={() => handleActivateUser(user)}
                                isDisabled={processingUserId === user.id}
                              >
                                Ativar
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="danger"
                                startContent={<TrashIcon className="h-4 w-4" />}
                                onPress={() => handleDeleteUser(user)}
                                isDisabled={processingUserId === user.id}
                              >
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
    </motion.div>
  );
}
