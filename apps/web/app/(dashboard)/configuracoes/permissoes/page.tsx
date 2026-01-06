'use client';

import { Card, Button, Select, SelectItem, Checkbox, Divider, Skeleton, Spinner } from '@heroui/react';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { permissionsApi } from '@/lib/api/endpoints/settings';
import type { Permission } from '@/types/settings';

const DEFAULT_PERMISSION_CATEGORIES = [
  'users',
  'clients',
  'finance',
  'obligations',
  'licenses',
  'reports',
  'settings',
  'audit',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  users: 'Usuários',
  clients: 'Clientes',
  finance: 'Financeiro',
  obligations: 'Obrigações',
  licenses: 'Licenças',
  reports: 'Relatórios',
  settings: 'Configurações',
  audit: 'Auditoria',
};

export default function PermissoesPage() {
  const [selectedRole, setSelectedRole] = useState('func');
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});

  const categoryOrder = useMemo(() => {
    const extras = Object.keys(allPermissions).filter(
      (category) => !DEFAULT_PERMISSION_CATEGORIES.includes(category as (typeof DEFAULT_PERMISSION_CATEGORIES)[number])
    );
    return [...DEFAULT_PERMISSION_CATEGORIES, ...extras];
  }, [allPermissions]);

  const loadPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [permsResponse, rolesResponse] = await Promise.all([
        permissionsApi.listPermissions(0, 1000),
        permissionsApi.getRolePermissions(selectedRole),
      ]);

      const grouped: Record<string, Permission[]> = {};
      DEFAULT_PERMISSION_CATEGORIES.forEach((category) => {
        grouped[category] = [];
      });

      const permissions = permsResponse?.items ?? [];
      permissions.forEach((perm: Permission) => {
        const category = perm.category || 'outros';
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(perm);
      });

      Object.values(grouped).forEach((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
      setAllPermissions(grouped);

      const roleMap: Record<string, boolean> = {};
      if (rolesResponse?.permissions && Array.isArray(rolesResponse.permissions)) {
        rolesResponse.permissions.forEach((entry: { permission_id: string; granted: boolean }) => {
          roleMap[entry.permission_id] = entry.granted;
        });
      }
      setRolePermissions(roleMap);
    } catch (error) {
      toast.error('Erro ao carregar permissões');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    void loadPermissions();
  }, [selectedRole, loadPermissions]);

  const handlePermissionToggle = useCallback((permissionId: string, granted: boolean) => {
    setRolePermissions((prev) => ({
      ...prev,
      [permissionId]: granted,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const permissionsToSave: Record<string, boolean> = {};
      Object.values(allPermissions).forEach((permissions) => {
        permissions.forEach((permission) => {
          permissionsToSave[permission.id] = !!rolePermissions[permission.id];
        });
      });

      await permissionsApi.updateRolePermissions(selectedRole, permissionsToSave);
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
        </div>

        <Divider />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            {categoryOrder.map((category) => {
              const permissions = allPermissions[category] ?? [];
              return (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3">{CATEGORY_LABELS[category] ?? category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-default-100 p-4 rounded-lg">
                  {permissions.length > 0 ? (
                    permissions.map((perm) => (
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
              );
            })}
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
