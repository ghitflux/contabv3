# Problemas Resolvidos - ContabilConsult

Este documento registra problemas encontrados durante o desenvolvimento e suas soluções, para referência futura.

## 1. Login não funcionando - Hash de senha inválido

### Problema
```
ValueError: Invalid salt
```

### Causa
O hash de senha no banco de dados estava corrompido ou incompatível com o bcrypt.

### Sintomas
- Login retornava 500 Internal Server Error
- Logs mostravam erro em `user.verify_password(password)`
- Hash no banco começava com `\b\2\` ao invés de `$2b$`

### Solução
1. **Criar script de seed de usuários** que usa `user.set_password()` corretamente
2. **Executar seed**: `docker exec ConsultContabil-api python -m scripts.seed_users`
3. **Nunca inserir hash diretamente no banco** - sempre usar o método do modelo

### Código Correto (User Model)
```python
def set_password(self, password: str) -> None:
    """Set password hash."""
    salt = bcrypt.gensalt()
    self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(self, password: str) -> bool:
    """Verify password."""
    return bcrypt.checkpw(
        password.encode('utf-8'),
        self.password_hash.encode('utf-8')
    )
```

### Prevenção
- Sempre usar `user.set_password(senha)` ao criar usuários
- Usar scripts de seed ao invés de INSERT SQL manual
- Verificar hash gerado começa com `$2b$12$`

---

## 2. API não estava rodando no Docker

### Problema
API rodava apenas localmente, sem containerização.

### Causa
Ausência de `Dockerfile` e `docker-compose.yml` no projeto.

### Solução
1. **Criar Dockerfile multi-stage**:
   - Stage `base`: instalação de dependências
   - Stage `development`: com hot-reload
   - Stage `production`: otimizado

2. **Criar docker-compose.yml**:
   - Container PostgreSQL com healthcheck
   - Container API com dependência no PostgreSQL
   - Networks e volumes nomeados

3. **Configurar hot-reload**: montar código fonte como volume

### Arquivos Criados
- `apps/api/Dockerfile`
- `apps/api/.dockerignore`
- `docker-compose.yml`

---

## 3. Erro de importação de modelos SQLAlchemy

### Problema
```
ImportError: cannot import name 'ObligationType' from 'app.db.models.obligation'
sqlalchemy.exc.InvalidRequestError: When initializing mapper Mapper[Client(clients)],
expression 'Obligation' failed to locate a name
```

### Causa
Modelos SQLAlchemy não estavam sendo importados corretamente no `__init__.py`, causando problemas de relacionamentos.

### Sintomas
- Container API reiniciava em loop
- Migrações Alembic falhavam
- Scripts de seed não funcionavam

### Solução
**Importar TODOS os modelos** em `apps/api/app/db/models/__init__.py`:

```python
from app.db.models.audit import AuditLog
from app.db.models.base import Base
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import FinancialTransaction, PaymentMethod, PaymentStatus, TransactionType
from app.db.models.notification import Notification
from app.db.models.obligation import Obligation
from app.db.models.obligation_event import ObligationEvent
from app.db.models.obligation_type import ObligationType
from app.db.models.user import User, UserRole
```

### Regras Importantes
1. **Todos os modelos** devem ser importados em `__init__.py`
2. **Enums também** precisam ser importados se usados em outros modelos
3. **Ordem importa**: modelos base antes de modelos dependentes
4. **Usar imports absolutos**: `from app.db.models.X import Y`

### Prevenção
- Ao criar novo modelo, adicionar import em `__init__.py` imediatamente
- Verificar se enums são importados também
- Testar migrações após adicionar modelo: `alembic upgrade head`

---

## 4. Dependência faltando - reportlab

### Problema
```
ModuleNotFoundError: No module named 'reportlab'
```

### Causa
Dependência `reportlab` necessária para geração de PDFs não estava em `pyproject.toml`.

### Sintomas
- API não iniciava
- Erro ao importar `app.services.finance.invoice_service`

### Solução
Adicionar dependência em `apps/api/pyproject.toml`:

```toml
dependencies = [
    # ... outras dependências
    "reportlab>=4.0.0",
]
```

Reconstruir container:
```bash
docker compose up -d --build
```

### Prevenção
- Adicionar dependências em `pyproject.toml` assim que usadas
- Sempre testar build do Docker após adicionar import novo
- Usar `pip freeze > requirements.txt` para backup

---

## 5. PostgreSQL em container separado vs compartilhado

### Problema
Container PostgreSQL (`contabil-postgres-dev`) estava sendo compartilhado entre projetos.

### Causa
Falta de isolamento entre projetos diferentes.

### Solução
Criar containers dedicados para o projeto:
- `ConsultContabil-postgres`
- `ConsultContabil-api`

Com network isolada: `consultcontabil-network`

### Benefícios
- Isolamento completo entre projetos
- Possibilidade de destruir ambiente sem afetar outros
- Versionamento específico do PostgreSQL
- Migrations independentes

### Prevenção
- Sempre nomear containers com prefixo do projeto
- Criar network dedicada para cada projeto
- Documentar containers em uso

---

## 6. Passlib incompatível com bcrypt 5.x

### Problema
```
ValueError: password cannot be longer than 72 bytes
AttributeError: module 'bcrypt' has no attribute '__about__'
```

### Causa
Passlib tentando usar bcrypt diretamente causa erro de compatibilidade.

### Solução
**Usar bcrypt diretamente** ao invés de passlib em produção:

```python
import bcrypt

# Gerar hash
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(password.encode('utf-8'), salt)

# Verificar
is_valid = bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
```

### Alternativa
Downgrade bcrypt para versão 4.x se passlib for necessário:
```toml
"bcrypt>=4.0.0,<5.0.0"
```

---

## 7. pyproject.toml sem configuração de build

### Problema
```
ValueError: Unable to determine which files to ship inside the wheel
```

### Causa
Faltava configuração `[tool.hatch.build.targets.wheel]` no `pyproject.toml`.

### Solução
Adicionar em `apps/api/pyproject.toml`:

```toml
[tool.hatch.build.targets.wheel]
packages = ["app"]
```

### Explicação
Hatchling (build backend) precisa saber qual diretório contém o código Python.

---

## Checklist para Evitar Problemas Futuros

### Ao criar novo modelo SQLAlchemy
- [ ] Importar modelo em `app/db/models/__init__.py`
- [ ] Importar enums usados pelo modelo
- [ ] Criar migração: `alembic revision --autogenerate -m "descrição"`
- [ ] Testar migração: `alembic upgrade head`
- [ ] Testar rollback: `alembic downgrade -1`

### Ao adicionar nova dependência
- [ ] Adicionar em `pyproject.toml` na seção `dependencies`
- [ ] Reconstruir container: `docker compose up -d --build`
- [ ] Verificar se API inicia corretamente
- [ ] Commitar `pyproject.toml` atualizado

### Ao criar usuários
- [ ] Sempre usar `user.set_password(senha)`
- [ ] Nunca inserir hash SQL diretamente
- [ ] Usar script de seed quando possível
- [ ] Verificar hash gerado começa com `$2b$`

### Ao configurar Docker
- [ ] Nomear containers com prefixo do projeto
- [ ] Criar network dedicada
- [ ] Configurar healthchecks para dependências
- [ ] Usar volumes nomeados
- [ ] Documentar portas utilizadas

### Ao fazer deploy
- [ ] Alterar `DEBUG=false`
- [ ] Gerar `SECRET_KEY` aleatória
- [ ] Usar credenciais seguras
- [ ] Remover `--reload` do uvicorn
- [ ] Configurar backups do banco
