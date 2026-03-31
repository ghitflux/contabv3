import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEFAULT_LOGIN_ROUTE,
  getDefaultAppRouteFromRefreshToken,
} from "@/lib/auth/default-route";

export default async function HomePage() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  redirect(
    refreshToken
      ? getDefaultAppRouteFromRefreshToken(refreshToken)
      : DEFAULT_LOGIN_ROUTE
  );
}
