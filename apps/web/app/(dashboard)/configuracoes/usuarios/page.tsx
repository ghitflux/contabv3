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
import { PlusIcon, EditIcon, TrashIcon, SearchIcon } from '@/lib/icons';
import { useUserManagement } from '@/hooks/useUserManagement';
import type { User } from '@/types/user';

export default function UsuariosPage() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { users, isLoading, fetchUsers, createUser, updateUser, deactivateUser } = useUserManagement();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'func',
  });

  useEffect(() => {
    fetchUsers(1, 100);
  }, [fetchUsers]);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = useCallback(() => {
    setSelectedUser(null);
    setFormData({ name: '', email: '', password: '', role: 'func' });
    onOpen();
  }, [onOpen]);

  const handleEditUser = useCallback(
    (user: User) => {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
      });
      onOpen();
    },
    [onOpen]
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
        await fetchUsers(1, 100);
      }
      onOpenChange();
    } catch (error) {
      toast.error('Erro ao salvar usuário');
    }
  }, [selectedUser, formData, createUser, updateUser, onOpenChange, fetchUsers]);

  const handleDeactivateUser = useCallback(
    async (user: User) => {
      if (!window.confirm(`Desativar usuário ${user.name}?`)) return;

      try {
        await deactivateUser(user.id);
        toast.success('Usuário desativado!');
        await fetchUsers(1, 100);
      } catch (error) {
        toast.error('Erro ao desativar usuário');
      }
    },
    [deactivateUser, fetchUsers]
  );

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
          <Button
            color="primary"
            startContent={<PlusIcon className="h-5 w-5" />}
            onClick={handleCreateUser}
          >
            Novo Usuário
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            isClearable
            placeholder="Buscar usuários..."
            startContent={<SearchIcon className="h-4 w-4" />}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        </div>

        {/* Users Table */}
        <Table aria-label="Tabela de usuários">
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
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    {user.is_active && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onClick={() => handleDeactivateUser(user)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* User Form Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
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
              <SelectItem key="admin" value="admin">
                Administrador
              </SelectItem>
              <SelectItem key="func" value="func">
                Funcionário
              </SelectItem>
              <SelectItem key="cliente" value="cliente">
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
            <Button color="default" variant="light" onPress={() => onOpenChange()}>
              Cancelar
            </Button>
            <Button color="primary" onClick={handleSaveUser}>
              {selectedUser ? 'Atualizar' : 'Criar'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
