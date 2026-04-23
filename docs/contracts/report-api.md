# Report API Contract

## Overview

The Report API provides endpoints for generating, previewing, and exporting various financial and operational reports. All reports support advanced customization, real-time preview, and export in multiple formats (PDF, CSV and XLS).

## Base URL

```
/api/v1/reports
```

## Authentication

All endpoints require JWT authentication via Bearer token in the Authorization header.

## RBAC

- **Admin/Func**: Full access to all reports
- **Cliente**: Access only to their own data; client portal should expose only `geral` and `obrigacoes`

---

## Endpoints

### Get Available Report Types

**GET** `/reports/types`

Returns a list of all available report types with metadata.

**Response:** `200 OK`
```json
{
  "types": [
    {
      "type": "geral",
      "name": "Relatório Geral",
      "description": "Visão gerencial com empresa, resumo financeiro, DRE, KPIs, evolução, análises e projeções",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["line", "bar", "table"],
      "required_permissions": null
    },
    {
      "type": "dre",
      "name": "Demonstrativo de Resultados",
      "description": "Mostra o lucro ou prejuízo do período",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["bar", "line", "table"],
      "required_permissions": null
    },
    {
      "type": "fluxo_caixa",
      "name": "Fluxo de Caixa",
      "description": "Mostra entradas e saídas de dinheiro mês a mês",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["line", "area", "table"],
      "required_permissions": null
    },
    {
      "type": "livro_caixa",
      "name": "Livro Caixa",
      "description": "Registra todas as movimentações financeiras",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["table"],
      "required_permissions": null
    },
    {
      "type": "receitas_cliente",
      "name": "Receitas por Cliente",
      "description": "Mostra quanto cada cliente gerou em receita",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["bar", "pie", "table"],
      "required_permissions": null
    },
    {
      "type": "despesas_categoria",
      "name": "Despesas por Categoria",
      "description": "Classifica despesas em grupos",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["pie", "bar", "table"],
      "required_permissions": null
    },
    {
      "type": "projecao_fluxo",
      "name": "Projeção de Fluxo de Caixa",
      "description": "Prevê entradas e saídas futuras",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["line", "area", "table"],
      "required_permissions": null
    },
    {
      "type": "kpis",
      "name": "Indicadores Financeiros",
      "description": "Apresenta métricas de performance",
      "category": "financeiro",
      "supports_customization": true,
      "supported_charts": ["table"],
      "required_permissions": null
    },
    {
      "type": "clientes",
      "name": "Relatório de Clientes",
      "description": "Lista completa de clientes com indicadores",
      "category": "operacional",
      "supports_customization": true,
      "supported_charts": ["table"],
      "required_permissions": null
    },
    {
      "type": "obrigacoes",
      "name": "Relatório de Obrigações",
      "description": "Compliance e estatísticas de obrigações fiscais",
      "category": "operacional",
      "supports_customization": true,
      "supported_charts": ["bar", "pie", "table"],
      "required_permissions": null
    },
    {
      "type": "licencas",
      "name": "Relatório de Licenças",
      "description": "Status e vencimentos de licenças",
      "category": "operacional",
      "supports_customization": true,
      "supported_charts": ["table", "bar"],
      "required_permissions": null
    },
    {
      "type": "auditoria",
      "name": "Relatório de Auditoria",
      "description": "Atividades e mudanças no sistema",
      "category": "operacional",
      "supports_customization": true,
      "supported_charts": ["table", "bar"],
      "required_permissions": ["admin"]
    }
  ]
}
```

---

### Preview Report

**POST** `/reports/preview`

Generates a preview of the report with data and chart configurations.

**Request:**
```json
{
  "report_type": "dre",
  "filters": {
    "period_start": "2025-01-01",
    "period_end": "2025-12-31",
    "client_ids": null,
    "status": null,
    "statuses": null,
    "report_type": "dre"
  },
  "customizations": {
    "fields_to_include": ["data", "valor", "cliente"],
    "group_by": "cliente",
    "sort_by": "valor",
    "sort_direction": "desc",
    "chart_types": ["bar", "pie"],
    "include_summary": true,
    "include_charts": true
  }
}
```

