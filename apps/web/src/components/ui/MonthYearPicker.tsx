'use client';

import { Button, Popover, PopoverContent, PopoverTrigger, Select, SelectItem } from '@/heroui';
import { CalendarIcon, XIcon } from '@/lib/icons';
import { useMemo, useState } from 'react';

interface MonthYearPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  isClearable?: boolean;
  'aria-label'?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  label,
  className,
  size = 'sm',
  placeholder = 'Selecionar mês e ano',
  isClearable = false,
  'aria-label': ariaLabel,
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const monthNames = useMemo(
    () => [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ],
    []
  );

  const parsedValue = useMemo(() => {
    if (!value) return null;
    try {
      const [year, month] = value.split('-');
      if (!year || !month) return null;
      const parsedYear = parseInt(year, 10);
      const parsedMonth = parseInt(month, 10);
      if (!parsedYear || !parsedMonth) return null;
      return { year: parsedYear, month: parsedMonth };
    } catch {
      return null;
    }
  }, [monthNames, value]);

  const selectedYear = parsedValue?.year ?? now.getFullYear();
  const selectedMonth = parsedValue?.month ?? now.getMonth() + 1;

  const years = useMemo(() => {
    const pivot = selectedYear || now.getFullYear();
    const start = pivot - 5;
    const end = pivot + 5;
    const list: number[] = [];
    for (let year = start; year <= end; year += 1) {
      list.push(year);
    }
    return list;
  }, [now, selectedYear]);

  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const [year, month] = value.split('-');
      if (!year || !month) return value;
      const monthIndex = parseInt(month, 10) - 1;
      if (monthIndex < 0 || monthIndex > 11) return value;
      return `${monthNames[monthIndex]} de ${year}`;
    } catch {
      return value;
    }
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label
          className="text-sm font-medium text-default-600 mb-2 block"
          htmlFor={ariaLabel ?? label}
        >
          {label}
        </label>
      )}
      <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-start">
        <div className="relative w-full">
          <PopoverTrigger>
            <Button
              id={ariaLabel ?? label}
              variant="bordered"
              size={size}
              className={`w-full justify-between text-left font-normal gap-2 py-2.5 ${
                value ? 'text-foreground' : 'text-default-400'
              } ${isClearable && value ? 'pr-10' : ''}`}
              aria-label={ariaLabel || label || 'Selecionar mês e ano'}
            >
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <CalendarIcon className="h-4 w-4 text-default-400" />
                <span className="truncate">{displayValue || placeholder}</span>
              </div>
            </Button>
          </PopoverTrigger>
          {isClearable && value ? (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10"
              onPress={() => onChange('')}
              aria-label="Limpar mês selecionado"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <PopoverContent className="w-[320px] p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Mês"
                selectedKeys={[String(selectedMonth)]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string | undefined;
                  if (!selected) return;
                  const month = parseInt(selected, 10);
                  if (!month) return;
                  const monthValue = String(month).padStart(2, '0');
                  onChange(`${selectedYear}-${monthValue}`);
                }}
                size="sm"
              >
                {monthNames.map((name, index) => (
                  <SelectItem key={String(index + 1)}>{name}</SelectItem>
                ))}
              </Select>
              <Select
                label="Ano"
                selectedKeys={[String(selectedYear)]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string | undefined;
                  if (!selected) return;
                  const year = parseInt(selected, 10);
                  if (!year) return;
                  const monthValue = String(selectedMonth).padStart(2, '0');
                  onChange(`${year}-${monthValue}`);
                }}
                size="sm"
              >
                {years.map((year) => (
                  <SelectItem key={String(year)}>{year}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="light" onPress={() => setIsOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
