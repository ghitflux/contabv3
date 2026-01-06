'use client';

import { Button, Calendar, Popover, PopoverContent, PopoverTrigger } from '@/heroui';
import { CalendarIcon, XIcon } from '@/lib/icons';
import { CalendarDate } from '@internationalized/date';
import { useMemo, useState } from 'react';

interface DatePickerFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isClearable?: boolean;
  'aria-label'?: string;
}

const formatDisplayValue = (value?: string | null) => {
  if (!value) return '';
  const [datePart] = value.split('T');
  if (!datePart) return value;
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value;
  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);
  const parsedDay = Number.parseInt(day, 10);
  if (!parsedYear || !parsedMonth || !parsedDay) return value;
  return `${String(parsedDay).padStart(2, '0')}/${String(parsedMonth).padStart(2, '0')}/${String(parsedYear).padStart(4, '0')}`;
};

const parseCalendarDate = (value?: string | null) => {
  if (!value) return null;
  const [datePart] = value.split('T');
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  try {
    return new CalendarDate(year, month, day);
  } catch {
    return null;
  }
};

const formatToValue = (date: CalendarDate) => {
  const year = date.year.toString().padStart(4, '0');
  const month = date.month.toString().padStart(2, '0');
  const day = date.day.toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = 'Selecionar data',
  className,
  size = 'sm',
  isClearable = false,
  'aria-label': ariaLabel,
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const calendarValue = useMemo(() => parseCalendarDate(value), [value]);
  const displayValue = useMemo(() => formatDisplayValue(value), [value]);

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
              aria-label={ariaLabel || label || 'Selecionar data'}
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
              aria-label="Limpar data selecionada"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <PopoverContent className="w-auto p-0">
          <Calendar
            value={calendarValue}
            onChange={(date) => {
              if (date) {
                onChange(formatToValue(date as CalendarDate));
                setIsOpen(false);
              }
            }}
            aria-label={ariaLabel || label || 'Calendário'}
            calendarWidth={320}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
