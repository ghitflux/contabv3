/**
 * User types and interfaces.
 */

export enum UserRole {
  ADMIN = "admin",
  FUNC = "func",
  CLIENTE = "cliente",
}

export interface UserBase {
  name: string;
  email: string;
  role: UserRole;
}

export interface UserCreate extends UserBase {
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  is_verified?: boolean;
}

export interface UserUpdatePassword {
  current_password: string;
  new_password: string;
}

export interface User extends UserBase {
  id: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInDB extends User {
  password_hash: string;
}

/**
 * Type guard to check if user has a specific role.
 */
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  return user !== null && roles.includes(user.role);
}

/**
 * Type guard to check if user is admin or funcionario.
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, [UserRole.ADMIN, UserRole.FUNC]);
}

/**
 * Type guard to check if user is funcionario.
 */
export function isFuncionario(user: User | null): boolean {
  return hasRole(user, [UserRole.FUNC]);
}

/**
 * Type guard to check if user is cliente.
 */
export function isCliente(user: User | null): boolean {
  return hasRole(user, [UserRole.CLIENTE]);
}
