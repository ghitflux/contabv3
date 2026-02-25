'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardBody, CardHeader, Input, Link } from '@/heroui';
import { authApi } from '@/lib/api/endpoints/auth';
import { toast } from '@/lib/toast';
import type { ApiError } from '@/lib/api/client';
import { CopyIcon } from '@/lib/icons';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Senha deve ter no mínimo 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Senha deve conter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(password)) return 'Senha deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(password)) return 'Senha deve conter pelo menos um número.';
  return null;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') ?? '';

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devToken, setDevToken] = useState<string | null>(initialToken || null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Informe o email para recuperar a senha.');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await authApi.requestPasswordReset({ email: email.trim() });
      toast.success(response.message);
      if (response.resetToken) {
        setToken(response.resetToken);
        setDevToken(response.resetToken);
      }
    } catch (error) {
      const apiError = error as ApiError;
      const detail = typeof apiError?.data?.detail === 'string' ? apiError.data.detail : '';
      toast.error(detail || 'Não foi possível solicitar a recuperação de senha.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      toast.error('Informe o token de recuperação.');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    setIsConfirming(true);
    try {
      await authApi.confirmPasswordReset({
        token: token.trim(),
        new_password: newPassword,
      });
      toast.success('Senha redefinida com sucesso. Faça login com a nova senha.');
      router.push('/login');
    } catch (error) {
      const apiError = error as ApiError;
      const detail = typeof apiError?.data?.detail === 'string' ? apiError.data.detail : '';
      toast.error(detail || 'Não foi possível redefinir a senha.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Recuperar Senha</h1>
          <p className="text-sm text-default-500">
            {hasToken
              ? 'Defina sua nova senha usando o token de recuperação.'
              : 'Solicite um token para redefinir sua senha.'}
          </p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          {!hasToken ? (
            <form onSubmit={handleRequest} className="flex flex-col gap-4">
              <Input
                type="email"
                label="Email"
                placeholder="seu@email.com"
                variant="bordered"
                isRequired
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isDisabled={isRequesting}
              />
              <Button
                type="submit"
                color="primary"
                className="w-full"
                isLoading={isRequesting}
                isDisabled={isRequesting}
              >
                Solicitar recuperação
              </Button>
              <Link href="/login" size="sm" className="text-default-500">
                Voltar para o login
              </Link>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <Input
                label="Token"
                placeholder="Cole o token de recuperação"
                variant="bordered"
                isRequired
                value={token}
                onChange={(e) => setToken(e.target.value)}
                isDisabled={isConfirming}
              />

              <Input
                type="password"
                label="Nova senha"
                placeholder="Mínimo 8 caracteres"
                variant="bordered"
                isRequired
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                isDisabled={isConfirming}
              />
              <Input
                type="password"
                label="Confirmar nova senha"
                placeholder="Digite a senha novamente"
                variant="bordered"
                isRequired
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                isDisabled={isConfirming}
              />

              {devToken && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs space-y-2">
                  <p className="font-medium">Token de desenvolvimento</p>
                  <p className="break-all text-default-600">{devToken}</p>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<CopyIcon className="h-4 w-4" />}
                    onPress={async () => {
                      await navigator.clipboard.writeText(devToken);
                      toast.success('Token copiado.');
                    }}
                  >
                    Copiar token
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                color="primary"
                className="w-full"
                isLoading={isConfirming}
                isDisabled={isConfirming}
              >
                Redefinir senha
              </Button>
              <Link href="/login" size="sm" className="text-default-500">
                Voltar para o login
              </Link>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

