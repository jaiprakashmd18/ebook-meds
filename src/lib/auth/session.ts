import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, type Permission, type StaffRole } from "./roles";

export type SessionUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  displayName: string | null;
  roles: StaffRole[];
};

/**
 * The authenticated user for this request, verified with the Supabase Auth
 * server (getUser), plus roles read through RLS. Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    displayName: (profile?.display_name as string | null) ?? null,
    roles: ((roles ?? []) as { role: StaffRole }[]).map((r) => r.role),
  };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}

/** Staff-only pages respond with 404 to everyone else, revealing nothing. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!can(user.roles, permission)) notFound();
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions: throw instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.roles, permission)) throw new AuthorizationError();
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  return user;
}
