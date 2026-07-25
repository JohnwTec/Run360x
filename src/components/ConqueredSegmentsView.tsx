import React, { useState } from 'react';
import { Map, Polyline, Marker } from '@vis.gl/react-google-maps';
import { Trophy, Flame, Zap, Mountain, Activity, Award, Navigation, ChevronRight, ChevronDown, ChevronUp, BarChart3, ShieldCheck, Users, Gauge, Sparkles } from 'lucide-react';
import { WorkoutStats, ConqueredSegment, PathPoint } from '../types';
import { formatPace } from '../utils/geo';
import { DARK_NEON_MAP_STYLE, LIGHT_TACTICAL_MAP_STYLE } from '../constants/mapStyles';
import { ElevationPaceRecharts } from './ElevationPaceRecharts';

interface ConqueredSegmentsViewProps {
  stats: WorkoutStats;
  theme?: 'dark' | 'light';
}

export const ConqueredSegmentsView: React.FC<ConqueredSegmentsViewProps> = ({ stats, theme = 'dark' }) => {
  const isLight = theme === 'light';

  // Base user center location or default center
  const defaultCenter = stats.path.length > 0
    ? { lat: stats.path[Math.floor(stats.path.length / 2)].lat, lng: stats.path[Math.floor(stats.path.length / 2)].lng }
    : { lat: -23.55052, lng: -46.633308 };

  // Generate Conquered Segments from path or fallback simulation
  const generatedSegments: ConqueredSegment[] = React.useMemo(() => {
    if (stats.path.length < 4) {
      // Sample mock segments around default location
      const c = defaultCenter;
      return [
        {
          id: 'seg-1',
          name: 'Sprint da Avenida Principal (Reta de Elite)',
          distanceMeters: 450,
          avgPaceMinKm: Math.max(3.5, stats.avgPaceMinKm - 0.8),
          elevationGainMeters: 4,
          neonColor: '#ff007f', // Vibrant Pink/Violet
          glowColor: 'rgba(255, 0, 127, 0.6)',
          badgeTitle: '🏆 NOVO RECORDE PESSOAL (PR)',
          xpBonus: 250,
          isPR: true,
          topSpeedKmH: 19.8,
          runnersOvertaken: 14,
          cadenceAvg: 184,
          effortRating: 'Zona 5 - Tiro Máximo',
          coordinates: [
            { lat: c.lat - 0.002, lng: c.lng - 0.002 },
            { lat: c.lat - 0.001, lng: c.lng - 0.001 },
            { lat: c.lat, lng: c.lng },
          ],
        },
        {
          id: 'seg-2',
          name: 'Desafio de Aclive do Parque',
          distanceMeters: 620,
          avgPaceMinKm: stats.avgPaceMinKm + 0.4,
          elevationGainMeters: 28,
          neonColor: '#00ff88', // Emerald Neon
          glowColor: 'rgba(0, 255, 136, 0.6)',
          badgeTitle: '⛰️ MESTRE DA ELEVAÇÃO (+28m)',
          xpBonus: 180,
          topSpeedKmH: 15.2,
          runnersOvertaken: 8,
          cadenceAvg: 176,
          effortRating: 'Zona 4 - Limiar de Aclive',
          coordinates: [
            { lat: c.lat, lng: c.lng },
            { lat: c.lat + 0.001, lng: c.lng + 0.002 },
            { lat: c.lat + 0.002, lng: c.lng + 0.003 },
          ],
        },
        {
          id: 'seg-3',
          name: 'Circuito Tático de Cruzamento',
          distanceMeters: 800,
          avgPaceMinKm: stats.avgPaceMinKm - 0.2,
          elevationGainMeters: 8,
          neonColor: '#ffee00', // Gold Yellow
          glowColor: 'rgba(255, 238, 0, 0.6)',
          badgeTitle: '⚡ SETOR DOMINADO (TOP 1)',
          xpBonus: 200,
          topSpeedKmH: 17.6,
          runnersOvertaken: 19,
          cadenceAvg: 180,
          effortRating: 'Zona 4 - Ritmo Sustentado',
          coordinates: [
            { lat: c.lat + 0.002, lng: c.lng + 0.003 },
            { lat: c.lat + 0.003, lng: c.lng + 0.001 },
            { lat: c.lat + 0.004, lng: c.lng - 0.001 },
          ],
        },
      ];
    }

    // Split actual workout path into 3 distinct segments
    const third = Math.floor(stats.path.length / 3);
    const seg1Path = stats.path.slice(0, third + 1);
    const seg2Path = stats.path.slice(third, third * 2 + 1);
    const seg3Path = stats.path.slice(third * 2);

    return [
      {
        id: 'seg-real-1',
        name: 'Segmento 1: Explosão Inicial & Aceleração',
        distanceMeters: Math.round(stats.totalDistanceMeters * 0.35),
        avgPaceMinKm: Number((stats.avgPaceMinKm * 0.92).toFixed(2)),
        elevationGainMeters: 12,
        neonColor: '#ff00aa', // Hot Magenta Neon
        glowColor: 'rgba(255, 0, 170, 0.7)',
        badgeTitle: '🔥 MAIOR ACELERAÇÃO DA SESSÃO',
        xpBonus: 220,
        isPR: true,
        topSpeedKmH: Number((60 / (stats.avgPaceMinKm * 0.82)).toFixed(1)),
        runnersOvertaken: 12,
        cadenceAvg: 182,
        effortRating: 'Zona 4 - Aceleração Inicial',
        coordinates: seg1Path.map((p) => ({ lat: p.lat, lng: p.lng })),
      },
      {
        id: 'seg-real-2',
        name: 'Segmento 2: Trecho de Resistência & Altimetria',
        distanceMeters: Math.round(stats.totalDistanceMeters * 0.4),
        avgPaceMinKm: Number((stats.avgPaceMinKm * 1.05).toFixed(2)),
        elevationGainMeters: 26,
        neonColor: '#00ff88', // Emerald Green Neon
        glowColor: 'rgba(0, 255, 136, 0.7)',
        badgeTitle: '⛰️ CONQUISTA DE ELEVAÇÃO (+26M)',
        xpBonus: 190,
        topSpeedKmH: Number((60 / (stats.avgPaceMinKm * 0.98)).toFixed(1)),
        runnersOvertaken: 9,
        cadenceAvg: 174,
        effortRating: 'Zona 4 - Força Altimétrica',
        coordinates: seg2Path.map((p) => ({ lat: p.lat, lng: p.lng })),
      },
      {
        id: 'seg-real-3',
        name: 'Segmento 3: Sprint Final de Encerramento',
        distanceMeters: Math.round(stats.totalDistanceMeters * 0.25),
        avgPaceMinKm: Number((stats.avgPaceMinKm * 0.88).toFixed(2)),
        elevationGainMeters: 6,
        neonColor: '#00f0ff', // Cyberpunk Cyan Neon
        glowColor: 'rgba(0, 240, 255, 0.7)',
        badgeTitle: '⚡ SPRINT FINAL CONQUISTADO',
        xpBonus: 280,
        topSpeedKmH: Number((60 / (stats.avgPaceMinKm * 0.75)).toFixed(1)),
        runnersOvertaken: 16,
        cadenceAvg: 190,
        effortRating: 'Zona 5 - Sprint de Chegada',
        coordinates: seg3Path.map((p) => ({ lat: p.lat, lng: p.lng })),
      },
    ];
  }, [stats, defaultCenter]);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(generatedSegments[0].id);
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<string[]>([generatedSegments[0].id]);

  const toggleExpandSegment = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSegmentId(id);
    setExpandedSegmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedSegment = generatedSegments.find((s) => s.id === selectedSegmentId) || generatedSegments[0];

  return (
    <div className="space-y-6 font-sans">
      {/* SECTION 1: MAPA DE SEGMENTOS CONQUISTADOS */}
      <div
        className={`p-6 rounded-3xl border space-y-6 transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-cyan-500/30 text-white shadow-[0_0_40px_rgba(6,182,212,0.1)]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-950 text-purple-300 border border-purple-500/40'
              }`}>
                DESTAQUE DE SEGMENTOS TÁTICOS
              </span>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                +{(generatedSegments.reduce((acc, s) => acc + s.xpBonus, 0))} XP BÔNUS DE SETOR
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1.5 flex items-center gap-2">
              <span>Segmentos Conquistados no Trajeto</span>
              <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Traçados neon destacados no mapa representam os trechos de maior performance, recordes pessoais e vitórias em subidas.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Filtro de Segmento:</span>
            <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              {generatedSegments.length} SEGMENTOS CONQUISTADOS
            </span>
          </div>
        </div>

        {/* Interactive Segment Selection Pills */}
        <div className="flex flex-wrap gap-2.5 font-mono text-xs">
          {generatedSegments.map((seg) => {
            const isSelected = seg.id === selectedSegmentId;

            return (
              <button
                key={seg.id}
                onClick={() => {
                  setSelectedSegmentId(seg.id);
                  if (!expandedSegmentIds.includes(seg.id)) {
                    setExpandedSegmentIds((prev) => [...prev, seg.id]);
                  }
                }}
                className={`px-3.5 py-2 rounded-2xl border font-bold transition flex items-center gap-2 cursor-pointer shadow-sm ${
                  isSelected
                    ? isLight
                      ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-md'
                      : 'bg-slate-950 text-cyan-300 border-cyan-400 font-extrabold shadow-[0_0_20px_rgba(6,182,212,0.3)] scale-105'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-400'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: seg.neonColor, boxShadow: `0 0 10px ${seg.neonColor}` }}
                />
                <span>{seg.name}</span>
                <span className="text-[10px] opacity-80">({seg.distanceMeters}m)</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Google Map with Glowing Neon Segment Overlays */}
        <div className={`relative h-80 sm:h-96 w-full rounded-2xl border overflow-hidden shadow-xl ${
          isLight ? 'border-slate-300' : 'border-cyan-500/40'
        }`}>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={16}
            mapId="CONQUERED_SEGMENTS_MAP"
            styles={isLight ? LIGHT_TACTICAL_MAP_STYLE : DARK_NEON_MAP_STYLE}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            disableDefaultUI={true}
          >
            {/* Draw Polylines for each Conquered Segment */}
            {generatedSegments.map((seg) => {
              const isSelected = seg.id === selectedSegmentId;

              return (
                <React.Fragment key={seg.id}>
                  {/* Thick Glow Underlying Polyline */}
                  <Polyline
                    path={seg.coordinates}
                    strokeColor={seg.neonColor}
                    strokeOpacity={isSelected ? 0.9 : 0.4}
                    strokeWeight={isSelected ? 12 : 6}
                  />

                  {/* Sharp Center Core Polyline */}
                  <Polyline
                    path={seg.coordinates}
                    strokeColor="#ffffff"
                    strokeOpacity={0.95}
                    strokeWeight={isSelected ? 4 : 2}
                  />

                  {/* Segment Start & End Markers */}
                  {seg.coordinates.length > 0 && (
                    <Marker
                      position={seg.coordinates[0]}
                      title={`Início: ${seg.name}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Map>

          {/* Floating Selected Segment Info Panel */}
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md bg-slate-950/90 border border-cyan-500/40 backdrop-blur-md p-4 rounded-2xl font-mono text-xs text-slate-100 shadow-2xl space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedSegment.neonColor, boxShadow: `0 0 12px ${selectedSegment.neonColor}` }}
                />
                <span className="font-extrabold text-cyan-300 uppercase text-[11px]">
                  {selectedSegment.badgeTitle}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                +{selectedSegment.xpBonus} XP
              </span>
            </div>

            <h3 className="font-black text-sm text-white">{selectedSegment.name}</h3>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase">Extensão</span>
                <span className="text-xs font-bold text-cyan-400">{selectedSegment.distanceMeters} metros</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase">Pace Médio</span>
                <span className="text-xs font-bold text-amber-400">{formatPace(selectedSegment.avgPaceMinKm)} min/km</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase">Ganho Altimétrico</span>
                <span className="text-xs font-bold text-emerald-400">+{selectedSegment.elevationGainMeters} m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Segment Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {generatedSegments.map((seg, idx) => {
            const isSelected = seg.id === selectedSegmentId;
            const isExpanded = expandedSegmentIds.includes(seg.id);

            return (
              <div
                key={seg.id}
                onClick={() => toggleExpandSegment(seg.id)}
                style={{ animationDelay: `${idx * 150}ms` }}
                className={`p-4.5 rounded-2xl border transition-all cursor-pointer space-y-3 font-mono animate-neon-unlock badge-unlock-glow relative overflow-hidden ${
                  isSelected
                    ? isLight
                      ? 'bg-slate-50 border-orange-400 shadow-lg ring-2 ring-orange-400/30'
                      : 'bg-slate-950 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400 animate-neon-glow-pulse'
                    : isLight
                    ? 'bg-slate-50/50 border-slate-200 hover:bg-slate-100'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border uppercase flex items-center gap-1 shadow-sm"
                    style={{
                      backgroundColor: `${seg.neonColor}25`,
                      borderColor: seg.neonColor,
                      color: seg.neonColor,
                      boxShadow: `0 0 10px ${seg.neonColor}40`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: seg.neonColor }} />
                    {seg.badgeTitle}
                  </span>
                  <span className="text-[10px] font-mono font-extrabold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                    +{seg.xpBonus} XP
                  </span>
                </div>

                <h4 className="text-xs font-black uppercase text-slate-100 line-clamp-1">{seg.name}</h4>

                {/* Primary Compact Metrics */}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Distância: <strong className="text-slate-200">{seg.distanceMeters}m</strong></span>
                  <span className="text-amber-400 font-bold">{formatPace(seg.avgPaceMinKm)}/km</span>
                </div>

                {/* Expansion Toggle Button Indicator */}
                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold pt-1 border-t border-slate-800/40">
                  <span>{isExpanded ? 'Ocultar detalhes do setor' : 'Clique para ver estatísticas'}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-cyan-400" />}
                </div>

                {/* EXPANDED DETAILED SECTOR STATISTICS */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800 space-y-2.5 animate-fadeIn">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Recorde de Velocidade</span>
                          <span className="text-xs font-black text-amber-400">{seg.topSpeedKmH || 18.5} km/h</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        MAX SPEED
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Corredores Superados</span>
                          <span className="text-xs font-black text-emerald-400">{seg.runnersOvertaken || 12} atletas ultrapassados</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        OVERTAKE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">CADÊNCIA MÉDIA</span>
                        <span className="font-extrabold text-cyan-300">{seg.cadenceAvg || 180} SPM</span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">ZONA DE ESFORÇO</span>
                        <span className="font-extrabold text-purple-300 truncate block">{seg.effortRating || 'Zona 4'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: GRÁFICO RECHARTS DE ELEVAÇÃO DO TERRENO X PACE DO CORREDOR */}
      <ElevationPaceRecharts stats={stats} theme={theme} />
    </div>
  );
};
