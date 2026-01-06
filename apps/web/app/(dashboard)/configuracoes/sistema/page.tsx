'use client';

import { Card, Button, Input, Divider, Switch, Skeleton } from '@heroui/react';
import { useSystemSettings } from '@/hooks/useSettings';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';

export default function SistemaPage() {
  const { settings, isLoading, fetchSettings, updateSettings } = useSystemSettings();
  const [formData, setFormData] = useState({
    company_name: '',
    company_cnpj: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_from_email: '',
    smtp_use_tls: true,
    backup_enabled: false,
    backup_retention_days: 30,
    api_rate_limit_enabled: true,
    api_rate_limit_requests: 100,
    api_rate_limit_window_seconds: 60,
    enable_two_factor_auth: false,
    enable_audit_logging: true,
    enable_client_drafts: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name,
        company_cnpj: settings.company_cnpj || '',
        company_email: settings.company_email || '',
        company_phone: settings.company_phone || '',
        company_address: settings.company_address || '',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || 587,
        smtp_username: settings.smtp_username || '',
        smtp_from_email: settings.smtp_from_email || '',
        smtp_use_tls: settings.smtp_use_tls,
        backup_enabled: settings.backup_enabled,
        backup_retention_days: settings.backup_retention_days,
        api_rate_limit_enabled: settings.api_rate_limit_enabled,
        api_rate_limit_requests: settings.api_rate_limit_requests,
        api_rate_limit_window_seconds: settings.api_rate_limit_window_seconds,
        enable_two_factor_auth: settings.enable_two_factor_auth,
        enable_audit_logging: settings.enable_audit_logging,
        enable_client_drafts: settings.enable_client_drafts,
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
      await updateSettings(formData);
      toast.success('Configurações do sistema atualizadas!');
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
          <h3 className="text-xl font-semibold mb-4">Informações da Empresa</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome da Empresa"
              placeholder="ContabilConsult"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
            />
            <Input
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              value={formData.company_cnpj}
              onChange={(e) => handleChange('company_cnpj', e.target.value)}
            />
            <Input
              label="Email da Empresa"
              type="email"
              placeholder="contato@empresa.com.br"
              value={formData.company_email}
              onChange={(e) => handleChange('company_email', e.target.value)}
            />
            <Input
              label="Telefone"
              placeholder="+55 11 99999-9999"
              value={formData.company_phone}
              onChange={(e) => handleChange('company_phone', e.target.value)}
            />
            <Input
              label="Endereço"
              className="md:col-span-2"
              placeholder="Rua, número, complemento, cidade..."
              value={formData.company_address}
              onChange={(e) => handleChange('company_address', e.target.value)}
            />
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Configuração de Email (SMTP)</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Host SMTP"
              placeholder="smtp.gmail.com"
              value={formData.smtp_host}
              onChange={(e) => handleChange('smtp_host', e.target.value)}
            />
            <Input
              label="Porta"
              type="number"
              placeholder="587"
              value={String(formData.smtp_port)}
              onChange={(e) => handleChange('smtp_port', parseInt(e.target.value))}
            />
            <Input
              label="Usuário"
              placeholder="seu@email.com"
              value={formData.smtp_username}
              onChange={(e) => handleChange('smtp_username', e.target.value)}
            />
            <Input
              type="password"
              label="Senha"
              placeholder="••••••••"

            />
            <Input
              label="Email de Saída"
              type="email"
              placeholder="noreply@empresa.com.br"
              value={formData.smtp_from_email}
              onChange={(e) => handleChange('smtp_from_email', e.target.value)}
            />
            <div className="flex items-end">
              <Switch
                isSelected={formData.smtp_use_tls}
                onChange={(e) => handleChange('smtp_use_tls', e.target.checked)}

              >
                Usar TLS
              </Switch>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Backup</h3>
          <Divider className="mb-6" />
          <div className="space-y-4">
            <Switch
              isSelected={formData.backup_enabled}
              onChange={(e) => handleChange('backup_enabled', e.target.checked)}

            >
              Habilitar Backups
            </Switch>

            {formData.backup_enabled && (
              <Input
                type="number"
                label="Retenção de Backups (dias)"
                min="1"
                max="365"
                value={String(formData.backup_retention_days)}
                onChange={(e) => handleChange('backup_retention_days', parseInt(e.target.value))}

              />
            )}
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Features</h3>
          <Divider className="mb-6" />
          <div className="space-y-4">
            <Switch
              isSelected={formData.enable_two_factor_auth}
              onChange={(e) => handleChange('enable_two_factor_auth', e.target.checked)}

            >
              Autenticação de Dois Fatores
            </Switch>

            <Switch
              isSelected={formData.enable_audit_logging}
              onChange={(e) => handleChange('enable_audit_logging', e.target.checked)}

            >
              Auditoria
            </Switch>

            <Switch
              isSelected={formData.enable_client_drafts}
              onChange={(e) => handleChange('enable_client_drafts', e.target.checked)}

            >
              Rascunhos de Clientes
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
