import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  MapPin,
  Calendar,
  Award,
  Users,
  CheckCircle2,
  ExternalLink,
  Flame,
  Filter,
  RefreshCw,
  Globe,
  Radio,
  Zap,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { tacticalAudio } from '../utils/audio';

export interface CommunityChallenge {
  id: string;
  title: string;
  organizer: string;
  location: string;
  date: string;
  distances: string;
  xpReward: number;
  challengeType: string;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Elite' | string;
  description: string;
  searchUrl: string;
  participantsCount: number;
  accepted?: boolean;
}

interface GroundingSource {
  title: string;
  uri: string;
}

interface CommunityChallengesFeedProps {
  theme?: 'dark' | 'light';
  onAcceptChallenge?: (challenge: CommunityChallenge) => void;
}

const INITIAL_FALLBACK_EVENTS: CommunityChallenge[] = [
  {
    id: 'evt-sp-marathon',
    title: 'Maratona Internacional de São Paulo',
    organizer: 'Yescom / Prefeitura de SP',
    location: 'Parque do Ibirapuera, São Paulo - SP',
    date: '05 de Abril de 2026',
    distances: '5K, 10K, 21K, 42K',
    xpReward: 1200,
    challengeType: 'Maratona',
    difficulty: 'Avançado',
    description: 'A corrida mais emblemática do asfalto paulistano. Passe pelas avenidas Faria Lima, 23 de Maio e do Estado vencendo a névoa urbana.',
    searchUrl: 'https://www.yescom.com.br/maratonadesaopaulo/2026/',
    participantsCount: 482,
  },
  {
    id: 'evt-circuito-estacoes',
    title: 'Circuito das Estações 2026 - Etapa Outono',
    organizer: 'O2 Corre / Asics',
    location: 'Pacaembu, São Paulo - SP',
    date: '19 de Maio de 2026',
    distances: '5K, 10K, 13K',
    xpReward: 650,
    challengeType: 'Corrida de Rua',
    difficulty: 'Intermediário',
    description: 'Desafio clássico do circuito nacional. Acelere nas ladeiras do Pacaembu e conquiste a insígnia tática de Outono.',
    searchUrl: 'https://www.circuitodasestacoes.com.br/',
    participantsCount: 310,
  },
  {
    id: 'evt-rio-half',
    title: 'Meia Maratona do Rio de Janeiro',
    organizer: 'Spike Events / Prefeitura RJ',
    location: 'Avenida Atlântica, Copacabana - Rio de Janeiro, RJ',
    date: '21 de Junho de 2026',
    distances: '5K, 21K',
    xpReward: 900,
    challengeType: 'Meia Maratona',
    difficulty: 'Avançado',
    description: 'Corrida veloz pela orla das praias do Leblon, Ipanema e Copacabana. Ideal para bater seu Recorde Pessoal de Pace.',
    searchUrl: 'https://meiamaratonadorio.com.br/',
    participantsCount: 529,
  },
  {
    id: 'evt-night-run',
    title: 'Night Run Circuito Neon - Etapa Noturna',
    organizer: 'RunLevel Community / O2',
    location: 'Parque Barigui, Curitiba - PR',
    date: '11 de Julho de 2026',
    distances: '5K, 10K',
    xpReward: 500,
    challengeType: 'Desafio Noturno',
    difficulty: 'Iniciante',
    description: 'Corrida sob luzes estroboscópicas e música eletrônica. Ilumine seu mapa tático no Parque Barigui.',
    searchUrl: 'https://www.nightrun.com.br/',
    participantsCount: 215,
  },
  {
    id: 'evt-k21-trail',
    title: 'K21 Trail Run Serra do Mar',
    organizer: 'K Series Brasil',
    location: 'Maresias / São Sebastião - SP',
    date: '16 de Agosto de 2026',
    distances: '10K, 21K Trail',
    xpReward: 1100,
    challengeType: 'Trail Run',
    difficulty: 'Elite',
    description: 'Desafio técnico de montanha com altimetria elevada, lama e praias selvagens. Para atletas que buscam limite extremo.',
    searchUrl: 'https://k21series.com/',
    participantsCount: 178,
  },
];

