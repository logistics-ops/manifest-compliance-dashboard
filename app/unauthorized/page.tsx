import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { requireSession } from "@/lib/integrations/auth";

export const metadata = {
  title: "Access Review | Manifest Carrier Compliance",
};

export default async function UnauthorizedPage() {
  const session = await requireSession();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="section-panel w-full max-w-2xl p-8 text-center max-md:p-5">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-md border border-manifest-red/50 bg-manifest-red/10 text-manifest-red">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="eyebrow">Access Review</p>
        <h1 className="text-3xl font-extrabold tracking-normal text-white">
          Your account needs a carrier profile assignment.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-manifest-muted">
          {session.email} is signed in, but it is not authorized for the dashboard and is not linked to a carrier profile yet.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-md border border-white/10 bg-black/30 px-4 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
          >
            Retry access
          </Link>
          <form action={logoutAction}>
            <button className="inline-flex min-h-10 items-center rounded-md border border-manifest-red/50 bg-manifest-red/15 px-4 text-sm font-extrabold text-white transition hover:bg-manifest-red/25">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
