import { LockKeyhole, ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { loginAction } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    redirectTo?: string;
  }>;
};

export const metadata = {
  title: "Login | Manifest Carrier Compliance",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_420px] overflow-hidden rounded-md border border-white/10 bg-black/45 shadow-premium backdrop-blur-2xl max-lg:grid-cols-1">
        <div className="relative min-h-[560px] overflow-hidden bg-[linear-gradient(125deg,rgba(227,25,55,0.32),rgba(5,5,6,0.72)_42%,rgba(255,255,255,0.05)),repeating-linear-gradient(135deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_20px)] p-8">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-md border border-manifest-red/65 bg-gradient-to-br from-manifest-red to-manifest-redDark font-extrabold shadow-[0_14px_38px_rgba(227,25,55,0.28)]">
                  M
                </div>
                <div>
                  <p className="eyebrow">Manifest</p>
                  <h1 className="text-lg font-extrabold leading-tight tracking-normal text-white">
                    Global Logistics
                  </h1>
                </div>
              </div>

              <p className="eyebrow">Secure Compliance Portal</p>
              <h2 className="max-w-xl text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
                Carrier compliance access for operations, audits, and renewals.
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
              <AccessTile icon={<ShieldCheck className="h-4 w-4" />} label="Admin" value="Full control" />
              <AccessTile icon={<LockKeyhole className="h-4 w-4" />} label="Staff" value="Compliance updates" />
              <AccessTile icon={<Truck className="h-4 w-4" />} label="Carrier" value="Own profile" />
            </div>
          </div>
        </div>

        <div className="p-8 max-md:p-5">
          <p className="eyebrow">Authentication</p>
          <h2 className="text-3xl font-extrabold tracking-normal text-white">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-manifest-muted">
            Use your Manifest Global Logistics account to access carrier compliance records.
          </p>

          {params.error ? (
            <div className="mt-5 rounded-md border border-manifest-danger/45 bg-manifest-danger/10 p-3 text-sm font-bold text-manifest-danger">
              {params.error}
            </div>
          ) : null}

          <form action={loginAction} className="mt-7 grid gap-4">
            <input type="hidden" name="redirectTo" value={params.redirectTo ?? "/"} />
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="form-control"
                placeholder="name@manifestgloballogistics.com"
              />
            </label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="form-control"
                placeholder="Enter password"
              />
            </label>
            <button className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-manifest-red/50 bg-manifest-red/15 px-4 text-sm font-extrabold text-white transition hover:bg-manifest-red/25">
              Sign in securely
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AccessTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/35 p-3">
      <span className="mb-3 grid h-8 w-8 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
        {icon}
      </span>
      <strong className="block text-sm text-white">{label}</strong>
      <span className="text-xs font-bold text-manifest-muted">{value}</span>
    </div>
  );
}
