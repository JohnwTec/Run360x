import express from 'express';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini client
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing.');
    }
    genAI = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAI;
}

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Coach Chatbot Endpoint (Gemini 4 + Google Search & Google Maps Grounding)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      history,
      userContext,
      mode = 'default',
      enableSearch = true,
      enableMaps = false,
      userLocation,
    } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Mensagem inválida ou ausente.' });
      return;
    }

    const ai = getGenAI();

    // Select active Gemini 4 / 3.1 model according to mode
    // Note: googleMaps CANNOT be combined with googleSearch in the same request.
    let modelName = 'gemini-4-hydrogen';
    const config: any = {};

    const wantsMaps = mode === 'maps' || enableMaps === true;

    if (mode === 'fast') {
      modelName = 'gemini-3.1-flash-lite';
    } else if (wantsMaps) {
      modelName = 'gemini-4-hydrogen';
      config.tools = [{ googleMaps: {} }];
      if (
        userLocation &&
        typeof userLocation.lat === 'number' &&
        typeof userLocation.lng === 'number'
      ) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            },
          },
        };
      }
    } else if (mode === 'pro') {
      modelName = 'gemini-4-hydrogen';
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    } else {
      modelName = 'gemini-4-hydrogen';
      if (enableSearch) {
        config.tools = [{ googleSearch: {} }];
      }
    }

    const systemInstruction = `Você é o 'Coach Tático Run360X & Consultor de Saúde Esportiva', um treinador profissional especialista em corrida de rua, pista de atletismo (400m/200m), esteira, trail run, fisiologia do exercício, biomecânica, prevenção de lesões e nutrição esportiva.
Seu objetivo é dar respostas curtas, práticas, motivadoras e cientificamente embasadas para consultas rápidas de atletas.

Sempre que relevante, considere o contexto do atleta:
${userContext ? JSON.stringify(userContext) : 'Sem contexto adicional do atleta fornecido.'}

Instruções de Estilo & Formato:
1. Responda em Português do Brasil com tom encorajador, focado em alta performance segura e saúde do atleta.
2. Use listas curtas com marcadores (bullet points) para facilitar a leitura rápida na tela do celular.
3. Aborde tópicos como:
   - Treinos específicos para Pista 400m, Pista 200m, Esteira (inclinação e velocidade), Estrada/Cidade e Trail Run.
   - Como melhorar velocidade e resistência sem risco de lesão.
   - Locais reais para correr (pistas de atletismo, parques, trilhas e academias) quando o modo Google Maps estiver ativo.
   - Nutrição pré/pós-treino, hidratação e reposição de eletrólitos.
   - Prevenção de lesões (canelite, fascite plantar, tendinite do aquiles, síndrome do trato iliotibial).
4. Mantenha as respostas concisas e diretas (3 a 5 parágrafos curtos no máximo).
5. Se o usuário perguntar algo médico grave, inclua um aviso amigável recomendando acompanhamento médico especializado.`;

    config.systemInstruction = systemInstruction;

    // Build chat contents array from history if present
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.sender === 'user' || item.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: item.text || item.content }] });
        } else if (item.sender === 'bot' || item.role === 'model') {
          contents.push({ role: 'model', parts: [{ text: item.text || item.content }] });
        }
      }
    }

    contents.push({ role: 'user', parts: [{ text: message }] });

    let response;
    let modelUsed = modelName;

    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config,
      });
    } catch (firstErr: any) {
      console.warn('Primeira tentativa de IA falhou (possível limite de cota/rate limit):', firstErr?.message);

      // Secondary fallback model attempt without grounding tools
      try {
        modelUsed = 'gemini-3.1-flash-lite';
        response = await ai.models.generateContent({
          model: modelUsed,
          contents: contents,
          config: {
            systemInstruction,
          },
        });
      } catch (secondErr: any) {
        console.warn('Segunda tentativa de IA também falhou:', secondErr?.message);

        res.json({
          reply: `⚡ **Coach Tático RUN360X (Modo Suporte de Contingência)**\n\nIdentificamos uma alta demanda temporária no servidor de IA (limite de cota atingido). Aqui estão as orientações táticas para a sua consulta:\n\n• **Cadência & Pace**: Mantenha a cadência entre 165 e 180 Passos/Minuto e priorize a constância nos treinos Z2.\n• **Pista & Esteira**: Em pistas de 400m ou 200m, controle as parciais sem queimar a primeira volta; na esteira, 1% de inclinação simula o arrasto do ar externo.\n• **Nutrição & Hidratação**: Reponha 500ml de água/eletrólitos a cada hora de corrida e consuma carboidratos pré-treino.\n\n*(Sua pergunta foi registrada. Tente novamente em alguns instantes para a resposta personalizada completa!)*`,
          sources: [],
          modelUsed: 'contingency-backup',
        });
        return;
      }
    }

    const replyText = response?.text || 'Não foi possível gerar uma resposta no momento. Tente novamente em instantes.';

    // Extract Web Search AND Google Maps grounding URLs
    const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: Array<{ title: string; uri: string; type: 'web' | 'maps' }> = [];

    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks as any[]) {
        if (chunk?.web?.uri) {
          sources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
            type: 'web',
          });
        }
        if (chunk?.maps?.uri) {
          sources.push({
            title: chunk.maps.title || 'Ver no Google Maps',
            uri: chunk.maps.uri,
            type: 'maps',
          });
        }
        const reviewSnippets = chunk?.maps?.placeAnswerSources?.reviewSnippets;
        if (Array.isArray(reviewSnippets)) {
          for (const snippet of reviewSnippets) {
            if (snippet?.googleMapsUri) {
              sources.push({
                title: snippet.title || chunk?.maps?.title || 'Avaliação no Google Maps',
                uri: snippet.googleMapsUri,
                type: 'maps',
              });
            }
          }
        }
      }
    }

    res.json({
      reply: replyText,
      sources,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Erro na API de Chat:', error);
    res.json({
      reply: `⚡ **Coach Tático RUN360X (Atendimento Local)**\n\nO servidor de IA está com limite de requisições temporariamente excedido. Mantenha o foco em seus treinos de ritmo Z2 e hidratação adequada. Tente enviar sua pergunta novamente em instantes!`,
      sources: [],
      modelUsed: 'local-fallback',
    });
  }
});

