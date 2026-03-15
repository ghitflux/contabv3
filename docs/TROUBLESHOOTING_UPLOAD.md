# Troubleshooting: Upload de Comprovante em Obrigações

## Problema Reportado
"Erro ao fazer upload" ao tentar anexar comprovante em uma obrigação.

## Correções Já Aplicadas

### 1. Backend - Caminho de Upload
✅ Corrigido caminho de `/var/uploads/receipts` (Unix) para `uploads/receipts/` (relativo)
✅ Adicionada organização por data
✅ Criado endpoint de download de receipts

### 2. Frontend - Tratamento de Erro
✅ Melhorado tratamento de erro para mostrar mensagem detalhada
✅ Adicionado console.log para debug

### 3. Backend - Processor de Obrigações
✅ Corrigidos enums de status (CONCLUIDA/CANCELADA/PENDENTE)
✅ Corrigidos campos do evento (user_id/extra_data) e tipo CANCELED

## Como Testar e Identificar o Erro

### Passo 1: Verificar Console do Navegador
1. Abra o DevTools do navegador (F12)
2. Vá para a aba "Console"
3. Tente fazer upload de um arquivo
4. Procure por: `"Erro ao fazer upload:"`
5. Copie a mensagem de erro completa

### Passo 2: Verificar Network Tab
1. No DevTools, vá para a aba "Network"
2. Tente fazer upload novamente
3. Procure pela requisição para `/obligations/{id}/receipt`
4. Clique na requisição
5. Verifique:
   - **Status Code**: Deve ser 200 (sucesso) ou outro código de erro
   - **Response**: Veja a mensagem de erro do backend
   - **Headers**: Verifique se o Content-Type está correto

### Passo 3: Verificar Backend Logs
1. Abra o terminal onde o backend está rodando
2. Procure por erros após tentar fazer upload
3. Copie os logs de erro

## Possíveis Causas do Erro

### Causa 1: Backend não está rodando
**Sintoma**: Erro `Failed to fetch` ou `Network error`

**Solução**:
```bash
cd apps/api
venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

### Causa 2: Pasta de uploads sem permissão
**Sintoma**: Erro `Permission denied` no backend

**Solução**:
```bash
# Criar pasta manualmente
mkdir -p uploads/receipts

# No Windows (PowerShell)
New-Item -Path "uploads\receipts" -ItemType Directory -Force
```

### Causa 3: Token expirado
**Sintoma**: Status Code 401 Unauthorized

**Solução**:
1. Faça logout e login novamente
2. Ou force refresh do token

### Causa 4: Permissão de usuário
**Sintoma**: Status Code 403 Forbidden ou "Only admin/func can upload receipts"

**Solução**:
- Apenas usuários Admin e Funcionário podem fazer upload
- Cliente não pode fazer upload de receipts
- Verifique seu role no sistema

### Causa 5: Arquivo muito grande
**Sintoma**: Erro "File size exceeds 10MB limit"

**Solução**:
- Reduza o tamanho do arquivo
- Máximo permitido: 10MB

### Causa 6: Tipo de arquivo inválido
**Sintoma**: Erro "Invalid file type"

**Solução**:
- Use apenas: PDF, JPEG ou PNG
- Verifique a extensão do arquivo

## Teste Manual via cURL

Para testar o endpoint diretamente:

```bash
# 1. Obter token de autenticação
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@contabil.com","password":"admin"}'

# Copie o access_token da resposta

# 2. Fazer upload de arquivo
curl -X POST "http://localhost:8000/api/v1/obligations/{OBLIGATION_ID}/receipt" \
  -H "Authorization: Bearer {SEU_TOKEN_AQUI}" \
  -F "file=@caminho/para/arquivo.pdf" \
  -F "notes=Teste de upload via cURL"
