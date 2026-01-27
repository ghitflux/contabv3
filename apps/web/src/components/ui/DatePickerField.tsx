'use client';

import { Button, Calendar, Input, Popover, PopoverContent, PopoverTrigger } from '@/heroui';
import { CalendarIcon, XIcon } from '@/lib/icons';
import { CalendarDate } from '@internationalized/date';
import { useEffect, useMemo, useState } from 'react';

interface DatePickerFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isClearable?: boolean;
  minYear?: number;
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

const parseUserInputDate = (raw: string, minYear?: number) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const separator = trimmed.includes('/') ? '/' : trimmed.includes('-') ? '-' : null;
  if (!separator) return null;

  const parts = trimmed.split(separator).map((part) => part.trim());
  if (parts.length !== 3) return null;

  const [first, second, third] = parts;
  if (!first || !second || !third) return null;

  const part1 = Number.parseInt(first, 10);
  const part2 = Number.parseInt(second, 10);
  const part3 = Number.parseInt(third, 10);
  if (Number.isNaN(part1) || Number.isNaN(part2) || Number.isNaN(part3)) return null;

  let year: number;
  let month: number;
  let day: number;

  if (first.length === 4) {
    year = part1;
    month = part2;
    day = part3;
  } else if (third.length === 4) {
    day = part1;
    month = part2;
    year = part3;
  } else {
    return null;
  }

  if (typeof minYear === 'number' && year < minYear) return null;

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
  minYear,
  'aria-label': ariaLabel,
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const calendarValue = useMemo(() => parseCalendarDate(value), [value]);
  const displayValue = useMemo(() => formatDisplayValue(value), [value]);
  const [inputValue, setInputValue] = useState(displayValue);
  const minValue = useMemo(
    () => (typeof minYear === 'number' ? new CalendarDate(minYear, 1, 1) : undefined),
    [minYear]
  );

  useEffect(() => {
    setInputValue(displayValue);
  }, [displayValue]);

  const commitInputValue = () => {
    const trimmed = inputValue.trim();

    if (!trimmed) {
      if (isClearable) {
        onChange('');
      } else {
        setInputValue(displayValue);
      }
      return;
    }

    const parsed = parseUserInputDate(trimmed, minYear);
    if (!parsed) {
      setInputValue(displayValue);
      return;
    }

    const nextValue = formatToValue(parsed);
    onChange(nextValue);
    setInputValue(formatDisplayValue(nextValue));
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
        <div className="w-full">
          <Input
            id={ariaLabel ?? label}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={commitInputValue}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitInputValue();
                (event.currentTarget as HTMLElement).blur();
              }
            }}
            placeholder={placeholder}
            size={size}
            variant="bordered"
            aria-label={ariaLabel || label || 'Selecionar data'}
            startContent={
              <PopoverTrigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="sm"
                  aria-label="Abrir calendário"
                >
                  <CalendarIcon className="h-4 w-4 text-default-400" />
                </Button>
              </PopoverTrigger>
            }
            endContent={
              isClearable && inputValue ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="sm"
                  onPress={() => {
                    setInputValue('');
                    onChange('');
                  }}
                  aria-label="Limpar data selecionada"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              ) : null
            }
          />
        </div>
        <PopoverContent className="w-auto p-0">
          <Calendar
            value={calendarValue}
            onChange={(date) => {
              if (date) {
                const nextValue = formatToValue(date as CalendarDate);
                onChange(nextValue);
                setInputValue(formatDisplayValue(nextValue));
                setIsOpen(false);
              }
            }}
            aria-label={ariaLabel || label || 'Calendário'}
            calendarWidth={320}
            minValue={minValue}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
