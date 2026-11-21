import {
  createVoiceActivityDetector,
  isPolitePeer,
  shouldConnectMicPeer,
} from '../shared/audioMeter.ts';

export type WebRtcSignalPayload =
  | { type: 'peer-ready' }
  | { type: 'description'; description: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

interface PeerEntry {
  peerId: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  sender: RTCRtpSender | null;
  audioEl: HTMLAudioElement | null;
  remoteStream: MediaStream | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  iceRestarts: number;
  sentReadyPing: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class RoomVoiceManager {
  private peers = new Map<string, PeerEntry>();
  private meId = '';
  private roomId = '';
  private localStream: MediaStream | null = null;
  private locallyMutedIds = new Set<string>();
  private audioContainer: HTMLDivElement | null = null;
  private pendingPlayElements = new Set<HTMLAudioElement>();
  private autoplayUnlockBound = false;

  private readonly onSendSignal: (
    targetUserId: string,
    roomId: string,
    signal: WebRtcSignalPayload
  ) => void;

  constructor(options: {
    onSendSignal: (targetUserId: string, roomId: string, signal: WebRtcSignalPayload) => void;
  }) {
    this.onSendSignal = options.onSendSignal;
  }

  private getAudioContainer(): HTMLDivElement | null {
    if (typeof document === 'undefined') return null;
    if (this.audioContainer && document.body.contains(this.audioContainer)) {
      return this.audioContainer;
    }
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-voice-audio-sink', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
    this.audioContainer = el;
    return el;
  }

  private bindAutoplayUnlock() {
    if (this.autoplayUnlockBound || typeof window === 'undefined') return;
    this.autoplayUnlockBound = true;
    const retryPlay = () => {
      for (const audio of Array.from(this.pendingPlayElements)) {
        audio
          .play()
          .then(() => {
            this.pendingPlayElements.delete(audio);
          })
          .catch(() => {});
      }
      if (this.pendingPlayElements.size === 0) {
        window.removeEventListener('pointerdown', retryPlay);
        window.removeEventListener('keydown', retryPlay);
        this.autoplayUnlockBound = false;
      }
    };
    window.addEventListener('pointerdown', retryPlay, { passive: true });
    window.addEventListener('keydown', retryPlay, { passive: true });
  }

  private tryPlayAudio(audio: HTMLAudioElement) {
    audio.play().catch(() => {
      this.pendingPlayElements.add(audio);
      this.bindAutoplayUnlock();
    });
  }

  setLocallyMutedUserIds(ids: Set<string>) {
    this.locallyMutedIds = new Set(ids);
    for (const [peerId, entry] of this.peers) {
      if (entry.audioEl) {
        entry.audioEl.muted = this.locallyMutedIds.has(peerId);
      }
    }
  }

  syncState(params: {
    meId: string | null;
    roomId: string | null;
    roomOnlineUserIds: string[];
    seatedUserIds: Set<string>;
    localStream: MediaStream | null;
    locallyMutedUserIds: Set<string>;
  }) {
    const nextMeId = params.meId ?? '';
    const nextRoomId = params.roomId ?? '';
    this.locallyMutedIds = new Set(params.locallyMutedUserIds);

    const roomChanged = nextRoomId !== this.roomId || nextMeId !== this.meId;
    if (roomChanged) {
      this.closeAllPeers();
      this.meId = nextMeId;
      this.roomId = nextRoomId;
    }

    this.localStream = params.localStream;

    if (!this.meId || !this.roomId || typeof RTCPeerConnection === 'undefined') {
      this.closeAllPeers();
      return;
    }

    const desiredPeerIds = new Set<string>();
    for (const peerId of params.roomOnlineUserIds) {
      if (
        shouldConnectMicPeer({
          meId: this.meId,
          peerId,
          seatedUserIds: params.seatedUserIds,
        })
      ) {
        desiredPeerIds.add(peerId);
      }
    }

    // Close peers that left the room or no longer involve any mic speaker
    for (const peerId of Array.from(this.peers.keys())) {
      if (!desiredPeerIds.has(peerId)) {
        this.closePeer(peerId);
      }
    }

    // Ensure peer connections & local track attachment for all desired peers
    for (const peerId of desiredPeerIds) {
      const entry = this.ensurePeer(peerId);
      void this.syncSenderTrack(entry);

      // If we are a listener (no localStream) and peer is on mic, ask peer to ensure offer
      if (!this.localStream && params.seatedUserIds.has(peerId) && !entry.sentReadyPing) {
        entry.sentReadyPing = true;
        this.onSendSignal(peerId, this.roomId, { type: 'peer-ready' });
      }
    }
  }

  private ensurePeer(peerId: string): PeerEntry {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4,
    });

    const entry: PeerEntry = {
      peerId,
      pc,
      polite: isPolitePeer(this.meId, peerId),
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      sender: null,
      audioEl: null,
      remoteStream: null,
      disconnectTimer: null,
      iceRestarts: 0,
      sentReadyPing: false,
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && this.roomId) {
        this.onSendSignal(peerId, this.roomId, {
          type: 'candidate',
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      await this.negotiate(entry);
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      entry.remoteStream = stream;

      if (!entry.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', '');
        audio.volume = 1;
        audio.muted = this.locallyMutedIds.has(peerId);
        const sink = this.getAudioContainer();
        if (sink) sink.appendChild(audio);
        entry.audioEl = audio;
      }

      entry.audioEl.srcObject = stream;
      entry.audioEl.muted = this.locallyMutedIds.has(peerId);
      this.tryPlayAudio(entry.audioEl);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        entry.iceRestarts = 0;
        if (entry.disconnectTimer) {
          clearTimeout(entry.disconnectTimer);
          entry.disconnectTimer = null;
        }
      } else if (state === 'disconnected') {
        if (!entry.disconnectTimer) {
          entry.disconnectTimer = setTimeout(() => {
            entry.disconnectTimer = null;
            if (
              (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') &&
              entry.iceRestarts < 3
            ) {
              entry.iceRestarts += 1;
              try {
                pc.restartIce();
              } catch {
                // ignore
              }
            }
          }, 2500);
        }
      } else if (state === 'failed') {
        if (entry.iceRestarts < 3) {
          entry.iceRestarts += 1;
          try {
            pc.restartIce();
          } catch {
            // ignore
          }
        }
      }
    };

    this.peers.set(peerId, entry);
    return entry;
  }

  private async negotiate(entry: PeerEntry) {
    if (!this.roomId || entry.pc.signalingState === 'closed') return;
    try {
      entry.makingOffer = true;
      await entry.pc.setLocalDescription();
      if (entry.pc.localDescription) {
        this.onSendSignal(entry.peerId, this.roomId, {
          type: 'description',
          description: entry.pc.localDescription,
        });
      }
    } catch {
      // Ignore transient negotiation abort
    } finally {
      entry.makingOffer = false;
    }
  }

  private async syncSenderTrack(entry: PeerEntry) {
    const localTrack = this.localStream?.getAudioTracks()[0] ?? null;
    if (localTrack) {
      if (entry.sender) {
        if (entry.sender.track !== localTrack) {
          await entry.sender.replaceTrack(localTrack).catch(() => {});
        }
        const transceiver = entry.pc.getTransceivers().find((t) => t.sender === entry.sender);
        if (transceiver && transceiver.direction !== 'sendrecv') {
          transceiver.direction = 'sendrecv';
        }
      } else if (this.localStream) {
        entry.sender = entry.pc.addTrack(localTrack, this.localStream);
        // Tune voice encoding bitrate for clear, stable speech
        try {
          const params = entry.sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0] = {
            ...params.encodings[0],
            maxBitrate: 48_000,
          };
          await entry.sender.setParameters(params).catch(() => {});
        } catch {
          // Not supported on all browsers
        }
      }
    } else if (entry.sender) {
      await entry.sender.replaceTrack(null).catch(() => {});
      const transceiver = entry.pc.getTransceivers().find((t) => t.sender === entry.sender);
      if (transceiver && transceiver.direction === 'sendrecv') {
        transceiver.direction = 'recvonly';
      }
    }
  }

  async handleSignal(params: {
    fromUserId: string;
    roomId?: string;
    signal: WebRtcSignalPayload;
  }) {
    if (!this.meId || !this.roomId) return;
    if (params.roomId && params.roomId !== this.roomId) return;
    if (!params.fromUserId || params.fromUserId === this.meId) return;

    const { fromUserId, signal } = params;
    const entry = this.ensurePeer(fromUserId);
    const { pc } = entry;

    if (signal.type === 'peer-ready') {
      await this.syncSenderTrack(entry);
      if (
        this.localStream &&
        pc.signalingState === 'stable' &&
        (pc.iceConnectionState === 'new' || !pc.remoteDescription)
      ) {
        await this.negotiate(entry);
      }
      return;
    }

    if (signal.type === 'description') {
      try {
        const description = signal.description;
        const readyForOffer =
          !entry.makingOffer &&
          (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;

        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        entry.isSettingRemoteAnswerPending = description.type === 'answer';
        await pc.setRemoteDescription(description);
        entry.isSettingRemoteAnswerPending = false;

        for (const cand of entry.pendingCandidates.splice(0)) {
          await pc.addIceCandidate(cand).catch(() => {});
        }

        if (description.type === 'offer') {
          await this.syncSenderTrack(entry);
          await pc.setLocalDescription();
          if (pc.localDescription && this.roomId) {
            this.onSendSignal(fromUserId, this.roomId, {
              type: 'description',
              description: pc.localDescription,
            });
          }
        }
      } catch {
        entry.isSettingRemoteAnswerPending = false;
      }
      return;
    }

    if (signal.type === 'candidate') {
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate);
        } else {
          entry.pendingCandidates.push(signal.candidate);
        }
      } catch {
        if (!entry.ignoreOffer) {
          // Ignore stale ICE candidate
        }
      }
    }
  }

  private closePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    this.peers.delete(peerId);
    if (entry.disconnectTimer) {
      clearTimeout(entry.disconnectTimer);
    }
    try {
      entry.pc.onicecandidate = null;
      entry.pc.onnegotiationneeded = null;
      entry.pc.ontrack = null;
      entry.pc.oniceconnectionstatechange = null;
      entry.pc.close();
    } catch {
      // ignore
    }
    if (entry.audioEl) {
      this.pendingPlayElements.delete(entry.audioEl);
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
        entry.audioEl.remove();
      } catch {
        // ignore
      }
    }
  }

  closeAllPeers() {
    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }
  }

  destroy() {
    this.closeAllPeers();
    if (this.audioContainer) {
      this.audioContainer.remove();
      this.audioContainer = null;
    }
  }
}