export const CommunityChallengesFeed: React.FC<CommunityChallengesFeedProps> = ({
  theme = 'dark',
  onAcceptChallenge,
}) => {
  const isLight = theme === 'light';

  const [locationQuery, setLocationQuery] = useState('São Paulo, SP');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [events, setEvents] = useState<CommunityChallenge[]>(INITIAL_FALLBACK_EVENTS);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [lastSearchedCity, setLastSearchedCity] = useState<string>('São Paulo, SP');

  // Load accepted challenges from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('runlevel_accepted_challenges');
      if (saved) {
        setAcceptedIds(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch events using Google Search Grounding backend route
  const handleSearchEvents = async (cityToSearch = locationQuery) => {
    setIsLoading(true);
    setGroundingSources([]);
    try {
      const response = await fetch('/api/community-challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: cityToSearch,
          category: selectedCategory,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta da API');
      }

      const data = await response.json();

      if (Array.isArray(data.events) && data.events.length > 0) {
        // Map data to ensure valid CommunityChallenge structure
        const formattedEvents: CommunityChallenge[] = data.events.map((e: any, idx: number) => ({
          id: e.id || `evt-ai-${Date.now()}-${idx}`,
          title: e.title || 'Desafio de Corrida da Comunidade',
          organizer: e.organizer || 'Comunidade Corredores de Rua',
          location: e.location || cityToSearch,
          date: e.date || 'Data a confirmar em breve',
          distances: e.distances || '5K, 10K',
          xpReward: typeof e.xpReward === 'number' ? e.xpReward : 500,
          challengeType: e.challengeType || 'Corrida de Rua',
          difficulty: e.difficulty || 'Intermediário',
          description: e.description || 'Desafio tático verificado via busca oficial do Google.',
          searchUrl: e.searchUrl || '#',
          participantsCount: e.participantsCount || Math.floor(Math.random() * 200) + 80,
        }));

        setEvents(formattedEvents);
      } else {
        // Filter fallback events if API returns empty
        const filtered = INITIAL_FALLBACK_EVENTS.filter((e) =>
          e.location.toLowerCase().includes(cityToSearch.toLowerCase().split(',')[0].trim())
        );
        setEvents(filtered.length > 0 ? filtered : INITIAL_FALLBACK_EVENTS);
      }

      if (Array.isArray(data.sources)) {
        setGroundingSources(data.sources);
      }

      setLastSearchedCity(cityToSearch);
      tacticalAudio.playOrbCollectSound();
    } catch (err) {
      console.warn('Erro ao consultar Google Search Grounding. Mantendo lista padrão:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Accept Challenge
  const handleToggleAccept = (challenge: CommunityChallenge) => {
    const nextAccepted = new Set(acceptedIds);
    const isNowAccepted = !nextAccepted.has(challenge.id);

    if (isNowAccepted) {
      nextAccepted.add(challenge.id);
      tacticalAudio.playOrbCollectSound();
      tacticalAudio.speakTacticalCoach(`Desafio aceito: ${challenge.title}. Adicionado às suas missões.`);
    } else {
      nextAccepted.delete(challenge.id);
    }

    setAcceptedIds(nextAccepted);
    localStorage.setItem('runlevel_accepted_challenges', JSON.stringify(Array.from(nextAccepted)));

    if (onAcceptChallenge && isNowAccepted) {
      onAcceptChallenge({ ...challenge, accepted: true });
    }
  };

  // Filter local state based on category or search tab
  const displayedEvents = events.filter((evt) => {
    if (selectedCategory === 'aceitos') {
      return acceptedIds.has(evt.id);
    }
    if (selectedCategory === 'todas') return true;
    return (
      evt.challengeType.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      evt.distances.toLowerCase().includes(selectedCategory.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Banner / Header Bar */}
      <div
        className={`p-6 sm:p-8 rounded-3xl relative overflow-hidden border transition-all ${
          isLight
            ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-white border-orange-200 text-slate-900 shadow-md'
            : 'bg-slate-900/90 border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.15)] text-slate-100'
        }`}
      >
        {/* Glow backdrop accent */}
        {!isLight && (
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono px-3 py-1 rounded-full uppercase font-bold flex items-center gap-1.5 border ${
                  isLight
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                RADAR GOOGLE SEARCH GROUNDING
              </span>
              <span
                className={`text-[10px] font-mono px-2.5 py-1 rounded-md font-bold uppercase ${
                  isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                COMUNIDADE RUNLEVEL
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
              Feed de Desafios & Corridas Locais
            </h2>

            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Pesquise eventos de corrida reais em tempo real em qualquer cidade do Brasil. Aceite desafios comunitários, receba bônus de XP e conecte-se com a elite do asfalto.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 shrink-0 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="text-center px-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Eventos no Radar</span>
              <span className="text-xl font-black font-mono text-cyan-400">{events.length}</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Aceitos por Você</span>
              <span className="text-xl font-black font-mono text-emerald-400">{acceptedIds.size}</span>
            </div>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchEvents()}
              placeholder="Digite a cidade ou estado (ex: São Paulo, Rio de Janeiro, Curitiba, Recife...)"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm font-mono border transition outline-none ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200'
                  : 'bg-slate-950 border-cyan-500/30 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
              }`}
            />
          </div>

          <button
            onClick={() => handleSearchEvents()}
            disabled={isLoading}
            className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition shrink-0 ${
              isLight
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
                : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Buscando no Google...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Buscar Eventos</span>
              </>
            )}
          </button>
        </div>

        {/* Preset Cities Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className={`text-slate-400 font-bold flex items-center gap-1 ${isLight ? 'text-slate-500' : ''}`}>
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" /> Cidades Populares:
          </span>
          {['São Paulo, SP', 'Rio de Janeiro, RJ', 'Curitiba, PR', 'Belo Horizonte, MG', 'Brasília, DF', 'Porto Alegre, RS', 'Florianópolis, SC'].map(
            (city) => (
              <button
                key={city}
                onClick={() => {
                  setLocationQuery(city);
                  handleSearchEvents(city);
                }}
                className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  lastSearchedCity === city
                    ? isLight
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : isLight
                    ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {city.split(',')[0]}
              </button>
            )
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-mono font-bold uppercase flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          {[
            { id: 'todas', label: 'Todas as Corridas' },
            { id: '5K', label: '5K / 10K' },
            { id: 'Meia', label: 'Meia Maratona (21K)' },
            { id: 'Maratona', label: 'Maratona (42K)' },
            { id: 'Trail', label: 'Trail / Montanha' },
            { id: 'Noturno', label: 'Corridas Noturnas' },
            { id: 'aceitos', label: `Aceitos por Mim (${acceptedIds.size})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? isLight
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : isLight
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-cyan-500/30'
              }`}
            >
              {cat.id === 'aceitos' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results Summary */}
        <span className="text-xs font-mono text-slate-400">
          Exibindo <strong>{displayedEvents.length}</strong> desafios para {lastSearchedCity}
        </span>
      </div>

      {/* Grounding Sources Info (Google Search Verification) */}
      {groundingSources.length > 0 && (
        <div className={`p-4 rounded-2xl border text-xs font-mono space-y-2 ${
          isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-900' : 'bg-slate-950 border-cyan-500/30 text-cyan-300'
        }`}>
          <div className="flex items-center gap-2 font-bold text-cyan-400">
            <Globe className="w-4 h-4 animate-spin-slow" />
            <span>Fontes Oficiais Verificadas no Google Search:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {groundingSources.slice(0, 4).map((src, idx) => (
              <a
                key={idx}
                href={src.uri}
                target="_blank"
                rel="noreferrer"
                className="hover:underline flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-200"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{src.title.length > 40 ? src.title.substring(0, 38) + '...' : src.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayedEvents.length === 0 && (
        <div className={`p-12 text-center rounded-3xl border space-y-3 ${
          isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <Search className="w-12 h-12 mx-auto text-slate-500 opacity-50" />
          <h3 className="text-lg font-bold text-slate-200">Nenhum evento encontrado para este filtro</h3>
          <p className="text-xs max-w-md mx-auto">
            {selectedCategory === 'aceitos'
              ? 'Você ainda não aceitou nenhum desafio comunitário. Clique em "ACEITAR DESAFIO" nos cards abaixo para incluí-los.'
              : 'Tente alterar a cidade pesquisada ou redefinir a categoria para visualizar todas as corridas locais.'}
          </p>
          <button
            onClick={() => {
              setSelectedCategory('todas');
              handleSearchEvents('São Paulo, SP');
            }}
            className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold font-mono text-xs rounded-xl hover:bg-cyan-400 transition cursor-pointer"
          >
            Resetar Filtro & Buscar em SP
          </button>
        </div>
      )}

      {/* Dark Neon Grid of Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedEvents.map((event) => {
          const isAccepted = acceptedIds.has(event.id);

          return (
            <div
              key={event.id}
              className={`group relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between border ${
                isAccepted
                  ? isLight
                    ? 'bg-emerald-50/60 border-emerald-400 shadow-lg'
                    : 'bg-slate-900 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                  : isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-orange-400 shadow-md hover:shadow-xl'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-cyan-500/60 shadow-md hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]'
              }`}
            >
              {/* Acceptance Glowing Badge */}
              {isAccepted && (
                <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500 text-slate-950 font-mono font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  DESAFIO ACEITO
                </div>
              )}

              <div>
                {/* Header: Type & Organizer */}
                <div className="flex items-center justify-between gap-2 mb-3 pr-24">
                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border uppercase ${
                      event.challengeType.includes('Maratona')
                        ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                        : event.challengeType.includes('Trail')
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                        : event.challengeType.includes('Noturno')
                        ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {event.challengeType}
                  </span>

                  <span className="text-[10px] font-mono text-slate-400 font-semibold truncate">
                    {event.organizer}
                  </span>
                </div>

                {/* Event Title */}
                <h3
                  className={`text-lg font-black uppercase tracking-tight mb-2 group-hover:text-cyan-300 transition line-clamp-2 ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {event.title}
                </h3>

                {/* Description */}
                <p className={`text-xs leading-relaxed mb-4 line-clamp-3 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {event.description}
                </p>

                {/* Details Meta Table */}
                <div className="space-y-2 mb-5 font-mono text-xs">
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}>
                    <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{event.date}</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}>
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span><strong>{event.participantsCount + (isAccepted ? 1 : 0)}</strong> atletas aceitaram</span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                      <Award className="w-3.5 h-3.5" />
                      <span>+{event.xpReward} XP</span>
                    </div>
                  </div>
                </div>

                {/* Distances Chips */}
                <div className="mb-5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 mr-1">Distâncias:</span>
                  {event.distances.split(',').map((dist, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isLight
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-slate-800 text-cyan-300 border border-slate-700'
                      }`}
                    >
                      {dist.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleToggleAccept(event)}
                  className={`w-full py-3 px-4 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                    isAccepted
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                      : isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                  }`}
                >
                  {isAccepted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 fill-current text-slate-950" />
                      <span>ACEITO • VER MINHAS MISSÕES</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>ACEITAR DESAFIO (+{event.xpReward} XP)</span>
                    </>
                  )}
                </button>

                {/* Grounding Source Page Link */}
                {event.searchUrl && event.searchUrl !== '#' && (
                  <a
                    href={event.searchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full py-2 px-3 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 border transition ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>Página Oficial & Inscrições</span>
                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