**Response:** `200 OK`
```json
{
  "report_type": "dre",
  "data": {
    "receitas": [
      {
        "categoria": "Honorários Mensais",
        "valor": 50000.00,
        "percentual": 65.5
      },
      {
        "categoria": "Serviços Adicionais",
        "valor": 10000.00,
        "percentual": 13.1
      }
    ],
    "despesas": [
      {
        "categoria": "Folha de Pagamento",
        "valor": 20000.00,
        "percentual": 26.2
      },
      {
        "categoria": "Aluguel",
        "valor": 5000.00,
        "percentual": 6.5
      }
    ],
    "receita_total": 60000.00,
    "despesa_total": 25000.00,
    "resultado_liquido": 35000.00,
    "margem_lucro": 58.3
  },
  "charts_config": [
    {
      "type": "bar",
      "title": "Receita vs Despesa",
      "data_key": "valor",
      "x_axis_key": "categoria",
      "y_axis_key": "valor",
      "color_scheme": ["#00bcd4", "#f44336"]
    }
  ],
  "summary": {
    "total_items": 10,
    "period": "2025-01-01 a 2025-12-31"
  },
  "generated_at": "2025-11-01T10:30:00Z",
  "record_count": 10
}
```

### Strategic Report Payloads

#### `geral`

`geral` is the strategic management report. It returns:

```json
{
  "empresa": {
    "escopo": "escritorio",
    "id": "client-or-office-id",
    "nome": "Contabilidade Exemplo",
    "razao_social": "Contabilidade Exemplo LTDA",
    "cnpj": "00.000.000/0001-00",
    "email": "contato@example.com",
    "telefone": "(00) 0000-0000",
    "endereco": "Rua Exemplo, 100"
  },
  "resumo_financeiro": {
    "receita_total": 60000.0,
    "despesa_total": 25000.0,
    "resultado_liquido": 35000.0,
    "margem_lucro": 58.33
  },
  "dre_simplificada": {
    "receitas": [{"categoria": "Honorários", "valor": 50000.0, "percentual": 83.33}],
    "despesas": [{"categoria": "Folha", "valor": 20000.0, "percentual": 80.0}],
    "receita_total": 60000.0,
    "despesa_total": 25000.0,
    "resultado_liquido": 35000.0,
    "margem_lucro": 58.33
  },
  "kpis": {
    "margem_operacional": 58.33,
    "resultado_liquido": 35000.0,
    "receita_total": 60000.0,
    "despesa_total": 25000.0
  },
  "evolucao_mensal": [
    {
      "competencia": "2025-01",
      "receita_total": 60000.0,
      "despesa_total": 25000.0,
      "resultado_liquido": 35000.0,
      "margem_lucro": 58.33
    }
  ],
  "analises": {
    "principais_receitas": [{"categoria": "Honorários", "valor": 50000.0, "percentual": 83.33}],
    "principais_despesas": [{"categoria": "Folha", "valor": 20000.0, "percentual": 80.0}]
  },
  "projecoes": {
    "metodo_projecao": "Média mensal dos últimos 6 meses",
    "base_historico_meses": 6,
    "periodos": [
      {
        "competencia": "2025-02",
        "previsao_receita": 60000.0,
        "previsao_despesa": 25000.0,
        "previsao_resultado": 35000.0
      }
    ]
  }
}
```

Financial calculations in `geral` use only paid, non-deleted transactions in the selected competence range. `aplicacao` and `resgate` are financial movements and are excluded from revenue, expense, DRE and KPI totals.

For office users, `/relatorios` defaults `geral` to the technical office client configured by `OFFICE_CLIENT_ID`. The same endpoint still accepts a specific client through `client_ids` or consolidated scope with `client_ids = null`. For client users, the API overrides `client_ids` to the authenticated client's record.

#### `clientes`

The clients report keeps the `clients` list and adds:

