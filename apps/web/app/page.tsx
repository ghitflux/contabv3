'use client';

import { Button, Card, CardBody, CardHeader, Link } from '@/heroui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="z-10 max-w-2xl w-full items-center justify-center flex flex-col gap-8">
        <Card className="w-full">
          <CardHeader className="flex gap-3 pb-3">
            <div className="flex flex-col">
              <p className="text-2xl font-bold">🏢 SaaS Contábil</p>
              <p className="text-sm text-default-500">Sistema de Gestão para Escritórios Contábeis</p>
            </div>
          </CardHeader>
          <CardBody className="gap-4">
            <p className="text-sm">
              Sistema completo para gerenciar clientes, obrigações fiscais, financeiro e muito mais.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button as={Link} href="/login" color="primary" variant="solid" className="flex-1">
                Acessar Sistema
              </Button>
              <Button as={Link} href="/clientes" color="default" variant="bordered" className="flex-1">
                Ver Demo (Clientes)
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="w-full rounded-lg border border-dashed border-default-300 p-6">
          <h3 className="mb-3 text-sm font-semibold">✅ Marco 1 Completo</h3>
          <ul className="space-y-2 text-sm text-default-600">
            <li>✓ Monorepo configurado (pnpm workspaces)</li>
            <li>✓ Next.js 16 + HeroUI + Tailwind v4</li>
            <li>✓ FastAPI + SQLAlchemy 2 + PostgreSQL</li>
            <li>✓ Docker Compose + Nginx</li>
            <li>✓ Páginas base (Login e Clientes Mock)</li>
          </ul>
          <p className="mt-4 text-xs text-default-500">
            Tecnologias: Next.js 16, HeroUI, Tailwind v4, FastAPI, SQLAlchemy 2, PostgreSQL 16, Docker, Nginx
          </p>
        </div>
      </div>
    </main>
  );
}
