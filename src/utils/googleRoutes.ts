"use client";

import { loadGoogleMapsSdk } from './googleMapsLoader';

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

export async function computeRoute({ origin, destination, travelMode = 'TWO_WHEELER' }: RouteRequestParams): Promise<RouteResult> {
  const isSdkLoaded = await loadGoogleMapsSdk();

  // ETAPA 1: Google Maps JS SDK DirectionsService (Nativo no navegador sem erros de CORS)
  if (isSdkLoaded && (window as any).google?.maps?.DirectionsService) {
    try {
      const directionsService = new (window as any).google.maps.DirectionsService();
      const googleMaps = (window as any).google.maps;

      const mode = (travelMode === 'TWO_WHEELER' && googleMaps.TravelMode.TWO_WHEELER)
        ? googleMaps.TravelMode.TWO_WHEELER
        : googleMaps.TravelMode.DRIVING;

      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route({
          origin: new googleMaps.LatLng(origin.lat, origin.lng),
          destination: new googleMaps.LatLng(destination.lat, destination.lng),
          travelMode: mode
        }, (response: any, status: string) => {
          if (status === 'OK' && response) {
            resolve(response);
          } else {
            reject(new Error('DirectionsService status: ' + status));
          }
        });
      });

      if (result && result.routes && result.routes.length > 0) {
        const route = result.routes[0];
        const leg = route.legs[0];
        const overviewPath = route.overview_path || [];
        const coordinates: [number, number][] = overviewPath.map((p: any) => [
          typeof p.lat === 'function' ? p.lat() : p.lat,
          typeof p.lng === 'function' ? p.lng() : p.lng
        ]);

        const distanceMeters = leg?.distance?.value || 0;
        const durationSeconds = leg?.duration?.value || 0;

        const durationMinutes = Math.ceil(durationSeconds / 60);
        const etaDate = new Date(Date.now() + durationMinutes * 60000);
        const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return {
          distanceMeters,
          durationSeconds,
          coordinates,
          travelModeUsed: 'GOOGLE_MAPS_MOTO',
          isFallback: false,
          etaTimeString
        };
      }
    } catch (sdkErr) {
      console.warn('Falha no calculador do Google Maps SDK, apelando para OSRM:', sdkErr);
    }
  }

  // ETAPA 2: Fallback Gratuito OSRM (OpenStreetMap) caso o SDK não retorne resultados
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
        fallbackReason: 'Serviço de rotas OpenStreetMap ativo para traçar o percurso.',
        etaTimeString
      };
    }
  } catch (err) {
    console.warn('Erro ao calcular rota via OSRM:', err);
  }

  throw new Error('Não foi possível calcular a rota. Verifique sua conexão de rede.');
}