```json
{
  "total_clientes": 25,
  "total_clientes_ativos": 21,
  "total_honorarios": 32000.0,
  "por_regime": [{"regime": "simples_nacional", "total": 14}],
  "por_status": [{"status": "ativo", "total": 21}]
}
```

Each `clients[]` item includes `status`, `regime_tributario`, `honorarios`, `total_pendente` and `total_atrasado`.

#### `obrigacoes`

The obligations report now applies `period_start`, `period_end`, `client_ids`, `status` and `statuses` filters. It returns totals and a detailed list:

```json
{
  "compliance_rate": 82.5,
  "total_obligations": 40,
  "pending": 5,
  "completed": 33,
  "overdue": 2,
  "cancelled": 0,
  "totais_por_status": [{"status": "pendente", "total": 5}],
  "obligations": [
    {
      "id": "obligation-id",
      "client_id": "client-id",
      "client_name": "Cliente Exemplo",
      "client_cnpj": "00.000.000/0001-00",
      "obligation_name": "DAS Mensal",
      "obligation_code": "DAS",
      "status": "pendente",
      "competencia": "2025-01",
      "due_date": "2025-01-20",
      "priority": "media",
      "completed_at": null
    }
  ]
}
```

---

### Export Report

**POST** `/reports/export`

Generates and exports the report in the specified format.

**Request:**
```json
{
  "report_type": "dre",
  "format": "pdf",
  "filters": {
    "period_start": "2025-01-01",
    "period_end": "2025-12-31",
    "client_ids": null,
    "report_type": "dre"
  },
  "customizations": {
    "include_summary": true,
    "include_charts": true
  },
  "filename": "DRE_2025",
  "save_as_template": false
}
```

**Response:** `200 OK`
```json
{
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_url": "/api/v1/reports/download/550e8400-e29b-41d4-a716-446655440000",
  "file_name": "DRE_2025_20251101_103000.pdf",
  "file_size": 245760,
  "format": "pdf",
  "generated_at": "2025-11-01T10:30:00Z",
  "expires_at": "2025-11-08T10:30:00Z"
}
```

---

### Download Report

**GET** `/reports/download/{report_id}`

Downloads a previously generated report file.

**Response:** `200 OK`
- Headers: `Content-Type: application/pdf` or `text/csv`
- Headers: `Content-Disposition: attachment; filename="DRE_2025.pdf"`

---

### Get Report History

**GET** `/reports/history?page=1&size=20&report_type=dre`

Returns paginated list of generated reports.

**Query Parameters:**
- `page` (int, default: 1): Page number
- `size` (int, default: 20): Items per page
- `report_type` (enum, optional): Filter by report type
- `format` (enum, optional): Filter by format
- `start_date` (date, optional): Filter from date
- `end_date` (date, optional): Filter to date

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "template_id": null,
      "user_id": "user-id-here",
      "report_type": "dre",
      "filters_used": {
        "period_start": "2025-01-01",
        "period_end": "2025-12-31"
      },
      "format": "pdf",
      "file_path": "/uploads/reports/user-id/20251101/DRE_2025.pdf",
      "file_size": 245760,
      "generated_at": "2025-11-01T10:30:00Z",
      "expires_at": "2025-11-08T10:30:00Z",
      "status": "completed"
    }
  ],
  "total": 50,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

---

## Report Templates Management

### Get Templates

**GET** `/reports/templates?include_system=true`

Returns list of available templates (user + system).

