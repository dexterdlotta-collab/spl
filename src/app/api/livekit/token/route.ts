import { AccessToken } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!livekitUrl || !apiKey || !apiSecret || apiSecret.trim().toLowerCase() === "your-livekit-api-secret") {
    return NextResponse.json({ error: "Set a valid LiveKit URL, API key, and API secret in the server environment." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const roomId = typeof body === "object" && body !== null && "roomId" in body && typeof body.roomId === "string" ? body.roomId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) {
    return NextResponse.json({ error: "A valid room ID is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to join a voice call." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Join this study room before starting its voice call." }, { status: 403 });

  const { data: room } = await supabase.from("study_rooms").select("id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Study room not found." }, { status: 404 });

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: profile?.display_name || user.email || "Student",
    ttl: "5m",
  });
  token.addGrant({ roomJoin: true, room: room.id, canPublish: true, canSubscribe: true });

  return NextResponse.json(
    { serverUrl: livekitUrl, participantToken: await token.toJwt() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
