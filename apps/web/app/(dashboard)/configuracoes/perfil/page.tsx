'use client';

import { useEffect } from 'react';
import { Card, Button, Select, SelectItem, Switch, Divider, Skeleton } from '@heroui/react';
import { useUserSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/auth/AuthContext';
import { ThemeMode, LanguageCode } from '@/types/settings';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { PasswordChangeForm } from '@/components/features/configuracoes/PasswordChangeForm';

export default function PerfilPage() {
  const { user } = useAuth();
  const { settings, isLoading, error, fetchSettings, updateSettings } = useUserSettings();
  const [formData, setFormData] = useState({
    theme_mode: ThemeMode.SYSTEM as ThemeMode,
    language: LanguageCode.PT_BR as LanguageCode,
    notify_email_enabled: true,
    notify_obligations: true,
    notify_financial: true,
    notify_licenses: true,
    notify_reports: false,
    notify_system: true,
    email_digest_enabled: false,
    email_digest_frequency: 'weekly',
    show_email_publicly: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        theme_mode: settings.theme_mode,
        language: settings.language,
        notify_email_enabled: settings.notify_email_enabled,
        notify_obligations: settings.notify_obligations,
        notify_financial: settings.notify_financial,
        notify_licenses: settings.notify_licenses,
        notify_reports: settings.notify_reports,
        notify_system: settings.notify_system,
        email_digest_enabled: settings.email_digest_enabled,
        email_digest_frequency: settings.email_digest_frequency,
        show_email_publicly: settings.show_email_publicly,
      });
    }
  }, [settings]);

  const handleChange = useCallback(
    (field: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast.success('Configurações atualizadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar configurações');
    } finally {
      setIsSaving(false);
    }
  }, [formData, updateSettings]);

  if (error) {
    return (
      <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
        <Card className="p-6 border-danger">
          <p className="text-danger">{error}</p>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      {/* Profile Header */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-default-500">{user?.email}</p>
            <p className="text-sm text-default-400 capitalize mt-1">Cargo: {user?.role}</p>
          </div>
        </div>
      </Card>

      {/* Preferences Section */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Preferências</h3>
          <Divider className="mb-6" />

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tema"
                placeholder="Selecione o tema"
                selectedKeys={[formData.theme_mode]}
                onChange={(e) => handleChange('theme_mode', e.target.value)}
              >
                <SelectItem key={ThemeMode.LIGHT}>
                  Claro
                </SelectItem>
                <SelectItem key={ThemeMode.DARK}>
                  Escuro
                </SelectItem>
                <SelectItem key={ThemeMode.SYSTEM}>
                  Sistema
                </SelectItem>
              </Select>

              <Select
                label="Idioma"
                placeholder="Selecione o idioma"
                selectedKeys={[formData.language]}
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <SelectItem key={LanguageCode.PT_BR}>
                  Português (Brasil)
                </SelectItem>
                <SelectItem key={LanguageCode.EN_US}>
                  English (US)
                </SelectItem>
                <SelectItem key={LanguageCode.ES_ES}>
                  Español (España)
                </SelectItem>
              </Select>
            </div>
          )}
        </div>

        <Divider />

        {/* Notifications Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Notificações por Email</h3>
          <Divider className="mb-6" />

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <Switch
                isSelected={formData.notify_email_enabled}
                onChange={(e) => handleChange('notify_email_enabled', e.target.checked)}
              >
                Habilitar notificações por email
              </Switch>

              {formData.notify_email_enabled && (
                <>
                  <Switch
                    isSelected={formData.notify_obligations}
                    onChange={(e) => handleChange('notify_obligations', e.target.checked)}
                  >
                    Notificar sobre obrigações
                  </Switch>

                  <Switch
                    isSelected={formData.notify_financial}
                    onChange={(e) => handleChange('notify_financial', e.target.checked)}
                  >
                    Notificar sobre financeiro
                  </Switch>

                  <Switch
                    isSelected={formData.notify_licenses}
                    onChange={(e) => handleChange('notify_licenses', e.target.checked)}
                  >
                    Notificar sobre licenças
                  </Switch>

                  <Switch
                    isSelected={formData.notify_reports}
                    onChange={(e) => handleChange('notify_reports', e.target.checked)}
                  >
                    Notificar sobre relatórios
                  </Switch>

                  <Switch
                    isSelected={formData.notify_system}
                    onChange={(e) => handleChange('notify_system', e.target.checked)}
                  >
                    Notificar eventos do sistema
                  </Switch>

                  <Divider className="my-4" />

                  <Switch
                    isSelected={formData.email_digest_enabled}
                    onChange={(e) => handleChange('email_digest_enabled', e.target.checked)}
                  >
                    Habilitar resumo de email
                  </Switch>

                  {formData.email_digest_enabled && (
                    <Select
                      label="Frequência do resumo"
                      selectedKeys={[formData.email_digest_frequency]}
                      onChange={(e) => handleChange('email_digest_frequency', e.target.value)}
                    >
                      <SelectItem key="daily">
                        Diário
                      </SelectItem>
                      <SelectItem key="weekly">
                        Semanal
                      </SelectItem>
                      <SelectItem key="monthly">
                        Mensal
                      </SelectItem>
                    </Select>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Divider />

        {/* Privacy Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Privacidade</h3>
          <Divider className="mb-6" />

          {isLoading ? (
            <Skeleton className="h-12 rounded-lg" />
          ) : (
            <Switch
              isSelected={formData.show_email_publicly}
              onChange={(e) => handleChange('show_email_publicly', e.target.checked)}
            >
              Exibir email publicamente
            </Switch>
          )}
        </div>

        {/* Save Button */}
        <Divider />
        <div className="flex justify-end gap-2">
          <Button
            isLoading={isSaving}
            color="primary"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            Salvar Configurações
          </Button>
        </div>
      </Card>

      <PasswordChangeForm />
    </motion.div>
  );
}
