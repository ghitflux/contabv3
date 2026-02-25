'use client';

import { Card, Input, Button, Divider } from '@heroui/react';
import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { authApi } from '@/lib/api/endpoints/auth';
import type { ApiError } from '@/lib/api/client';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePasswords = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Senha atual é obrigatória';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Nova senha é obrigatória';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Senha deve ter no mínimo 8 caracteres';
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = 'Senha deve conter pelo menos uma letra maiúscula';
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = 'Senha deve conter pelo menos uma letra minúscula';
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Senha deve conter pelo menos um número';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não conferem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    if (!validatePasswords()) {
      return;
    }

    setIsLoading(true);
    try {
      await authApi.updateMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (error) {
      const apiError = error as ApiError;
      const detail = typeof apiError?.data?.detail === 'string' ? apiError.data.detail : '';
      if (apiError?.status === 401 || detail.toLowerCase().includes('current password')) {
        toast.error('Senha atual incorreta');
        return;
      }
      if (detail) {
        toast.error(detail);
        return;
      }
      toast.error('Erro ao alterar senha');
    } finally {
      setIsLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, validatePasswords]);

  return (
    <Card className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Alterar Senha</h2>
        <p className="text-default-500">Atualize sua senha regularmente para manter sua conta segura</p>
      </div>

      <Divider />

      <div className="space-y-4">
        <Input
          type="password"
          label="Senha Atual"
          placeholder="Digite sua senha atual"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (errors.currentPassword) {
              setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.currentPassword;
                return newErrors;
              });
            }
          }}
          isInvalid={!!errors.currentPassword}
          errorMessage={errors.currentPassword}
          isDisabled={isLoading}
        />

        <Input
          type="password"
          label="Nova Senha"
          placeholder="Mínimo 8 caracteres, maiúsculas, minúsculas e números"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (errors.newPassword) {
              setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.newPassword;
                return newErrors;
              });
            }
          }}
          isInvalid={!!errors.newPassword}
          errorMessage={errors.newPassword}
          isDisabled={isLoading}
          description="Deve conter maiúsculas, minúsculas e números"
        />
        <div className="rounded-lg border border-default-200 p-3 text-xs text-default-600 space-y-1">
          <p>Requisitos mínimos:</p>
          <p>- 8 ou mais caracteres</p>
          <p>- Pelo menos uma letra maiúscula e uma minúscula</p>
          <p>- Pelo menos um número</p>
        </div>

        <Input
          type="password"
          label="Confirmar Nova Senha"
          placeholder="Digite a nova senha novamente"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) {
              setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.confirmPassword;
                return newErrors;
              });
            }
          }}
          isInvalid={!!errors.confirmPassword}
          errorMessage={errors.confirmPassword}
          isDisabled={isLoading}
        />
      </div>

      <Divider />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          color="default"
          variant="light"
          onClick={() => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setErrors({});
          }}
          isDisabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          color="primary"
          isLoading={isLoading}
          isDisabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          onClick={handleSubmit}
        >
          Alterar Senha
        </Button>
      </div>
    </Card>
  );
}
