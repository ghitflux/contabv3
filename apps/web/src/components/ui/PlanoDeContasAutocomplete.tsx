"use client";

import { Autocomplete, AutocompleteItem, AutocompleteSection } from "@heroui/react";
import { useMemo, useState } from "react";
import {
  PLANO_DE_CONTAS,
  formatConta,
  getGroupLabel,
  getPlanoDeContasGrouped,
  type ContaCategoria,
} from "@/constants/planoDeContas";

interface PlanoDeContasAutocompleteProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "flat" | "bordered" | "faded" | "underlined";
}

export function PlanoDeContasAutocomplete({
  value,
  onChange,
  label = "Categoria (Plano de Contas)",
  placeholder = "Digite para buscar: código, nome ou descrição",
  isRequired = false,
  isDisabled = false,
  className,
  size = "md",
  variant = "bordered",
}: PlanoDeContasAutocompleteProps) {
  const [filterValue, setFilterValue] = useState("");

  // Group contas by type
  const grouped = useMemo(() => getPlanoDeContasGrouped(), []);

  // Filter contas based on search
  const filteredContas = useMemo(() => {
    if (!filterValue) return PLANO_DE_CONTAS;

    const lowerQuery = filterValue.toLowerCase();
    return PLANO_DE_CONTAS.filter(
      (conta) =>
        conta.codigo.toLowerCase().includes(lowerQuery) ||
        conta.nome.toLowerCase().includes(lowerQuery) ||
        conta.descricao?.toLowerCase().includes(lowerQuery)
    );
  }, [filterValue]);

  // Group filtered contas
  const filteredGrouped = useMemo(() => {
    const groups = {
      RECEITA: [] as ContaCategoria[],
      DESPESA: [] as ContaCategoria[],
      CUSTO: [] as ContaCategoria[],
      INVESTIMENTO: [] as ContaCategoria[],
    };

    for (const conta of filteredContas) {
      groups[conta.tipo].push(conta);
    }

    return groups;
  }, [filteredContas]);

  // Get selected conta for display
  const selectedConta = useMemo(() => {
    if (!value) return null;
    return PLANO_DE_CONTAS.find((conta) => conta.codigo === value);
  }, [value]);

  const handleSelectionChange = (key: React.Key | null) => {
    if (key === null) {
      onChange(null);
    } else {
      onChange(String(key));
    }
  };

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      variant={variant}
      size={size}
      isRequired={isRequired}
      isDisabled={isDisabled}
      className={className}
      selectedKey={value ?? ""}
      onSelectionChange={handleSelectionChange}
      inputValue={filterValue}
      onInputChange={setFilterValue}
      defaultInputValue={selectedConta ? formatConta(selectedConta) : ""}
      isClearable
      allowsCustomValue={false}
      listboxProps={{
        emptyContent: "Nenhuma categoria encontrada",
      }}
    >
      {Object.entries(filteredGrouped).map(([tipo, contas]) => {
        if (contas.length === 0) return null;

        return (
          <AutocompleteSection
            key={tipo}
            title={getGroupLabel(tipo as ContaCategoria["tipo"])}
            classNames={{
              heading: "text-xs font-semibold text-default-500 uppercase tracking-wide px-2 py-1",
            }}
          >
            {contas.map((conta) => (
              <AutocompleteItem
                key={conta.codigo}
                textValue={formatConta(conta)}
                description={conta.descricao}
                classNames={{
                  base: "py-2",
                  title: "text-sm font-medium",
                  description: "text-xs text-default-500",
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{formatConta(conta)}</span>
                  {conta.descricao && <span className="text-xs text-default-500">{conta.descricao}</span>}
                </div>
              </AutocompleteItem>
            ))}
          </AutocompleteSection>
        );
      })}
    </Autocomplete>
  );
}
