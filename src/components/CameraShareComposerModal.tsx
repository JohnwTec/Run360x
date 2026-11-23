import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  ImagePlus,
  Loader2,
  LogIn,
  RefreshCw,
  Send,
  Sparkles,
  SwitchCamera,
  X,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CommunityHudAnchor,
  CommunityOverlayStyle,
  CommunityPost,
  CommunityPostMetrics,
  UserProfile,
  WorkoutStats,
} from '../types';
import {
  buildMetricsFromWorkout,
  COMMUNITY_BACKDROP_PRESETS,
  compressSourceToDataUrl,
  renderCompositeSharePng,
} from '../utils/communityMetrics';
import { getAgeCategoryFromAge, getAgeCategoryLabel, getGenderLabel } from '../data/rankingsData';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import { FloatingTelemetryOverlay } from './FloatingTelemetryOverlay';

interface CameraShareComposerModalProps {
  userProfile: UserProfile;
  firebaseUser: FirebaseUser | null;
  initialWorkout?: WorkoutStats | null;
  onClose: () => void;
  onPublished?: (post: CommunityPost) => void;
  theme?: 'dark' | 'light';
}

const VIBRANT_SUGGESTIONS: string[] = [
  'MISSÃO CUMPRIDA! ⚡',
  'DOMINEI O ASFALTO HOJE 🔥',
  'RITMO DE ELITE NO RADAR 🚀',
  'MAIS UMA CONQUISTA PRA CONTA 💪',
  'SUPEREI MEUS LIMITES! 🏆',
];

const OVERLAY_STYLES: { id: CommunityOverlayStyle; label: string }[] = [
  { id: 'neon', label: 'Neon' },
  { id: 'solar', label: 'Solar' },
  { id: 'emerald', label: 'Esmeralda' },
  { id: 'crystal', label: 'Cristal' },
];

const HUD_ANCHORS: { id: CommunityHudAnchor; label: string }[] = [
  { id: 'top', label: 'Topo' },
  { id: 'center', label: 'Centro' },
  { id: 'bottom', label: 'Base' },
];

