'use client';

import { Card, Button, Select, SelectItem, Checkbox, Divider, Skeleton, Spinner } from '@heroui/react';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { permissionsApi } from '@/lib/api/endpoints/settings';

export default function PermissoesPage() {
  const [selectedRole, setSelectedRole] = useState('func');
  const [rolePermissions, setRolePermissions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allPermissions, setAllPermissions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadPermissions();
  }, [selectedRole]);

  const loadPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch permissions from API
      // const permsResponse = await permissionsApi.listPermissions(0, 1000);
      // const rolesResponse = await permissionsApi.getRolePermissions(selectedRole);

      // For now, set placeholder
      setRolePermissions({});
      setAllPermissions({
        USERS: [],
        CLIENTS: [],
        FINANCE: [],
        OBLIGATIONS: [],
        LICENSES: [],
        REPORTS: [],
        SETTINGS: [],
        AUDIT: [],
      });
    } catch (error) {
      toast.error('Erro ao carregar permissões');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole]);

  const handlePermissionToggle = useCallback((permissionId: string, granted: boolean) => {
    setRolePermissions((prev) => ({
      ...prev,
      [permissionId]: granted,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // TODO: Save permissions via API
      // await permissionsApi.updateRolePermissions(selectedRole, rolePermissions);
      toast.success('Permissões atualizadas!');
    } catch (error) {
      toast.error('Erro ao atualizar permissões');
    } finally {
      setIsSaving(false);
    }
  }, [selectedRole, rolePermissions]);

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">Gerenciamento de Permissões</h2>
          <p className="text-default-500 mb-4">
            Configure quais permissões cada role pode acessar no sistema
          </p>
        </div>

        <div className="max-w-xs">
          <Select
            label="Selecione o Cargo"
            selectedKeys={[selectedRole]}
            onChange={(e) => setSelectedRole(e.target.value)}
            description="Selecione um cargo para gerenciar suas permissões"
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
        </div>

        <Divider />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(allPermissions).map(([category, permissions]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 capitalize">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-default-100 p-4 rounded-lg">
                  {permissions.length > 0 ? (
                    permissions.map((perm: any) => (
                      <Checkbox
                        key={perm.id}
                        isSelected={rolePermissions[perm.id] || false}
                        onChange={(e) => handlePermissionToggle(perm.id, e.target.checked)}
                      >
                        {perm.name}
                      </Checkbox>
                    ))
                  ) : (
                    <p className="text-default-400 text-sm">Nenhuma permissão nesta categoria</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Divider />

        <div className="flex justify-end gap-2">
          <Button color="default" variant="light" onClick={() => loadPermissions()}>
            Descartar
          </Button>
          <Button color="primary" isLoading={isSaving} onClick={handleSave}>
            Salvar Permissões
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