**Query Parameters:**
- `include_system` (bool, default: true): Include system templates

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "template-id",
      "name": "DRE Mensal",
      "description": "Demonstrativo de Resultados mensal padrão",
      "report_type": "dre",
      "default_filters": {
        "period_start": "2025-01-01",
        "period_end": "2025-12-31"
      },
      "default_customizations": {
        "include_summary": true,
        "include_charts": true
      },
      "is_system": true,
      "created_by_id": "admin-id",
      "created_at": "2025-10-01T00:00:00Z",
      "updated_at": "2025-10-01T00:00:00Z"
    }
  ]
}
```

### Create Template

**POST** `/reports/templates`

Creates a new custom template.

**Request:**
```json
{
  "name": "DRE Trimestral",
  "description": "DRE para análise trimestral",
  "report_type": "dre",
  "default_filters": {
    "period_start": "2025-Q1-START",
    "period_end": "2025-Q1-END"
  },
  "default_customizations": {
    "include_summary": true,
    "include_charts": true
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "template-id",
  "name": "DRE Trimestral",
  "description": "DRE para análise trimestral",
  "report_type": "dre",
  "default_filters": {...},
  "default_customizations": {...},
  "is_system": false,
  "created_by_id": "user-id",
  "created_at": "2025-11-01T10:30:00Z",
  "updated_at": "2025-11-01T10:30:00Z"
}
```

### Update Template

**PUT** `/reports/templates/{template_id}`

Updates a custom template (system templates cannot be updated).

**Request:**
```json
{
  "name": "DRE Semestral",
  "description": "DRE para análise semestral atualizada"
}
```

**Response:** `200 OK` (returns updated template)

### Delete Template

**DELETE** `/reports/templates/{template_id}`

Deletes a custom template (system templates cannot be deleted).

**Response:** `204 No Content`

---

## Financial Report Endpoints (Convenience)

### Generate DRE Report

**POST** `/reports/financial/dre`

Shorthand for generating DRE report with default settings.

### Generate Cash Flow Report

**POST** `/reports/financial/cash-flow`

Shorthand for generating cash flow report.

### Generate Cash Book Report

**POST** `/reports/financial/cash-book`

Shorthand for generating cash book report.

### Generate Revenue by Client Report

**POST** `/reports/financial/revenue-client`

Shorthand for generating revenue by client report.

### Generate Expenses by Category Report

**POST** `/reports/financial/expenses`

Shorthand for generating expenses report.

### Generate Cash Flow Projection

**POST** `/reports/financial/projection`

Shorthand for generating projection report.

### Generate KPI Report

**POST** `/reports/financial/kpis`

Shorthand for generating KPIs report.

---

## Operational Report Endpoints

### Export Clients Report

**POST** `/reports/clients/export`

Generates comprehensive clients report.

### Export Obligations Report

**POST** `/reports/obligations/export`

Generates compliance and obligations report.

### Export Licenses Report

**POST** `/reports/licenses/export`

Generates licenses and certifications report.

### Export Audit Report

**POST** `/reports/audit/export` (Admin only)

Generates audit and activity report.

---

## Export Table Preparation

`reports.py` prepares dedicated export tables for:

- `geral`: empresa, resumo financeiro, KPIs, evolução mensal, principais receitas/despesas and projeções.
- `clientes`: cliente, CNPJ, status, regime tributário, honorários, pendente and atrasado.
- `obrigacoes`: cliente, CNPJ, obrigação, status, competência, vencimento and prioridade.

---

## Deploy Notes

Deploy requires `alembic upgrade head` because PostgreSQL enum `report_type` receives the new value `geral`.

Production Docker configuration remains unchanged. Do not alter `docker-compose.prod.yml` or `.env.prod`; production continues using `postgres:5432` through the Docker network.

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid filters: period_end must be after period_start"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Insufficient permissions to access this report"
}
```

### 404 Not Found
```json
{
  "detail": "Report template not found"
}
```

### 422 Unprocessable Entity
```json
{
  "detail": [
    {
      "loc": ["body", "filters", "period_start"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 429 Too Many Requests
```json
{
  "detail": "Rate limit exceeded. Maximum 10 reports per hour."
}
```

---

## Rate Limiting

- Maximum **10 reports per hour** per user
- Rate limit applies to `/export` endpoints only
- Preview endpoints have no limit

---

## Notes

1. **File Expiration**: All generated report files expire after 7 days and are automatically cleaned up.
2. **Async Generation**: PDF generation is async for large reports. Use the report history endpoint to check status.
3. **Customization**: Not all reports support all customization options. Check `supports_customization` and `supported_charts` in report type info.
4. **RBAC**: Clients can only see their own data in all reports.
5. **Data Retention**: Report history is retained indefinitely for audit purposes, but file downloads expire after 7 days.
