'use client';

import { Button, Card, CardBody, CardHeader, Input, Link } from '@/heroui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/clientes');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    try {
      await login(email, password);
      // Redirect to clients page on success
      router.push('/clientes');
    } catch (err) {
      setLoginError('Email ou senha incorretos');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Bem-vindo</h1>
          <p className="text-sm text-default-500">Entre com suas credenciais</p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              label="Email"
              placeholder="seu@email.com"
              variant="bordered"
              isRequired
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isDisabled={isLoading}
            />
            <Input
              type="password"
              label="Senha"
              placeholder="••••••••"
              variant="bordered"
              isRequired
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isDisabled={isLoading}
            />
            {(loginError || error) && (
              <div className="text-sm text-danger">{loginError || error}</div>
            )}
            <div className="flex items-center justify-between text-sm">
              <Link href="#" size="sm" className="text-default-500">
                Esqueceu a senha?
              </Link>
            </div>
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={isLoading}
              isDisabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-default-400">
            Credenciais de teste: admin@contabil.com / admin123
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
