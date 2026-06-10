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

type AdminClientFailureReason = "missing_env" | "create_client_threw" | null;

let lastAdminClientDiagnostics: ReturnType<typeof getAdminClientEnvDiagnostics> & {
  adminClientFailureReason: AdminClientFailureReason;
  createClientThrew: boolean;
  createClientErrorMessage: string | null;
} = {
  ...getAdminClientEnvDiagnostics(),
  adminClientFailureReason: null,
  createClientThrew: false,
  createClientErrorMessage: null,
};

export function getLastAdminClientDiagnostics() {
  return lastAdminClientDiagnostics;
}

export function createAdminClient() {
  const diagnostics = getAdminClientEnvDiagnostics();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  lastAdminClientDiagnostics = {
    ...diagnostics,
    adminClientFailureReason: null,
    createClientThrew: false,
    createClientErrorMessage: null,
  };

  console.info("[supabase-admin] createAdminClient called", diagnostics);

  const failedChecks = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL_EMPTY_AFTER_TRIM" : null,
    !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY_EMPTY_AFTER_TRIM" : null,
  ].filter(Boolean);

  if (!supabaseUrl || !serviceRoleKey) {
    lastAdminClientDiagnostics = {
      ...diagnostics,
      adminClientFailureReason: "missing_env",
      createClientThrew: false,
      createClientErrorMessage: null,
    };
    console.warn("[supabase-admin] createAdminClient env check failed", {
      ...diagnostics,
      failedChecks,
      adminClientFailureReason: "missing_env",
      createClientThrew: false,
      createClientErrorMessage: null,
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
    const createClientErrorMessage = error instanceof Error ? error.message : "Unknown error";
    lastAdminClientDiagnostics = {
      ...diagnostics,
      adminClientFailureReason: "create_client_threw",
      createClientThrew: true,
      createClientErrorMessage,
    };
    console.error("[supabase-admin] createAdminClient createClient threw", {
      ...diagnostics,
      adminClientFailureReason: "create_client_threw",
      createClientThrew: true,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: createClientErrorMessage,
    });
    return null;
  }
}
