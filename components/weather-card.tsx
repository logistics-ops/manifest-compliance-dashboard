import { CloudSun, Navigation, Wind } from "lucide-react";
import type { WeatherResult } from "@/lib/integrations/weather";

export function WeatherCard({
  title,
  weather,
}: {
  title: string;
  weather: WeatherResult | null;
}) {
  if (!weather) {
    return (
      <article className="section-panel p-5 max-md:p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{title}</p>
            <h3 className="text-xl font-extrabold tracking-normal text-white">Weather unavailable</h3>
          </div>
          <CloudSun className="h-5 w-5 text-manifest-red" />
        </div>
        <p className="text-sm leading-6 text-manifest-muted">
          Enter a U.S. city and state to check dispatch weather. Severe weather alert support is prepared for future NWS integration.
        </p>
      </article>
    );
  }

  return (
    <article className="section-panel overflow-hidden p-5 max-md:p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{title}</p>
          <h3 className="text-xl font-extrabold tracking-normal text-white">{weather.locationLabel}</h3>
          <p className="mt-1 text-xs font-bold text-manifest-muted">Open-Meteo · refreshed briefly</p>
        </div>
        <CloudSun className="h-5 w-5 text-manifest-red" />
      </div>

      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <WeatherMetric label="Temp" value={formatTemperature(weather.currentTemperature)} />
        <WeatherMetric label="Condition" value={weather.condition} />
        <WeatherMetric label="Precip" value={formatPercent(weather.precipitationChance)} />
        <WeatherMetric label="Wind" value={formatWind(weather.windSpeed)} />
      </div>

      <div className="mt-4 rounded-md border border-manifest-amber/35 bg-manifest-amber/10 p-3 text-sm text-manifest-amber">
        {weather.severeWeatherWarning}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {weather.forecast.map((day) => (
          <div key={day.date} className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-sm text-white">{formatForecastDate(day.date)}</strong>
              <Navigation className="h-3.5 w-3.5 text-manifest-red" />
            </div>
            <p className="text-xs font-bold text-manifest-muted">{day.condition}</p>
            <p className="mt-2 text-sm text-white">{formatTemperature(day.highTemperature)} / {formatTemperature(day.lowTemperature)}</p>
            <p className="mt-1 flex items-center gap-2 text-xs font-bold text-manifest-muted">
              <Wind className="h-3.5 w-3.5" />
              {formatPercent(day.precipitationChance)} precip · {formatWind(day.windSpeed)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <span className="panel-label">{label}</span>
      <strong className="mt-2 block text-lg text-white">{value}</strong>
    </div>
  );
}

function formatTemperature(value: number | null) {
  return value === null ? "N/A" : `${Math.round(value)} F`;
}

function formatWind(value: number | null) {
  return value === null ? "N/A" : `${Math.round(value)} mph`;
}

function formatPercent(value: number | null) {
  return value === null ? "N/A" : `${Math.round(value)}%`;
}

function formatForecastDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}
