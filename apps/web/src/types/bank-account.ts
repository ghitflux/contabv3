export interface BankAccount {
  id: string;
  client_id: string;
  name: string;
  account_number: string;
  balance: number;
  accounting_account?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccountCreate {
  client_id?: string;
  name: string;
  account_number: string;
  balance?: number;
  accounting_account?: string | null;
}

export interface BankAccountUpdate {
  name?: string;
  account_number?: string;
  balance?: number;
  accounting_account?: string | null;
}

export interface BankAccountListResponse {
  items: BankAccount[];
  total: number;
  skip: number;
  limit: number;
}
