"use client";

export interface ParsedAddressQuery {
  rawQuery: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  isApproximate: boolean;
  locationType?: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
  requestedNumber?: string | null;
  matchedNumber?: string | null;
  exactNumberMatched: boolean;
  exactStreetMatched: boolean;
  streetMismatchReason?: string;
  unconfirmedReason?: string;
  source: string;
  addressComponents?: {
    streetNumber?: string;
    route?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

const getGoogleApiKey = (): string | null => {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
};

// 1. PARSER ESTRUTURADO DE ENDEREÇO DA CONSULTA
export function parseAddressQuery(rawQuery: string): ParsedAddressQuery {
  const query = rawQuery.trim();
  if (!query) {
    return { rawQuery, street: null, number: null, neighborhood: null, city: null, state: null };
  }

  // Extrair número residencial se presente
  let number: string | null = null;
  const numberMatch = query.match(/(?:n[ºº°]\s*|,\s*|\s+)(\d{1,5})(?:\s*[,-]|\s+|$)/i);
  if (numberMatch && numberMatch[1]) {
    number = numberMatch[1].trim();
  }

  // Dividir a consulta por vírgulas
  const parts = query.split(',').map(p => p.trim()).filter(Boolean);

  let street: string | null = null;
  let neighborhood: string | null = null;
  let city: string | null = null;
  let state: string | null = null;

  if (parts.length >= 1) {
    // A primeira parte geralmente é a rua (removendo o número se estiver concatenado)
    let rawStreet = parts[0];
    if (number) {
      rawStreet = rawStreet.replace(new RegExp(`(?:n[ºº°]\\s*|,\\s*|\\s+)${number}(?:\\s*[,-]|\\s+|$)`, 'i'), '').trim();
    }
    street = rawStreet || parts[0];
  }

  if (parts.length >= 2) {
    // Se a segunda parte for apenas número, tentar capturar o bairro na próxima
    if (parts[1].match(/^\d{1,5}$/)) {
      if (parts[2]) neighborhood = parts[2];
      if (parts[3]) city = parts[3];
    } else {
      neighborhood = parts[1];
    }
  }

  if (parts.length >= 3 && !city) {
    city = parts[2];
  }

  // Verificar se cidade ou estado foram informados
  if (query.toLowerCase().includes('campina grande')) {
    city = 'Campina Grande';
  }
  if (query.toLowerCase().includes('pb') || query.toLowerCase().includes('paraíba') || query.toLowerCase().includes('paraiba')) {
    state = 'PB';
  }

  return {
    rawQuery,
    street,
    number,
    neighborhood,
    city: city || 'Campina Grande',
    state: state || 'PB'
  };
}

// 2. NORMALIZAÇÃO DO NOME DA VIA E EXTRAÇÃO DE TOKENS SIGNIFICATIVOS
const STREET_PREFIXES = [
  'rua', 'r.', 'r', 'avenida', 'av.', 'av', 'travessa', 'trv.', 'trv',
  'alameda', 'alm.', 'rodovia', 'rod.', 'rod', 'praca', 'praça', 'servidao',
  'servidão', 'estrada', 'est.', 'est', 'viaduto', 'vdt.'
];

const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'com', 'sem', 'para']);

export function normalizeStreetName(streetName: string): string {
  if (!streetName) return '';
  let normalized = streetName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/gi, ' ') // Remove pontuação
    .replace(/\s+/g, ' ')
    .trim();

  // Remover prefixos comuns de vias
  STREET_PREFIXES.forEach(prefix => {
    const regex = new RegExp(`^${prefix}\\s+`, 'i');
    normalized = normalized.replace(regex, '');
  });

  return normalized.trim();
}

export function getSignificantTokens(text: string): string[] {
  const normalized = normalizeStreetName(text);
  return normalized.split(' ')
    .filter(token => token.length >= 2 && !STOP_WORDS.has(token));
}

