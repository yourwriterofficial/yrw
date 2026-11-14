function readNamedKey(jsonEnvName: string, keyName = "default"): string {
  const raw = Deno.env.get(jsonEnvName);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const val = parsed?.[keyName];
    return typeof val === "string" ? val.trim() : "";
  } catch {
    return "";
  }
}

export function getSupabaseSecretKey(): string {
  return (
    readNamedKey("SUPABASE_SECRET_KEYS") ||
    (Deno.env.get("SUPABASE_SECRET_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim()
  );
}

export function getSupabasePublishableKey(): string {
  return (
    readNamedKey("SUPABASE_PUBLISHABLE_KEYS") ||
    (Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_ANON_KEY") || "").trim()
  );
}
