'use client';

import { Button, ButtonGroup, Select, SelectItem } from '@/heroui';
import { SearchInput } from '@/components/ui/SearchInput';

interface ClientsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;
}

export function ClientsFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortOrder,
  onSortOrderChange,
}: ClientsFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchQuery}
            onValueChange={onSearchChange}
            placeholder="Buscar por razão social ou CNPJ..."
          />
        </div>
        <Select
          label="Status"
          placeholder="Todos"
          selectedKeys={statusFilter ? [statusFilter] : []}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            onStatusChange(value || '');
          }}
          className="w-full md:w-40"
          variant="bordered"
        >
          <SelectItem key="all">
            Todos
          </SelectItem>
          <SelectItem key="ativo">
            Ativo
          </SelectItem>
          <SelectItem key="inativo">
            Inativo
          </SelectItem>
          <SelectItem key="pendente">
            Pendente
          </SelectItem>
          <SelectItem key="inadimplente">
            Inadimplente
          </SelectItem>
        </Select>
      </div>
      <ButtonGroup>
        <Button
          variant={sortOrder === 'asc' ? 'solid' : 'bordered'}
          onPress={() => onSortOrderChange('asc')}
          startContent={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          }
        >
          A-Z
        </Button>
        <Button
          variant={sortOrder === 'desc' ? 'solid' : 'bordered'}
          onPress={() => onSortOrderChange('desc')}
          startContent={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          }
        >
          Z-A
        </Button>
      </ButtonGroup>
    </div>
  );
}