// 3. VALIDAÇÃO RÍGIDA DE CORRESPONDÊNCIA DE LOGRADOURO
export function validateStreetMatch(requestedStreet: string, candidateRoute: string): {
  isMatch: boolean;
  matchScore: number;
  reason?: string;
} {
  if (!requestedStreet || !candidateRoute) {
    return { isMatch: false, matchScore: 0, reason: 'Logradouro não informado' };
  }

  const reqTokens = getSignificantTokens(requestedStreet);
  const candTokens = getSignificantTokens(candidateRoute);

  if (reqTokens.length === 0) {
    return { isMatch: true, matchScore: 100 };
  }

  let matchedCount = 0;
  const missingTokens: string[] = [];

  reqTokens.forEach(reqToken => {
    const found = candTokens.some(candToken => {
      return candToken === reqToken || candToken.includes(reqToken) || reqToken.includes(candToken);
    });

    if (found) {
      matchedCount++;
    } else {
      missingTokens.push(reqToken);
    }
  });

  const matchRatio = matchedCount / reqTokens.length;

  // Requisitar que pelo menos 66% das palavras significativas coincidam
  if (matchRatio >= 0.66) {
    return { isMatch: true, matchScore: Math.round(matchRatio * 100) };
  }

  return {
    isMatch: false,
    matchScore: Math.round(matchRatio * 100),
    reason: `Incompatibilidade de logradouro: ausência do(s) termo(s) '${missingTokens.join(', ')}' em '${candidateRoute}'`
  };
}

// 4. PARSER DE COMPONENTES DE ENDEREÇO DO GOOGLE
export function parseAddressComponents(components: any[] = []) {
  const result = {
    streetNumber: '',
    route: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: ''
  };

  if (!Array.isArray(components)) return result;

  components.forEach(comp => {
    const types: string[] = comp.types || [];
    if (types.includes('street_number')) {
      result.streetNumber = comp.long_name || comp.short_name || '';
    } else if (types.includes('route')) {
      result.route = comp.long_name || comp.short_name || '';
    } else if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
      result.neighborhood = comp.long_name || comp.short_name || '';
    } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      result.city = comp.long_name || comp.short_name || '';
    } else if (types.includes('administrative_area_level_1')) {
      result.state = comp.short_name || comp.long_name || '';
    } else if (types.includes('postal_code')) {
      result.postalCode = comp.long_name || comp.short_name || '';
    }
  });

  return result;
}