// Community Challenge Feed Search Route (Google Search Grounding with Gemini 4)
app.post('/api/community-challenges', async (req, res) => {
  try {
    const { location = 'São Paulo, Brasil', category = 'todas' } = req.body;

    const ai = getGenAI();
    const modelName = 'gemini-4-hydrogen';

    const prompt = `Pesquise no Google usando o Grounding os eventos reais e atuais/futuros de corrida de rua, meias maratonas, circuitos de 5K/10K, corridas noturnas, ultramaratonas ou corridas de montanha/trail run ocorrendo em ou próximos de: "${location}".
Filtro de categoria solicitado pelo usuário: "${category}".

Formate sua resposta ESTRITAMENTE como um array JSON válido contendo de 4 a 6 objetos de evento. Não inclua nenhum texto explicativo fora do bloco JSON.
Cada objeto no array JSON deve ter as seguintes propriedades exatas:
- "id": string (ex: "evt-sp-01")
- "title": string (Nome oficial ou descritivo da corrida/desafio, ex: "Circuito das Estações 2026 - Etapa Outono")
- "organizer": string (Organizador, patrocínio ou comunidade local, ex: "O2 Corre / Asics")
- "location": string (Local exato ou parque/avenida e cidade, ex: "Parque do Ibirapuera, São Paulo - SP")
- "date": string (Data prevista ou mês do evento, ex: "15 de Outubro de 2026")
- "distances": string (Distâncias disponíveis separadas por vírgula, ex: "5K, 10K, 21K")
- "xpReward": number (Recompensa em XP, entre 350 e 1200 XP dependendo da dificuldade)
- "challengeType": string ("Corrida de Rua", "Meia Maratona", "Maratona", "Trail Run", "Desafio Noturno", "Circuito 5K/10K")
- "difficulty": string ("Iniciante", "Intermediário", "Avançado", "Elite")
- "description": string (Descrição motivadora do evento em tom tático de 2 frases)
- "searchUrl": string (URL do site oficial ou página de inscrição do evento, se encontrada no Google Search)
- "participantsCount": number (Número estimado de corredores na comunidade aceitando este desafio, ex: 142)`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "Você é o radar tático de eventos e desafios comunitários de corrida do Run360X. Retorne resultados precisos e reais baseados na busca no Google.",
      },
    });

    const replyText = response.text || '';

    // Extract grounding source URLs
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = Array.isArray(groundingChunks)
      ? groundingChunks
          .map((c: any) => c.web)
          .filter(Boolean)
          .map((w: any) => ({ title: w.title, uri: w.uri }))
      : [];

    // Parse JSON array from replyText
    let events: any[] = [];
    try {
      const jsonMatch = replyText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        events = JSON.parse(jsonMatch[0]);
      } else {
        events = JSON.parse(replyText);
      }
    } catch {
      console.warn('Fallback: Não foi possível realizar JSON parse estrito dos eventos');
    }

    // Attach first grounding source URI as fallback searchUrl if missing
    if (sources.length > 0) {
      events = events.map((evt, idx) => ({
        ...evt,
        searchUrl: evt.searchUrl || sources[idx % sources.length]?.uri || sources[0]?.uri || '#',
      }));
    }

    res.json({
      events,
      sources,
      searchLocation: req.body?.location || 'São Paulo, Brasil',
    });
  } catch (error: any) {
    console.warn('API de Desafios da Comunidade usando fallback local devido a erro/cota:', error?.message);
    const locStr = String(req.body?.location || 'São Paulo, Brasil');
    
    // Fallback events array when AI quota is exceeded or offline
    const fallbackEvents = [
      {
        id: `evt-fallback-1-${Date.now()}`,
        title: `Circuito Tático de Rua RUN360X - ${locStr}`,
        organizer: "Comunidade Tática Local & RUN360X",
        location: `${locStr} (Principais Vias e Parques)`,
        date: "Próximo Fim de Semana",
        distances: "5K, 10K, 21K",
        xpReward: 650,
        challengeType: "Circuito 5K/10K",
        difficulty: "Intermediário",
        description: "Desafio de velocidade e constância no asfalto local. Conquiste novos setores e suba no ranking da comunidade.",
        searchUrl: "https://www.google.com/search?q=corridas+de+rua+" + encodeURIComponent(locStr),
        participantsCount: 184
      },
      {
        id: `evt-fallback-2-${Date.now()}`,
        title: `Desafio Noturno do Fantasma Urbana`,
        organizer: "Clube da Madrugada RUN360X",
        location: `${locStr} (Circuito Iluminado)`,
        date: "Sexta-feira, 20:00h",
        distances: "5K, 8K",
        xpReward: 500,
        challengeType: "Desafio Noturno",
        difficulty: "Iniciante",
        description: "Corrida noturna com foco em cadência e ritmo Z2 constante. Ideal para superar marcas pessoais.",
        searchUrl: "https://www.google.com/search?q=eventos+corrida+" + encodeURIComponent(locStr),
        participantsCount: 129
      },
      {
        id: `evt-fallback-3-${Date.now()}`,
        title: `Desafio de Subida & Ladeiras Táticas`,
        organizer: "Squad de Ladeiras",
        location: `${locStr} (Zona Elevada)`,
        date: "Sábado de Manhã",
        distances: "6K, 12K",
        xpReward: 900,
        challengeType: "Trail Run / Subida",
        difficulty: "Avançado",
        description: "Ganho de elevação positivo com fortalecimento de quadríceps e força mental.",
        searchUrl: "https://www.google.com/search?q=meia+maratona+" + encodeURIComponent(locStr),
        participantsCount: 96
      }
    ];

    res.json({
      events: fallbackEvents,
      sources: [],
      searchLocation: locStr,
      isFallback: true,
    });
  }
});

// Vite or Static Middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Servidor RunLevel ativo na porta http://0.0.0.0:${PORT}`);
  });
}

startServer();