```

Substitua:
- `{OBLIGATION_ID}` pelo ID da obrigação
- `{SEU_TOKEN_AQUI}` pelo token obtido no passo 1
- `caminho/para/arquivo.pdf` pelo caminho real do arquivo

## Verificação da Estrutura de Pastas

Após um upload bem-sucedido, a estrutura deve ser:

```
uploads/
└── receipts/
    └── YYYYMMDD/               # Ex: 20251230
        └── {uuid}_timestamp_arquivo.pdf
```

Exemplo:
```
uploads/
└── receipts/
    └── 20251230/
        ├── ddc0114a-17f8-452e-a8de-e43d4092c328_20251230_143022_comprovante.pdf
        └── abc123-456-789_20251230_150000_nota.jpg
```

## Comandos de Diagnóstico

### Verificar se pasta existe
```bash
# Windows
dir uploads\receipts

# Linux/Mac
ls -la uploads/receipts
```

### Verificar permissões (Linux/Mac)
```bash
ls -la uploads/
chmod -R 755 uploads/
```

### Verificar tamanho do arquivo
```bash
# Windows
Get-ItemProperty caminho\arquivo.pdf | Select-Object Length

# Linux/Mac
ls -lh caminho/arquivo.pdf
```

## Checklist de Verificação

Antes de reportar o erro, verifique:

- [ ] Backend está rodando (`http://localhost:8000/api/v1/health`)
- [ ] Você está logado como Admin ou Funcionário
- [ ] O arquivo é PDF, JPEG ou PNG
- [ ] O arquivo tem menos de 10MB
- [ ] A pasta `uploads/receipts` existe
- [ ] Não há erros no console do navegador
- [ ] Não há erros no terminal do backend

## Informações para Reportar Erro

Se o erro persistir, forneça:

1. **Mensagem de erro do console**
   ```
   Erro ao fazer upload: ...
   ```

2. **Status Code da requisição**
   ```
   404, 500, etc.
   ```

3. **Resposta do backend**
   ```json
   { "detail": "..." }
   ```

4. **Tipo e tamanho do arquivo**
   ```
   Arquivo: comprovante.pdf (2.5 MB)
   ```

5. **Role do usuário**
   ```
   Admin, Funcionário ou Cliente
   ```

6. **Logs do backend**
   ```
   Copie os logs do terminal onde o backend está rodando
   ```

---

## Correções Aplicadas

### Arquivo: `apps/web/src/components/features/obrigacoes/UploadReceiptModal.tsx`

**Linha 130-145**: Melhorado tratamento de erro
```typescript
catch (err) {
  console.error("Erro ao fazer upload:", err);

  // Extract error message from API error
  let errorMessage = "Erro ao fazer upload";
  if (err instanceof Error) {
    errorMessage = err.message;
    // Check if error has data property (from API)
    if ((err as any).data?.detail) {
      errorMessage = (err as any).data.detail;
    }
  } else if (typeof err === "string") {
    errorMessage = err;
  }

  setError(errorMessage);
}
```

### Arquivo: `apps/api/app/api/v1/routes/obligations.py`

**Linha 316-336**: Caminho de upload corrigido
```python
# Use relative path that works on Windows and Linux
upload_dir = Path("uploads/receipts")
upload_dir.mkdir(parents=True, exist_ok=True)

# Create subdirectory by date for organization
today = datetime.utcnow().strftime("%Y%m%d")
date_dir = upload_dir / today
date_dir.mkdir(parents=True, exist_ok=True)

# Generate unique filename
timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
filename = f"{obligation_id}_{timestamp}_{file.filename}"
file_path = date_dir / filename

with open(file_path, "wb") as f:
    f.write(contents)

receipt_url = f"/obligations/receipts/{today}/{filename}"
```

**Linha 762-833**: Novo endpoint de download
```python
@router.get("/receipts/{date}/{filename}")
async def download_receipt(...)
```

---

**Data**: 2025-12-30
**Status**: Aguardando teste do usuário para identificar erro específico