// 5. SISTEMA DE AVALIAÇÃO, PONTUAÇÃO E RANKING DOS CANDIDATOS
function rankAndSelectBestCandidate(results: any[], parsedQuery: ParsedAddressQuery): {
  selected: any | null;
  exactStreetMatched: boolean;
  exactNumberMatched: boolean;
  requestedNumber: string | null;
  matchedNumber: string | null;
  streetMismatchReason?: string;
  unconfirmedReason?: string;
  evaluatedLog: any[];
} {
  const evaluatedLog: any[] = [];
  const requestedNum = parsedQuery.number;
  const requestedStreet = parsedQuery.street || '';

  let bestCandidate: any | null = null;
  let highestScore = -Infinity;
  let bestExactStreetMatched = false;
  let bestExactNumberMatched = false;
  let bestMatchedNumber: string | null = null;
  let bestStreetMismatchReason: string | undefined = undefined;
  let bestUnconfirmedReason: string | undefined = undefined;

  results.forEach((item, index) => {
    let score = 0;
    const geometry = item.geometry || {};
    const locType = geometry.location_type || 'APPROXIMATE';
    const components = parseAddressComponents(item.address_components || []);
    const types: string[] = item.types || [];

    let isStreetMatch = true;
    let streetReason = '';
    let isNumberMatch = false;

    // A. DESQUALIFICAÇÃO: Se o usuário pesquisou por um endereço e o resultado for puramente uma Cidade/Estado
    const isPureLocality = types.includes('locality') || types.includes('administrative_area_level_1') || types.includes('political');
    const hasRoute = !!components.route;

    if (requestedStreet && isPureLocality && !hasRoute) {
      evaluatedLog.push({
        index,
        formattedAddress: item.formatted_address,
        score: -1000,
        status: 'REJECTED_GENERIC_CITY',
        reason: 'O resultado é apenas um município/estado e não um logradouro específico.'
      });
      return;
    }

    // B. VALIDAÇÃO RÍGIDA DO NOME DO LOGRADOURO
    if (requestedStreet) {
      const candidateRoute = components.route || item.formatted_address || '';
      const streetValidation = validateStreetMatch(requestedStreet, candidateRoute);

      if (!streetValidation.isMatch) {
        isStreetMatch = false;
        streetReason = streetValidation.reason || 'Nome da rua incompatível';
        evaluatedLog.push({
          index,
          formattedAddress: item.formatted_address,
          candidateRoute,
          score: -500,
          status: 'REJECTED_STREET_MISMATCH',
          reason: streetReason
        });
        return; // REJEIÇÃO CATEGÓRICA: Não aceita "Carlos Agra" para "Vereador Alberto Agra"
      } else {
        score += streetValidation.matchScore * 2; // Pontuação alta por correspondência do nome
      }
    }

    // C. PONTUAÇÃO DO TIPO DE PRECISÃO GEOGRÁFICA
    if (locType === 'ROOFTOP') {
      score += 100;
    } else if (locType === 'RANGE_INTERPOLATED') {
      score += 80;
    } else if (locType === 'GEOMETRIC_CENTER') {
      score += 40;
    } else {
      score += 10;
    }

    // D. PONTUAÇÃO E VALIDAÇÃO DO NÚMERO RESIDENCIAL
    if (requestedNum) {
      if (components.streetNumber && components.streetNumber.trim() === requestedNum.trim()) {
        score += 150;
        isNumberMatch = true;
      } else if (components.streetNumber) {
        score -= 50; // Número diferente
      } else {
        score -= 20; // Sem número individualizado
      }
    }

    // E. CORRESPONDÊNCIA DE BAIRRO E CIDADE
    if (parsedQuery.neighborhood && components.neighborhood && components.neighborhood.toLowerCase().includes(parsedQuery.neighborhood.toLowerCase())) {
      score += 30;
    }
    if (parsedQuery.city && components.city && components.city.toLowerCase().includes(parsedQuery.city.toLowerCase())) {
      score += 20;
    }

    evaluatedLog.push({
      index,
      formattedAddress: item.formatted_address,
      candidateRoute: components.route,
      candidateNumber: components.streetNumber,
      locationType: locType,
      placeId: item.place_id,
      score,
      status: 'ACCEPTED_CANDIDATE',
      isStreetMatch,
      isNumberMatch
    });

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = item;
      bestExactStreetMatched = isStreetMatch;
      bestExactNumberMatched = isNumberMatch;
      bestMatchedNumber = components.streetNumber || null;
      bestStreetMismatchReason = isStreetMatch ? undefined : streetReason;

      if (requestedNum && !isNumberMatch) {
        if (locType === 'GEOMETRIC_CENTER') {
          bestUnconfirmedReason = `Via localizada, mas o número ${requestedNum} é exibido no centro da rua pelo Google.`;
        } else if (components.streetNumber) {
          bestUnconfirmedReason = `O Google retornou o número ${components.streetNumber} em vez do número ${requestedNum} solicitado.`;
        } else {
          bestUnconfirmedReason = `Número ${requestedNum} não cadastrado individualmente no mapa do Google.`;
        }
      } else {
        bestUnconfirmedReason = undefined;
      }
    }
  });

  return {
    selected: bestCandidate,
    exactStreetMatched: bestExactStreetMatched,
    exactNumberMatched: bestExactNumberMatched,
    requestedNumber: requestedNum,
    matchedNumber: bestMatchedNumber,
    streetMismatchReason: bestStreetMismatchReason,
    unconfirmedReason: bestUnconfirmedReason,
    evaluatedLog
  };
}

// 6. IMPRESSÃO DE DIAGNÓSTICO TEMPORÁRIO NO CONSOLE
function printDiagnosticAuditLog(data: {
  parsedQuery: ParsedAddressQuery;
  apiSource: string;
  status: string;
  resultsCount: number;
  evaluatedCandidates: any[];
  chosenCandidate: GeocodedAddress | null;
}) {
  console.group(`🔍 [DIAGNÓSTICO E AUDITORIA DE BUSCA DE ENDEREÇO] — ${new Date().toLocaleTimeString('pt-BR')}`);
  console.log(`📌 ENTRADA ORIGINAL: "${data.parsedQuery.rawQuery}"`);
  console.log(`🧩 COMPONENTES PARSEADOS:`, {
    parsedStreet: data.parsedQuery.street,
    parsedNumber: data.parsedQuery.number,
    parsedNeighborhood: data.parsedQuery.neighborhood,
    parsedCity: data.parsedQuery.city,
    parsedState: data.parsedQuery.state
  });
  console.log(`🌐 API CONSULTADA: ${data.apiSource} | STATUS: ${data.status} | CANDIDATOS: ${data.resultsCount}`);
  console.log(`📋 RANKING E AVALIAÇÃO DOS CANDIDATOS:`, data.evaluatedCandidates);

  if (data.chosenCandidate) {
    console.log(`🏆 CANDIDATO SELECIONADO FINAL:`, {
      formattedAddress: data.chosenCandidate.formattedAddress,
      lat: data.chosenCandidate.lat,
      lng: data.chosenCandidate.lng,
      placeId: data.chosenCandidate.placeId || 'N/A',
      locationType: data.chosenCandidate.locationType,
      exactStreetMatched: data.chosenCandidate.exactStreetMatched ? 'SIM ✅' : 'NÃO ⚠️',
      exactNumberMatched: data.chosenCandidate.exactNumberMatched ? 'SIM ✅' : 'NÃO ⚠️',
      unconfirmedReason: data.chosenCandidate.unconfirmedReason || 'Nenhum'
    });
  } else {
    console.warn(`❌ NENHUM CANDIDATO VÁLIDO ATENDEU AOS CRITÉRIOS DE LOGRADOURO!`);
  }
  console.groupEnd();
}

