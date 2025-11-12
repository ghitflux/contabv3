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
import { SaveIcon } from "@/lib/icons";
import type { Client, ClientCreate } from "@/types/client";
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
const clientFormSchema = z.object({
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  nome_fantasia: z.string().nullable(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  inscricao_estadual: z.string().nullable(),
  inscricao_municipal: z.string().nullable(),
  codigo_simples: z.string().nullable(),

  email: z.string().email("Email inválido"),
  telefone: z.string().nullable(),
  celular: z.string().nullable(),

  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),

  honorarios_mensais: z.coerce.number().min(0, "Valor inválido"),
  dia_vencimento: z.coerce.number().min(1).max(31),

  regime_tributario: z.nativeEnum(RegimeTributario),
  tipo_empresa: z.nativeEnum(TipoEmpresa),
  tipos_empresa: z.array(z.string()),
  data_abertura: z.string().nullable(),
  inicio_escritorio: z.string().nullable(),

  responsavel_nome: z.string().nullable(),
  responsavel_cpf: z.string().nullable(),
  responsavel_email: z.string().nullable(),
  responsavel_telefone: z.string().nullable(),

  senha_prefeitura: z.string().nullable(),
  login_seg_desemp: z.string().nullable(),
  senha_seg_desemp: z.string().nullable(),
  senha_gcw_resp: z.string().nullable(),

  servicos_contratados: z.array(z.string()),
  licencas_necessarias: z.array(z.string()),

  observacoes: z.string().nullable(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormModalProps {
  client?: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClientCreate) => Promise<void>;
}

export function ClientFormModal({ client, isOpen, onClose, onSave }: ClientFormModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ClientFormData>({
    // @ts-expect-error - Type mismatch between react-hook-form and @hookform/resolvers versions
    resolver: zodResolver(clientFormSchema),
    defaultValues: client
      ? {
          ...client,
          tipos_empresa: client.tipos_empresa || [],
          servicos_contratados: client.servicos_contratados || [],
          licencas_necessarias: client.licencas_necessarias || [],
        }
      : {
          razao_social: "",
          nome_fantasia: null,
          cnpj: "",
          inscricao_estadual: null,
          inscricao_municipal: null,
          codigo_simples: null,
          email: "",
          telefone: null,
          celular: null,
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: null,
          uf: null,
          honorarios_mensais: 0,
          dia_vencimento: 10,
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
          senha_gcw_resp: null,
          servicos_contratados: [],
          licencas_necessarias: [],
          observacoes: null,
        },
  });

  const onSubmit = async (data: ClientFormData) => {
    try {
      setIsSubmitting(true);
      await onSave(data as ClientCreate);
      reset();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
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
            <ModalHeader className="flex-shrink-0 px-6 pt-6">
              <h2 className="text-2xl font-bold">
                {client ? "Editar Cliente" : "Novo Cliente"}
              </h2>
            </ModalHeader>
            <ModalBody className="overflow-y-auto px-6 py-6">
              <form
                id="client-form"
                // @ts-ignore - Type mismatch from resolver
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Dados da Empresa */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          label="CNPJ"
                          placeholder="00.000.000/0000-00"
                          isRequired
                          isInvalid={!!errors.cnpj}
                          errorMessage={errors.cnpj?.message}
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
                          label="Código Simples"
                          placeholder="Código do Simples Nacional"
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Contato */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      name="telefone"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value || ""}
                          label="Telefone"
                          placeholder="(00) 0000-0000"
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

                {/* Endereço */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        />
                      )}
                    />
                  </div>
                </section>

                <Divider />

                {/* Financeiro */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Financeiro</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          placeholder="10"
                          min={1}
                          max={31}
                          isRequired
                        />
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

                {/* Responsável */}
                <section>
                  <h3 className="text-lg font-semibold mb-3">Responsável</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          label="CPF do Responsável"
                          placeholder="000.000.000-00"
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
              </form>
            </ModalBody>
            <ModalFooter className="flex-shrink-0 border-t border-divider px-6 pb-6">
              <Button variant="light" onClick={onCloseModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="client-form"
                color="primary"
                startContent={<SaveIcon className="h-4 w-4" />}
                isLoading={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