export const CameraShareComposerModal: React.FC<CameraShareComposerModalProps> = ({
  userProfile,
  firebaseUser,
  initialWorkout = null,
  onClose,
  onPublished,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Workout source selector (initialWorkout + profile history)
  const workoutOptions = useMemo(() => {
    const list: WorkoutStats[] = [];
    if (initialWorkout) list.push(initialWorkout);
    for (const item of userProfile.history || []) {
      if (!list.some((existing) => existing.id === item.id)) {
        list.push(item);
      }
    }
    return list;
  }, [initialWorkout, userProfile.history]);

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(
    workoutOptions[0]?.id || 'profile-summary'
  );

  const activeMetrics: CommunityPostMetrics = useMemo(() => {
    const matched = workoutOptions.find((w) => w.id === selectedWorkoutId) || null;
    return buildMetricsFromWorkout(matched, userProfile);
  }, [workoutOptions, selectedWorkoutId, userProfile]);

  // Camera & capture state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'starting' | 'live' | 'captured' | 'unavailable'>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');

  // Overlay customization
  const [vibrantText, setVibrantText] = useState<string>('MISSÃO CUMPRIDA! ⚡');
  const [overlayStyle, setOverlayStyle] = useState<CommunityOverlayStyle>('neon');
  const [hudAnchor, setHudAnchor] = useState<CommunityHudAnchor>('bottom');

  // Publish & export state
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCameraStream();
      setCameraError(null);
      setCameraState('starting');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setCameraError('Câmera ao vivo indisponível neste navegador. Use a câmera nativa/galeria ou escolha um cenário.');
        setCapturedPhotoUrl(COMMUNITY_BACKDROP_PRESETS[0].src);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('live');
      } catch {
        setCameraState('unavailable');
        setCameraError(
          'Permissão de câmera não concedida ou dispositivo sem câmera ativa. Envie uma foto da câmera do celular/galeria ou use um cenário.'
        );
        setCapturedPhotoUrl((prev) => prev || COMMUNITY_BACKDROP_PRESETS[0].src);
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCameraStream();
    };
  }, [facingMode, startCamera, stopCameraStream]);

  const handleCaptureFromCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const compressed = compressSourceToDataUrl(video, 600, 800, facingMode === 'user');
    if (compressed) {
      setCapturedPhotoUrl(compressed);
      stopCameraStream();
      setCameraState('captured');
    }
  };

  const handleRetakePhoto = () => {
    setCapturedPhotoUrl('');
    startCamera(facingMode);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      const img = new Image();
      img.onload = () => {
        const compressed = compressSourceToDataUrl(img, 600, 800, false);
        if (compressed) {
          stopCameraStream();
          setCapturedPhotoUrl(compressed);
          setCameraState('captured');
          setCameraError(null);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetBackdrop = (src: string) => {
    stopCameraStream();
    setCapturedPhotoUrl(src);
    setCameraState('captured');
    setCameraError(null);
  };

  const resolveCurrentPhotoForExport = (): string => {
    if (cameraState === 'live' && videoRef.current && videoRef.current.videoWidth > 0) {
      const snap = compressSourceToDataUrl(videoRef.current, 600, 800, facingMode === 'user');
      if (snap) {
        setCapturedPhotoUrl(snap);
        stopCameraStream();
        setCameraState('captured');
        return snap;
      }
    }
    return capturedPhotoUrl || COMMUNITY_BACKDROP_PRESETS[0].src;
  };

  const handleDownloadComposite = async () => {
    setIsDownloading(true);
    setFeedbackError(null);
    try {
      const photoSrc = resolveCurrentPhotoForExport();
      const pngUrl = await renderCompositeSharePng({
        photoSrc,
        metrics: activeMetrics,
        vibrantText,
        authorName: userProfile.name || firebaseUser?.displayName || 'Atleta RUN360X',
        overlayStyle,
        hudAnchor,
      });
      if (pngUrl) {
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `RUN360X_Comunidade_${Date.now()}.png`;
        link.click();
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2600);
      }
    } catch {
      setFeedbackError('Não foi possível gerar a imagem para download.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSignInAndContinue = async () => {
    setIsSigningIn(true);
    setFeedbackError(null);
    try {
      await signInWithGoogle();
    } catch {
      setFeedbackError('Login com Google cancelado ou indisponível. Você ainda pode publicar localmente ou baixar a foto.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePublishPost = async (publishLocallyIfOffline = false) => {
    setIsPublishing(true);
    setFeedbackError(null);

    try {
      const photoSrc = resolveCurrentPhotoForExport();
      const safePhoto = photoSrc.length <= 255000 ? photoSrc : COMMUNITY_BACKDROP_PRESETS[0].src;

      const authorName = (
        userProfile.name?.trim() ||
        firebaseUser?.displayName?.trim() ||
        'Atleta RUN360X'
      ).slice(0, 80);

      const ageCategoryLabel = getAgeCategoryLabel(getAgeCategoryFromAge(userProfile.age)).slice(0, 40);
      const genderLabel = getGenderLabel(userProfile.gender || 'masculino').slice(0, 24);
      const cleanVibrantText = vibrantText.trim().slice(0, 120);
      const cleanTitle = (activeMetrics.achievementTitle || 'Treino Concluído').slice(0, 90);
      const safeRoute = (activeMetrics.routeLine || []).slice(0, 48).map((p) => String(p).slice(0, 24));

      if (firebaseUser && !publishLocallyIfOffline) {
        const postRef = doc(collection(db, 'communityPosts'));
        const payload = {
          authorId: firebaseUser.uid,
          authorName,
          authorAvatar: (firebaseUser.photoURL || (userProfile.gender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️')).slice(0, 300),
          authorLevel: Math.min(99, Math.max(1, Math.round(userProfile.level || 1))),
          ageCategoryLabel,
          genderLabel,
          achievementTitle: cleanTitle,
          vibrantText: cleanVibrantText,
          overlayStyle,
          hudAnchor,
          distanceKm: Number(Math.min(500, Math.max(0, activeMetrics.distanceKm)).toFixed(2)),
          avgPaceMinKm: Number(Math.min(30, Math.max(1.5, activeMetrics.avgPaceMinKm)).toFixed(2)),
          fastestKmPaceMinKm: Number(
            Math.min(30, Math.max(1.5, activeMetrics.fastestKmPaceMinKm)).toFixed(2)
          ),
          avgSpeedKmh: Number(Math.min(60, Math.max(0, activeMetrics.avgSpeedKmh)).toFixed(1)),
          durationSeconds: Math.min(86400, Math.max(0, Math.round(activeMetrics.durationSeconds))),
          xpGained: Math.min(100000, Math.max(0, Math.round(activeMetrics.xpGained))),
          routeLine: safeRoute,
          photoDataUrl: safePhoto,
          visibility: 'community' as const,
          kudosCount: 0,
          commentsCount: 0,
          createdAt: serverTimestamp(),
        };

        try {
          await setDoc(postRef, payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `communityPosts/${postRef.id}`);
        }

        const publishedPost: CommunityPost = {
          id: postRef.id,
          ...payload,
          createdAtIso: new Date().toISOString(),
        };
        if (onPublished) onPublished(publishedPost);
        onClose();
        return;
      }

      // Local community post fallback when user hasn't connected Google yet
      const localPost: CommunityPost = {
        id: `local-${Date.now()}`,
        authorId: 'local-athlete',
        authorName,
        authorAvatar: userProfile.gender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️',
        authorLevel: Math.min(99, Math.max(1, Math.round(userProfile.level || 1))),
        ageCategoryLabel,
        genderLabel,
        achievementTitle: cleanTitle,
        vibrantText: cleanVibrantText,
        overlayStyle,
        hudAnchor,
        distanceKm: activeMetrics.distanceKm,
        avgPaceMinKm: activeMetrics.avgPaceMinKm,
        fastestKmPaceMinKm: activeMetrics.fastestKmPaceMinKm,
        avgSpeedKmh: activeMetrics.avgSpeedKmh,
        durationSeconds: activeMetrics.durationSeconds,
        xpGained: activeMetrics.xpGained,
        routeLine: safeRoute,
        photoDataUrl: safePhoto,
        visibility: 'community',
        kudosCount: 0,
        commentsCount: 0,
        createdAtIso: new Date().toISOString(),
        isLocalOnly: true,
      };
      if (onPublished) onPublished(localPost);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao publicar na comunidade.';
      setFeedbackError(
        msg.includes('permission')
          ? 'Permissão negada ao sincronizar. Verifique seu login Google ou publique localmente.'
          : 'Não foi possível concluir a publicação agora. Tente novamente.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl border shadow-2xl ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {/* Top Modal Bar */}
        <div
          className={`sticky top-0 z-20 px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 backdrop-blur-md ${
            isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-950/95 border-slate-800'
          }`}
        >
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold tracking-tight truncate">
              Compartilhar Conquista com Câmera
            </h3>
            <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Métricas e mini mapa do percurso flutuam ao vivo sobre a sua foto
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar câmera de compartilhamento"
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Responsive Layout: Left = Live Camera / Photo Canvas, Right = Controls */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 3:4 Camera Viewfinder & Floating Telemetry Overlay (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative w-full max-w-[420px] mx-auto aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-xl">
              {/* Live Camera Video Feed */}
              {cameraState === 'live' || cameraState === 'starting' ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
              ) : (
                <img
                  src={capturedPhotoUrl || COMMUNITY_BACKDROP_PRESETS[0].src}
                  alt="Foto capturada da corrida com métricas flutuantes"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Loading Camera Overlay */}
              {cameraState === 'starting' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                  <span className="text-xs font-mono">Abrindo câmera do dispositivo...</span>
                </div>
              )}

              {/* Live Floating Telemetry HUD + Mini Route Map Line + Vibrant Short Text */}
              <FloatingTelemetryOverlay
                metrics={activeMetrics}
                vibrantText={vibrantText}
                overlayStyle={overlayStyle}
                hudAnchor={hudAnchor}
                authorName={userProfile.name || firebaseUser?.displayName || 'Atleta RUN360X'}
              />

              {/* Top-Right Camera Quick Controls when Live */}
              {cameraState === 'live' && (
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  aria-label="Alternar câmera frontal e traseira"
                  className="absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/25 backdrop-blur-md flex items-center justify-center transition cursor-pointer"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Camera Shutter & Capture Controls (Thumb-Friendly >= 48px) */}
            <div className="max-w-[420px] mx-auto flex flex-wrap items-center justify-center gap-2.5">
              {cameraState === 'live' ? (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureFromCamera}
                    className={`flex-1 min-h-[52px] px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                      isLight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    <span>Tirar Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                    className={`min-h-[52px] px-4 py-3 rounded-2xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                    }`}
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span>Virar</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleRetakePhoto}
                  className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Abrir Câmera Ao Vivo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-cyan-300'
                }`}
              >
                <ImagePlus className="w-4 h-4" />
                <span>Câmera / Galeria</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {cameraError && (
              <p className="max-w-[420px] mx-auto text-xs text-amber-400 text-center leading-relaxed">
                {cameraError}
              </p>
            )}

            {/* Quick Running Backdrops if user prefers or has no webcam */}
            <div className="max-w-[420px] mx-auto pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Ou teste com um cenário de corrida
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {COMMUNITY_BACKDROP_PRESETS.map((preset) => {
                  const isActive = cameraState !== 'live' && capturedPhotoUrl === preset.src;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetBackdrop(preset.src)}
                      className={`relative h-16 rounded-xl overflow-hidden border transition cursor-pointer ${
                        isActive
                          ? isLight
                            ? 'border-orange-500 ring-2 ring-orange-400/50'
                            : 'border-cyan-400 ring-2 ring-cyan-400/40'
                          : 'border-slate-700/60 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.src}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 text-[10px] font-medium text-white py-0.5 px-1 truncate">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Vibrant Text, Metrics Source, Floating Style & Publish (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {/* Workout / Achievement Source Picker */}
            {workoutOptions.length > 0 && (
              <div className="space-y-1.5">
                <label
                  htmlFor="workout-source-select"
                  className={`text-xs font-semibold block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
                >
                  Exercício / Conquista para as métricas flutuantes
                </label>
                <select
                  id="workout-source-select"
                  value={selectedWorkoutId}
                  onChange={(e) => setSelectedWorkoutId(e.target.value)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                      : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                  }`}
                >
                  {workoutOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.workoutTitle} · {(w.totalDistanceMeters / 1000).toFixed(2)} km ({w.date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Short Vibrant Text Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="vibrant-caption-input"
                  className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
                >
                  Texto curto e vibrante sobre a foto
                </label>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {vibrantText.length}/120
                </span>
              </div>

              <input
                id="vibrant-caption-input"
                type="text"
                maxLength={120}
                value={vibrantText}
                onChange={(e) => setVibrantText(e.target.value)}
                placeholder="Ex: Novo recorde pessoal no parque! ⚡"
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none transition ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500 focus:bg-white'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400'
                }`}
              />

              {/* 1-Tap Energetic Phrase Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {VIBRANT_SUGGESTIONS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setVibrantText(phrase)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      vibrantText === phrase
                        ? isLight
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* Floating Object Style & Position Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className={`text-xs font-semibold block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Estilo do objeto flutuante
                </span>
                <div
                  className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  {OVERLAY_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOverlayStyle(st.id)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        overlayStyle === st.id
                          ? isLight
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-cyan-400 text-slate-950 shadow-sm'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className={`text-xs font-semibold block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Posição sobre a foto
                </span>
                <div
                  className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  {HUD_ANCHORS.map((anchor) => (
                    <button
                      key={anchor.id}
                      type="button"
                      onClick={() => setHudAnchor(anchor.id)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        hudAnchor === anchor.id
                          ? isLight
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-950'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {anchor.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Metrics Summary Strip */}
            <div
              className={`p-3.5 rounded-2xl border text-xs font-mono tabular-nums space-y-1 ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="font-semibold text-[11px] text-slate-400">
                Métricas incluídas no card flutuante
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{activeMetrics.distanceKm.toFixed(2)} km</span>
                <span aria-hidden="true">·</span>
                <span>Vel. média {activeMetrics.avgSpeedKmh.toFixed(1)} km/h</span>
                <span aria-hidden="true">·</span>
                <span>Linha de percurso ({activeMetrics.routeLine.length} pts GPS)</span>
              </div>
            </div>

            {feedbackError && (
              <p className="text-xs text-rose-400 font-medium leading-relaxed">{feedbackError}</p>
            )}

            {/* Publish & Download Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              {firebaseUser ? (
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => handlePublishPost(false)}
                  className={`w-full min-h-[52px] px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg disabled:opacity-60 ${
                    isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950'
                  }`}
                >
                  {isPublishing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span>{isPublishing ? 'Publicando na Comunidade...' : 'Publicar na Comunidade Interna'}</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={handleSignInAndContinue}
                    className={`w-full min-h-[50px] px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg disabled:opacity-60 ${
                      isLight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950'
                    }`}
                  >
                    {isSigningIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    <span>Conectar com Google para Publicar Ao Vivo</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => handlePublishPost(true)}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Publicar no Meu Feed Local (Sem Login)</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={isDownloading}
                onClick={handleDownloadComposite}
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                {downloaded ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{downloaded ? 'Foto HD Salva!' : 'Baixar Foto com Métricas (.PNG HD)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraShareComposerModal;
