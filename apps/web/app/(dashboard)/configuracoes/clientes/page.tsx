'use client';

import { Card, Button, Input, Select, SelectItem, Divider, Skeleton } from '@heroui/react';
import { useClientDefaultSettings } from '@/hooks/useSettings';
import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';

export default function ClientesPage() {
  const { settings, isLoading, fetchSettings, updateSettings } = useClientDefaultSettings();
  const [formData, setFormData] = useState({
    default_payment_day: 10,
    default_honorario_amount: undefined,
    default_obligation_template_ids: '',
    default_cnae_ids: '',
    default_client_status: 'ativo',
    default_notification_template: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData({
        default_payment_day: settings.default_payment_day,
        default_honorario_amount: settings.default_honorario_amount || undefined,
        default_obligation_template_ids: settings.default_obligation_template_ids || '',
        default_cnae_ids: settings.default_cnae_ids || '',
        default_client_status: settings.default_client_status,
        default_notification_template: settings.default_notification_template || '',
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
      toast.success('Padrões de clientes atualizados!');
    } catch (error) {
      toast.error('Erro ao atualizar padrões');
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
          <h2 className="text-2xl font-bold mb-4">Padrões para Novos Clientes</h2>
          <p className="text-default-500 mb-4">
            Valores padrão que serão preenchidos ao criar novos clientes
          </p>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Configurações Financeiras</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Dia de Vencimento Padrão"
              min="1"
              max="31"
              value={formData.default_payment_day}
              onChange={(e) => handleChange('default_payment_day', parseInt(e.target.value))}
              description="Dia do mês padrão para vencimento"
            />
            <Input
              type="number"
              step="0.01"
              label="Honorário Mensal Padrão (R$)"
              placeholder="0.00"
              value={formData.default_honorario_amount || ''}
              onChange={(e) =>
                handleChange('default_honorario_amount', e.target.value ? parseFloat(e.target.value) : undefined)
              }
              description="Valor padrão de honorários (deixe vazio para sem padrão)"
            />
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Configurações Padrão</h3>
          <Divider className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Status Padrão de Novos Clientes"
              selectedKeys={[formData.default_client_status]}
              onChange={(e) => handleChange('default_client_status', e.target.value)}
              description="Status ao criar novo cliente"
            >
              <SelectItem key="ativo" value="ativo">
                Ativo
              </SelectItem>
              <SelectItem key="inativo" value="inativo">
                Inativo
              </SelectItem>
              <SelectItem key="pendente" value="pendente">
                Pendente
              </SelectItem>
            </Select>

            <Input
              label="Template de Notificação Padrão"
              placeholder="ID do template"
              value={formData.default_notification_template}
              onChange={(e) => handleChange('default_notification_template', e.target.value)}
              description="ID do template de notificação"
            />
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-xl font-semibold mb-4">Modelos e Atividades</h3>
          <Divider className="mb-6" />
          <p className="text-default-500 text-sm mb-4">
            Lista de IDs separados por vírgula para serem associados a novos clientes
          </p>
          <div className="space-y-4">
            <Input
              label="Templates de Obrigações Padrão"
              placeholder="id1, id2, id3"
              value={formData.default_obligation_template_ids}
              onChange={(e) => handleChange('default_obligation_template_ids', e.target.value)}
              description="IDs dos templates de obrigações (opcional)"
            />

            <Input
              label="CNAEs Padrão"
              placeholder="id1, id2, id3"
              value={formData.default_cnae_ids}
              onChange={(e) => handleChange('default_cnae_ids', e.target.value)}
              description="IDs dos CNAEs padrão (opcional)"
            />
          </div>
        </div>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button color="default" variant="light" onClick={() => fetchSettings()}>
            Descartar
          </Button>
          <Button color="primary" isLoading={isSaving} onClick={handleSave}>
            Salvar Padrões
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
