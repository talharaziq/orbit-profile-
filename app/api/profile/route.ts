import { NextRequest, NextResponse } from "next/server";
import { getGitHubProfile, GitHubProfileError } from "@/lib/github";
import type { RangeKey } from "@/lib/types";

export const runtime = "nodejs";

const ranges: RangeKey[] = ["30d", "90d", "year"];

export async function GET(request: NextRequest) {
  const username = (request.nextUrl.searchParams.get("username") ?? "").trim();
  const requestedRange = request.nextUrl.searchParams.get("range") as RangeKey | null;
  const range: RangeKey = requestedRange && ranges.includes(requestedRange) ? requestedRange : "year";

  if (!username || username.length > 39 || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)) {
    return NextResponse.json({ error: "Enter a valid GitHub username (letters, numbers, and hyphens)." }, { status: 400 });
  }

  try {
    const profile = await getGitHubProfile(username, range);
    return NextResponse.json(profile, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load this GitHub profile.";
    const status = error instanceof GitHubProfileError ? error.status : 500;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
