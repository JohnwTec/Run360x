import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Zap,
  Sparkles,
  Brain,
  Globe,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Trash2,
  Copy,
  Check,
  Flame,
  Heart,
  Activity,
  ShieldAlert,
  Apple,
  ExternalLink,
  ChevronRight,
  Info,
  MapPin
} from 'lucide-react';
import { UserProfile, TrainingLevel, WorkoutOption, LatLng } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  sources?: Array<{ title: string; uri: string; type?: 'web' | 'maps' }>;
  modelUsed?: string;
}

interface CoachChatProps {
  userProfile?: UserProfile;
  selectedLevel?: TrainingLevel;
  selectedWorkoutOption?: WorkoutOption;
  userPosition?: LatLng;
  theme?: 'dark' | 'light';
}

const QUICK_TOPICS = [
  {
    id: 'intervalado',
    category: 'Treinos',
    icon: Flame,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    title: 'Tiros de 400m e Intervalados',
    prompt: 'Como devo aquecer e executar o treino de tiros de 400m para maximizar o ganho de velocidade sem lesionar?',
  },
  {
    id: 'nutricao',
    category: 'Nutrição',
    icon: Apple,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    title: 'Nutrição Pré & Pós-Corrida',
    prompt: 'O que devo consumir de carboidrato e proteína 1 hora antes e após um treino intenso de corrida?',
  },
  {
    id: 'lesoes',
    category: 'Saúde',
    icon: ShieldAlert,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    title: 'Prevenção de Canelite e Dores',
    prompt: 'Sinto um incômodo leve na canela e joelhos ao correr. Quais exercícios de fortalecimento e cuidados posso fazer?',
  },
  {
    id: 'ritmo',
    category: 'Desempenho',
    icon: Activity,
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    title: 'Como Baixar o Pace',
    prompt: 'Quais técnicas de cadência, mecânica de passada e respiração ajudam a diminuir o pace sustentado?',
  },
  {
    id: 'locais_maps',
    category: 'Google Maps',
    icon: MapPin,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    title: 'Pistas 400m & Parques Perto de Mim',
    prompt: 'Quais são as melhores pistas de atletismo (400m ou 200m), parques e trilhas para correr perto da minha localização atual?',
    useMaps: true,
  },
  {
    id: 'recuperacao',
    category: 'Recuperação',
    icon: Heart,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    title: 'Recuperação Muscular & Sono',
    prompt: 'Quais são as melhores estratégias de regeneração pós-treino (liberação miofascial, hidratação, descanso)?',
  },
];

