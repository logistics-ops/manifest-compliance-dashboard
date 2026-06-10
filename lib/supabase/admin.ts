import { createClient } from "@supabase/supabase-js";

export function getAdminClientEnvDiagnostics() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return {
    hasUrl: Boolean(supabaseUrl),
    urlLength: supabaseUrl.length,
    urlTrimmedLength: supabaseUrl.trim().length,
    isUrlEmptyAfterTrim: supabaseUrl.trim().length === 0,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    serviceRoleLength: serviceRoleKey.length,
    serviceRoleTrimmedLength: serviceRoleKey.trim().length,
    isServiceRoleKeyEmptyAfterTrim: serviceRoleKey.trim().length === 0,
  };
}

export function createAdminClient() {
  const diagnostics = getAdminClientEnvDiagnostics();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  console.info("[supabase-admin] createAdminClient called", diagnostics);

  const failedChecks = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL_EMPTY_AFTER_TRIM" : null,
    !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY_EMPTY_AFTER_TRIM" : null,
  ].filter(Boolean);

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[supabase-admin] createAdminClient env check failed", {
      ...diagnostics,
      failedChecks,
    });
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    console.error("[supabase-admin] createAdminClient createClient threw", {
      ...diagnostics,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
