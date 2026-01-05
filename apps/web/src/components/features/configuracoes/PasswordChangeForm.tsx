'use client';

import { Card, Input, Button, Divider } from '@heroui/react';
import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { authApi } from '@/lib/api/endpoints/auth';

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
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          toast.error('Senha atual incorreta');
        } else {
          toast.error('Erro ao alterar senha');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, validatePasswords]);

  return (
    <Card className="p-6 space-y-6">
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

      <div className="flex gap-2">
        <Button
          color="default"
          variant="light"
          onClick={() => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setErrors({});
          }}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          color="primary"
          isLoading={isLoading}
          onClick={handleSubmit}
        >
          Alterar Senha
        </Button>
      </div>
    </Card>
  );
}
