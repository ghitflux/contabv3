'use client';

import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Spinner,
} from '@/heroui';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyContent?: ReactNode;
  getRowKey: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyContent = 'Nenhum registro encontrado',
  getRowKey,
}: DataTableProps<T>) {
  return (
    <Table
      aria-label="Data table"
      className="min-w-[720px]"
      classNames={{
        wrapper: 'shadow-none border border-divider overflow-x-auto',
        th: 'bg-default-100',
      }}
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn
            key={column.key}
            allowsSorting={column.sortable}
          >
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        items={data}
        isLoading={isLoading}
        loadingContent={<Spinner label="Carregando..." />}
        emptyContent={emptyContent}
      >
        {(item) => (
          <TableRow key={getRowKey(item)}>
            {(columnKey) => {
              const column = columns.find((col) => col.key === columnKey);
              const value = item[columnKey as keyof T];

              if (column?.render) {
                return <TableCell>{column.render(item)}</TableCell>;
              }

              return <TableCell>{String(value)}</TableCell>;
            }}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
