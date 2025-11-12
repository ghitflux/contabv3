"use client";

import { Button, Calendar, Popover, PopoverContent, PopoverTrigger } from "@/heroui";
import { CalendarIcon, XIcon } from "@/lib/icons";
import { CalendarDate } from "@internationalized/date";
import { useMemo, useState } from "react";

interface MonthYearPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
  isClearable?: boolean;
  "aria-label"?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  label,
  className,
  size = "sm",
  placeholder = "Selecionar mês e ano",
  isClearable = false,
  "aria-label": ariaLabel,
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const calendarValue = useMemo(() => {
    if (!value) return null;
    try {
      const [year, month] = value.split('-');
      if (!year || !month) return null;
      return new CalendarDate(parseInt(year, 10), parseInt(month, 10), 1);
    } catch {
      return null;
    }
  }, [value]);

  const handleChange = (date: CalendarDate | null) => {
    if (!date) return;
    const year = date.year.toString();
    const month = date.month.toString().padStart(2, '0');
    onChange(`${year}-${month}`);
    setIsOpen(false);
  };

  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const [year, month] = value.split('-');
      const monthNames = [
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
      ];
      const monthIndex = parseInt(month, 10) - 1;
      if (monthIndex < 0 || monthIndex > 11) return value;
      return `${monthNames[monthIndex]} de ${year}`;
    } catch {
      return value;
    }
  }, [value]);

  return (
    <div className={className}>
      {label && <label className="text-sm font-medium text-default-600 mb-1 block" htmlFor={ariaLabel ?? label}>{label}</label>}
      <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-start">
        <PopoverTrigger>
          <Button
            id={ariaLabel ?? label}
            variant="bordered"
            size={size}
            className={`w-full justify-between text-left font-normal ${
              value ? "text-foreground" : "text-default-400"
            }`}
            aria-label={ariaLabel || label || "Selecionar mês e ano"}
          >
            <CalendarIcon className="h-4 w-4 text-default-400 mr-2" />
            <span className="truncate">{displayValue || placeholder}</span>
            {isClearable && value ? (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="sm"
                onPress={(event) => {
                  event.stopPropagation();
                  onChange("");
                }}
                aria-label="Limpar mês selecionado"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            value={calendarValue}
            onChange={handleChange}
            showMonthAndYearPickers
            aria-label={ariaLabel || label || 'Calendário'}
            calendarWidth={280}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

