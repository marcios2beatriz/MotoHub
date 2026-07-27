"use client";

export interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  isApproximate?: boolean;
  source?: string;
}

const getGoogleApiKey = (): string | null => {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
};

// Log de diagnóstico padronizado
const logDiagnostic = (data: {
  originalQuery: string;
  apiUsed: string;
  paramsSent: any;
  responseStatus: string;
  resultsCount: number;
  returnedAddress?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  discardReason?: string;
}) => {
  console.log(`[Google Maps Diagnostic] --------------------`);
  console.log(`originalQuery:`, data.originalQuery);
  console.log(`API Utilizada:`, data.apiUsed);
  console.log(`Parâmetros Enviados:`, data.paramsSent);
  console.log(`Status da Resposta:`, data.responseStatus);
  console.log(`Quantidade de Resultados:`, data.resultsCount);
  if (data.returnedAddress) console.log(`Endereço Retornado:`, data.returnedAddress);
  if (data.lat !== undefined && data.lng !== undefined) console.log(`Coordenadas: Lat ${data.lat}, Lng ${data.lng}`);
  if (data.placeId) console.log(`Place ID:`, data.placeId);
  if (data.discardReason) console.log(`Motivo de Descarte:`, data.discardReason);
  console.log(`---------------------------------------------`);
};

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

// Busca por Texto Livre (Geocoding API + Places Text Search + Fallbacks)
export async function searchFreeTextAddress(originalQuery: string): Promise<GeocodedAddress | null> {
  const query = originalQuery.trim();
  if (!query) return null;

  const apiKey = getGoogleApiKey();

  // ETAPA 1: Google Maps JS SDK (caso já esteja injetado no browser)
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address: query }, (results: any[], status: string) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve({ results, status });
          } else {
            resolve({ results: [], status });
          }
        });
      });

      if (response.results && response.results.length > 0) {
        const top = response.results[0];
        const lat = top.geometry.location.lat();
        const lng = top.geometry.location.lng();
        const locationType = top.geometry.location_type;
        const isApprox = locationType === 'APPROXIMATE';

        logDiagnostic({
          originalQuery: query,
          apiUsed: 'Google Maps JS Geocoder SDK',
          paramsSent: { address: query },
          responseStatus: response.status,
          resultsCount: response.results.length,
          returnedAddress: top.formatted_address,
          lat,
          lng,
          placeId: top.place_id
        });

        return {
          lat,
          lng,
          formattedAddress: top.formatted_address || query,
          placeId: top.place_id,
          isApproximate: isApprox,
          source: 'google_js_sdk'
        };
      }
    } catch (err) {
      console.warn('Erro ao executar Geocoder no JS SDK do Google:', err);
    }
  }

  // ETAPA 2: Google Geocoding REST API (utilizando VITE_GOOGLE_MAPS_API_KEY)
  if (apiKey) {
    try {
      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&language=pt-BR`;
      const gRes = await fetch(googleGeocodeUrl);
      const gData = await gRes.json();

      if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
        const top = gData.results[0];
        const lat = top.geometry.location.lat;
        const lng = top.geometry.location.lng;
        const isApprox = top.geometry.location_type === 'APPROXIMATE';

        logDiagnostic({
          originalQuery: query,
          apiUsed: 'Google Geocoding REST API',
          paramsSent: { address: query, key: 'CONFIGURED' },
          responseStatus: gData.status,
          resultsCount: gData.results.length,
          returnedAddress: top.formatted_address,
          lat,
          lng,
          placeId: top.place_id
        });

        return {
          lat,
          lng,
          formattedAddress: top.formatted_address || query,
          placeId: top.place_id,
          isApproximate: isApprox,
          source: 'google_rest_geocoding'
        };
      } else {
        logDiagnostic({
          originalQuery: query,
          apiUsed: 'Google Geocoding REST API',
          paramsSent: { address: query },
          responseStatus: gData.status || 'ZERO_RESULTS',
          resultsCount: 0,
          discardReason: 'Google Geocoding não retornou resultados diretos.'
        });
      }
    } catch (err) {
      console.warn('Erro na chamada Google Geocoding REST API:', err);
    }

    // ETAPA 3: Google Places Text Search REST API
    try {
      const googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pt-BR`;
      const pRes = await fetch(googlePlacesUrl);
      const pData = await pRes.json();

      if (pData.status === 'OK' && pData.results && pData.results.length > 0) {
        const top = pData.results[0];
        const lat = top.geometry.location.lat;
        const lng = top.geometry.location.lng;

        logDiagnostic({
          originalQuery: query,
          apiUsed: 'Google Places Text Search REST API',
          paramsSent: { query, key: 'CONFIGURED' },
          responseStatus: pData.status,
          resultsCount: pData.results.length,
          returnedAddress: top.formatted_address || top.name,
          lat,
          lng,
          placeId: top.place_id
        });

        return {
          lat,
          lng,
          formattedAddress: top.formatted_address || top.name || query,
          placeId: top.place_id,
          isApproximate: false,
          source: 'google_places_textsearch'
        };
      }
    } catch (err) {
      console.warn('Erro na chamada Google Places Text Search REST API:', err);
    }
  }

  // ETAPA 4: Fallback Geocoding - Esri World Geocoding (Backup de Alta Precisão)
  try {
    const fullQuery = query.toLowerCase().includes('campina grande') || query.toLowerCase().includes('pb')
      ? query
      : `${query}, Campina Grande - PB, Brasil`;

    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(fullQuery)}&f=json&maxLocations=1`;
    const esriRes = await fetch(esriUrl);
    const esriData = await esriRes.json();

    if (esriData && esriData.candidates && esriData.candidates.length > 0) {
      const candidate = esriData.candidates[0];
      const loc = candidate.location;
      const score = candidate.score || 100;

      logDiagnostic({
        originalQuery: query,
        apiUsed: 'Esri World Geocoding (Fallback)',
        paramsSent: { singleLine: fullQuery },
        responseStatus: 'OK',
        resultsCount: esriData.candidates.length,
        returnedAddress: candidate.address || fullQuery,
        lat: loc.y,
        lng: loc.x,
        discardReason: score < 80 ? 'Score inferior a 80 (Aproximado)' : undefined
      });

      return { 
        lat: loc.y, 
        lng: loc.x, 
        formattedAddress: candidate.address || fullQuery,
        isApproximate: score < 80,
        source: 'esri_fallback'
      };
    }
  } catch (e) {}

  // ETAPA 5: Fallback Photon API
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      const coords = feat.geometry.coordinates;
      const props = feat.properties;
      const formatted = [props.name, props.street, props.housenumber, props.city || 'Campina Grande', props.state || 'PB']
        .filter(Boolean)
        .join(', ');

      logDiagnostic({
        originalQuery: query,
        apiUsed: 'Photon API (Fallback)',
        paramsSent: { q: query },
        responseStatus: 'OK',
        resultsCount: data.features.length,
        returnedAddress: formatted || query,
        lat: coords[1],
        lng: coords[0]
      });

      return { 
        lat: coords[1], 
        lng: coords[0],
        formattedAddress: formatted || query,
        isApproximate: false,
        source: 'photon_fallback'
      };
    }
  } catch (e) {}

  // Log de falha total
  logDiagnostic({
    originalQuery: query,
    apiUsed: 'Todas as APIs (Google / Esri / Photon)',
    paramsSent: { query },
    responseStatus: 'ZERO_RESULTS',
    resultsCount: 0,
    discardReason: 'Nenhum provedor conseguiu localizar este endereço.'
  });

  return null;
}