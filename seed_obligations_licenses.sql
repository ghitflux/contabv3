-- Seed de Tipos de Obrigações
INSERT INTO obligation_types (id, name, code, description, recurrence, day_of_month, applies_to_simples, applies_to_presumido, applies_to_real, is_active, created_at, updated_at)
VALUES
(gen_random_uuid(), 'Declaração de Imposto de Renda', 'DECL-IR', 'Apresentação da declaração anual de imposto de renda', 'anual'::obligationrecurrence, 31, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'DARF - IRPJ', 'DARF-IRPJ', 'Pagamento de DARF - Imposto de Renda Pessoa Jurídica', 'trimestral'::obligationrecurrence, 15, false, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'DARF - PIS/COFINS', 'DARF-PIS', 'Pagamento de DARF - PIS e COFINS', 'mensal'::obligationrecurrence, 14, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'Folha de Pagamento', 'FOLHA', 'Entrega da folha de pagamento e GFIP', 'mensal'::obligationrecurrence, 3, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'FGTS', 'FGTS', 'Contribuição ao Fundo de Garantia do Tempo de Serviço', 'mensal'::obligationrecurrence, 7, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'ECD - Escrituração Contábil Digital', 'ECD', 'Apresentação da escrituração contábil digital', 'anual'::obligationrecurrence, 30, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'ECF - Escrituração Contábil Fiscal', 'ECF', 'Apresentação da escrituração contábil fiscal', 'anual'::obligationrecurrence, 30, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'NFe - Nota Fiscal Eletrônica', 'NFE', 'Emissão de Notas Fiscais Eletrônicas', 'mensal'::obligationrecurrence, 20, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'NFSe - Nota Fiscal de Serviço Eletrônica', 'NFSE', 'Emissão de Notas Fiscais de Serviço', 'mensal'::obligationrecurrence, 20, true, true, true, true, NOW(), NOW()),
(gen_random_uuid(), 'EFD-PIS/COFINS', 'EFD-PIS', 'Escrituração Fiscal Digital PIS/COFINS', 'trimestral'::obligationrecurrence, 10, true, true, true, true, NOW(), NOW());

-- Seed de Obrigações para cada cliente
WITH client_ids AS (
    SELECT id, razao_social, ROW_NUMBER() OVER (ORDER BY razao_social) as rn FROM clients WHERE deleted_at IS NULL
),
obligation_type_ids AS (
    SELECT id, name, ROW_NUMBER() OVER (ORDER BY name) as rn FROM obligation_types LIMIT 10
)
INSERT INTO obligations (id, client_id, obligation_type_id, due_date, status, priority, description, created_at, updated_at)
SELECT
    gen_random_uuid(),
    c.id,
    ot.id,
    CURRENT_DATE + ((((c.rn + ot.rn) % 30) + 1)) * INTERVAL '1 day',
    CASE ((c.rn % 5))
        WHEN 1 THEN 'pendente'::obligationstatus
        WHEN 2 THEN 'em_andamento'::obligationstatus
        WHEN 3 THEN 'concluida'::obligationstatus
        WHEN 4 THEN 'atrasada'::obligationstatus
        ELSE 'cancelada'::obligationstatus
    END,
    CASE ((c.rn % 4))
        WHEN 1 THEN 'baixa'::obligationpriority
        WHEN 2 THEN 'media'::obligationpriority
        WHEN 3 THEN 'alta'::obligationpriority
        ELSE 'urgente'::obligationpriority
    END,
    'Obrigação ' || ot.name || ' para ' || c.razao_social,
    NOW(),
    NOW()
FROM client_ids c
CROSS JOIN obligation_type_ids ot;

-- Seed de Licenças para cada cliente
INSERT INTO licenses (id, client_id, license_type, registration_number, issuing_authority, issue_date, expiration_date, status, notes, created_at, updated_at)
SELECT
    gen_random_uuid(),
    c.id,
    CASE (row_number() OVER (PARTITION BY c.id ORDER BY c.id) % 8)
        WHEN 0 THEN 'ALVARA_FUNCIONAMENTO'::licensetype
        WHEN 1 THEN 'LICENCA_AMBIENTAL'::licensetype
        WHEN 2 THEN 'CERTIFICADO_DIGITAL'::licensetype
        WHEN 3 THEN 'INSCRICAO_ESTADUAL'::licensetype
        WHEN 4 THEN 'INSCRICAO_MUNICIPAL'::licensetype
        WHEN 5 THEN 'LICENCA_SANITARIA'::licensetype
        WHEN 6 THEN 'LICENCA_BOMBEIROS'::licensetype
        ELSE 'OUTROS'::licensetype
    END,
    'REG-' || substr(md5(c.id::text), 1, 10) || '-' || (row_number() OVER (PARTITION BY c.id ORDER BY c.id)),
    CASE (row_number() OVER (PARTITION BY c.id ORDER BY c.id) % 3)
        WHEN 0 THEN 'Prefeitura'
        WHEN 1 THEN 'SEFAZ'
        ELSE 'Vigilância Sanitária'
    END,
    CURRENT_DATE - INTERVAL '180 days',
    CURRENT_DATE + INTERVAL '180 days',
    CASE (row_number() OVER (PARTITION BY c.id ORDER BY c.id) % 3)
        WHEN 1 THEN 'ATIVA'::licensestatus
        WHEN 2 THEN 'VENCIDA'::licensestatus
        ELSE 'EM_PROCESSO'::licensestatus
    END,
    'Licença de ' || c.razao_social,
    NOW(),
    NOW()
FROM clients c
WHERE c.deleted_at IS NULL;

-- Verificar inserções
SELECT COUNT(*) as total_obligation_types FROM obligation_types;
SELECT COUNT(*) as total_obligations FROM obligations;
SELECT COUNT(*) as total_licenses FROM licenses;
SELECT
    c.razao_social,
    COUNT(DISTINCT o.id) as obrigacoes,
    COUNT(DISTINCT l.id) as licencas
FROM clients c
LEFT JOIN obligations o ON c.id = o.client_id AND o.deleted_at IS NULL
LEFT JOIN licenses l ON c.id = l.client_id
WHERE c.deleted_at IS NULL
GROUP BY c.razao_social
ORDER BY c.razao_social;
