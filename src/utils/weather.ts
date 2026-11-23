import {
  WeatherData,
  WeatherCondition,
  HydrationPlan,
  GearSuggestion,
  LatLng,
  HourlyForecastPoint,
  HeavyRainAssessment,
} from '../types';

/**
 * Maps WMO weather code to readable descriptions and icons.
 * Codes specification: https://open-meteo.com/en/docs
 */
export function parseWeatherCode(code: number, isDay: boolean): WeatherCondition {
  switch (code) {
    case 0:
      return {
        code,
        label: isDay ? 'Céu Limpo & Ensolarado' : 'Noite Limpa & Estrelada',
        icon: isDay ? '☀️' : '🌙',
        isClear: true,
        isCloudy: false,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 1:
      return {
        code,
        label: isDay ? 'Predominantemente Ensolarado' : 'Noite Quase Limpa',
        icon: isDay ? '🌤️' : '🌙',
        isClear: true,
        isCloudy: false,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 2:
      return {
        code,
        label: 'Parcialmente Nublado',
        icon: isDay ? '⛅' : '☁️',
        isClear: false,
        isCloudy: true,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 3:
      return {
        code,
        label: 'Nublado / Encoberto',
        icon: '☁️',
        isClear: false,
        isCloudy: true,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 45:
    case 48:
      return {
        code,
        label: 'Neblina / Nevoeiro Denso',
        icon: '🌫️',
        isClear: false,
        isCloudy: true,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: true,
      };
    case 51:
    case 53:
    case 55:
      return {
        code,
        label: 'Garoa Leve / Chuvisco',
        icon: '🌦️',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 61:
      return {
        code,
        label: 'Chuva Leve',
        icon: '🌧️',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 63:
      return {
        code,
        label: 'Chuva Moderada',
        icon: '🌧️',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 65:
      return {
        code,
        label: 'Chuva Forte Torrencial',
        icon: '⛈️',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 71:
    case 73:
    case 75:
      return {
        code,
        label: 'Queda de Neve',
        icon: '❄️',
        isClear: false,
        isCloudy: true,
        isRain: false,
        isSnow: true,
        isThunder: false,
        isFog: false,
      };
    case 80:
    case 81:
    case 82:
      return {
        code,
        label: 'Pancadas de Chuva',
        icon: '🌦️',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
    case 95:
    case 96:
    case 99:
      return {
        code,
        label: 'Tempestade Elétrica',
        icon: '⚡',
        isClear: false,
        isCloudy: true,
        isRain: true,
        isSnow: false,
        isThunder: true,
        isFog: false,
      };
    default:
      return {
        code,
        label: 'Condições Estáveis',
        icon: isDay ? '☀️' : '🌙',
        isClear: true,
        isCloudy: false,
        isRain: false,
        isSnow: false,
        isThunder: false,
        isFog: false,
      };
  }
}

/**
 * Calculates sports hydration plan based on temperature, apparent temperature and humidity.
 */
export function calculateHydrationPlan(tempC: number, apparentTempC: number, humidity: number): HydrationPlan {
  const effectiveTemp = Math.max(tempC, apparentTempC);

  if (effectiveTemp >= 31 || (effectiveTemp >= 28 && humidity >= 70)) {
    return {
      status: 'ALERTA TÉRMICO CRÍTICO: ALTO RISCO DE DESIDRATAÇÃO',
      volumePerInterval: '250 - 300 ml',
      intervalMinutes: 15,
      urgency: 'critical',
      electrolytesRecommendation: 'Obrigatório: Reposição de Sódio + Isotônico',
      tip: 'Calor e umidade elevados aumentam a taxa de suor para até 1,8L/h. Beba água a cada 15 min com eletrólitos para evitar hiponatremia e câimbras.',
      dailyWaterTargetLiters: 3.8,
    };
  }

  if (effectiveTemp >= 25) {
    return {
      status: 'CLIMA QUENTE: TRANSPIRAÇÃO ACENTUADA',
      volumePerInterval: '200 - 250 ml',
      intervalMinutes: 20,
      urgency: 'high',
      electrolytesRecommendation: 'Recomendado (Sais minerais / Eletrólitos)',
      tip: 'Ingestão periódica antes da sensação de sede. Para treinos acima de 45 minutos, intercale água pura e repositor eletrolítico.',
      dailyWaterTargetLiters: 3.2,
    };
  }

  if (effectiveTemp >= 19) {
    return {
      status: 'CLIMA MODERADO: CONDIÇÕES FAVORÁVEIS',
      volumePerInterval: '150 - 200 ml',
      intervalMinutes: 20,
      urgency: 'normal',
      electrolytesRecommendation: 'Opcional (Água fresca é suficiente para < 1h)',
      tip: 'Mantenha hidratação contínua em pequenos goles para evitar distensão gástrica durante passadas de ritmo elevado.',
      dailyWaterTargetLiters: 2.7,
    };
  }

  if (effectiveTemp >= 13) {
    return {
      status: 'CLIMA IDEAL DE PROVA: ALTA EFICIÊNCIA',
      volumePerInterval: '120 - 150 ml',
      intervalMinutes: 25,
      urgency: 'low',
      electrolytesRecommendation: 'Não essencial durante o treino curto',
      tip: 'Faixa térmica ideal para quebra de recordes pessoais (PR). A sede diminui no frio, mas mantenha goles regulares.',
      dailyWaterTargetLiters: 2.3,
    };
  }

  return {
    status: 'CLIMA FRIO: DESIDRATAÇÃO RESPIRATÓRIA',
    volumePerInterval: '100 - 120 ml',
    intervalMinutes: 30,
    urgency: 'low',
    electrolytesRecommendation: 'Pós-treino se necessário',
    tip: 'O ar seco e frio acelera a perda hídrica pela respiração. Beba água em temperatura ambiente para evitar choque térmico.',
    dailyWaterTargetLiters: 2.2,
  };
}

/**
 * Generates equipment and gear suggestions customized for real-time conditions.
 */
export function generateGearSuggestions(
  tempC: number,
  apparentTempC: number,
  condition: WeatherCondition,
  isDay: boolean,
  windSpeedKmh: number,
  humidity: number
): GearSuggestion[] {
  const suggestions: GearSuggestion[] = [];

  // 1. Rain / Wet Conditions
  if (condition.isRain || condition.isThunder) {
    suggestions.push({
      id: 'gear-rain-hat',
      title: 'Boné ou Viseira de Aba Curva',
      category: 'protecao',
      icon: '🧢',
      reason: 'Desvia a água da chuva e respingos diretamente dos olhos, preservando a visão do percurso.',
      importance: 'obrigatorio',
    });
    suggestions.push({
      id: 'gear-rain-jacket',
      title: 'Corta-Vento Hidrorrepelente Leve',
      category: 'vestuario',
      icon: '🧥',
      reason: 'Impede o vento frio de acelerar o resfriamento corpóreo com a roupa molhada.',
      importance: 'obrigatorio',
    });
    suggestions.push({
      id: 'gear-socks-synthetic',
      title: 'Meias Sintéticas Anti-Bolhas (Poliamida/Coolmax)',
      category: 'calcado',
      icon: '🧦',
      reason: 'Não retêm água e minimizam o atrito nos pés encharcados, evitando bolhas.',
      importance: 'recomendado',
    });
    suggestions.push({
      id: 'gear-shoes-grip',
      title: 'Tênis com Borracha Aderente (Grip Molhado)',
      category: 'calcado',
      icon: '👟',
      reason: 'Atenção extra a faixas pintadas e bueiros de metal molhados que ficam escorregadios.',
      importance: 'obrigatorio',
    });
  }

  // 2. Sun & High UV (Daytime and clear/hot)
  if (isDay && (tempC >= 22 || condition.isClear)) {
    suggestions.push({
      id: 'gear-sun-glasses',
      title: 'Óculos Esportivos UV400 Antiembaçantes',
      category: 'protecao',
      icon: '🕶️',
      reason: 'Protege a retina da radiação solar direta e reduz o reflexo incômodo do asfalto.',
      importance: tempC >= 26 ? 'obrigatorio' : 'recomendado',
    });
    suggestions.push({
      id: 'gear-sun-screen',
      title: 'Protetor Solar FPS 50+ Resistente a Suor',
      category: 'protecao',
      icon: '🧴',
      reason: 'Aplique nas orelhas, nuca, braços e pernas 15 minutos antes de iniciar.',
      importance: 'obrigatorio',
    });
    suggestions.push({
      id: 'gear-light-top',
      title: 'Regata ou Camiseta Dry-Fit Microperfurada',
      category: 'vestuario',
      icon: '👕',
      reason: 'Tecido de alta evaporação que ajuda a dispersar calor por convecção.',
      importance: 'recomendado',
    });
  }

  // 3. Cold Weather (< 16°C)
  if (tempC < 16) {
    suggestions.push({
      id: 'gear-thermal-sleeves',
      title: 'Manguitos Térmicos Removíveis',
      category: 'vestuario',
      icon: '🧤',
      reason: 'Aquecem os braços no início e podem ser abaixados aos punhos quando o corpo esquentar.',
      importance: tempC < 12 ? 'obrigatorio' : 'recomendado',
    });
    suggestions.push({
      id: 'gear-base-layer',
      title: 'Segunda Pele Térmica Respirável',
      category: 'vestuario',
      icon: '🥋',
      reason: 'Mantém a temperatura estável sem acumular umidade interna na pele.',
      importance: tempC < 10 ? 'obrigatorio' : 'recomendado',
    });
  }

  // 4. Night Running (isDay is false)
  if (!isDay) {
    suggestions.push({
      id: 'gear-night-lights',
      title: 'Luz LED Clip de Sinalização / Farol Peitoral',
      category: 'seguranca',
      icon: '🔦',
      reason: 'Indispensável para ser avistado por veículos e ciclistas a mais de 100m de distância.',
      importance: 'obrigatorio',
    });
    suggestions.push({
      id: 'gear-reflective-bands',
      title: 'Braçadeiras & Roupas com Detalhes Reflexivos 360°',
      category: 'seguranca',
      icon: '⚡',
      reason: 'Garante visualização periférica em cruzamentos e vias urbanas.',
      importance: 'obrigatorio',
    });
  }

  // 5. Strong Wind (> 20 km/h)
  if (windSpeedKmh >= 20) {
    suggestions.push({
      id: 'gear-wind-breaker',
      title: 'Jaqueta Corta-Vento Aerodinâmica Ajustada',
      category: 'vestuario',
      icon: '💨',
      reason: `Vento de ${windSpeedKmh.toFixed(0)} km/h aumenta o arrasto e a sensação de resfriamento.`,
      importance: 'recomendado',
    });
  }

  // 6. Hydration Bottle / Pack for Long / Hot runs
  if (tempC >= 25 || humidity <= 35) {
    suggestions.push({
      id: 'gear-soft-flask',
      title: 'Garrafa Soft Flask de Mão ou Cinto de Hidratação',
      category: 'acessorio',
      icon: '💧',
      reason: 'Permite carregar 300-500ml com acesso imediato e sem chacoalhar nas passadas.',
      importance: 'recomendado',
    });
  }

  return suggestions;
}

/**
 * Fetches real-time weather from the Open-Meteo Open Weather API.
 * Free, open, no key required, high precision.
 */
export async function fetchLiveWeather(position: LatLng): Promise<WeatherData> {
  const { lat, lng } = position;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&forecast_days=2&timezone=auto`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha na API Open Weather: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};
    const hourly = data.hourly || {};

    const tempC = Math.round((current.temperature_2m ?? 24) * 10) / 10;
    const apparentTempC = Math.round((current.apparent_temperature ?? tempC) * 10) / 10;
    const humidityPercent = Math.round(current.relative_humidity_2m ?? 60);
    const windSpeedKmh = Math.round((current.wind_speed_10m ?? 10) * 10) / 10;
    const precipitationMm = Math.round((current.precipitation ?? 0) * 10) / 10;
    const weatherCode = current.weather_code ?? 0;
    const isDay = current.is_day === 1;

    const hourlyForecast: HourlyForecastPoint[] = Array.isArray(hourly.time)
      ? hourly.time.map((t: string, idx: number) => ({
          time: t,
          temperatureC: Math.round((hourly.temperature_2m?.[idx] ?? tempC) * 10) / 10,
          precipitationMm: Math.round((hourly.precipitation?.[idx] ?? 0) * 10) / 10,
          precipitationProbability: Math.round(hourly.precipitation_probability?.[idx] ?? 0),
          weatherCode: hourly.weather_code?.[idx] ?? 0,
        }))
      : [];

    const condition = parseWeatherCode(weatherCode, isDay);
    const hydration = calculateHydrationPlan(tempC, apparentTempC, humidityPercent);
    const gearSuggestions = generateGearSuggestions(
      tempC,
      apparentTempC,
      condition,
      isDay,
      windSpeedKmh,
      humidityPercent
    );

    return {
      temperatureC: tempC,
      apparentTemperatureC: apparentTempC,
      humidityPercent,
      windSpeedKmh,
      precipitationMm,
      weatherCode,
      isDay,
      condition,
      hydration,
      gearSuggestions,
      hourlyForecast,
      locationName: `GPS ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (err) {
    console.warn('Erro ao obter clima ao vivo da API aberta Open-Meteo, usando estimativa tática local:', err);

    // Fallback based on current hour
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    const tempC = isDay ? 24 : 19;
    const apparentTempC = tempC + 1;
    const humidityPercent = 65;
    const windSpeedKmh = 12;
    const weatherCode = 1;

    const condition = parseWeatherCode(weatherCode, isDay);
    const hydration = calculateHydrationPlan(tempC, apparentTempC, humidityPercent);
    const gearSuggestions = generateGearSuggestions(
      tempC,
      apparentTempC,
      condition,
      isDay,
      windSpeedKmh,
      humidityPercent
    );

    return {
      temperatureC: tempC,
      apparentTemperatureC: apparentTempC,
      humidityPercent,
      windSpeedKmh,
      precipitationMm: 0,
      weatherCode,
      isDay,
      condition,
      hydration,
      gearSuggestions,
      hourlyForecast: [],
      locationName: 'Sensor Tático Local (Estimado)',
      fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }
}

const HEAVY_RAIN_WMO_CODES = new Set([65, 81, 82, 95, 96, 99]);
const STORM_WMO_CODES = new Set([95, 96, 99]);

export function formatLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Evaluates whether the weather forecast around a scheduled workout time indicates heavy rain
 * and recommends the next drier time window for rescheduling.
 */
export function evaluateHeavyRainForWorkoutTime(
  weather: WeatherData | null,
  scheduledTimeIso: string
): HeavyRainAssessment {
  const scheduledDate = new Date(scheduledTimeIso);
  const targetMs = Number.isNaN(scheduledDate.getTime()) ? Date.now() + 15 * 60 * 1000 : scheduledDate.getTime();
  const fallbackReschedule = new Date(targetMs + 2 * 60 * 60 * 1000);

  const defaultResult: HeavyRainAssessment = {
    isHeavyRain: false,
    severity: 'none',
    precipitationMm: weather?.precipitationMm ?? 0,
    precipitationProbability: 0,
    weatherCode: weather?.weatherCode ?? 0,
    conditionLabel: weather?.condition.label ?? 'Condições Estáveis',
    suggestedRescheduleIso: formatLocalDateTimeInput(fallbackReschedule),
    suggestedRescheduleLabel: fallbackReschedule.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  if (!weather) return defaultResult;

  // Match closest hourly slot to scheduled workout start
  let matchedSlot: HourlyForecastPoint | null = null;
  if (weather.hourlyForecast && weather.hourlyForecast.length > 0) {
    let minDiff = Infinity;
    for (const slot of weather.hourlyForecast) {
      const slotMs = new Date(slot.time).getTime();
      if (Number.isNaN(slotMs)) continue;
      const diff = Math.abs(slotMs - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        matchedSlot = slot;
      }
    }
  }

  const withinOneHour = Math.abs(targetMs - Date.now()) <= 60 * 60 * 1000;
  const precipMm = withinOneHour
    ? Math.max(weather.precipitationMm, matchedSlot?.precipitationMm ?? 0)
    : matchedSlot?.precipitationMm ?? weather.precipitationMm;
  const precipProb = matchedSlot?.precipitationProbability ?? (weather.condition.isRain ? 80 : 10);
  const code =
    withinOneHour && HEAVY_RAIN_WMO_CODES.has(weather.weatherCode)
      ? weather.weatherCode
      : matchedSlot?.weatherCode ?? weather.weatherCode;

  const isStorm = STORM_WMO_CODES.has(code) || precipMm >= 15;
  const isHeavyRain =
    isStorm ||
    HEAVY_RAIN_WMO_CODES.has(code) ||
    precipMm >= 7.5 ||
    (precipProb >= 75 && precipMm >= 4.0);

  let severity: HeavyRainAssessment['severity'] = 'none';
  if (isStorm) severity = 'storm';
  else if (isHeavyRain) severity = 'heavy';
  else if (precipMm >= 2.0 || precipProb >= 55) severity = 'moderate';

  // Find next dry/clear window at least 1 hour after the scheduled time
  let suggestedDate = fallbackReschedule;
  if (weather.hourlyForecast && weather.hourlyForecast.length > 0) {
    const drySlot = weather.hourlyForecast.find((slot) => {
      const slotMs = new Date(slot.time).getTime();
      return (
        slotMs >= targetMs + 60 * 60 * 1000 &&
        !HEAVY_RAIN_WMO_CODES.has(slot.weatherCode) &&
        slot.precipitationMm < 2.0 &&
        slot.precipitationProbability < 45
      );
    });
    if (drySlot) {
      const parsed = new Date(drySlot.time);
      if (!Number.isNaN(parsed.getTime())) suggestedDate = parsed;
    }
  }

  const isTomorrow = suggestedDate.getDate() !== new Date().getDate();
  const timePart = suggestedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const suggestedRescheduleLabel = isTomorrow ? `Amanhã às ${timePart}` : `Hoje às ${timePart}`;

  const hourNum = scheduledDate.getHours();
  const cond = parseWeatherCode(code, hourNum >= 6 && hourNum < 18);

  return {
    isHeavyRain,
    severity,
    precipitationMm: Number(precipMm.toFixed(1)),
    precipitationProbability: precipProb,
    weatherCode: code,
    conditionLabel: cond.label,
    suggestedRescheduleIso: formatLocalDateTimeInput(suggestedDate),
    suggestedRescheduleLabel,
  };
}
