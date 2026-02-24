'use client';

import { NotificationCenter } from '@/components/shared/NotificationCenter';
import { ActivityDueSoonBanner } from '@/components/shared/ActivityDueSoonBanner';
import { ThemeSwitcher } from '@/components/shared/ThemeSwitcher';
import { ToastContainer } from '@/components/ui/Toast';
import { Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@/heroui';
import { useAuth } from '@/hooks/auth/AuthContext';
import {
  BarChartIcon as ChartIcon,
  ClockIcon,
  DollarSignIcon as CurrencyIcon,
  FileTextIcon as DocumentIcon,
  MenuIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SettingsIcon,
  LicenseIcon as ShieldIcon,
  UsersIcon,
} from '@/lib/icons';
import { UserRole } from '@/types/user';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdminOrFunc = user?.role !== UserRole.CLIENTE;

  const navigation = [
    ...(user?.role === UserRole.CLIENTE
      ? [
          { name: 'Meus Dados', href: '/meus-dados', icon: UsersIcon },
          { name: 'Financeiro', href: '/financeiro', icon: CurrencyIcon },
          { name: 'Obrigações', href: '/obrigacoes', icon: DocumentIcon },
          { name: 'Downloads', href: '/downloads', icon: DocumentIcon },
          { name: 'Relatórios', href: '/relatorios', icon: ChartIcon },
          { name: 'Atividades', href: '/atividades', icon: ClockIcon },
        ]
      : [
          { name: 'Clientes', href: '/clientes', icon: UsersIcon },
          { name: 'Financeiro', href: '/financeiro', icon: CurrencyIcon },
          { name: 'Obrigações', href: '/obrigacoes', icon: DocumentIcon },
          { name: 'Licenças', href: '/licencas', icon: ShieldIcon },
          { name: 'Relatórios', href: '/relatorios', icon: ChartIcon },
          { name: 'Downloads', href: '/downloads', icon: DocumentIcon },
          { name: 'Atividades', href: '/atividades', icon: ClockIcon },
        ]),
    ...(isAdminOrFunc
      ? [{ name: 'Configurações', href: '/configuracoes', icon: SettingsIcon }]
      : []),
  ];

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }, [logout, router]);

  return (
    <div className="flex h-screen bg-background">
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-divider bg-background transition-all duration-300 md:static md:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div
          className={`flex h-16 items-center border-b border-divider ${
            isCollapsed && !isMobileSidebarOpen ? 'justify-center px-0' : 'justify-between px-6'
          }`}
        >
          {!isCollapsed || isMobileSidebarOpen ? (
            <h2 className="text-xl font-bold">CIC Gestão</h2>
          ) : null}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsCollapsed((prev) => !prev)}
            className="hidden md:inline-flex"
          >
            {isCollapsed ? (
              <PanelRightOpenIcon className="h-4 w-4" />
            ) : (
              <PanelRightCloseIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <nav className={`flex-1 space-y-1 py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.href);
            const showLabels = !isCollapsed || isMobileSidebarOpen;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isCollapsed && !isMobileSidebarOpen ? 'justify-center gap-0' : 'gap-3'
                } ${
                  isActive
                    ? 'bg-primary/15 dark:bg-primary/20 text-primary-600 dark:text-primary-300 border-l-2 border-primary dark:border-primary-300'
                    : 'text-default-600 dark:text-slate-300 hover:bg-default-100 dark:hover:bg-white/5 hover:text-default-900 dark:hover:text-white'
                }`}
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-300'
                      : 'text-default-400 dark:text-slate-400 group-hover:text-default-700 dark:group-hover:text-white'
                  }`}
                />
                {showLabels && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-divider bg-background px-6">
          <Button
            isIconOnly
            variant="light"
            onPress={() => setIsMobileSidebarOpen((prev) => !prev)}
            className="md:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <ThemeSwitcher />

            {/* Notification Center */}
            <NotificationCenter />

            {/* User Menu */}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Avatar as="button" className="cursor-pointer" name="Admin" size="sm" />
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Profile Actions"
                onAction={(key) => {
                  if (key === 'logout') {
                    void handleLogout();
                  }
                }}
              >
                <DropdownItem key="profile" className="gap-2">
                  <p className="font-semibold">{user?.name || 'Usuário'}</p>
                  <p className="text-sm">{user?.email || 'user@example.com'}</p>
                </DropdownItem>
                <DropdownItem key="settings" href="/configuracoes/perfil">
                  Configurações
                </DropdownItem>
                <DropdownItem key="logout" color="danger">
                  Sair
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <ActivityDueSoonBanner />
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
