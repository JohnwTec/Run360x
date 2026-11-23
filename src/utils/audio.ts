import {
  AudioAnnouncement,
  AudioCoachCategory,
  AudioCoachPriority,
  AudioCoachSettings,
} from '../types';

const SETTINGS_STORAGE_KEY = 'run360x_audio_coach_settings';

export const DEFAULT_AUDIO_COACH_SETTINGS: AudioCoachSettings = {
  enabled: true,
  announcePace: true,
  announceMilestones: true,
  announceCombatZones: true,
  paceIntervalSeconds: 45,
  milestoneStepMeters: 500,
  rate: 1.05,
  volume: 1.0,
  voiceURI: null,
};

export interface AudioCoachSnapshot {
  supported: boolean;
  settings: AudioCoachSettings;
  isSpeaking: boolean;
  currentAnnouncement: AudioAnnouncement | null;
  recentAnnouncements: AudioAnnouncement[];
  availableVoices: SpeechSynthesisVoice[];
}

type AudioCoachListener = (snapshot: AudioCoachSnapshot) => void;

const PRIORITY_WEIGHT: Record<AudioCoachPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

// Format pace (e.g. 5.25 min/km) into natural pt-BR speech
export function formatPaceForSpeech(paceMinKm: number): string {
  if (!isFinite(paceMinKm) || paceMinKm <= 0 || paceMinKm > 25) {
    return 'ritmo indisponível';
  }
  const totalSeconds = Math.round(paceMinKm * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  const minLabel = mins === 1 ? '1 minuto' : `${mins} minutos`;
  if (secs === 0) {
    return `${minLabel} por quilômetro`;
  }
  const secLabel = secs === 1 ? '1 segundo' : `${secs} segundos`;
  return `${minLabel} e ${secLabel} por quilômetro`;
}

// Format distance in meters into natural pt-BR speech
export function formatDistanceForSpeech(meters: number): string {
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} metros`;
  }
  const km = meters / 1000;
  const roundedKm = Math.round(km * 100) / 100;
  if (Math.abs(roundedKm - Math.round(roundedKm)) < 0.01) {
    const whole = Math.round(roundedKm);
    return whole === 1 ? '1 quilômetro' : `${whole} quilômetros`;
  }
  const formatted = roundedKm.toFixed(1).replace('.', ' vírgula ');
  return `${formatted} quilômetros`;
}

// Format elapsed duration into natural pt-BR speech
export function formatDurationForSpeech(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(hrs === 1 ? '1 hora' : `${hrs} horas`);
  if (mins > 0) parts.push(mins === 1 ? '1 minuto' : `${mins} minutos`);
  if (secs > 0 && hrs === 0) parts.push(secs === 1 ? '1 segundo' : `${secs} segundos`);

  return parts.length > 0 ? parts.join(' e ') : '0 segundos';
}

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioCoachSettings = { ...DEFAULT_AUDIO_COACH_SETTINGS };
  private queue: AudioAnnouncement[] = [];
  private isSpeaking = false;
  private currentAnnouncement: AudioAnnouncement | null = null;
  private recentAnnouncements: AudioAnnouncement[] = [];
  private availableVoices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<AudioCoachListener>();
  private speechFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadSettings();
    this.initVoices();
  }

  private loadSettings() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...DEFAULT_AUDIO_COACH_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_AUDIO_COACH_SETTINGS };
    }
  }

  private saveSettings() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore storage errors
    }
  }

  private initVoices() {
    if (!this.isSpeechSupported()) return;

    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        // Prioritize pt-BR, then other pt, then remaining voices alphabetically
        this.availableVoices = [...voices].sort((a, b) => {
          const score = (v: SpeechSynthesisVoice) => {
            const lang = v.lang.toLowerCase();
            if (lang === 'pt-br') return 0;
            if (lang.startsWith('pt')) return 1;
            if (lang.startsWith('en')) return 2;
            return 3;
          };
          const diff = score(a) - score(b);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });
        this.emit();
      }
    };

    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }

  isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  getSettings(): AudioCoachSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AudioCoachSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    if (!this.settings.enabled) {
      this.stopAllSpeech();
    }
    this.emit();
  }

  getSnapshot(): AudioCoachSnapshot {
    return {
      supported: this.isSpeechSupported(),
      settings: { ...this.settings },
      isSpeaking: this.isSpeaking,
      currentAnnouncement: this.currentAnnouncement,
      recentAnnouncements: [...this.recentAnnouncements],
      availableVoices: [...this.availableVoices],
    };
  }

  subscribe(listener: AudioCoachListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Futuristic Chime for XP Orb collection
  playOrbCollectSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6
    osc.frequency.exponentialRampToValueAtTime(1760.0, now + 0.3); // A6

    gain.gain.setValueAtTime(0.15 * this.settings.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Crisp ascending chime for Distance Milestones
  playMilestoneSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.14 * this.settings.volume, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.26);
    });
  }

  // Subtle radar sonar ping when approaching a Combat Zone
  playRadarPingSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, now + i * 0.18);
      osc.frequency.exponentialRampToValueAtTime(520, now + i * 0.18 + 0.14);

      gain.gain.setValueAtTime(0.15 * this.settings.volume, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.16);
    }
  }

  // Tactical alert for Combat Zones
  playCombatZoneAlertSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now + i * 0.12);
      osc.frequency.exponentialRampToValueAtTime(440, now + i * 0.12 + 0.08);

      gain.gain.setValueAtTime(0.18 * this.settings.volume, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.09);
    }
  }

  // Fanfare sweep when overtaking the Ghost Runner
  playGhostOvertakeSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18 * this.settings.volume, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
  }

  // Interval phase start pulse
  playIntervalStartSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(600, now + 0.1);

    gain.gain.setValueAtTime(0.1 * this.settings.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Laser/Spark sound for record speed bursts
  playSparkSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    gain.gain.setValueAtTime(0.12 * this.settings.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Grand synth chord sweep for Level Up celebration
  playLevelUpSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + idx * 0.07 + 0.3);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setValueAtTime(0.18 * this.settings.volume, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.52);
    });

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    subGain.gain.setValueAtTime(0.3 * this.settings.volume, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.45);

    setTimeout(() => {
      this.speakTacticalCoach('Parabéns Atleta! Você subiu de nível com excelência!', {
        category: 'system',
        priority: 'high',
      });
    }, 600);
  }

  private resolveVoice(): SpeechSynthesisVoice | null {
    if (!this.isSpeechSupported()) return null;
    const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    if (this.settings.voiceURI) {
      const exact = voices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (exact) return exact;
    }

    const ptBR = voices.find((v) => v.lang.toLowerCase() === 'pt-br');
    if (ptBR) return ptBR;
    const ptAny = voices.find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (ptAny) return ptAny;
    return voices[0] || null;
  }

  private clearFallbackTimer() {
    if (this.speechFallbackTimer) {
      clearTimeout(this.speechFallbackTimer);
      this.speechFallbackTimer = null;
    }
  }

  stopAllSpeech() {
    this.queue = [];
    this.isSpeaking = false;
    this.currentAnnouncement = null;
    this.clearFallbackTimer();
    if (this.isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.emit();
  }

  clearHistory() {
    this.recentAnnouncements = [];
    this.emit();
  }

  private recordAnnouncement(announcement: AudioAnnouncement) {
    this.recentAnnouncements = [announcement, ...this.recentAnnouncements].slice(0, 8);
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (!this.settings.enabled || !this.isSpeechSupported()) {
      this.queue = [];
      this.emit();
      return;
    }

    // Pop highest-priority item (FIFO among equal priorities)
    let bestIdx = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (PRIORITY_WEIGHT[this.queue[i].priority] > PRIORITY_WEIGHT[this.queue[bestIdx].priority]) {
        bestIdx = i;
      }
    }
    const [next] = this.queue.splice(bestIdx, 1);

    this.isSpeaking = true;
    this.currentAnnouncement = { ...next, spoken: true };
    this.recordAnnouncement(this.currentAnnouncement);
    this.emit();

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = 'pt-BR';
    utterance.rate = this.settings.rate;
    utterance.volume = this.settings.volume;
    utterance.pitch = next.category === 'combat_zone' ? 0.92 : 0.98;

    const voice = this.resolveVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'pt-BR';
    }

    const finalize = () => {
      this.clearFallbackTimer();
      this.isSpeaking = false;
      this.currentAnnouncement = null;
      this.emit();
      // Small breathing pause before next queued announcement
      setTimeout(() => this.processQueue(), 180);
    };

    utterance.onend = finalize;
    utterance.onerror = finalize;

    // Safety timeout in case a browser speech engine hangs without firing onend
    const estimatedMs = Math.max(4500, Math.min(18000, next.text.length * 95));
    this.clearFallbackTimer();
    this.speechFallbackTimer = setTimeout(() => {
      if (this.isSpeaking && this.currentAnnouncement?.id === next.id) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        finalize();
      }
    }, estimatedMs);

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finalize();
    }
  }

  // Core Speech Synthesis Queue Method
  speakTacticalCoach(
    phrase: string,
    options?: {
      category?: AudioCoachCategory;
      priority?: AudioCoachPriority;
      interrupt?: boolean;
      ignoreCategoryFilter?: boolean;
    }
  ) {
    const category = options?.category ?? 'system';
    const priority = options?.priority ?? 'normal';

    if (!this.settings.enabled) return;

    if (!options?.ignoreCategoryFilter) {
      if (category === 'pace' && !this.settings.announcePace) return;
      if (category === 'milestone' && !this.settings.announceMilestones) return;
      if (category === 'combat_zone' && !this.settings.announceCombatZones) return;
    }

    const announcement: AudioAnnouncement = {
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      priority,
      text: phrase,
      timestamp: Date.now(),
      spoken: false,
    };

    if (!this.isSpeechSupported()) {
      // Still surface visual HUD caption even if browser lacks speechSynthesis
      this.recordAnnouncement(announcement);
      this.emit();
      return;
    }

    const shouldInterrupt =
      options?.interrupt === true ||
      priority === 'critical' ||
      (this.isSpeaking &&
        this.currentAnnouncement &&
        PRIORITY_WEIGHT[priority] > PRIORITY_WEIGHT[this.currentAnnouncement.priority]);

    if (shouldInterrupt) {
      this.clearFallbackTimer();
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      this.isSpeaking = false;
      this.currentAnnouncement = null;
      this.queue.unshift(announcement);
    } else {
      // Keep queue fresh (cap at 3 pending prompts, drop oldest low/normal prompt if full)
      if (this.queue.length >= 3) {
        const dropIdx = this.queue.findIndex((item) => item.priority === 'low' || item.priority === 'normal');
        if (dropIdx !== -1) {
          this.queue.splice(dropIdx, 1);
        } else {
          this.queue.shift();
        }
      }
      this.queue.push(announcement);
    }

    this.processQueue();
  }

  // Structured Prompt 1: Pace Announcement (Periodic, Drift Alert, or On-Demand)
  announcePaceUpdate(params: {
    currentPaceMinKm: number;
    targetPaceMinKm: number;
    speedKmh: number;
    totalDistanceMeters: number;
    elapsedSeconds: number;
    reason?: 'periodic' | 'drift_slow' | 'drift_fast' | 'manual';
  }) {
    const { currentPaceMinKm, targetPaceMinKm, speedKmh, reason = 'periodic' } = params;
    const paceSpoken = formatPaceForSpeech(currentPaceMinKm);
    const diff = currentPaceMinKm - targetPaceMinKm; // positive = slower than target

    let guidance = 'Ritmo excelente, exatamente dentro da meta.';
    if (diff > 0.45) {
      guidance = `Você está um pouco abaixo do alvo. Acelere a passada para buscar ${formatPaceForSpeech(targetPaceMinKm)}.`;
    } else if (diff < -0.45) {
      guidance = 'Ritmo forte acima da meta! Controle a respiração para sustentar a energia.';
    }

    let phrase = '';
    if (reason === 'drift_slow') {
      phrase = `Alerta de ritmo. Ritmo atual de ${paceSpoken}. Acelere o passo para retomar a zona alvo.`;
    } else if (reason === 'drift_fast') {
      phrase = `Ritmo muito forte, ${paceSpoken}, a ${speedKmh.toFixed(1).replace('.', ' vírgula ')} quilômetros por hora. Mantenha o controle.`;
    } else {
      phrase = `Atualização de ritmo: ${paceSpoken}, velocidade de ${speedKmh.toFixed(1).replace('.', ' vírgula ')} quilômetros por hora. ${guidance}`;
    }

    this.speakTacticalCoach(phrase, {
      category: 'pace',
      priority: reason === 'manual' ? 'high' : 'normal',
      interrupt: reason === 'manual',
      ignoreCategoryFilter: reason === 'manual',
    });
  }

  // Structured Prompt 2: Distance Milestone Announcement
  announceDistanceMilestone(params: {
    distanceMeters: number;
    targetDistanceMeters: number;
    currentPaceMinKm: number;
    elapsedSeconds: number;
    isHalfway?: boolean;
    isTargetReached?: boolean;
  }) {
    const { distanceMeters, currentPaceMinKm, elapsedSeconds, isHalfway, isTargetReached } = params;
    const distSpoken = formatDistanceForSpeech(distanceMeters);
    const paceSpoken = formatPaceForSpeech(currentPaceMinKm);
    const timeSpoken = formatDurationForSpeech(elapsedSeconds);

    let phrase = '';
    if (isTargetReached) {
      this.playLevelUpSound();
      phrase = `Meta da missão alcançada! Você completou ${distSpoken} em ${timeSpoken}, com ritmo médio de ${paceSpoken}. Excelente conquista!`;
    } else if (isHalfway) {
      this.playMilestoneSound();
      phrase = `Metade da missão concluída! ${distSpoken} percorridos em ${timeSpoken}. Ritmo atual: ${paceSpoken}. Continue firme!`;
    } else {
      this.playMilestoneSound();
      phrase = `Marco de ${distSpoken} alcançado! Tempo: ${timeSpoken}. Ritmo atual de ${paceSpoken}.`;
    }

    this.speakTacticalCoach(phrase, {
      category: 'milestone',
      priority: 'high',
    });
  }

  // On-demand distance & progress readout
  announceDistanceStatus(params: {
    totalDistanceMeters: number;
    targetDistanceMeters: number;
    currentPaceMinKm: number;
    elapsedSeconds: number;
  }) {
    const { totalDistanceMeters, targetDistanceMeters, currentPaceMinKm, elapsedSeconds } = params;
    const pct = Math.min(100, Math.round((totalDistanceMeters / Math.max(1, targetDistanceMeters)) * 100));
    const remaining = Math.max(0, targetDistanceMeters - totalDistanceMeters);
    const phrase =
      remaining > 0
        ? `Status da distância: ${formatDistanceForSpeech(totalDistanceMeters)} percorridos, ${pct} por cento da meta. Faltam ${formatDistanceForSpeech(remaining)}. Tempo de ${formatDurationForSpeech(elapsedSeconds)} e ritmo de ${formatPaceForSpeech(currentPaceMinKm)}.`
        : `Status da distância: ${formatDistanceForSpeech(totalDistanceMeters)} percorridos em ${formatDurationForSpeech(elapsedSeconds)}. Meta concluída!`;

    this.speakTacticalCoach(phrase, {
      category: 'milestone',
      priority: 'high',
      interrupt: true,
      ignoreCategoryFilter: true,
    });
  }

  // Structured Prompt 3: Combat Zone Alerts (Approaching, Entered, Cleared, Manual check)
  announceCombatZoneAlert(params: {
    phase: 'approaching' | 'entered' | 'cleared' | 'status';
    zoneTitle: string;
    distanceToStartMeters?: number;
    description?: string;
    manual?: boolean;
  }) {
    const { phase, zoneTitle, distanceToStartMeters, description, manual } = params;

    if (phase === 'approaching') {
      this.playRadarPingSound();
      const distText =
        distanceToStartMeters !== undefined
          ? `a ${Math.max(10, Math.round(distanceToStartMeters / 10) * 10)} metros à frente`
          : 'à frente';
      this.speakTacticalCoach(
        `Alerta tático! Aproximando-se da ${zoneTitle}, ${distText}. Prepare-se para acelerar!`,
        {
          category: 'combat_zone',
          priority: 'high',
          ignoreCategoryFilter: manual,
        }
      );
      return;
    }

    if (phase === 'entered') {
      this.playCombatZoneAlertSound();
      this.speakTacticalCoach(
        `Alerta de Zona de Combate! Você entrou na ${zoneTitle}. ${description || 'Acelere o ritmo ao máximo agora!'}`,
        {
          category: 'combat_zone',
          priority: 'critical',
          interrupt: true,
          ignoreCategoryFilter: manual,
        }
      );
      return;
    }

    if (phase === 'cleared') {
      this.playGhostOvertakeSound();
      this.speakTacticalCoach(
        `Zona de Combate dominada! Você superou a ${zoneTitle} com sucesso. Bônus de XP desbloqueado!`,
        {
          category: 'combat_zone',
          priority: 'high',
          ignoreCategoryFilter: manual,
        }
      );
      return;
    }

    // Manual status check
    this.playRadarPingSound();
    const distText =
      distanceToStartMeters !== undefined
        ? `${Math.max(10, Math.round(distanceToStartMeters / 10) * 10)} metros`
        : 'próxima';
    this.speakTacticalCoach(
      `Radar de Combate: ${zoneTitle} localizada a ${distText}. Mantenha o foco tático.`,
      {
        category: 'combat_zone',
        priority: 'high',
        interrupt: true,
        ignoreCategoryFilter: true,
      }
    );
  }

  // Subtle descending dual-tone chime for Auto-Pause
  playAutoPauseSound() {
    if (!this.settings.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [520, 340];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.14);

      gain.gain.setValueAtTime(0.14 * this.settings.volume, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.24);
    });
  }

  // Session lifecycle & interval phase announcements
  announceSessionEvent(
    event: 'start' | 'pause' | 'resume' | 'auto_pause' | 'auto_resume' | 'interval_change' | 'finish',
    details?: {
      codename?: string;
      phaseLabel?: string;
      targetPaceMinKm?: number;
      totalDistanceMeters?: number;
      stationarySeconds?: number;
    }
  ) {
    switch (event) {
      case 'start':
        this.playIntervalStartSound();
        this.speakTacticalCoach(
          `Missão iniciada: ${details?.codename || 'Treino Tático'}. ${
            details?.targetPaceMinKm
              ? `Ritmo alvo de ${formatPaceForSpeech(details.targetPaceMinKm)}.`
              : ''
          } Bom treino!`,
          { category: 'system', priority: 'high', interrupt: true }
        );
        break;
      case 'pause':
        this.speakTacticalCoach('Treino pausado. Respire fundo e recupere o fôlego.', {
          category: 'system',
          priority: 'high',
          interrupt: true,
        });
        break;
      case 'resume':
        this.playIntervalStartSound();
        this.speakTacticalCoach('Treino retomado. Volte ao ritmo da missão!', {
          category: 'system',
          priority: 'high',
          interrupt: true,
        });
        break;
      case 'auto_pause':
        this.playAutoPauseSound();
        this.speakTacticalCoach(
          `Pausa automática ativada. Você permaneceu parado por mais de ${
            details?.stationarySeconds || 30
          } segundos. O treino será retomado automaticamente assim que você voltar a se movimentar.`,
          {
            category: 'system',
            priority: 'critical',
            interrupt: true,
          }
        );
        break;
      case 'auto_resume':
        this.playIntervalStartSound();
        this.speakTacticalCoach(
          'Movimento detectado pelo GPS! Treino retomado automaticamente. Volte ao ritmo da missão!',
          {
            category: 'system',
            priority: 'high',
            interrupt: true,
          }
        );
        break;
      case 'interval_change':
        this.playIntervalStartSound();
        this.speakTacticalCoach(
          `Mudança de fase: ${details?.phaseLabel || 'Novo intervalo'}. ${
            details?.targetPaceMinKm
              ? `Ajuste para ${formatPaceForSpeech(details.targetPaceMinKm)}.`
              : ''
          }`,
          { category: 'pace', priority: 'high', interrupt: true }
        );
        break;
      case 'finish':
        this.stopAllSpeech();
        break;
    }
  }
}

export const tacticalAudio = new TacticalAudioEngine();
