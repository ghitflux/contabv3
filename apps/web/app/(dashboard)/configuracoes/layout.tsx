'use client';

import { ReactNode } from 'react';
import { Tabs, Tab, Card } from '@heroui/react';
import { SettingsIcon } from '@/lib/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/auth/useAuth';
import { isAdmin } from '@/types/user';

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isUserAdmin = isAdmin(user);

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname.includes('/usuarios')) return 'usuarios';
    if (pathname.includes('/sistema')) return 'sistema';
    if (pathname.includes('/seguranca')) return 'seguranca';
    if (pathname.includes('/permissoes')) return 'permissoes';
    if (pathname.includes('/clientes')) return 'clientes';
    return 'perfil';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (key: string | number) => {
    if (key === 'perfil') {
      router.push('/configuracoes/perfil');
    } else if (key === 'usuarios') {
      router.push('/configuracoes/usuarios');
    } else if (key === 'sistema') {
      router.push('/configuracoes/sistema');
    } else if (key === 'seguranca') {
      router.push('/configuracoes/seguranca');
    } else if (key === 'permissoes') {
      router.push('/configuracoes/permissoes');
    } else if (key === 'clientes') {
      router.push('/configuracoes/clientes');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-small text-default-500">
            Gerencie as configurações da aplicação e suas preferências
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-0">
        <Tabs
          key={activeTab}
          defaultSelectedKey={activeTab}
          onSelectionChange={handleTabChange}
          aria-label="Abas de configurações"
          color="primary"
          classNames={{
            tabList: "border-0 !border-0",
            tab: "border-0 !border-0 [&::before]:hidden [&::after]:hidden",
            tabContent: "border-0 !border-0",
            base: "border-0",
          }}
        >
          {/* Perfil Tab - Available to all users */}
          <Tab key="perfil" title="Meu Perfil">
            <div className="p-6">{children}</div>
          </Tab>

          {/* Admin only tabs */}
          {isUserAdmin ? (
            <>
              <Tab key="usuarios" title="Usuários">
                <div className="p-6">{children}</div>
              </Tab>
              <Tab key="sistema" title="Sistema">
                <div className="p-6">{children}</div>
              </Tab>
              <Tab key="seguranca" title="Segurança">
                <div className="p-6">{children}</div>
              </Tab>
              <Tab key="permissoes" title="Permissões">
                <div className="p-6">{children}</div>
              </Tab>
              <Tab key="clientes" title="Padrões de Clientes">
                <div className="p-6">{children}</div>
              </Tab>
            </>
          ) : (
            <>
              <Tab key="usuarios" title="Usuários" isDisabled>
                <div className="p-6">
                  <p className="text-default-500">Requer permissão de administrador</p>
                </div>
              </Tab>
              <Tab key="sistema" title="Sistema" isDisabled>
                <div className="p-6">
                  <p className="text-default-500">Requer permissão de administrador</p>
                </div>
              </Tab>
              <Tab key="seguranca" title="Segurança" isDisabled>
                <div className="p-6">
                  <p className="text-default-500">Requer permissão de administrador</p>
                </div>
              </Tab>
              <Tab key="permissoes" title="Permissões" isDisabled>
                <div className="p-6">
                  <p className="text-default-500">Requer permissão de administrador</p>
                </div>
              </Tab>
              <Tab key="clientes" title="Padrões de Clientes" isDisabled>
                <div className="p-6">
                  <p className="text-default-500">Requer permissão de administrador</p>
                </div>
              </Tab>
            </>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
