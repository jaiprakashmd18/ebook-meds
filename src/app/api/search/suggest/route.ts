import { NextResponse, type NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/data/catalog";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  try {
    const suggestions = await getSearchSuggestions(q);
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