export interface LocalMicMonitorHandle {
  stream: MediaStream;
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

export async function startLocalMicMonitor(options: {
  initiallyMuted: boolean;
  onSpeakingChange: (speaking: boolean) => void;
  onTrackEnded?: () => void;
}): Promise<LocalMicMonitorHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('المتصفح لا يدعم التقاط الصوت');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  let muted = options.initiallyMuted;
  for (const track of stream.getAudioTracks()) {
    track.enabled = !muted;
    if (options.onTrackEnded) {
      track.onended = options.onTrackEnded;
    }
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let unlockListener: (() => void) | null = null;
  const vad = createVoiceActivityDetector();
  let stopped = false;

  if (AudioCtx) {
    ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
      unlockListener = () => {
        if (ctx && ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlockListener, { passive: true });
      window.addEventListener('keydown', unlockListener, { passive: true });
    }

    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.35;
    src.connect(analyser);

    const timeSamples = new Uint8Array(analyser.fftSize);
    const freqBins = new Uint8Array(analyser.frequencyBinCount);

    timer = setInterval(() => {
      if (stopped) return;
      const track = stream.getAudioTracks()[0];
      const trackInactive = !track || track.readyState !== 'live' || !track.enabled || muted;

      if (trackInactive || (ctx && ctx.state !== 'running')) {
        if (vad.isSpeaking()) {
          vad.reset();
          options.onSpeakingChange(false);
        }
        return;
      }

      analyser.getByteTimeDomainData(timeSamples);
      analyser.getByteFrequencyData(freqBins);

      const res = vad.evaluate({
        timeSamples,
        freqBins,
        sampleRate: ctx?.sampleRate ?? 48000,
        fftSize: analyser.fftSize,
        nowMs: performance.now(),
        muted: false,
      });

      if (res.changed) {
        options.onSpeakingChange(res.speaking);
      }
    }, 50);
  }

  return {
    stream,
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !nextMuted;
      }
      if (nextMuted && vad.reset()) {
        options.onSpeakingChange(false);
      }
    },
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (unlockListener) {
        window.removeEventListener('pointerdown', unlockListener);
        window.removeEventListener('keydown', unlockListener);
        unlockListener = null;
      }
      if (vad.reset()) {
        options.onSpeakingChange(false);
      }
      for (const track of stream.getAudioTracks()) {
        track.onended = null;
        track.stop();
      }
      if (ctx) {
        void ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