export async function geocodeAddress(address: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
} | string): Promise<GeocodedAddress | null> {
  let street = '';
  let number = '';
  let neighborhood = '';
  let city = 'Campina Grande';
  let state = 'PB';

  if (typeof address === 'string') {
    street = address;
  } else if (address) {
    street = address.street || '';
    number = address.number || '';
    neighborhood = address.neighborhood || '';
    city = address.city || 'Campina Grande';
    state = address.state || 'PB';
  }

  if (!street) return null;

  const rawQuery = typeof address === 'string'
    ? address.trim()
    : `${street} ${number}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();

  return searchFreeTextAddress(rawQuery);
}

// BUSCA PRINCIPAL DE ENDEREÇO COM SUPORTE A GOOGLE MAPS PLATFORM
export async function searchFreeTextAddress(originalQuery: string): Promise<GeocodedAddress | null> {
  const parsedQuery = parseAddressQuery(originalQuery);
  if (!parsedQuery.rawQuery) return null;

  const apiKey = getGoogleApiKey();

  // Garante viés para Campina Grande / PB sem fechar totalmente os limites
  const queryWithContext = parsedQuery.rawQuery.toLowerCase().includes('campina grande')
    ? parsedQuery.rawQuery
    : `${parsedQuery.rawQuery}, Campina Grande - PB, Brasil`;

  // ETAPA 1: Google Maps JS SDK Geocoder
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({
          address: queryWithContext,
          componentRestrictions: { country: 'BR' }
        }, (results: any[], status: string) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve({ results, status });
          } else {
            resolve({ results: [], status: status || 'ZERO_RESULTS' });
          }
        });
      });

      if (response.results && response.results.length > 0) {
        const ranking = rankAndSelectBestCandidate(response.results, parsedQuery);

        if (ranking.selected) {
          const top = ranking.selected;
          const lat = top.geometry.location.lat();
          const lng = top.geometry.location.lng();
          const locType = top.geometry.location_type || 'APPROXIMATE';
          const parsedComp = parseAddressComponents(top.address_components || []);

          const finalResult: GeocodedAddress = {
            lat,
            lng,
            formattedAddress: top.formatted_address || queryWithContext,
            placeId: top.place_id,
            isApproximate: locType === 'APPROXIMATE' || locType === 'GEOMETRIC_CENTER' || !ranking.exactNumberMatched,
            locationType: locType,
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber,
            exactNumberMatched: ranking.exactNumberMatched,
            exactStreetMatched: ranking.exactStreetMatched,
            unconfirmedReason: ranking.unconfirmedReason,
            source: 'google_js_sdk',
            addressComponents: parsedComp
          };

          printDiagnosticAuditLog({
            parsedQuery,
            apiSource: 'Google Maps JS Geocoder SDK',
            status: response.status,
            resultsCount: response.results.length,
            evaluatedCandidates: ranking.evaluatedLog,
            chosenCandidate: finalResult
          });

          return finalResult;
        }
      }
    } catch (err) {
      console.warn('Erro na chamada JS SDK Geocoder:', err);
    }
  }

  // ETAPA 2: Google Geocoding REST API (usando VITE_GOOGLE_MAPS_API_KEY)
  if (apiKey) {
    try {
      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryWithContext)}&key=${apiKey}&language=pt-BR&components=country:BR`;
      const gRes = await fetch(googleGeocodeUrl);
      const gData = await gRes.json();

      if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
        const ranking = rankAndSelectBestCandidate(gData.results, parsedQuery);

        if (ranking.selected) {
          const top = ranking.selected;
          const lat = top.geometry.location.lat;
          const lng = top.geometry.location.lng;
          const locType = top.geometry.location_type || 'APPROXIMATE';
          const parsedComp = parseAddressComponents(top.address_components || []);

          const finalResult: GeocodedAddress = {
            lat,
            lng,
            formattedAddress: top.formatted_address || queryWithContext,
            placeId: top.place_id,
            isApproximate: locType === 'APPROXIMATE' || locType === 'GEOMETRIC_CENTER' || !ranking.exactNumberMatched,
            locationType: locType,
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber,
            exactNumberMatched: ranking.exactNumberMatched,
            exactStreetMatched: ranking.exactStreetMatched,
            unconfirmedReason: ranking.unconfirmedReason,
            source: 'google_rest_geocoding',
            addressComponents: parsedComp
          };

          printDiagnosticAuditLog({
            parsedQuery,
            apiSource: 'Google Geocoding REST API',
            status: gData.status,
            resultsCount: gData.results.length,
            evaluatedCandidates: ranking.evaluatedLog,
            chosenCandidate: finalResult
          });

          return finalResult;
        }
      }
    } catch (err) {
      console.warn('Erro na chamada Google Geocoding REST API:', err);
    }

    // ETAPA 3: Google Places Text Search REST API
    try {
      const googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryWithContext)}&key=${apiKey}&language=pt-BR&location=-7.2247,-35.8878&radius=20000`;
      const pRes = await fetch(googlePlacesUrl);
      const pData = await pRes.json();

      if (pData.status === 'OK' && pData.results && pData.results.length > 0) {
        const ranking = rankAndSelectBestCandidate(pData.results, parsedQuery);

        if (ranking.selected) {
          const top = ranking.selected;
          const lat = top.geometry.location.lat;
          const lng = top.geometry.location.lng;

          const finalResult: GeocodedAddress = {
            lat,
            lng,
            formattedAddress: top.formatted_address || top.name || queryWithContext,
            placeId: top.place_id,
            isApproximate: false,
            locationType: 'ROOFTOP',
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber,
            exactNumberMatched: ranking.exactNumberMatched,
            exactStreetMatched: ranking.exactStreetMatched,
            source: 'google_places_textsearch'
          };

          printDiagnosticAuditLog({
            parsedQuery,
            apiSource: 'Google Places Text Search REST API',
            status: pData.status,
            resultsCount: pData.results.length,
            evaluatedCandidates: ranking.evaluatedLog,
            chosenCandidate: finalResult
          });

          return finalResult;
        }
      }
    } catch (err) {
      console.warn('Erro na chamada Google Places Text Search REST API:', err);
    }
  }

  // ETAPA 4: Backup de Apoio Esri World Geocoding
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(queryWithContext)}&f=json&maxLocations=5&location=-35.8878,-7.2247`;
    const esriRes = await fetch(esriUrl);
    const esriData = await esriRes.json();

    if (esriData && esriData.candidates && esriData.candidates.length > 0) {
      const top = esriData.candidates[0];
      const loc = top.location;
      const score = top.score || 100;

      // Validação do logradouro retornado no Esri
      if (parsedQuery.street) {
        const validation = validateStreetMatch(parsedQuery.street, top.address || '');
        if (!validation.isMatch) {
          printDiagnosticAuditLog({
            parsedQuery,
            apiSource: 'Esri World Geocoding (Backup)',
            status: 'REJECTED_STREET_MISMATCH',
            resultsCount: esriData.candidates.length,
            evaluatedCandidates: [{ address: top.address, reason: validation.reason }],
            chosenCandidate: null
          });
          return null;
        }
      }

      const finalResult: GeocodedAddress = {
        lat: loc.y,
        lng: loc.x,
        formattedAddress: top.address || queryWithContext,
        isApproximate: score < 80,
        locationType: score >= 90 ? 'ROOFTOP' : 'GEOMETRIC_CENTER',
        requestedNumber: parsedQuery.number,
        exactNumberMatched: score >= 90,
        exactStreetMatched: true,
        source: 'esri_fallback'
      };

      printDiagnosticAuditLog({
        parsedQuery,
        apiSource: 'Esri World Geocoding (Backup)',
        status: 'OK',
        resultsCount: esriData.candidates.length,
        evaluatedCandidates: [{ address: top.address, score }],
        chosenCandidate: finalResult
      });

      return finalResult;
    }
  } catch (e) {}

  printDiagnosticAuditLog({
    parsedQuery,
    apiSource: 'Nenhuma API retornou correspondência válida',
    status: 'ZERO_RESULTS',
    resultsCount: 0,
    evaluatedCandidates: [],
    chosenCandidate: null
  });

  return null;
}