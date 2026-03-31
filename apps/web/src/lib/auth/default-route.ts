export const DEFAULT_LOGIN_ROUTE = "/login";
export const DEFAULT_ADMIN_ROUTE = "/clientes";
export const DEFAULT_CLIENT_ROUTE = "/financeiro";

type JwtPayload = {
  role?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4;
    if (pad) {
      payload += "=".repeat(4 - pad);
    }
    if (typeof atob !== "function") {
      return null;
    }
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getDefaultAppRoute(role?: string | null): string {
  return role === "cliente" ? DEFAULT_CLIENT_ROUTE : DEFAULT_ADMIN_ROUTE;
}

export function getDefaultAppRouteFromRefreshToken(refreshToken?: string | null): string {
  if (!refreshToken) {
    return DEFAULT_LOGIN_ROUTE;
  }

  const payload = decodeJwtPayload(refreshToken);
  return getDefaultAppRoute(payload?.role ?? null);
}
