"use client";

export interface RouteRequestParams {
  origin: { lat: number; lng: number; heading?: number };
  destination: { lat: number; lng: number };
  travelMode?: 'TWO_WHEELER' | 'DRIVE';
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lat, lng]
  travelModeUsed: string;
  isFallback: boolean;
  fallbackReason?: string;
  etaTimeString: string;
}

// Decodificador de Polilinha do Google Maps
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

const getGoogleApiKey = (): string | null => {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
};

export async function computeRoute({ origin, destination, travelMode = 'TWO_WHEELER' }: RouteRequestParams): Promise<RouteResult> {
  const apiKey = getGoogleApiKey();

  // ETAPA 1: Google Routes API v2
  if (apiKey) {
    try {
      const url = 'https://routes.googleapis.com/v1/directions:computeRoutes';

      const requestBody: any = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: travelMode,
        routingPreference: 'TRAFFIC_AWARE',
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE'
      };

      if (origin.heading !== undefined && origin.heading >= 0 && origin.heading <= 360) {
        requestBody.origin.heading = Math.round(origin.heading);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.fallbackInfo'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const encodedPolyline = route.polyline?.encodedPolyline || '';
        const coordinates = decodePolyline(encodedPolyline);

        const distanceMeters = route.distanceMeters || 0;
        const durationSeconds = parseInt((route.duration || '0s').replace('s', ''), 10) || 0;

        const durationMinutes = Math.ceil(durationSeconds / 60);
        const etaDate = new Date(Date.now() + durationMinutes * 60000);
        const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return {
          distanceMeters,
          durationSeconds,
          coordinates,
          travelModeUsed: 'GOOGLE_TWO_WHEELER',
          isFallback: false,
          etaTimeString
        };
      }
    } catch (err) {
      console.warn('Erro ao chamar Google Routes API v2:', err);
    }

    // ETAPA 2: Google Directions API v1
    try {
      const modeParam = travelMode === 'TWO_WHEELER' ? 'two_wheeler' : 'driving';
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${modeParam}&key=${apiKey}&language=pt-BR`;
      
      const response = await fetch(directionsUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const encodedPolyline = route.overview_polyline?.points || '';
        const coordinates = decodePolyline(encodedPolyline);

        const distanceMeters = leg?.distance?.value || 0;
        const durationSeconds = leg?.duration?.value || 0;

        const durationMinutes = Math.ceil(durationSeconds / 60);
        const etaDate = new Date(Date.now() + durationMinutes * 60000);
        const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return {
          distanceMeters,
          durationSeconds,
          coordinates,
          travelModeUsed: 'GOOGLE_DIRECTIONS_V1',
          isFallback: false,
          etaTimeString
        };
      }
    } catch (err) {
      console.warn('Erro na chamada ao Google Directions API v1:', err);
    }
  }

  // ETAPA 3: Fallback Gratuito OSRM (OpenStreetMap) caso não haja chave válida configurada
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const rawCoords: [number, number][] = route.geometry.coordinates;
      const coordinates: [number, number][] = rawCoords.map(c => [c[1], c[0]]);

      const distanceMeters = route.distance || 0;
      const durationSeconds = route.duration || 0;

      const durationMinutes = Math.ceil(durationSeconds / 60);
      const etaDate = new Date(Date.now() + durationMinutes * 60000);
      const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return {
        distanceMeters,
        durationSeconds,
        coordinates,
        travelModeUsed: 'OSRM_OPENSTREETMAP',
        isFallback: true,
        fallbackReason: 'Chave VITE_GOOGLE_MAPS_API_KEY do Google Maps ausente ou inativa no arquivo .env. Usando rotas OpenStreetMap.',
        etaTimeString
      };
    }
  } catch (err) {
    console.warn('Erro ao calcular rota via OSRM:', err);
  }

  throw new Error('Não foi possível calcular a rota. Verifique sua conexão de rede.');
}