'use client';

import { Card, Button, Input, Divider, Switch, Skeleton } from '@heroui/react';
import { useSecuritySettings } from '@/hooks/useSettings';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';

export default function SegurancaPage() {
  const { settings, isLoading, fetchSettings, updateSettings } = useSecuritySettings();
  const [formData, setFormData] = useState({
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_special_chars: false,
    password_expiration_days: null as number | null,
    password_history_count: 5,
    session_timeout_minutes: 30,
    max_concurrent_sessions: 3,
    require_password_change_on_first_login: false,
    lockout_enabled: true,
    lockout_threshold_attempts: 5,
    lockout_duration_minutes: 30,
    ip_whitelist_enabled: false,
    two_factor_required: false,
    two_factor_grace_period_days: 7,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData({
        password_min_length: settings.password_min_length ?? 8,
        password_require_uppercase: settings.password_require_uppercase ?? true,
        password_require_lowercase: settings.password_require_lowercase ?? true,
        password_require_numbers: settings.password_require_numbers ?? true,
        password_require_special_chars: settings.password_require_special_chars ?? false,
        password_expiration_days: settings.password_expiration_days ?? null,
        password_history_count: settings.password_history_count ?? 5,
        session_timeout_minutes: settings.session_timeout_minutes ?? 30,
        max_concurrent_sessions: settings.max_concurrent_sessions ?? 3,
        require_password_change_on_first_login: settings.require_password_change_on_first_login ?? false,
        lockout_enabled: settings.lockout_enabled ?? true,
        lockout_threshold_attempts: settings.lockout_threshold_attempts ?? 5,
        lockout_duration_minutes: settings.lockout_duration_minutes ?? 30,
        ip_whitelist_enabled: settings.ip_whitelist_enabled ?? false,
        two_factor_required: settings.two_factor_required ?? false,
        two_factor_grace_period_days: settings.two_factor_grace_period_days ?? 7,
      });
    }
  }, [settings]);

  const handleChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        password_expiration_days: formData.password_expiration_days ?? undefined,
      };
      await updateSettings(dataToSave);
      toast.success('Configurações de segurança atualizadas!');
    } catch (error) {
      toast.error('Erro ao atualizar configurações');
    } finally {
      setIsSaving(false);
    }
  }, [formData, updateSettings]);

  if (isLoading) {
    return (
      <motion.div
        variants={pageTransition}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
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
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Política de Senhas</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Comprimento Mínimo"
              min="4"
              max="20"
              value={String(formData.password_min_length)}
              onChange={(e) => handleChange('password_min_length', parseInt(e.target.value))}

            />
            <Input
              type="number"
              label="Dias até Expiração"
              min="0"
              placeholder="0 = sem expiração"
              value={formData.password_expiration_days !== null ? String(formData.password_expiration_days) : ''}
              onChange={(e) =>
                handleChange('password_expiration_days', e.target.value ? parseInt(e.target.value) : null)
              }

            />
            <Switch
              isSelected={formData.password_require_uppercase}
              onChange={(e) => handleChange('password_require_uppercase', e.target.checked)}

            >
              Exigir Maiúsculas
            </Switch>
            <Switch
              isSelected={formData.password_require_lowercase}
              onChange={(e) => handleChange('password_require_lowercase', e.target.checked)}

            >
              Exigir Minúsculas
            </Switch>
            <Switch
              isSelected={formData.password_require_numbers}
              onChange={(e) => handleChange('password_require_numbers', e.target.checked)}

            >
              Exigir Números
            </Switch>
            <Switch
              isSelected={formData.password_require_special_chars}
              onChange={(e) => handleChange('password_require_special_chars', e.target.checked)}

            >
              Exigir Caracteres Especiais
            </Switch>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Gerenciamento de Sessões</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Timeout de Sessão (minutos)"
              min="5"
              value={String(formData.session_timeout_minutes)}
              onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}

            />
            <Input
              type="number"
              label="Sessões Simultâneas Máximas"
              min="1"
              value={String(formData.max_concurrent_sessions)}
              onChange={(e) => handleChange('max_concurrent_sessions', parseInt(e.target.value))}

            />
            <Switch
              isSelected={formData.require_password_change_on_first_login}
              onChange={(e) => handleChange('require_password_change_on_first_login', e.target.checked)}

              className="md:col-span-2"
            >
              Exigir Mudança de Senha no Primeiro Login
            </Switch>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Bloqueio de Conta</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch
              isSelected={formData.lockout_enabled}
              onChange={(e) => handleChange('lockout_enabled', e.target.checked)}

              className="md:col-span-2"
            >
              Habilitar Bloqueio
            </Switch>

            {formData.lockout_enabled && (
              <>
                <Input
                  type="number"
                  label="Tentativas Falhadas"
                  min="1"
                  value={String(formData.lockout_threshold_attempts)}
                  onChange={(e) => handleChange('lockout_threshold_attempts', parseInt(e.target.value))}

                />
                <Input
                  type="number"
                  label="Duração do Bloqueio (minutos)"
                  min="1"
                  value={String(formData.lockout_duration_minutes)}
                  onChange={(e) => handleChange('lockout_duration_minutes', parseInt(e.target.value))}

                />
              </>
            )}
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Autenticação Adicional</h3>
          <Divider className="mb-6" />
          <div className="space-y-4">
            <Switch
              isSelected={formData.two_factor_required}
              onChange={(e) => handleChange('two_factor_required', e.target.checked)}

            >
              Exigir 2FA
            </Switch>

            {formData.two_factor_required && (
              <Input
                type="number"
                label="Período de Graça 2FA (dias)"
                min="0"
                value={String(formData.two_factor_grace_period_days)}
                onChange={(e) => handleChange('two_factor_grace_period_days', parseInt(e.target.value))}

              />
            )}

            <Switch
              isSelected={formData.ip_whitelist_enabled}
              onChange={(e) => handleChange('ip_whitelist_enabled', e.target.checked)}

              isDisabled
            >
              Whitelist de IP
            </Switch>
          </div>
        </div>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button color="default" variant="light" onClick={() => fetchSettings()}>
            Descartar
          </Button>
          <Button color="primary" isLoading={isSaving} onClick={handleSave}>
            Salvar Configurações
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
