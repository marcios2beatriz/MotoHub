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

// Decodificador da Polilinha do Google Maps (Google Encoded Polyline Algorithm)
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

// Log de Auditoria de Rota no Console
function printRouteAuditLog(data: {
  origin: { lat: number; lng: number; heading?: number };
  destination: { lat: number; lng: number };
  requestedTravelMode: string;
  actualTravelMode: string;
  apiEngine: string;
  distanceKm: string;
  durationMin: number;
  coordinatesCount: number;
  isFallback: boolean;
  fallbackReason?: string;
}) {
  console.group(`🏍️ [AUDITORIA DE ROTA DE NAVEGAÇÃO] — ${new Date().toLocaleTimeString('pt-BR')}`);
  console.log(`📌 ORIGEM GPS: Lat ${data.origin.lat.toFixed(6)}, Lng ${data.origin.lng.toFixed(6)} ${data.origin.heading ? `| Heading: ${data.origin.heading}°` : ''}`);
  console.log(`🎯 DESTINO: Lat ${data.destination.lat.toFixed(6)}, Lng ${data.destination.lng.toFixed(6)}`);
  console.log(`⚙️ MOTOR DE ROTAS: ${data.apiEngine}`);
  console.log(`🛵 TRAVEL MODE SOLICITADO: ${data.requestedTravelMode} | EFETIVO: ${data.actualTravelMode}`);
  console.log(`📏 DISTÂNCIA: ${data.distanceKm} km | DURAÇÃO: ${data.durationMin} min | PONTOS DA POLYLINE: ${data.coordinatesCount}`);
  if (data.isFallback) {
    console.warn(`⚠️ FALLBACK OCORRIDO: ${data.fallbackReason}`);
  } else {
    console.log(`✅ ROTA GOOGLE MAPS OFICIAL CALCULADA COM RESPEITO À MALHA VIÁRIA E SENTIDO DE DIREÇÃO.`);
  }
  console.groupEnd();
}

export async function computeRoute({ origin, destination, travelMode = 'TWO_WHEELER' }: RouteRequestParams): Promise<RouteResult> {
  const apiKey = getGoogleApiKey();

  // ETAPA 1: Google Routes API v2 (computeRoutes)
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
        travelMode: travelMode, // TWO_WHEELER para motocicletas
        routingPreference: 'TRAFFIC_AWARE',
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE'
      };

      // Inclui heading na origem se disponível e confiável
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

        const isFallback = !!route.fallbackInfo;
        const fallbackReason = route.fallbackInfo ? `Google Routes Fallback: ${JSON.stringify(route.fallbackInfo)}` : undefined;

        printRouteAuditLog({
          origin,
          destination,
          requestedTravelMode: travelMode,
          actualTravelMode: isFallback ? 'DRIVE_FALLBACK' : travelMode,
          apiEngine: 'Google Routes API v2 (computeRoutes)',
          distanceKm: (distanceMeters / 1000).toFixed(2),
          durationMin: durationMinutes,
          coordinatesCount: coordinates.length,
          isFallback,
          fallbackReason
        });

        return {
          distanceMeters,
          durationSeconds,
          coordinates,
          travelModeUsed: isFallback ? 'DRIVE_FALLBACK' : travelMode,
          isFallback,
          fallbackReason,
          etaTimeString
        };
      } else {
        console.warn('Google Routes API não retornou rotas válidas:', data);
      }
    } catch (err) {
      console.warn('Erro ao chamar Google Routes API v2:', err);
    }
  }

  // ETAPA 2: Fallback Secundário OSRM (Apenas se a chave do Google estiver ausente ou falhar)
  try {
    const waypointsString = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson&steps=true&continue_straight=true`;

    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
      const route = osrmData.routes[0];
      const coordinates: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

      const distanceMeters = route.distance || 0;
      const durationSeconds = route.duration || 0;
      const durationMinutes = Math.ceil(durationSeconds / 60);
      const etaDate = new Date(Date.now() + durationMinutes * 60000);
      const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      printRouteAuditLog({
        origin,
        destination,
        requestedTravelMode: travelMode,
        actualTravelMode: 'OSRM_DRIVING_FALLBACK',
        apiEngine: 'OSRM Public Server (Fallback)',
        distanceKm: (distanceMeters / 1000).toFixed(2),
        durationMin: durationMinutes,
        coordinatesCount: coordinates.length,
        isFallback: true,
        fallbackReason: 'Chave VITE_GOOGLE_MAPS_API_KEY indisponível ou limite de requisições excedido no Google Routes v2.'
      });

      return {
        distanceMeters,
        durationSeconds,
        coordinates,
        travelModeUsed: 'OSRM_FALLBACK',
        isFallback: true,
        fallbackReason: 'Utilizando motor de rotas OSRM secundário.',
        etaTimeString
      };
    }
  } catch (err) {
    console.warn('Erro no OSRM Fallback:', err);
  }

  // Se tudo falhar, lança erro em vez de desenhar linha reta inventada
  throw new Error('Não foi possível calcular uma rota viária válida entre a origem e o destino.');
}