import { createClient } from "@supabase/supabase-js";

export const ADMIN_CLIENT_ENV_NAMES = {
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
} as const;

export const EXPECTED_ADMIN_CLIENT_ENV_NAMES = [
  ADMIN_CLIENT_ENV_NAMES.supabaseUrl,
  ADMIN_CLIENT_ENV_NAMES.serviceRoleKey,
] as const;

export function getAdminClientEnvDiagnostics() {
  const supabaseUrl = process.env[ADMIN_CLIENT_ENV_NAMES.supabaseUrl] ?? "";
  const serviceRoleKey = process.env[ADMIN_CLIENT_ENV_NAMES.serviceRoleKey] ?? "";

  return {
    supabaseUrlEnvNameRead: ADMIN_CLIENT_ENV_NAMES.supabaseUrl,
    serviceRoleEnvNameRead: ADMIN_CLIENT_ENV_NAMES.serviceRoleKey,
    allExpectedEnvNames: [...EXPECTED_ADMIN_CLIENT_ENV_NAMES],
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
  const supabaseUrl = process.env[ADMIN_CLIENT_ENV_NAMES.supabaseUrl]?.trim();
  const serviceRoleKey = process.env[ADMIN_CLIENT_ENV_NAMES.serviceRoleKey]?.trim();
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
