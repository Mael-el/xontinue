// ============================================================
// COMPOSANT — Enregistreur de message vocal (MediaRecorder)
// Produit un WebM/OGG → base64 + durée, prêt pour l'API.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";

export interface VoiceRecording {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  durationSeconds: number;
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

export function VoiceRecorder(props: {
  onReady: (recording: VoiceRecording) => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const mimeRef = useRef<string>("audio/webm");

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        mimeRef.current = pickMime();
        const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current });
        recorderRef.current = recorder;
        chunksRef.current = [];
        startedAtRef.current = Date.now();
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(250);
      })
      .catch(() => setError("Micro inaccessible — vérifie l'autorisation"));

    return () => {
      cancelled = true;
      clearInterval(timer);
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function finish(send: boolean) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopTracks();
      props.onCancel();
      return;
    }
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    stopTracks();

    if (!send) {
      props.onCancel();
      return;
    }

    const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const blob = new Blob(chunksRef.current, { type: mimeRef.current.split(";")[0] });
    const buffer = await blob.arrayBuffer();
    // base64 sans stack overflow (chunked)
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    props.onReady({
      fileName: `vocal-${Date.now()}.${ext}`,
      mimeType: blob.type,
      dataBase64: btoa(binary),
      durationSeconds: duration,
    });
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <span className="font-mono text-sm text-orange-200">{mm}:{ss}</span>
      <span className="hidden text-xs text-neutral-400 sm:block">
        {error ?? "Enregistrement vocal en cours…"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => void finish(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/5"
          aria-label="Annuler l'enregistrement"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void finish(true)}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-400"
          aria-label="Envoyer le message vocal"
        >
          Envoyer ➤
        </button>
      </div>
    </div>
  );
}