export function CoachChat({ userProfile, selectedLevel, selectedWorkoutOption, userPosition, theme = 'dark' }: CoachChatProps) {
  const isLight = theme === 'light';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Saudações, Atleta! Sou o seu **Coach Tático & Consultor de Saúde Run360X (Gemini 4)**.\n\nPosso ajudar em **treinos de pista (400m/200m), esteira, estrada e trail**, **nutrição**, **prevenção de lesões** e localizar **pistas e parques reais perto de você** via Google Maps.\n\nComo posso ajudar na sua evolução hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'default' | 'maps' | 'fast' | 'pro'>('default');
  const [enableSearch] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);

  // Voice States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle Form Submit
  const handleSendMessage = async (textToSend?: string, overrideMode?: 'default' | 'maps' | 'fast' | 'pro') => {
    const query = textToSend || inputMessage;
    if (!query.trim() || isLoading) return;

    const effectiveMode = overrideMode || mode;
    if (overrideMode && overrideMode !== mode) {
      setMode(overrideMode);
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    // Build context object
    const userContext = includeContext
      ? {
          atletaNivel: userProfile ? `Nível ${userProfile.level} (${userProfile.xp} XP)` : 'Iniciante',
          setoresConquistados: userProfile?.conqueredSectors.length || 0,
          treinoAtualSelecionado: selectedLevel ? `${selectedLevel.title} - ${selectedLevel.codename}` : undefined,
          modalidadeSelecionada: selectedWorkoutOption ? selectedWorkoutOption.title : undefined,
        }
      : undefined;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
          userContext,
          mode: effectiveMode,
          enableSearch: effectiveMode === 'default' && enableSearch,
          enableMaps: effectiveMode === 'maps',
          userLocation: userPosition,
        }),
      });

      let replyText = '';
      let sources = undefined;
      let modelUsed = undefined;

      if (response.ok) {
        const data = await response.json();
        replyText = data.reply;
        sources = data.sources;
        modelUsed = data.modelUsed;
      } else {
        try {
          const errData = await response.json();
          replyText = errData.reply || errData.error || '⚡ **Coach Tático RUN360X**: Servidor temporariamente ocupado. Para manter seu treino eficiente: foque na cadência de 170 RPM, boa postura e hidratação regular.';
        } catch {
          replyText = '⚡ **Coach Tático RUN360X**: Serviço temporariamente indisponível. Continue firme no seu treino Z2 e tente novamente em instantes.';
        }
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: replyText || 'Recebi sua pergunta, mas não foi possível gerar resposta no momento.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: sources,
        modelUsed: modelUsed,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Erro no Chat com o Coach:', err);
      const errorMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: '⚡ **Coach Tático RUN360X (Modo Contingência)**\n\nIdentificamos uma oscilação na conexão com a IA. Para o seu treino de hoje:\n\n• Mantenha o ritmo Z2 confortável.\n• Atente-se à hidratação a cada 20 minutos.\n• Reduza a passada e foque na cadência se sentir cansaço precoque.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Text to Speech
  const toggleSpeech = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking && speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for clearer speech
    const cleanText = text.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    };

    setSpeakingMsgId(msgId);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (Voice Input)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Copy to Clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Render text with basic markdown styling
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-sm my-1 text-cyan-400 dark:text-cyan-300">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return <h3 key={idx} className="font-extrabold text-base my-1 text-cyan-400 dark:text-cyan-300">{line.replace(/^#+\s/, '')}</h3>;
      }

      // Format bold text
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const lineContent = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc my-0.5 leading-relaxed">
            {lineContent}
          </li>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      return <p key={idx} className="my-0.5 leading-relaxed">{lineContent}</p>;
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header Banner */}
      <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-cyan-500/30'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-cyan-950 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
          }`}>
            <Bot className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-wide uppercase">COACH TÁTICO & SAÚDE AI</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
              }`}>
                GEMINI 4 · ONLINE
              </span>
            </div>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Treinos em pista/esteira/trail, busca científica e locais reais via Google Maps
            </p>
          </div>
        </div>

        {/* Model & Grounding Mode Selector */}
        <div className={`flex flex-wrap items-center gap-1 p-1 rounded-2xl border text-xs font-mono font-bold ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <button
            onClick={() => setMode('fast')}
            className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              mode === 'fast'
                ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
            title="Respostas ultrarrápidas de baixa latência (Flash Lite)"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Rápido</span>
          </button>

          <button
            onClick={() => setMode('default')}
            className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              mode === 'default'
                ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
            title="Gemini 4 com Google Search para dados científicos atualizados"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Busca Web</span>
          </button>

          <button
            onClick={() => setMode('maps')}
            className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              mode === 'maps'
                ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-emerald-500 text-slate-950 font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
            title="Gemini 4 com Google Maps para encontrar pistas, parques e trilhas reais"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Locais Maps</span>
          </button>

          <button
            onClick={() => setMode('pro')}
            className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              mode === 'pro'
                ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
            title="Análise Profunda Gemini 4 (High Thinking)"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Profundo</span>
          </button>
        </div>
      </div>

      {/* Quick Topic Chips */}
      <div className="space-y-2">
        <span className={`text-[10px] font-mono uppercase font-bold tracking-wider block px-1 ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Consultas Rápidas & Locais de Treino:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.id}
                onClick={() => handleSendMessage(topic.prompt, (topic as any).useMaps ? 'maps' : undefined)}
                disabled={isLoading}
                className={`px-3 py-2 rounded-2xl border text-xs font-mono transition cursor-pointer flex items-center gap-2 ${
                  isLight
                    ? 'bg-white hover:bg-orange-50 border-slate-200 text-slate-800 hover:border-orange-300 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:border-cyan-500/40'
                }`}
              >
                <div className={`p-1 rounded-lg ${topic.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold">{topic.title}</span>
                <ChevronRight className="w-3 h-3 text-slate-400 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Thread Window */}
      <div className={`p-4 sm:p-6 rounded-3xl border min-h-[420px] max-h-[560px] overflow-y-auto flex flex-col justify-between space-y-4 ${
        isLight ? 'bg-white border-slate-200 shadow-inner' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="space-y-4">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs sm:text-sm ${
                  isBot ? 'justify-start' : 'justify-end'
                }`}
              >
                {isBot && (
                  <div className={`w-8 h-8 rounded-2xl border flex items-center justify-center shrink-0 mt-1 ${
                    isLight ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
                  }`}>
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-3xl p-4 space-y-2 relative group ${
                  isBot
                    ? isLight
                      ? 'bg-slate-100 text-slate-800 border border-slate-200/80'
                      : 'bg-slate-950 text-slate-100 border border-slate-800/80'
                    : isLight
                      ? 'bg-orange-500 text-white font-medium'
                      : 'bg-cyan-500 text-slate-950 font-medium'
                }`}>
                  <div className="flex items-center justify-between gap-3 text-[10px] font-mono opacity-80 border-b border-black/10 dark:border-white/10 pb-1 mb-1">
                    <span className="font-bold uppercase tracking-wider">
                      {isBot ? 'Coach RunLevel' : 'Atleta'}
                    </span>
                    <span className="text-[9px]">{msg.timestamp}</span>
                  </div>

                  <div className="text-xs leading-relaxed">
                    {renderFormattedText(msg.text)}
                  </div>

                  {/* Web Search & Google Maps Grounding Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] font-mono space-y-1.5">
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                        {msg.sources.some((s) => s.type === 'maps') ? (
                          <>
                            <MapPin className="w-3 h-3 text-emerald-500" /> Locais no Google Maps & Fontes:
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3" /> Fontes & Pesquisa Científica:
                          </>
                        )}
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition ${
                              src.type === 'maps'
                                ? isLight
                                  ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800'
                                  : 'bg-emerald-950/60 border-emerald-500/40 hover:border-emerald-400 text-emerald-200'
                                : isLight
                                  ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                                  : 'bg-slate-900 border-slate-800 hover:border-cyan-500/40 text-slate-300'
                            }`}
                          >
                            {src.type === 'maps' && <MapPin className="w-3 h-3 shrink-0 text-emerald-500" />}
                            <span className="truncate max-w-[200px]">{src.title || 'Abrir Referência'}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar for Bot Messages */}
                  {isBot && (
                    <div className="flex items-center justify-end gap-1 pt-1 opacity-80 hover:opacity-100 transition">
                      <button
                        onClick={() => toggleSpeech(msg.id, msg.text)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          speakingMsgId === msg.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : isLight ? 'bg-white hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                        title="Ouvir resposta (Voz em Português)"
                      >
                        {speakingMsgId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          isLight ? 'bg-white hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {!isBot && (
                  <div className={`w-8 h-8 rounded-2xl border flex items-center justify-center shrink-0 mt-1 ${
                    isLight ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3 text-xs font-mono text-cyan-500 dark:text-cyan-400 animate-pulse py-2">
              <div className="p-2 bg-cyan-950 border border-cyan-500/40 rounded-xl">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <span>Coach analisando fisiologia e gerando recomendação...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Controls Bar */}
      <div className={`p-3 rounded-3xl border space-y-2 ${
        isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Context & Info Pill */}
        <div className="flex items-center justify-between px-2 text-[10px] font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              Enviar perfil do Atleta para resposta personalizada (Nível, XP e Treino Selecionado)
            </span>
          </label>

          {messages.length > 1 && (
            <button
              onClick={() => setMessages([messages[0]])}
              className={`flex items-center gap-1 hover:underline transition ${
                isLight ? 'text-slate-500 hover:text-rose-600' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <Trash2 className="w-3 h-3" /> Limpar Histórico
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? 'bg-rose-500 text-white border-rose-400 animate-ping'
                : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
            title="Falar mensagem (Reconhecimento de Voz)"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Pergunte ao Coach: ex. 'Qual o ritmo ideal no treino de tiro de 400m?'"
            disabled={isLoading}
            className={`flex-1 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-sans focus:outline-none transition ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500 focus:bg-white'
                : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500 focus:bg-slate-900'
            }`}
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className={`px-5 py-3 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              !inputMessage.trim() || isLoading
                ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-400'
                : isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
            }`}
          >
            <span>Enviar</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
