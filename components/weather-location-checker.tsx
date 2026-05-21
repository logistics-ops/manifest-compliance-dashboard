"use client";

import { useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CloudSun, Search } from "lucide-react";
import { WeatherCard } from "@/components/weather-card";
import type { WeatherResult } from "@/lib/integrations/weather";

type WeatherLookupState = {
  city: string;
  state: string;
  weather: WeatherResult | null;
  error: string;
};

export function WeatherLocationChecker({
  origin,
  destination,
}: {
  origin?: { city: string; state: string };
  destination?: { city: string; state: string };
}) {
  const [isPending, startTransition] = useTransition();
  const [originState, setOriginState] = useState<WeatherLookupState>({
    city: origin?.city ?? "",
    state: origin?.state ?? "",
    weather: null,
    error: "",
  });
  const [destinationState, setDestinationState] = useState<WeatherLookupState>({
    city: destination?.city ?? "",
    state: destination?.state ?? "",
    weather: null,
    error: "",
  });

  function checkWeather(kind: "origin" | "destination") {
    const current = kind === "origin" ? originState : destinationState;
    const update = kind === "origin" ? setOriginState : setDestinationState;

    startTransition(async () => {
      update((previous) => ({ ...previous, error: "" }));
      const params = new URLSearchParams({ city: current.city, state: current.state });
      const response = await fetch(`/api/weather?${params.toString()}`);
      const payload = (await response.json()) as { weather?: WeatherResult | null; error?: string };

      if (!response.ok || payload.error) {
        update((previous) => ({ ...previous, weather: null, error: payload.error ?? "Unable to check weather." }));
        return;
      }

      update((previous) => ({ ...previous, weather: payload.weather ?? null, error: "" }));
    });
  }

  return (
    <section className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-start justify-between gap-3 max-md:flex-col">
        <div>
          <p className="eyebrow">Weather Checker</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Dispatch conditions</h2>
          <p className="mt-2 text-sm leading-6 text-manifest-muted">
            Check Open-Meteo conditions for pickup and delivery locations before dispatching.
          </p>
        </div>
        <CloudSun className="h-5 w-5 text-manifest-red" />
      </div>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <LookupPanel
          title="Origin"
          state={originState}
          setState={setOriginState}
          onCheck={() => checkWeather("origin")}
          isPending={isPending}
        />
        <LookupPanel
          title="Destination"
          state={destinationState}
          setState={setDestinationState}
          onCheck={() => checkWeather("destination")}
          isPending={isPending}
        />
      </div>
    </section>
  );
}

function LookupPanel({
  title,
  state,
  setState,
  onCheck,
  isPending,
}: {
  title: string;
  state: WeatherLookupState;
  setState: Dispatch<SetStateAction<WeatherLookupState>>;
  onCheck: () => void;
  isPending: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-black/25 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_96px_auto] gap-3 max-sm:grid-cols-1">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          {title} City
          <input
            value={state.city}
            onChange={(event) => setState((previous) => ({ ...previous, city: event.target.value }))}
            className="form-control"
            placeholder="City"
          />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          State
          <input
            value={state.state}
            onChange={(event) => setState((previous) => ({ ...previous, state: event.target.value.toUpperCase() }))}
            className="form-control"
            maxLength={2}
            placeholder="TX"
          />
        </label>
        <button
          type="button"
          onClick={onCheck}
          disabled={isPending || !state.city || !state.state}
          className="form-button self-end disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Check
        </button>
      </div>
      {state.error ? (
        <div className="rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-3 py-2 text-sm font-bold text-manifest-danger">
          {state.error}
        </div>
      ) : null}
      {state.weather ? <WeatherCard title={`${title} Weather`} weather={state.weather} /> : null}
    </div>
  );
}
