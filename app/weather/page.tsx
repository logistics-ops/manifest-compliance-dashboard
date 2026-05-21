import Link from "next/link";
import { ArrowLeft, CloudSun } from "lucide-react";
import { WeatherCard } from "@/components/weather-card";
import { WeatherLocationChecker } from "@/components/weather-location-checker";
import { requireSession } from "@/lib/integrations/auth";
import { getWeatherForLocation } from "@/lib/integrations/weather";

type WeatherPageProps = {
  searchParams?: Promise<{ city?: string; state?: string }>;
};

export default async function WeatherPage({ searchParams }: WeatherPageProps) {
  await requireSession();
  const params = await searchParams;
  const city = params?.city ?? "";
  const state = params?.state ?? "";
  const weather = city && state ? await getWeatherForLocation(city, state) : null;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Command center
            </Link>
            <p className="eyebrow">Operations</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Weather Checker
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Check pickup and delivery conditions before dispatch. Weather is fetched on demand from Open-Meteo and cached briefly.
            </p>
          </div>
          <div className="grid min-h-28 min-w-36 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
            <CloudSun className="h-8 w-8" />
          </div>
        </header>

        <section className="section-panel mb-5 p-6 max-md:p-4">
          <form className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-3 max-md:grid-cols-1">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              City
              <input name="city" defaultValue={city} className="form-control" placeholder="Dallas" />
            </label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              State
              <input name="state" defaultValue={state} className="form-control" maxLength={2} placeholder="TX" />
            </label>
            <button className="form-button self-end">Check Weather</button>
          </form>
        </section>

        {city && state ? (
          <WeatherCard title="Location Weather" weather={weather} />
        ) : (
          <WeatherLocationChecker />
        )}
      </div>
    </main>
  );
}
