import type { NextRequest } from "next/server";
import { searchCities } from "@/lib/cities";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return Response.json({ cities: searchCities(query.slice(0, 60)) });
}
