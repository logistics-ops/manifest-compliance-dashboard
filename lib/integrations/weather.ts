export type WeatherForecastDay = {
  date: string;
  condition: string;
  highTemperature: number | null;
  lowTemperature: number | null;
  precipitationChance: number | null;
  windSpeed: number | null;
};

export type WeatherResult = {
  locationLabel: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  currentTemperature: number | null;
  condition: string;
  precipitationChance: number | null;
  windSpeed: number | null;
  severeWeatherWarning: string;
  forecast: WeatherForecastDay[];
  provider: "Open-Meteo";
  fetchedAt: string;
};

type GeocodeResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country_code?: string;
  }>;
};

type ForecastResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
  };
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

export async function getWeatherForLocation(city: string, state: string): Promise<WeatherResult | null> {
  const normalizedCity = city.trim();
  const normalizedState = state.trim().toUpperCase();

  if (!normalizedCity || !normalizedState) return null;

  try {
    const geocode = await geocodeLocation(normalizedCity, normalizedState);
    if (!geocode) return null;

    const forecast = await fetchForecast(geocode.latitude, geocode.longitude);
    if (!forecast) return null;

    const daily = forecast.daily;
    const precipitationChance = daily?.precipitation_probability_max?.[0] ?? null;

    return {
      locationLabel: `${geocode.name}, ${normalizedState}`,
      city: geocode.name,
      state: normalizedState,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      currentTemperature: forecast.current?.temperature_2m ?? null,
      condition: describeWeatherCode(forecast.current?.weather_code),
      precipitationChance,
      windSpeed: forecast.current?.wind_speed_10m ?? null,
      severeWeatherWarning: "NWS severe weather alerts placeholder",
      forecast: buildForecastDays(daily),
      provider: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Unable to load Open-Meteo weather", error);
    return null;
  }
}

async function geocodeLocation(city: string, state: string) {
  const params = new URLSearchParams({
    name: city,
    count: "10",
    language: "en",
    format: "json",
    countryCode: "US",
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as GeocodeResponse;
  const expectedState = STATE_NAMES[state] ?? state;
  const results = payload.results ?? [];
  const exactStateMatch = results.find((result) => normalize(result.admin1) === normalize(expectedState));
  const fallback = results.find((result) => result.country_code === "US") ?? results[0];
  const match = exactStateMatch ?? fallback;

  if (!match) return null;

  return {
    name: match.name,
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

async function fetchForecast(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "3",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 10 * 60 },
  });

  if (!response.ok) return null;
  return (await response.json()) as ForecastResponse;
}

function buildForecastDays(daily: ForecastResponse["daily"]): WeatherForecastDay[] {
  const times = daily?.time ?? [];

  return times.slice(0, 3).map((date, index) => ({
    date,
    condition: describeWeatherCode(daily?.weather_code?.[index]),
    highTemperature: daily?.temperature_2m_max?.[index] ?? null,
    lowTemperature: daily?.temperature_2m_min?.[index] ?? null,
    precipitationChance: daily?.precipitation_probability_max?.[index] ?? null,
    windSpeed: daily?.wind_speed_10m_max?.[index] ?? null,
  }));
}

function describeWeatherCode(code?: number) {
  if (code === undefined) return "Unavailable";
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mixed conditions";
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}
