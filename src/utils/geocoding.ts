"use client";

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

// Extrai o número residencial do originalQuery
export function extractRequestedNumber(query: string): string | null {
  if (!query) return null;
  const match = query.match(/(?:n[ºº°]\s*|,\s*|\s+)(\d{1,5})(?:\s*[,-]|\s+|$)/i);
  return match && match[1] ? match[1].trim() : null;
}

// Extrai componentes estruturados da resposta do Google
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

// Sistema de Pontuação e Ranking dos Candidatos do Google Geocoding
function rankAndSelectBestCandidate(results: any[], originalQuery: string): {
  selected: any;
  exactNumberMatched: boolean;
  requestedNumber: string | null;
  matchedNumber: string | null;
  unconfirmedReason?: string;
  evaluatedLog: any[];
} {
  const requestedNum = extractRequestedNumber(originalQuery);
  const evaluatedLog: any[] = [];

  let bestCandidate = results[0];
  let highestScore = -Infinity;
  let bestExactMatch = false;
  let bestMatchedNumber: string | null = null;
  let bestUnconfirmedReason: string | undefined = undefined;

  results.forEach((item, index) => {
    let score = 0;
    const geometry = item.geometry || {};
    const locType = geometry.location_type || 'APPROXIMATE';
    const components = parseAddressComponents(item.address_components || []);
    let numberMatched = false;

    // 1. Pontuação do Tipo de Localização
    if (locType === 'ROOFTOP') {
      score += 100;
    } else if (locType === 'RANGE_INTERPOLATED') {
      score += 80;
    } else if (locType === 'GEOMETRIC_CENTER') {
      score += 40;
    } else {
      score += 10;
    }

    // 2. Pontuação do Número Residencial
    if (requestedNum) {
      if (components.streetNumber && components.streetNumber.trim() === requestedNum.trim()) {
        score += 150;
        numberMatched = true;
      } else if (components.streetNumber) {
        score -= 40;
      } else {
        score -= 20;
      }
    }

    // 3. Correspondência de Logradouro
    if (components.route && originalQuery.toLowerCase().includes(components.route.toLowerCase().replace('rua', '').replace('avenida', '').trim())) {
      score += 30;
    }

    evaluatedLog.push({
      index,
      formattedAddress: item.formatted_address,
      locationType: locType,
      placeId: item.place_id,
      extractedComponents: components,
      score,
      numberMatched
    });

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = item;
      bestExactMatch = numberMatched;
      bestMatchedNumber = components.streetNumber || null;

      if (requestedNum && !numberMatched) {
        if (locType === 'GEOMETRIC_CENTER') {
          bestUnconfirmedReason = `O Google localizou a rua, mas exibiu o centro da via (número ${requestedNum} não confirmado individualmente no mapa).`;
        } else if (components.streetNumber) {
          bestUnconfirmedReason = `O Google retornou o número ${components.streetNumber} em vez do número ${requestedNum} solicitado.`;
        } else {
          bestUnconfirmedReason = `Número ${requestedNum} não cadastrado na base oficial do Google Maps.`;
        }
      } else {
        bestUnconfirmedReason = undefined;
      }
    }
  });

  return {
    selected: bestCandidate,
    exactNumberMatched: bestExactMatch,
    requestedNumber: requestedNum,
    matchedNumber: bestMatchedNumber,
    unconfirmedReason: bestUnconfirmedReason,
    evaluatedLog
  };
}

