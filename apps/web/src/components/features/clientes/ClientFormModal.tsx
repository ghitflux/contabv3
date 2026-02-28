"use client";

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
  CheckboxGroup,
  Divider,
  Chip,
} from "@heroui/react";
import { EyeIcon, EyeOffIcon, RefreshIcon, SaveIcon } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { maskCNPJ, maskCPF, onlyNumbers } from "@/lib/masks";
import type { Client, ClientCreate } from "@/types/client";
import { obligationsApi, type ObligationTypeResponse } from "@/lib/api/endpoints/obligations";
import {
  RegimeTributario,
  TipoEmpresa,
  ServicoContratado,
  LicencaNecessaria,
  getRegimeLabel,
  getTipoEmpresaLabel,
  getServicoContratadoLabel,
  getLicencaNecessariaLabel,
} from "@/types/client";
import { DatePickerField } from "@/components/ui/DatePickerField";

// Zod schema for validation
const nullableString = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z.string().nullable()
);

const nullableEmail = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z.string().email("Email inválido").nullable()
);

const nullableCPF = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z
    .string()
    .nullable()
    .refine((value) => value === null || onlyNumbers(value).length === 11, "CPF inválido")
);

const clientFormSchema = z.object({
  razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
  nome_fantasia: nullableString,
  cnpj: z
    .string()
    .trim()
    .refine((value) => onlyNumbers(value).length === 14, "CNPJ inválido"),
  cpf_empresa: nullableCPF,
  senha_sistema: nullableString,
  senha_gov: nullableString,
  inscricao_estadual: nullableString,
  inscricao_municipal: nullableString,
  codigo_simples: nullableString,

  email: z.string().trim().email("Email inválido"),
  telefone: nullableString.optional(),
  celular: nullableString,

  cep: nullableString,
  logradouro: nullableString,
  numero: nullableString,
  complemento: nullableString,
  bairro: nullableString,
  cidade: nullableString,
  uf: nullableString,

  honorarios_mensais: z.coerce.number().min(0, "Valor inválido"),
  dia_vencimento: z.coerce.number().min(1).max(31),
  gerar_lancamentos_honorarios: z.boolean(),

  regime_tributario: z.nativeEnum(RegimeTributario),
  tipo_empresa: z.nativeEnum(TipoEmpresa),
  tipos_empresa: z.array(z.string()),
  data_abertura: nullableString,
  inicio_escritorio: nullableString,

  responsavel_nome: nullableString,
  responsavel_cpf: nullableCPF,
  responsavel_email: nullableEmail,
  responsavel_telefone: nullableString,

  senha_prefeitura: nullableString,
  login_seg_desemp: nullableString,
  senha_seg_desemp: nullableString,
  email_seg_desemp: nullableString,
  senha_nfse: nullableString,
  senha_certificado_digital: nullableString,
  senha_gcw_resp: nullableString,

  servicos_contratados: z.array(z.string()),
  licencas_necessarias: z.array(z.string()),

  obligation_types_ids: z.array(z.string()),

  observacoes: nullableString,
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormModalProps {
  client?: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClientCreate) => Promise<void>;
  isEditing?: boolean;
}

export function ClientFormModal({ client, isOpen, onClose, onSave, isEditing = false }: ClientFormModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [visibleFields, setVisibleFields] = React.useState<Record<string, boolean>>({});
  const [obligationTypes, setObligationTypes] = React.useState<ObligationTypeResponse[]>([]);
  const [loadingObligationTypes, setLoadingObligationTypes] = React.useState(false);

  const isFieldVisible = (key: string) => Boolean(visibleFields[key]);
  const toggleFieldVisibility = (key: string) => {
    setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Load obligation types when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLoadingObligationTypes(true);
      obligationsApi
        .getObligationTypes(true) // Only active types
        .then((types) => {
          setObligationTypes(types);
        })
        .catch((error) => {
          console.error("Erro ao carregar tipos de obrigações:", error);
          toast.error("Erro ao carregar tipos de obrigações");
        })
        .finally(() => {
          setLoadingObligationTypes(false);
        });
    }
  }, [isOpen]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ClientFormData>({
    // @ts-expect-error - Type mismatch between react-hook-form and @hookform/resolvers versions
    resolver: zodResolver(clientFormSchema),
    defaultValues: client
      ? {
          ...client,
          tipos_empresa: client.tipos_empresa || [],
          servicos_contratados: client.servicos_contratados || [],
          licencas_necessarias: client.licencas_necessarias || [],
          obligation_types_ids: client.obligation_types_ids || [],
          gerar_lancamentos_honorarios: client.gerar_lancamentos_honorarios ?? false,
        }
      : {
          razao_social: "",
          nome_fantasia: null,
          cnpj: "",
          cpf_empresa: null,
          senha_sistema: null,
          senha_gov: null,
          inscricao_estadual: null,
          inscricao_municipal: null,
          codigo_simples: null,
          email: "",
          celular: null,
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: null,
          uf: null,
          honorarios_mensais: 0,
          dia_vencimento: 1,
          gerar_lancamentos_honorarios: true,
          regime_tributario: RegimeTributario.SIMPLES_NACIONAL,
          tipo_empresa: TipoEmpresa.COMERCIO,
          tipos_empresa: [],
          data_abertura: null,
          inicio_escritorio: null,
          responsavel_nome: null,
          responsavel_cpf: null,
          responsavel_email: null,
          responsavel_telefone: null,
          senha_prefeitura: null,
          login_seg_desemp: null,
          senha_seg_desemp: null,
          email_seg_desemp: null,
          senha_nfse: null,
          senha_certificado_digital: null,
          senha_gcw_resp: null,
          servicos_contratados: [],
          licencas_necessarias: [],
          obligation_types_ids: [],
          observacoes: null,
        },
  });

  // Reset form when client data changes (for editing)
  React.useEffect(() => {
    if (isOpen && isEditing && client) {
      reset({
        ...client,
        tipos_empresa: client.tipos_empresa || [],
        servicos_contratados: client.servicos_contratados || [],
        licencas_necessarias: client.licencas_necessarias || [],
        obligation_types_ids: client.obligation_types_ids || [],
        gerar_lancamentos_honorarios: client.gerar_lancamentos_honorarios ?? false,
      });
    } else if (isOpen && !isEditing) {
      reset({
        razao_social: "",
        nome_fantasia: null,
        cnpj: "",
        cpf_empresa: null,
        senha_sistema: null,
        senha_gov: null,
        inscricao_estadual: null,
        inscricao_municipal: null,
        codigo_simples: null,
        email: "",
        celular: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        honorarios_mensais: 0,
        dia_vencimento: 1,
        gerar_lancamentos_honorarios: true,
        regime_tributario: RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa: TipoEmpresa.COMERCIO,
        tipos_empresa: [],
        data_abertura: null,
        inicio_escritorio: null,
        responsavel_nome: null,
        responsavel_cpf: null,
        responsavel_email: null,
        responsavel_telefone: null,
        senha_prefeitura: null,
        login_seg_desemp: null,
        senha_seg_desemp: null,
        email_seg_desemp: null,
        senha_nfse: null,
        senha_certificado_digital: null,
        senha_gcw_resp: null,
        servicos_contratados: [],
        licencas_necessarias: [],
        obligation_types_ids: [],
        observacoes: null,
      });
    }
  }, [isOpen, isEditing, client, reset]);

  const generateSystemPassword = React.useCallback(() => {
    const length = 16;
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const specials = "!@#$%^&*()-_=+";
    const all = upper + lower + digits + specials;
    const values = new Uint32Array(length);
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.getRandomValues) {
      cryptoApi.getRandomValues(values);
    } else {
      for (let i = 0; i < length; i += 1) {
        values[i] = Math.floor(Math.random() * all.length);
      }
    }

    const pick = (chars: string, idx: number) => chars[(values[idx] ?? 0) % chars.length];
    const base = [
      pick(upper, 0),
      pick(lower, 1),
      pick(digits, 2),
      pick(specials, 3),
    ];

    for (let i = base.length; i < length; i += 1) {
      base.push(pick(all, i));
    }

    const password = base.sort(() => 0.5 - Math.random()).join("");
    setValue("senha_sistema", password, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  const onSubmit = async (data: ClientFormData) => {
    try {
      setIsSubmitting(true);
      await onSave(data as ClientCreate);
      reset();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      const message = (() => {
        const err = error as any;
        if (err?.status === 401) return "Sessão expirada. Faça login novamente.";
        const detail = err?.data?.detail;
        if (typeof detail === "string" && detail.trim()) return detail;
        if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0];
          const loc = Array.isArray(first?.loc) ? first.loc.join(".") : undefined;
          const msg = typeof first?.msg === "string" ? first.msg : undefined;
          if (msg && loc) return `${loc}: ${msg}`;
          if (msg) return msg;
        }
        if (typeof err?.message === "string" && err.message.trim()) return err.message;
        return "Não foi possível salvar o cliente. Verifique os campos e tente novamente.";
      })();
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      shouldBlockScroll={false}
      classNames={{
        wrapper: "max-h-[90vh]",
        base: "max-h-[90vh]",
        body: "gap-0 p-0",
      }}
    >
      <ModalContent>
        {(onCloseModal) => (
          <>
            <form
              // @ts-ignore - Type mismatch from resolver
              onSubmit={handleSubmit(onSubmit)}
              className="contents"
            >
              <ModalHeader className="flex-shrink-0 px-6 pt-6">
                <h2 className="text-2xl font-bold">
                  {isEditing ? "Editar Cliente" : "Novo Cliente"}
                </h2>
              </ModalHeader>
              <ModalBody className="overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                {/* Dados da Empresa */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="razao_social"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          label="Razão Social"
                          placeholder="Digite a razão social"
                          isRequired
                          isInvalid={!!errors.razao_social}
                          errorMessage={errors.razao_social?.message}
                        />
                      )}
                    />
                    <Controller
                      name="nome_fantasia"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Nome Fantasia"
                          placeholder="Digite o nome fantasia"
                        />
                      )}
                    />
                    <Controller
                      name="cnpj"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                          label="CNPJ"
                          placeholder="00.000.000/0000-00"
                          isRequired
                          maxLength={18}
                          isInvalid={!!errors.cnpj}
                          errorMessage={errors.cnpj?.message}
                        />
                      )}
                    />
                    <Controller
                      name="cpf_empresa"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(maskCPF(e.target.value))}
                          label="CPF"
                          placeholder="000.000.000-00"
                          maxLength={14}
                          isInvalid={!!errors.cpf_empresa}
                          errorMessage={errors.cpf_empresa?.message}
                        />
                      )}
                    />
                    <Controller
                      name="senha_gov"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_gov") ? "text" : "password"}
                          label="Senha do GOV"
                          placeholder="Digite a senha do GOV"
                          endContent={
                            <Button
                              type="button"
                              variant="light"
                              size="sm"
                              isIconOnly
                              onPress={() => toggleFieldVisibility("senha_gov")}
                              aria-label={isFieldVisible("senha_gov") ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {isFieldVisible("senha_gov") ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </Button>
                          }
                        />
                      )}
                    />
                    <Controller
                      name="senha_prefeitura"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_prefeitura") ? "text" : "password"}
                          label="Senha da Prefeitura"
                          placeholder="Digite a senha da prefeitura"
                          endContent={
                            <Button
                              type="button"
                              variant="light"
                              size="sm"
                              isIconOnly
                              onPress={() => toggleFieldVisibility("senha_prefeitura")}
                              aria-label={isFieldVisible("senha_prefeitura") ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {isFieldVisible("senha_prefeitura") ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </Button>
                          }
                        />
                      )}
                    />
                    <Controller
                      name="login_seg_desemp"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Login Seguro Desemprego"
                          placeholder="Digite o login"
                        />
                      )}
                    />
                    <Controller
                      name="senha_seg_desemp"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_seg_desemp") ? "text" : "password"}
                          label="Senha Seguro Desemprego"
                          placeholder="Digite a senha"
                          endContent={
                            <Button
                              type="button"
                              variant="light"
                              size="sm"
                              isIconOnly
                              onPress={() => toggleFieldVisibility("senha_seg_desemp")}
                              aria-label={
                                isFieldVisible("senha_seg_desemp") ? "Ocultar senha" : "Mostrar senha"
                              }
                            >
                              {isFieldVisible("senha_seg_desemp") ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </Button>
                          }
                        />
                      )}
                    />
                    <Controller
                      name="email_seg_desemp"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="email"
                          label="E-mail Seguro Desemprego"
                          placeholder="email@exemplo.com"
                        />
                      )}
                    />
                    <Controller
                      name="senha_nfse"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_nfse") ? "text" : "password"}
                          label="Senha NFS-e Nacional"
                          placeholder="Digite a senha NFS-e Nacional"
                          endContent={
                            <Button
                              type="button"
                              variant="light"
                              size="sm"
                              isIconOnly
                              onPress={() => toggleFieldVisibility("senha_nfse")}
                              aria-label={isFieldVisible("senha_nfse") ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {isFieldVisible("senha_nfse") ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </Button>
                          }
                        />
                      )}
                    />
                    <Controller
                      name="senha_certificado_digital"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_certificado_digital") ? "text" : "password"}
                          label="Senha do Certificado Digital"
                          placeholder="Digite a senha do certificado"
                          endContent={
                            <Button
                              type="button"
                              variant="light"
                              size="sm"
                              isIconOnly
                              onPress={() => toggleFieldVisibility("senha_certificado_digital")}
                              aria-label={
                                isFieldVisible("senha_certificado_digital")
                                  ? "Ocultar senha"
                                  : "Mostrar senha"
                              }
                            >
                              {isFieldVisible("senha_certificado_digital") ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </Button>
                          }
                        />
                      )}
                    />
                    <Controller
                      name="inscricao_estadual"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Inscrição Estadual"
                          placeholder="Digite a IE"
                        />
                      )}
                    />
                    <Controller
                      name="inscricao_municipal"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Inscrição Municipal"
                          placeholder="Digite a IM"
                        />
                      )}
                    />
                    <Controller
                      name="codigo_simples"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Código de Acesso ao Simples Nacional"
                          placeholder="Digite o código de acesso"
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Contato */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="email"
                          label="Email"
                          placeholder="email@empresa.com"
                          isRequired
                          isInvalid={!!errors.email}
                          errorMessage={errors.email?.message}
                        />
                      )}
                    />
                    <Controller
                      name="celular"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Celular"
                          placeholder="(00) 00000-0000"
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Acesso ao Sistema */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Acesso ao Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="senha_sistema"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type={isFieldVisible("senha_sistema") ? "text" : "password"}
                          label="Senha de Acesso"
                          placeholder="Clique em gerar ou digite a senha"
                          endContent={
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="light"
                                size="sm"
                                isIconOnly
                                onPress={generateSystemPassword}
                                aria-label="Gerar senha"
                              >
                                <RefreshIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="light"
                                size="sm"
                                isIconOnly
                                onPress={() => toggleFieldVisibility("senha_sistema")}
                                aria-label={
                                  isFieldVisible("senha_sistema") ? "Ocultar senha" : "Mostrar senha"
                                }
                              >
                                {isFieldVisible("senha_sistema") ? (
                                  <EyeOffIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          }
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Endereço */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="cep"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="CEP"
                          placeholder="00000-000"
                        />
                      )}
                    />
                    <Controller
                      name="logradouro"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Logradouro"
                          placeholder="Rua, Avenida, etc"
                        />
                      )}
                    />
                    <Controller
                      name="numero"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Número"
                          placeholder="123"
                        />
                      )}
                    />
                    <Controller
                      name="complemento"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Complemento"
                          placeholder="Sala, Apto, etc"
                        />
                      )}
                    />
                    <Controller
                      name="bairro"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Bairro"
                          placeholder="Nome do bairro"
                        />
                      )}
                    />
                    <Controller
                      name="cidade"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Cidade"
                          placeholder="Nome da cidade"
                        />
                      )}
                    />
                    <Controller
                      name="uf"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="UF"
                          placeholder="SP"
                          maxLength={2}
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Tributação */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Tributação</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="regime_tributario"
                      control={control}
                      render={({ field }) => (
                        <Select
                          label="Regime Tributário"
                          placeholder="Selecione o regime"
                          selectedKeys={[field.value]}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as RegimeTributario;
                            field.onChange(selected);
                          }}
                          isRequired
                        >
                          {Object.values(RegimeTributario).map((regime) => (
                            <SelectItem key={regime}>
                              {getRegimeLabel(regime)}
                            </SelectItem>
                          ))}
                        </Select>
                      )}
                    />
                    <Controller
                      name="data_abertura"
                      control={control}
                      render={({ field }) => (
                        <DatePickerField
                          label="Data de Abertura"
                          value={field.value}
                          onChange={(value) => field.onChange(value || null)}
                          isClearable
                          minYear={1800}
                        />
                      )}
                    />
                    <Controller
                      name="inicio_escritorio"
                      control={control}
                      render={({ field }) => (
                        <DatePickerField
                          label="Início no Escritório"
                          value={field.value}
                          onChange={(value) => field.onChange(value || null)}
                          isClearable
                          minYear={1800}
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Financeiro */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Financeiro</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="honorarios_mensais"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          type="number"
                          label="Honorários Mensais"
                          placeholder="0.00"
                          startContent={<span className="text-default-400">R$</span>}
                          isRequired
                          isInvalid={!!errors.honorarios_mensais}
                          errorMessage={errors.honorarios_mensais?.message}
                        />
                      )}
                    />
                    <Controller
                      name="dia_vencimento"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          type="number"
                          label="Dia do Vencimento"
                          placeholder="1"
                          min={1}
                          max={31}
                          isRequired
                        />
                      )}
                    />
                    <Controller
                      name="gerar_lancamentos_honorarios"
                      control={control}
                      render={({ field }) => (
                        <Select
                          label="Lançar honorários automaticamente?"
                          placeholder="Selecione"
                          selectedKeys={[field.value ? "true" : "false"]}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as string | undefined;
                            field.onChange(selected === "true");
                          }}
                        >
                          <SelectItem key="false">Não</SelectItem>
                          <SelectItem key="true">
                            Sim — lançar como despesa/receita recorrente
                          </SelectItem>
                        </Select>
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Tipos de Empresa */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Tipo de Empresa (multi)</h3>
                  <Controller
                    name="tipos_empresa"
                    control={control}
                    render={({ field }) => (
                      <CheckboxGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        orientation="horizontal"
                      >
                        {Object.values(TipoEmpresa).map((tipo) => (
                          <Checkbox key={tipo} value={tipo}>
                            {getTipoEmpresaLabel(tipo)}
                          </Checkbox>
                        ))}
                      </CheckboxGroup>
                    )}
                  />
                </section>

                <Divider />

                {/* Serviços Contratados */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Serviços Contratados (multi)</h3>
                  <Controller
                    name="servicos_contratados"
                    control={control}
                    render={({ field }) => (
                      <>
                        <CheckboxGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          orientation="horizontal"
                        >
                          {Object.values(ServicoContratado).map((servico) => (
                            <Checkbox key={servico} value={servico}>
                              {getServicoContratadoLabel(servico)}
                            </Checkbox>
                          ))}
                        </CheckboxGroup>

                        {/* Chips para feedback visual */}
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {field.value.map((servico) => (
                              <Chip
                                key={servico}
                                color="primary"
                                variant="flat"
                                onClose={() => {
                                  field.onChange(field.value.filter((s: string) => s !== servico));
                                }}
                              >
                                {getServicoContratadoLabel(servico)}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  />
                </section>

                <Divider />

                {/* Licenças */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Licenças Necessárias (multi)</h3>
                  <Controller
                    name="licencas_necessarias"
                    control={control}
                    render={({ field }) => (
                      <>
                        <CheckboxGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          orientation="horizontal"
                          classNames={{
                            wrapper: "grid grid-cols-2 gap-2",
                          }}
                        >
                          {Object.values(LicencaNecessaria).map((licenca) => (
                            <Checkbox key={licenca} value={licenca}>
                              {getLicencaNecessariaLabel(licenca)}
                            </Checkbox>
                          ))}
                        </CheckboxGroup>

                        {/* Chips para feedback visual */}
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {field.value.map((licenca) => (
                              <Chip
                                key={licenca}
                                color="warning"
                                variant="flat"
                                onClose={() => {
                                  field.onChange(field.value.filter((l: string) => l !== licenca));
                                }}
                              >
                                {getLicencaNecessariaLabel(licenca)}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  />
                </section>

                <Divider />

                {/* Obrigações */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Obrigações Fiscais, Contábeis e Pessoais</h3>
                  <p className="text-sm text-default-500 mb-4">
                    Selecione as obrigações que serão geradas automaticamente para este cliente.
                  </p>
                  <Controller
                    name="obligation_types_ids"
                    control={control}
                    render={({ field }) => {
                      return (
                      <>
                        {loadingObligationTypes ? (
                          <p className="text-sm text-default-400">Carregando obrigações...</p>
                        ) : obligationTypes.length === 0 ? (
                          <p className="text-sm text-default-400">
                            Nenhuma obrigação disponível.
                          </p>
                        ) : (
                          <>
                            <CheckboxGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              orientation="vertical"
                              classNames={{
                                wrapper: "grid grid-cols-1 md:grid-cols-2 gap-2",
                              }}
                            >
                              {obligationTypes.map((obligationType) => (
                                <Checkbox key={obligationType.id} value={obligationType.id}>
                                  <div>
                                    <p className="font-medium text-sm">{obligationType.name}</p>
                                    {obligationType.description && (
                                      <p className="text-xs text-default-400">{obligationType.description}</p>
                                    )}
                                    <p className="text-xs text-default-500">
                                      {obligationType.recurrence.charAt(0).toUpperCase() + obligationType.recurrence.slice(1)}
                                    </p>
                                  </div>
                                </Checkbox>
                              ))}
                            </CheckboxGroup>

                            {/* Chips para feedback visual */}
                            {field.value && field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                <p className="text-sm font-medium w-full">
                                  {field.value.length} {field.value.length === 1 ? 'obrigação selecionada' : 'obrigações selecionadas'}
                                </p>
                                {field.value.map((id) => {
                                  const type = obligationTypes.find((t) => t.id === id);
                                  return type ? (
                                    <Chip
                                      key={id}
                                      color="secondary"
                                      variant="flat"
                                      onClose={() => {
                                        field.onChange(field.value.filter((typeId: string) => typeId !== id));
                                      }}
                                    >
                                      {type.name}
                                    </Chip>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </>
                      );
                    }}
                  />
                </section>

                <Divider />

                {/* Responsável */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Responsável</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Controller
                      name="responsavel_nome"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Nome do Responsável"
                          placeholder="Nome completo"
                        />
                      )}
                    />
                    <Controller
                      name="responsavel_cpf"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(maskCPF(e.target.value))}
                          label="CPF do Responsável"
                          placeholder="000.000.000-00"
                          maxLength={14}
                          isInvalid={!!errors.responsavel_cpf}
                          errorMessage={errors.responsavel_cpf?.message}
                        />
                      )}
                    />
                    <Controller
                      name="responsavel_email"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="email"
                          label="Email do Responsável"
                          placeholder="email@exemplo.com"
                        />
                      )}
                    />
                    <Controller
                      name="responsavel_telefone"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Telefone do Responsável"
                          placeholder="(00) 00000-0000"
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Observações */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Observações</h3>
                  <Controller
                    name="observacoes"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        label="Observações"
                        placeholder="Informações adicionais sobre o cliente"
                        minRows={3}
                      />
                    )}
                  />
                </section>
                </div>
              </ModalBody>
              <ModalFooter className="flex-shrink-0 border-t border-divider px-6 pb-6">
                <Button variant="light" onPress={onCloseModal}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  startContent={<SaveIcon className="h-4 w-4" />}
                  isLoading={isSubmitting}
                >
                  {isSubmitting
                    ? (isEditing ? "Atualizando..." : "Salvando...")
                    : (isEditing ? "Atualizar" : "Salvar")
                  }
                </Button>
              </ModalFooter>
            </form>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
