import React, { ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Flame,
  Heart,
  Loader2,
  LogIn,
  LogOut,
  MessageCircle,
  Send,
  Shield,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { CommunityComment, CommunityPost, UserProfile, WorkoutStats } from '../types';
import {
  COMMUNITY_BACKDROP_PRESETS,
  renderCompositeSharePng,
  ROUTE_PRESETS,
} from '../utils/communityMetrics';
import {
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutFromGoogle,
} from '../firebase';
import { FloatingTelemetryOverlay } from './FloatingTelemetryOverlay';
import { CameraShareComposerModal } from './CameraShareComposerModal';
import { CommunityTeamsSection } from './CommunityTeamsSection';
import { TeamRankingPanel } from './TeamRankingPanel';
import { UseCommunityTeamsResult } from '../utils/teamsStore';

export type CommunitySubTab = 'feed' | 'equipes' | 'ranking-equipes';

interface CommunityViewProps {
  userProfile: UserProfile;
  firebaseUser: FirebaseUser | null;
  teamsStore: UseCommunityTeamsResult;
  initialWorkoutToShare?: WorkoutStats | null;
  autoOpenCamera?: boolean;
  onClearAutoOpen?: () => void;
  initialSubTab?: CommunitySubTab;
  autoOpenCreateTeam?: boolean;
  onClearAutoOpenCreateTeam?: () => void;
  inspectTeamId?: string | null;
  onClearInspectTeamId?: () => void;
  theme?: 'dark' | 'light';
}

type FeedFilter = 'todos' | 'meus' | 'rapidos' | 'longos';

const LOCAL_POSTS_STORAGE_KEY = 'run360x_community_local_posts_v1';

// Starter showcase posts so the community tab is rich even before first cloud sync
const SHOWCASE_POSTS: CommunityPost[] = [
  {
    id: 'showcase-sunrise-1',
    authorId: 'showcase-marina',
    authorName: 'Marina Costa',
    authorAvatar: '🏃‍♀️',
    authorLevel: 4,
    ageCategoryLabel: '21 à 30 anos',
    genderLabel: 'Feminino',
    achievementTitle: 'Sub-25 nos 5K Matinais',
    vibrantText: 'AMANHECER DE RECORDE NO PARQUE! ⚡',
    overlayStyle: 'solar',
    hudAnchor: 'bottom',
    distanceKm: 6.45,
    avgPaceMinKm: 4.58,
    fastestKmPaceMinKm: 4.18,
    avgSpeedKmh: 13.1,
    durationSeconds: 1772,
    xpGained: 460,
    routeLine: ROUTE_PRESETS.parkCircuit,
    photoDataUrl: COMMUNITY_BACKDROP_PRESETS[0].src,
    visibility: 'community',
    kudosCount: 24,
    commentsCount: 2,
    createdAtIso: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    isLocalOnly: true,
  },
  {
    id: 'showcase-night-2',
    authorId: 'showcase-rafael',
    authorName: 'Rafael Mendes',
    authorAvatar: '🏃‍♂️',
    authorLevel: 5,
    ageCategoryLabel: '31 à 40 anos',
    genderLabel: 'Masculino',
    achievementTitle: 'Intervalado Noturno 10K',
    vibrantText: 'DOMINEI O ASFALTO NA CHUVA LEVE 🔥',
    overlayStyle: 'neon',
    hudAnchor: 'bottom',
    distanceKm: 10.12,
    avgPaceMinKm: 4.35,
    fastestKmPaceMinKm: 3.55,
    avgSpeedKmh: 13.8,
    durationSeconds: 2641,
    xpGained: 720,
    routeLine: ROUTE_PRESETS.urbanLoop,
    photoDataUrl: COMMUNITY_BACKDROP_PRESETS[1].src,
    visibility: 'community',
    kudosCount: 38,
    commentsCount: 3,
    createdAtIso: new Date(Date.now() - 1000 * 60 * 185).toISOString(),
    isLocalOnly: true,
  },
  {
    id: 'showcase-coastal-3',
    authorId: 'showcase-camila',
    authorName: 'Camila Duarte',
    authorAvatar: '🏃‍♀️',
    authorLevel: 3,
    ageCategoryLabel: '41 à 50 anos',
    genderLabel: 'Feminino',
    achievementTitle: 'Longão da Orla 12K',
    vibrantText: 'BRISA DO MAR E RITMO CONSTANTE 🚀',
    overlayStyle: 'emerald',
    hudAnchor: 'bottom',
    distanceKm: 12.04,
    avgPaceMinKm: 5.12,
    fastestKmPaceMinKm: 4.42,
    avgSpeedKmh: 11.7,
    durationSeconds: 3698,
    xpGained: 610,
    routeLine: ROUTE_PRESETS.coastalSprint,
    photoDataUrl: COMMUNITY_BACKDROP_PRESETS[2].src,
    visibility: 'community',
    kudosCount: 19,
    commentsCount: 1,
    createdAtIso: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    isLocalOnly: true,
  },
];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

// Local React ErrorBoundary protecting Firestore realtime views
interface BoundaryProps {
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}
class CommunityErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  declare props: Readonly<BoundaryProps>;
  declare setState: (state: Partial<BoundaryState>) => void;
  state: BoundaryState;

  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na Comunidade:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border border-rose-500/40 bg-rose-950/20 text-center space-y-3">
          <p className="text-sm font-semibold text-rose-300">
            Não foi possível sincronizar o feed ao vivo da comunidade neste momento.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CommunityFeedInner: React.FC<CommunityViewProps> = ({
  userProfile,
  firebaseUser,
  teamsStore,
  initialWorkoutToShare = null,
  autoOpenCamera = false,
  onClearAutoOpen,
  initialSubTab = 'feed',
  autoOpenCreateTeam = false,
  onClearAutoOpenCreateTeam,
  inspectTeamId = null,
  onClearInspectTeamId,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [subTab, setSubTab] = useState<CommunitySubTab>(inspectTeamId ? 'equipes' : initialSubTab);
  const [openCreateTeamTrigger, setOpenCreateTeamTrigger] = useState<boolean>(autoOpenCreateTeam);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(inspectTeamId);
  const [filter, setFilter] = useState<FeedFilter>('todos');
  const [cloudPosts, setCloudPosts] = useState<CommunityPost[]>([]);
  const [localPosts, setLocalPosts] = useState<CommunityPost[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_POSTS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CommunityPost[]) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Camera composer state
  const [showCameraModal, setShowCameraModal] = useState<boolean>(autoOpenCamera);

  // Kudos & Comments per post
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [localKudosBoost, setLocalKudosBoost] = useState<Record<string, number>>({});
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({});
  const [commentDraft, setCommentDraft] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [downloadingPostId, setDownloadingPostId] = useState<string | null>(null);
  const [downloadedPostId, setDownloadedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenCamera) {
      setSubTab('feed');
      setShowCameraModal(true);
      if (onClearAutoOpen) onClearAutoOpen();
    }
  }, [autoOpenCamera, onClearAutoOpen]);

  useEffect(() => {
    if (autoOpenCreateTeam) {
      setSubTab('equipes');
      setOpenCreateTeamTrigger(true);
      if (onClearAutoOpenCreateTeam) onClearAutoOpenCreateTeam();
    }
  }, [autoOpenCreateTeam, onClearAutoOpenCreateTeam]);

  useEffect(() => {
    if (inspectTeamId) {
      setSubTab('equipes');
      setTargetTeamId(inspectTeamId);
      if (onClearInspectTeamId) onClearInspectTeamId();
    }
  }, [inspectTeamId, onClearInspectTeamId]);

  // Real-time Firestore listener for interconnected community posts (strictly when authenticated)
  useEffect(() => {
    if (!firebaseUser) {
      setCloudPosts([]);
      setIsLoadingCloud(false);
      return;
    }

    setIsLoadingCloud(true);
    setSyncNotice(null);

    const postsQuery = query(
      collection(db, 'communityPosts'),
      where('visibility', '==', 'community'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const items: CommunityPost[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdTs = data.createdAt as Timestamp | undefined;
          const createdAtIso = createdTs?.toDate ? createdTs.toDate().toISOString() : new Date().toISOString();

          return {
            id: docSnap.id,
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || 'Atleta'),
            authorAvatar: String(data.authorAvatar || '🏃'),
            authorLevel: Number(data.authorLevel || 1),
            ageCategoryLabel: String(data.ageCategoryLabel || '21 à 30 anos'),
            genderLabel: String(data.genderLabel || 'Masculino'),
            achievementTitle: String(data.achievementTitle || 'Treino Concluído'),
            vibrantText: String(data.vibrantText || ''),
            overlayStyle: data.overlayStyle || 'neon',
            hudAnchor: data.hudAnchor || 'bottom',
            distanceKm: Number(data.distanceKm || 0),
            avgPaceMinKm: Number(data.avgPaceMinKm || 5.3),
            fastestKmPaceMinKm: Number(data.fastestKmPaceMinKm || 4.5),
            avgSpeedKmh: Number(data.avgSpeedKmh || 11.2),
            durationSeconds: Number(data.durationSeconds || 1800),
            xpGained: Number(data.xpGained || 0),
            routeLine: Array.isArray(data.routeLine) ? data.routeLine : ROUTE_PRESETS.urbanLoop,
            photoDataUrl: String(data.photoDataUrl || COMMUNITY_BACKDROP_PRESETS[0].src),
            visibility: 'community',
            kudosCount: Number(data.kudosCount || 0),
            commentsCount: Number(data.commentsCount || 0),
            createdAtIso,
            isLocalOnly: false,
          };
        });

        items.sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());
        setCloudPosts(items);
        setIsLoadingCloud(false);
      },
      (error) => {
        setIsLoadingCloud(false);
        setSyncNotice('Não foi possível ler o feed em nuvem. Verifique sua conexão.');
        try {
          handleFirestoreError(error, OperationType.LIST, 'communityPosts');
        } catch {
          // Handled gracefully in UI state
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  // Listen to comments for the currently expanded cloud post
  useEffect(() => {
    if (!firebaseUser || !expandedCommentsPostId) return;
    const isCloudPost = cloudPosts.some((p) => p.id === expandedCommentsPostId);
    if (!isCloudPost) return;

    const commentsPath = `communityPosts/${expandedCommentsPostId}/comments`;
    const commentsQuery = query(
      collection(db, 'communityPosts', expandedCommentsPostId, 'comments'),
      where('postId', '==', expandedCommentsPostId),
      limit(40)
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snap) => {
        const list: CommunityComment[] = snap.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt as Timestamp | undefined;
          return {
            id: d.id,
            postId: String(data.postId || expandedCommentsPostId),
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || 'Atleta'),
            text: String(data.text || ''),
            createdAtIso: ts?.toDate ? ts.toDate().toISOString() : new Date().toISOString(),
          };
        });
        list.sort((a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime());
        setCommentsByPost((prev) => ({ ...prev, [expandedCommentsPostId]: list }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, commentsPath);
        } catch {
          // Logged via structured handler
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, expandedCommentsPostId, cloudPosts]);

  // Combine live cloud posts + local posts + showcase inspiration
  const combinedPosts = useMemo(() => {
    const merged = [...cloudPosts, ...localPosts, ...SHOWCASE_POSTS];
    const seen = new Set<string>();
    const unique: CommunityPost[] = [];
    for (const p of merged) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }

    if (filter === 'meus') {
      return unique.filter(
        (p) =>
          (firebaseUser && p.authorId === firebaseUser.uid) ||
          p.authorId === 'local-athlete'
      );
    }
    if (filter === 'rapidos') {
      return [...unique].sort((a, b) => a.fastestKmPaceMinKm - b.fastestKmPaceMinKm);
    }
    if (filter === 'longos') {
      return [...unique].sort((a, b) => b.distanceKm - a.distanceKm);
    }
    return unique;
  }, [cloudPosts, localPosts, filter, firebaseUser]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSyncNotice(null);
    try {
      await signInWithGoogle();
    } catch {
      setSyncNotice('Login Google cancelado ou bloqueado pelo navegador.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePublishedPost = (post: CommunityPost) => {
    if (post.isLocalOnly) {
      setLocalPosts((prev) => {
        const next = [post, ...prev].slice(0, 20);
        try {
          localStorage.setItem(LOCAL_POSTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    }
    setFilter('todos');
  };

  const handleToggleKudo = async (post: CommunityPost) => {
    const alreadyLiked = likedPostIds.has(post.id);

    // Local / showcase posts toggle immediately in memory
    if (post.isLocalOnly || !firebaseUser) {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setLocalKudosBoost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || 0) + (alreadyLiked ? -1 : 1),
      }));
      return;
    }

    // Cloud post: atomic batch write matching hardened firestore.rules Pillar 7
    const postRef = doc(db, 'communityPosts', post.id);
    const kudoRef = doc(db, 'communityPosts', post.id, 'kudos', firebaseUser.uid);

    try {
      const batch = writeBatch(db);
      if (alreadyLiked) {
        batch.delete(kudoRef);
        batch.update(postRef, { kudosCount: Math.max(0, post.kudosCount - 1) });
      } else {
        batch.set(kudoRef, {
          postId: post.id,
          userId: firebaseUser.uid,
          userName: (userProfile.name || firebaseUser.displayName || 'Atleta').slice(0, 80),
          createdAt: serverTimestamp(),
        });
        batch.update(postRef, { kudosCount: post.kudosCount + 1 });
      }
      await batch.commit();

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `communityPosts/${post.id}/kudos`);
      } catch {
        setSyncNotice('Não foi possível registrar o aplauso agora.');
      }
    }
  };

  const handleAddComment = async (post: CommunityPost) => {
    const trimmed = commentDraft.trim().slice(0, 240);
    if (!trimmed) return;

    const authorName = (userProfile.name || firebaseUser?.displayName || 'Atleta').slice(0, 80);

    if (post.isLocalOnly || !firebaseUser) {
      const newLocalComment: CommunityComment = {
        id: `c-${Date.now()}`,
        postId: post.id,
        authorId: firebaseUser?.uid || 'local-athlete',
        authorName,
        text: trimmed,
        createdAtIso: new Date().toISOString(),
      };
      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: [...(prev[post.id] || []), newLocalComment],
      }));
      setCommentDraft('');
      return;
    }

    setIsSubmittingComment(true);
    try {
      const batch = writeBatch(db);
      const commentRef = doc(collection(db, 'communityPosts', post.id, 'comments'));
      const postRef = doc(db, 'communityPosts', post.id);

      batch.set(commentRef, {
        postId: post.id,
        authorId: firebaseUser.uid,
        authorName,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, { commentsCount: post.commentsCount + 1 });
      await batch.commit();
      setCommentDraft('');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `communityPosts/${post.id}/comments`);
      } catch {
        setSyncNotice('Não foi possível enviar o comentário.');
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeletePost = async (post: CommunityPost) => {
    if (post.isLocalOnly) {
      setLocalPosts((prev) => {
        const next = prev.filter((item) => item.id !== post.id);
        try {
          localStorage.setItem(LOCAL_POSTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      return;
    }

    if (!firebaseUser || post.authorId !== firebaseUser.uid) return;
    try {
      await deleteDoc(doc(db, 'communityPosts', post.id));
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `communityPosts/${post.id}`);
      } catch {
        setSyncNotice('Não foi possível excluir a publicação.');
      }
    }
  };

  const handleDownloadPostImage = async (post: CommunityPost) => {
    setDownloadingPostId(post.id);
    try {
      const pngUrl = await renderCompositeSharePng({
        photoSrc: post.photoDataUrl,
        metrics: post,
        vibrantText: post.vibrantText,
        authorName: post.authorName,
        overlayStyle: post.overlayStyle,
        hudAnchor: post.hudAnchor,
      });
      if (pngUrl) {
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `RUN360X_${post.authorName.replace(/\s+/g, '_')}_${Date.now()}.png`;
        link.click();
        setDownloadedPostId(post.id);
        setTimeout(() => setDownloadedPostId(null), 2400);
      }
    } finally {
      setDownloadingPostId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Community Header & Primary Camera Share CTA */}
      <section
        className={`rounded-3xl border p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Comunidade Interna RUN360X</span>
            <span aria-hidden="true">·</span>
            <span>{firebaseUser ? 'Sincronizado Ao Vivo' : 'Modo Visualização'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{combinedPosts.length} conquistas no feed</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
            Compartilhe Suas Conquistas com a Câmera
          </h2>

          <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Tire uma foto ao vivo com suas métricas flutuantes — quilometragem, pace/km, km mais rápido, velocidade média e mini mapa de percurso — e conecte-se com outros corredores do clube.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCameraModal(true)}
            className={`min-h-[48px] px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-lg whitespace-nowrap ${
              isLight
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span>Postar com Câmera</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTab('equipes');
              setOpenCreateTeamTrigger(true);
            }}
            className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                : 'bg-slate-950 hover:bg-slate-800 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Criar Equipe</span>
          </button>

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => signOutFromGoogle()}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-semibold border flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={`Conectado como ${firebaseUser.email || firebaseUser.displayName}`}
            >
              <LogOut className="w-4 h-4" />
              <span>{firebaseUser.displayName?.split(' ')[0] || 'Sair'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  : 'bg-slate-950 hover:bg-slate-800 border-cyan-500/40 text-cyan-300'
              }`}
            >
              {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Conectar com Google</span>
            </button>
          )}
        </div>
      </section>

      {/* Community Area Switcher: Feed | Equipes | Ranking de Equipes */}
      <div
        className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}
      >
        {(
          [
            { id: 'feed', label: `Feed de Conquistas (${combinedPosts.length})`, icon: <Camera className="w-4 h-4" /> },
            { id: 'equipes', label: `Equipes (${teamsStore.teams.length})`, icon: <Shield className="w-4 h-4" /> },
            { id: 'ranking-equipes', label: 'Ranking de Equipes', icon: <Trophy className="w-4 h-4" /> },
          ] as { id: CommunitySubTab; label: string; icon: React.ReactNode }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              subTab === tab.id
                ? isLight
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-cyan-400 text-slate-950'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {syncNotice && (
        <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-300">
          {syncNotice}
        </div>
      )}

      {subTab === 'equipes' && (
        <CommunityTeamsSection
          teams={teamsStore.teams}
          isMutating={teamsStore.isMutating}
          errorMessage={teamsStore.errorMessage}
          onClearError={teamsStore.clearError}
          isTeamCreator={teamsStore.isTeamCreator}
          onCreateTeam={teamsStore.createTeam}
          onAddMember={teamsStore.addMemberToTeam}
          onRemoveMember={teamsStore.removeMemberFromTeam}
          onDeleteTeam={teamsStore.deleteTeam}
          creatorDisplayName={userProfile.name?.trim() || firebaseUser?.displayName || 'Atleta RUN360X'}
          externalOpenCreate={openCreateTeamTrigger}
          onClearExternalOpenCreate={() => setOpenCreateTeamTrigger(false)}
          externalInspectTeamId={targetTeamId}
          onClearExternalInspectTeamId={() => setTargetTeamId(null)}
          theme={theme}
        />
      )}

      {subTab === 'ranking-equipes' && (
        <TeamRankingPanel
          teams={teamsStore.teams}
          isTeamCreator={teamsStore.isTeamCreator}
          onOpenCreateTeam={() => {
            setSubTab('equipes');
            setOpenCreateTeamTrigger(true);
          }}
          onManageTeam={(team) => {
            setSubTab('equipes');
            setTargetTeamId(team.id);
          }}
          theme={theme}
        />
      )}

      {/* Segmented Feed Filter Controls */}
      {subTab === 'feed' && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-xl border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          {(
            [
              { id: 'todos', label: 'Recentes' },
              { id: 'meus', label: 'Meus Posts' },
              { id: 'rapidos', label: 'Km Mais Rápido' },
              { id: 'longos', label: 'Maiores Distâncias' },
            ] as { id: FeedFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                filter === item.id
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-cyan-400 text-slate-950 shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoadingCloud && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Atualizando feed da comunidade...</span>
          </div>
        )}
      </div>

      {/* Interconnected Community Feed Grid */}
      {combinedPosts.length === 0 ? (
        <div
          className={`rounded-3xl border p-10 text-center space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <p className="text-base font-bold">Você ainda não publicou nenhuma conquista aqui.</p>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Abra a câmera, posicione suas métricas e linha do trajeto sobre a foto e compartilhe com a comunidade.
          </p>
          <button
            type="button"
            onClick={() => setShowCameraModal(true)}
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Fazer Primeiro Compartilhamento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {combinedPosts.map((post) => {
            const isLiked = likedPostIds.has(post.id);
            const displayKudos = Math.max(0, post.kudosCount + (localKudosBoost[post.id] || 0));
            const postComments = commentsByPost[post.id] || [];
            const displayCommentsCount = Math.max(post.commentsCount, postComments.length);
            const isCommentsOpen = expandedCommentsPostId === post.id;
            const canDelete =
              (post.isLocalOnly && post.authorId === 'local-athlete') ||
              (!post.isLocalOnly && firebaseUser?.uid === post.authorId);

            return (
              <article
                key={post.id}
                className={`rounded-3xl border overflow-hidden transition ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Clean Editorial Post Header (Zero-Pill Metadata) */}
                <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {post.authorAvatar.startsWith('http') ? (
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                          isLight ? 'bg-slate-100' : 'bg-slate-800'
                        }`}
                      >
                        {post.authorAvatar || '🏃'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">{post.authorName}</h3>
                      <div
                        className={`flex flex-wrap items-center gap-1.5 text-xs ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        <span>{post.ageCategoryLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{post.genderLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(post.createdAtIso)}</span>
                      </div>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post)}
                      aria-label="Excluir publicação"
                      className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition cursor-pointer ${
                        isLight
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/40'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 3:4 Photo Frame with Floating Telemetry Overlay & Mini Route Map */}
                <div className="relative aspect-[3/4] w-full bg-slate-950 overflow-hidden">
                  <img
                    src={post.photoDataUrl}
                    alt={`${post.authorName} - ${post.achievementTitle}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <FloatingTelemetryOverlay
                    metrics={post}
                    vibrantText={post.vibrantText}
                    overlayStyle={post.overlayStyle}
                    hudAnchor={post.hudAnchor}
                    authorName={post.authorName}
                    compact
                  />
                </div>

                {/* Social Interaction Footer: Kudos, Comments, Download */}
                <div className="px-4 sm:px-5 py-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleKudo(post)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer tabular-nums ${
                          isLiked
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        {isLiked ? (
                          <Flame className="w-4 h-4 text-rose-400 fill-current" />
                        ) : (
                          <Heart className="w-4 h-4" />
                        )}
                        <span>{displayKudos}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCommentsPostId((prev) => (prev === post.id ? null : post.id))
                        }
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer tabular-nums ${
                          isCommentsOpen
                            ? isLight
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-cyan-500/20 text-cyan-300'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{displayCommentsCount}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={downloadingPostId === post.id}
                      onClick={() => handleDownloadPostImage(post)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {downloadedPostId === post.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : downloadingPostId === post.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Salvar PNG</span>
                    </button>
                  </div>

                  {/* Expandable Comments Thread */}
                  {isCommentsOpen && (
                    <div
                      className={`pt-3 border-t space-y-3 ${
                        isLight ? 'border-slate-200' : 'border-slate-800'
                      }`}
                    >
                      {postComments.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          Seja o primeiro a incentivar essa conquista!
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                          {postComments.map((comment) => (
                            <div key={comment.id} className="text-xs leading-relaxed">
                              <span className="font-bold mr-1.5">{comment.authorName}</span>
                              <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                                {comment.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddComment(post);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          maxLength={240}
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Escreva uma mensagem de incentivo..."
                          className={`flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs focus:outline-none ${
                            isLight
                              ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                              : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingComment || !commentDraft.trim()}
                          aria-label="Enviar comentário"
                          className={`min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                            isLight
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          }`}
                        >
                          {isSubmittingComment ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Camera + Floating Telemetry Composer Modal */}
      {showCameraModal && (
        <CameraShareComposerModal
          userProfile={userProfile}
          firebaseUser={firebaseUser}
          initialWorkout={initialWorkoutToShare}
          onClose={() => setShowCameraModal(false)}
          onPublished={handlePublishedPost}
          theme={theme}
        />
      )}
    </div>
  );
};

export const CommunityView: React.FC<CommunityViewProps> = (props) => (
  <CommunityErrorBoundary>
    <CommunityFeedInner {...props} />
  </CommunityErrorBoundary>
);

export default CommunityView;