// Imprime Diagnóstico Forense Detalhado
function printForensicDiagnostic(data: {
  originalQuery: string;
  apiSource: string;
  status: string;
  resultsCount: number;
  evaluatedCandidates?: any[];
  chosenCandidate?: {
    formattedAddress: string;
    lat: number;
    lng: number;
    placeId?: string;
    locationType?: string;
    exactNumberMatched: boolean;
    requestedNumber?: string | null;
    matchedNumber?: string | null;
    unconfirmedReason?: string;
  };
}) {
  console.group(`🔍 [DIAGNÓSTICO FORENSE GOOGLE MAPS] — ${new Date().toLocaleTimeString('pt-BR')}`);
  console.log(`📌 ENTRADA DO USUÁRIO (originalQuery): "${data.originalQuery}"`);
  console.log(`🌐 API UTILIZADA: ${data.apiSource}`);
  console.log(`📊 STATUS DA RESPOSTA: ${data.status} | RESULTADOS ENCONTRADOS: ${data.resultsCount}`);

  if (data.evaluatedCandidates && data.evaluatedCandidates.length > 0) {
    console.log(`📋 CANDIDATOS AVALIADOS E RANKING:`, data.evaluatedCandidates);
  }

  if (data.chosenCandidate) {
    console.log(`🏆 RESULTADO FINAL SELECIONADO:`);
    console.log(`   - Endereço Formatado: "${data.chosenCandidate.formattedAddress}"`);
    console.log(`   - Coordenadas Exatas: Lat ${data.chosenCandidate.lat}, Lng ${data.chosenCandidate.lng}`);
    console.log(`   - Place ID: ${data.chosenCandidate.placeId || 'N/A'}`);
    console.log(`   - Tipo de Precisão (location_type): ${data.chosenCandidate.locationType || 'N/A'}`);
    console.log(`   - Número Confirmado Exatamente?: ${data.chosenCandidate.exactNumberMatched ? 'SIM ✅' : 'NÃO ⚠️'}`);
    if (data.chosenCandidate.requestedNumber) {
      console.log(`   - Número Solicitado: ${data.chosenCandidate.requestedNumber} | Número Retornado: ${data.chosenCandidate.matchedNumber || 'Nenhum'}`);
    }
    if (data.chosenCandidate.unconfirmedReason) {
      console.warn(`   - Motivo de Incerteza: ${data.chosenCandidate.unconfirmedReason}`);
    }
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
  let zipCode = '';

  if (typeof address === 'string') {
    street = address;
  } else if (address) {
    street = address.street || '';
    number = address.number || '';
    neighborhood = address.neighborhood || '';
    city = address.city || 'Campina Grande';
    state = address.state || 'PB';
    zipCode = address.zipCode || '';
  }

  if (!street && !zipCode) return null;

  const originalQuery = typeof address === 'string'
    ? address.trim()
    : `${street} ${number}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();

  return searchFreeTextAddress(originalQuery);
}

// Busca principal por texto livre no Google Maps Platform
export async function searchFreeTextAddress(originalQuery: string): Promise<GeocodedAddress | null> {
  const query = originalQuery.trim();
  if (!query) return null;

  const apiKey = getGoogleApiKey();

  // Garante inclusão de contexto regional de Campina Grande / PB na consulta
  const formattedQuery = query.toLowerCase().includes('campina grande') || query.toLowerCase().includes('pb')
    ? query
    : `${query}, Campina Grande - PB, Brasil`;

  // ETAPA 1: Google Maps JS SDK Geocoder (se injetado no browser)
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({ 
          address: formattedQuery,
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
        const ranking = rankAndSelectBestCandidate(response.results, formattedQuery);
        const top = ranking.selected;
        const lat = top.geometry.location.lat();
        const lng = top.geometry.location.lng();
        const locType = top.geometry.location_type || 'APPROXIMATE';
        const isApprox = locType === 'APPROXIMATE' || locType === 'GEOMETRIC_CENTER' || !ranking.exactNumberMatched;
        const parsedComponents = parseAddressComponents(top.address_components || []);

        const finalResult: GeocodedAddress = {
          lat,
          lng,
          formattedAddress: top.formatted_address || formattedQuery,
          placeId: top.place_id,
          isApproximate: isApprox,
          locationType: locType,
          requestedNumber: ranking.requestedNumber,
          matchedNumber: ranking.matchedNumber,
          exactNumberMatched: ranking.exactNumberMatched,
          unconfirmedReason: ranking.unconfirmedReason,
          source: 'google_js_sdk',
          addressComponents: parsedComponents
        };

        printForensicDiagnostic({
          originalQuery: formattedQuery,
          apiSource: 'Google Maps JS Geocoder SDK',
          status: response.status,
          resultsCount: response.results.length,
          evaluatedCandidates: ranking.evaluatedLog,
          chosenCandidate: {
            formattedAddress: finalResult.formattedAddress,
            lat,
            lng,
            placeId: top.place_id,
            locationType: locType,
            exactNumberMatched: ranking.exactNumberMatched,
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber,
            unconfirmedReason: ranking.unconfirmedReason
          }
        });

        return finalResult;
      }
    } catch (err) {
      console.warn('Erro na chamada JS SDK Geocoder:', err);
    }
  }

  // ETAPA 2: Google Geocoding REST API (usando VITE_GOOGLE_MAPS_API_KEY)
  if (apiKey) {
    try {
      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formattedQuery)}&key=${apiKey}&language=pt-BR&components=country:BR`;
      const gRes = await fetch(googleGeocodeUrl);
      const gData = await gRes.json();

      if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
        const ranking = rankAndSelectBestCandidate(gData.results, formattedQuery);
        const top = ranking.selected;
        const lat = top.geometry.location.lat;
        const lng = top.geometry.location.lng;
        const locType = top.geometry.location_type || 'APPROXIMATE';
        const isApprox = locType === 'APPROXIMATE' || locType === 'GEOMETRIC_CENTER' || !ranking.exactNumberMatched;
        const parsedComponents = parseAddressComponents(top.address_components || []);

        const finalResult: GeocodedAddress = {
          lat,
          lng,
          formattedAddress: top.formatted_address || formattedQuery,
          placeId: top.place_id,
          isApproximate: isApprox,
          locationType: locType,
          requestedNumber: ranking.requestedNumber,
          matchedNumber: ranking.matchedNumber,
          exactNumberMatched: ranking.exactNumberMatched,
          unconfirmedReason: ranking.unconfirmedReason,
          source: 'google_rest_geocoding',
          addressComponents: parsedComponents
        };

        printForensicDiagnostic({
          originalQuery: formattedQuery,
          apiSource: 'Google Geocoding REST API',
          status: gData.status,
          resultsCount: gData.results.length,
          evaluatedCandidates: ranking.evaluatedLog,
          chosenCandidate: {
            formattedAddress: finalResult.formattedAddress,
            lat,
            lng,
            placeId: top.place_id,
            locationType: locType,
            exactNumberMatched: ranking.exactNumberMatched,
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber,
            unconfirmedReason: ranking.unconfirmedReason
          }
        });

        return finalResult;
      }
    } catch (err) {
      console.warn('Erro na chamada Google Geocoding REST API:', err);
    }

    // ETAPA 3: Google Places Text Search REST API
    try {
      const googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(formattedQuery)}&key=${apiKey}&language=pt-BR&location=-7.2247,-35.8878&radius=20000`;
      const pRes = await fetch(googlePlacesUrl);
      const pData = await pRes.json();

      if (pData.status === 'OK' && pData.results && pData.results.length > 0) {
        const ranking = rankAndSelectBestCandidate(pData.results, formattedQuery);
        const top = ranking.selected;
        const lat = top.geometry.location.lat;
        const lng = top.geometry.location.lng;

        const finalResult: GeocodedAddress = {
          lat,
          lng,
          formattedAddress: top.formatted_address || top.name || formattedQuery,
          placeId: top.place_id,
          isApproximate: false,
          locationType: 'ROOFTOP',
          requestedNumber: ranking.requestedNumber,
          matchedNumber: ranking.matchedNumber,
          exactNumberMatched: ranking.exactNumberMatched,
          source: 'google_places_textsearch'
        };

        printForensicDiagnostic({
          originalQuery: formattedQuery,
          apiSource: 'Google Places Text Search REST API',
          status: pData.status,
          resultsCount: pData.results.length,
          evaluatedCandidates: ranking.evaluatedLog,
          chosenCandidate: {
            formattedAddress: finalResult.formattedAddress,
            lat,
            lng,
            placeId: top.place_id,
            locationType: 'ROOFTOP',
            exactNumberMatched: ranking.exactNumberMatched,
            requestedNumber: ranking.requestedNumber,
            matchedNumber: ranking.matchedNumber
          }
        });

        return finalResult;
      }
    } catch (err) {
      console.warn('Erro na chamada Google Places Text Search REST API:', err);
    }
  }

  // ETAPA 4: Backup de Apoio (Esri World Geocoding)
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(formattedQuery)}&f=json&maxLocations=3&location=-35.8878,-7.2247`;
    const esriRes = await fetch(esriUrl);
    const esriData = await esriRes.json();

    if (esriData && esriData.candidates && esriData.candidates.length > 0) {
      const top = esriData.candidates[0];
      const loc = top.location;
      const score = top.score || 100;
      const reqNum = extractRequestedNumber(formattedQuery);

      const finalResult: GeocodedAddress = {
        lat: loc.y,
        lng: loc.x,
        formattedAddress: top.address || formattedQuery,
        isApproximate: score < 80,
        locationType: score >= 90 ? 'ROOFTOP' : 'GEOMETRIC_CENTER',
        requestedNumber: reqNum,
        exactNumberMatched: score >= 90,
        source: 'esri_fallback'
      };

      printForensicDiagnostic({
        originalQuery: formattedQuery,
        apiSource: 'Esri World Geocoding (Backup)',
        status: 'OK',
        resultsCount: esriData.candidates.length,
        chosenCandidate: {
          formattedAddress: finalResult.formattedAddress,
          lat: loc.y,
          lng: loc.x,
          locationType: finalResult.locationType,
          exactNumberMatched: finalResult.exactNumberMatched,
          requestedNumber: reqNum
        }
      });

      return finalResult;
    }
  } catch (e) {}

  printForensicDiagnostic({
    originalQuery: formattedQuery,
    apiSource: 'Nenhuma API respondeu',
    status: 'ZERO_RESULTS',
    resultsCount: 0
  });

  return null;
}