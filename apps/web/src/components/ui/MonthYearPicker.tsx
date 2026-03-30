'use client';

import { Button, Popover, PopoverContent, PopoverTrigger } from '@/heroui';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/lib/icons';
import { useEffect, useMemo, useState } from 'react';

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
  const monthOptions = useMemo(
    () => [
      { label: 'Jan', fullLabel: 'janeiro', value: 1 },
      { label: 'Fev', fullLabel: 'fevereiro', value: 2 },
      { label: 'Mar', fullLabel: 'março', value: 3 },
      { label: 'Abr', fullLabel: 'abril', value: 4 },
      { label: 'Mai', fullLabel: 'maio', value: 5 },
      { label: 'Jun', fullLabel: 'junho', value: 6 },
      { label: 'Jul', fullLabel: 'julho', value: 7 },
      { label: 'Ago', fullLabel: 'agosto', value: 8 },
      { label: 'Set', fullLabel: 'setembro', value: 9 },
      { label: 'Out', fullLabel: 'outubro', value: 10 },
      { label: 'Nov', fullLabel: 'novembro', value: 11 },
      { label: 'Dez', fullLabel: 'dezembro', value: 12 },
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
  }, [value]);

  const selectedYear = parsedValue?.year ?? now.getFullYear();
  const selectedMonth = parsedValue?.month ?? now.getMonth() + 1;
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    if (!isOpen) return;
    setViewYear(selectedYear);
  }, [isOpen, selectedYear]);

  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const [year, month] = value.split('-');
      if (!year || !month) return value;
      const monthIndex = parseInt(month, 10) - 1;
      if (monthIndex < 0 || monthIndex > 11) return value;
      return `${monthOptions[monthIndex]?.fullLabel ?? value} de ${year}`;
    } catch {
      return value;
    }
  }, [monthOptions, value]);

  const currentMonthValue = useMemo(() => {
    const monthValue = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${monthValue}`;
  }, [now]);

  const handleMonthSelect = (month: number) => {
    const monthValue = String(month).padStart(2, '0');
    onChange(`${viewYear}-${monthValue}`);
    setIsOpen(false);
  };

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
              onPress={() => {
                onChange('');
                setIsOpen(false);
              }}
              aria-label="Limpar mês selecionado"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <PopoverContent className="w-[320px] p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setViewYear((prev) => prev - 1)}
                aria-label="Ano anterior"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold text-foreground">{viewYear}</div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setViewYear((prev) => prev + 1)}
                aria-label="Próximo ano"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {monthOptions.map((monthOption) => {
                const isSelected =
                  monthOption.value === selectedMonth && viewYear === selectedYear && Boolean(value);
                const isCurrentMonth =
                  monthOption.value === now.getMonth() + 1 && viewYear === now.getFullYear();

                return (
                  <Button
                    key={monthOption.value}
                    size="sm"
                    variant={isSelected ? 'solid' : 'bordered'}
                    color={isSelected ? 'primary' : 'default'}
                    className={
                      !isSelected && isCurrentMonth
                        ? 'border-primary/50 text-primary'
                        : undefined
                    }
                    onPress={() => handleMonthSelect(monthOption.value)}
                    aria-label={`Selecionar ${monthOption.fullLabel} de ${viewYear}`}
                  >
                    {monthOption.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setViewYear(now.getFullYear());
                  onChange(currentMonthValue);
                  setIsOpen(false);
                }}
              >
                Mês atual
              </Button>
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
