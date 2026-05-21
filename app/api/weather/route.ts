import { NextResponse } from "next/server";
import { requireSession } from "@/lib/integrations/auth";
import { getWeatherForLocation } from "@/lib/integrations/weather";

export async function GET(request: Request) {
  await requireSession();

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "";
  const state = searchParams.get("state") ?? "";

  if (!city.trim() || !state.trim()) {
    return NextResponse.json({ error: "City and state are required." }, { status: 400 });
  }

  const weather = await getWeatherForLocation(city, state);

  if (!weather) {
    return NextResponse.json({ error: "Weather is unavailable for that location." }, { status: 404 });
  }

  return NextResponse.json({ weather });
}
