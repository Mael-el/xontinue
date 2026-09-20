// ============================================================
// MAILLAGE WEBRTC — pairs audio/vidéo full-mesh
//
// Chaque paire d'utilisateurs ouvre une RTCPeerConnection.
// La signalisation (offer/answer/ICE) transite par le serveur
// socket.io (voice:signal / call:signal — relais pur).
// Pattern « polite peer » RFC 8834 : le plus petit userId
// initie (offer) — évitons ainsi la collision de négociations.
// ============================================================

"use client";

export interface RtcPeerHandle {
  peerId: string;
  connection: RTCPeerConnection;
  stream: MediaStream | null;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Full-mesh minimal : ajoute/retire des pairs à la demande,
 * écoute leurs pistes distantes, relaie la signalisation.
 */
export class RtcMesh {
  private peers = new Map<string, RtcPeerHandle>();
  private makingOffer = new Map<string, boolean>();
  private ignoreOffer = new Map<string, boolean>();

  constructor(
    private opts: {
      myUserId: string;
      localStream: MediaStream;
      sendSignal: (targetUserId: string, data: unknown) => void;
      onTrack: (peerId: string, stream: MediaStream) => void;
      onPeerLeft?: (peerId: string) => void;
    }
  ) {}

  /** « Polite peer » : le plus petit userId garde la main (offre initiale). */
  isInitiator(peerId: string): boolean {
    return this.opts.myUserId < peerId;
  }

  /** Ajoute un pair (idempotent) et négocie si on est initiateur. */
  async addPeer(peerId: string): Promise<void> {
    if (peerId === this.opts.myUserId || this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const handle: RtcPeerHandle = { peerId, connection: pc, stream: null };
    this.peers.set(peerId, handle);
    this.makingOffer.set(peerId, false);
    this.ignoreOffer.set(peerId, false);

    // Mes pistes sortent vers ce pair
    for (const track of this.opts.localStream.getTracks()) {
      pc.addTrack(track, this.opts.localStream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.opts.sendSignal(peerId, { candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      handle.stream = stream;
      if (stream) this.opts.onTrack(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
      if (pc.connectionState === "closed") this.removePeer(peerId);
    };

    // Renégociation (ex: caméra ajoutée après coup)
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(peerId, true);
        await pc.setLocalDescription();
        this.opts.sendSignal(peerId, { description: pc.localDescription });
      } catch {
        // ignore — la paire suivante réessaiera
      } finally {
        this.makingOffer.set(peerId, false);
      }
    };

    // L'ajout des pistes déclenche automatiquement negotiationneeded
    // chez l'initiateur ; le non-initiateur répondra à l'offre
    // (collision éventuelle arbitrée par le polite peer).
  }

  /** Supprime un pair (départ, fin d'appel). */
  removePeer(peerId: string): void {
    const handle = this.peers.get(peerId);
    if (!handle) return;
    try {
      handle.connection.close();
    } catch {
      // déjà fermée
    }
    this.peers.delete(peerId);
    this.makingOffer.delete(peerId);
    this.ignoreOffer.delete(peerId);
    this.opts.onPeerLeft?.(peerId);
  }

  /** Traite un message de signalisation entrant (relais serveur). */
  async handleSignal(fromUserId: string, data: unknown): Promise<void> {
    const handle = this.peers.get(fromUserId) ?? (await this.lazyAdd(fromUserId));
    if (!handle) return;
    const pc = handle.connection;
    const payload = (data ?? {}) as {
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

    try {
      if (payload.description) {
        const description = new RTCSessionDescription(payload.description);
        const collision =
          description.type === "offer" &&
          (this.makingOffer.get(fromUserId) || pc.signalingState !== "stable");
        // « Polite » = celui qui n'initie pas cède la collision
        const polite = !this.isInitiator(fromUserId);
        this.ignoreOffer.set(fromUserId, !polite && collision);
        if (this.ignoreOffer.get(fromUserId)) return;

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          this.opts.sendSignal(fromUserId, { description: pc.localDescription });
        }
      } else if (payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          if (!this.ignoreOffer.get(fromUserId)) throw err;
        }
      }
    } catch (err) {
      console.error("rtc signal error:", err);
    }
  }

  private async lazyAdd(peerId: string): Promise<RtcPeerHandle | undefined> {
    // Un pair inconnu nous signale : on l'ajoute pour négocier
    try {
      await this.addPeer(peerId);
      return this.peers.get(peerId);
    } catch {
      return undefined;
    }
  }

  /** Liste des pairs actuellement connectés. */
  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  /** Ferme tout (fin d'appel / démontage). */
  destroy(): void {
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.peers.clear();
  }
}
