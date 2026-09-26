"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";

type CallState = "idle" | "connecting" | "connected";

export function VoiceCall({ roomId }: { roomId: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const configured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);

  useEffect(() => () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.disconnect();
  }, []);

  function updateParticipants(room: Room) {
    setParticipants(Array.from(room.remoteParticipants.values(), (participant: RemoteParticipant) => participant.name || participant.identity));
  }

  async function joinCall() {
    setError("");
    setState("connecting");
    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Could not join voice call.";
        throw new Error(message);
      }
      if (typeof result !== "object" || result === null || !("serverUrl" in result) || !("participantToken" in result) || typeof result.serverUrl !== "string" || typeof result.participantToken !== "string") {
        throw new Error("The call server returned an invalid response.");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          const element = track.attach();
          element.setAttribute("data-voice-track", "true");
          audioRef.current.appendChild(element);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });
      room.on(RoomEvent.ParticipantConnected, () => updateParticipants(room));
      room.on(RoomEvent.ParticipantDisconnected, () => updateParticipants(room));
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) roomRef.current = null;
        setState("idle");
        setMicEnabled(true);
        setParticipants([]);
      });

      await room.connect(result.serverUrl, result.participantToken, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);
      updateParticipants(room);
      setMicEnabled(true);
      setState("connected");
    } catch (caught) {
      const room = roomRef.current;
      roomRef.current = null;
      if (room) await room.disconnect();
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Could not connect to the voice call.");
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room) return;
    try {
      const enabled = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setMicEnabled(enabled);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change microphone state.");
    }
  }

  async function leaveCall() {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setState("idle");
    setMicEnabled(true);
    setParticipants([]);
  }

  return <section className="voice-call" aria-label="Room voice call">
    <div className="voice-call-copy"><span className="voice-call-icon"><Headphones size={17} /></span><div><strong>{state === "connected" ? "Voice call connected" : state === "connecting" ? "Connecting to voice call" : "Room voice call"}</strong><small>{state === "connected" ? `${participants.length + 1} in call` : configured ? "Audio only · microphone permission required" : "Voice service configuration required"}</small></div></div>
    <div className="voice-call-controls">{state === "connected" ? <><button className={`icon-button ${micEnabled ? "" : "voice-muted"}`} aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"} title={micEnabled ? "Mute microphone" : "Unmute microphone"} onClick={() => void toggleMicrophone()}>{micEnabled ? <Mic size={16} /> : <MicOff size={16} />}</button><button className="icon-button voice-leave" aria-label="Leave voice call" title="Leave voice call" onClick={() => void leaveCall()}><PhoneOff size={16} /></button></> : <button className="outline-button" disabled={!configured || state === "connecting"} onClick={() => void joinCall()}>{state === "connecting" ? "Connecting…" : <><Phone size={14} /> Join voice</>}</button>}</div>
    {participants.length > 0 && <p className="voice-participants" aria-live="polite">Also connected: {participants.join(", ")}</p>}
    {error && <p className="auth-error voice-error" role="alert">{error}</p>}
    <div className="voice-audio" ref={audioRef} aria-hidden="true" />
  </section>;
}
