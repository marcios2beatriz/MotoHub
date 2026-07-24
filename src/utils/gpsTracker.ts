"use client";

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number; // em metros
  speedKmh: number;
  heading: number; // graus (0-360)
  timestamp: number;
}

export type GpsSignalQuality = 'excellent' | 'good' | 'weak' | 'lost' | 'denied' | 'off';

export interface GpsState {
  currentLocation: GpsLocation | null;
  quality: GpsSignalQuality;
  errorMessage: string | null;
  isNavigating: boolean;
}

// Cálculo da distância Haversine em metros entre duas coordenadas
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cálculo da direção/bearing em graus (0-360)
export function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * (180 / Math.PI) + 360) % 360;
}

// Verifica se um ponto está muito distante da rota estipulada (em metros)
export function isPointOffRoute(
  point: { lat: number; lng: number },
  routePolyline: [number, number][],
  thresholdMeters: number = 35
): boolean {
  if (routePolyline.length < 2) return false;

  let minDistance = Infinity;
  for (let i = 0; i < routePolyline.length - 1; i++) {
    const p1 = routePolyline[i];
    const p2 = routePolyline[i + 1];
    
    const dist = distanceToSegmentMeters(
      point.lat, point.lng,
      p1[0], p1[1],
      p2[0], p2[1]
    );
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance > thresholdMeters;
}

function distanceToSegmentMeters(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return calculateDistanceMeters(px, py, ax, ay);

  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);

  return calculateDistanceMeters(px, py, projX, projY);
}

class HighPrecisionGpsTracker {
  private watchId: number | null = null;
  private fallbackTimer: any = null;
  private wakeLock: any = null;
  private audioKeepAlive: HTMLAudioElement | null = null;

  private lastLocation: GpsLocation | null = null;
  private listeners: Set<(state: GpsState) => void> = new Set();
  
  private currentState: GpsState = {
    currentLocation: null,
    quality: 'off',
    errorMessage: null,
    isNavigating: false
  };

  public subscribe(callback: (state: GpsState) => void) {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  public setNavigating(navigating: boolean) {
    this.currentState.isNavigating = navigating;
    this.notify();
  }

  public async startTracking() {
    this.enableWakeLock();
    this.enableAudioKeepAlive();

    if (!navigator.geolocation) {
      this.currentState = {
        ...this.currentState,
        quality: 'off',
        errorMessage: 'O seu dispositivo/navegador não suporta geolocalização.'
      };
      this.notify();
      return;
    }

    this.stopTracking();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };

    const handleSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy || 10;
      const now = Date.now();

      let speedKmh = pos.coords.speed !== null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : 0;
      let heading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : 0;

      if (this.lastLocation) {
        const distanceM = calculateDistanceMeters(this.lastLocation.lat, this.lastLocation.lng, lat, lng);
        if (distanceM > 2.0 && (!pos.coords.heading || isNaN(pos.coords.heading))) {
          heading = Math.round(calculateBearingDegrees(this.lastLocation.lat, this.lastLocation.lng, lat, lng));
        } else if (distanceM <= 2.0) {
          heading = this.lastLocation.heading;
        }
      }

      const newLocation: GpsLocation = {
        lat,
        lng,
        accuracy: Math.round(accuracy),
        speedKmh,
        heading,
        timestamp: now
      };

      this.lastLocation = newLocation;

      let quality: GpsSignalQuality = 'excellent';
      if (accuracy > 30) quality = 'weak';
      else if (accuracy > 12) quality = 'good';

      this.currentState = {
        ...this.currentState,
        currentLocation: newLocation,
        quality,
        errorMessage: null
      };

      this.notify();
    };

    const handleError = (err: GeolocationPositionError) => {
      let quality: GpsSignalQuality = 'off';
      let msg = 'Obtendo sinal do GPS...';

      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        quality = 'denied';
        msg = 'Permissão de localização negada no seu navegador.';
      } else if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
        quality = 'lost';
        msg = 'Buscando satélites de GPS...';
      } else if (err.code === GeolocationPositionError.TIMEOUT) {
        quality = 'weak';
        msg = 'Aguardando atualização do sinal GPS...';
      }

      this.currentState = {
        ...this.currentState,
        quality,
        errorMessage: msg
      };
      this.notify();
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    this.watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    this.fallbackTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(handleSuccess, () => {}, options);
    }, 2000);
  }

  public stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.disableWakeLock();
    this.disableAudioKeepAlive();
  }

  private async enableWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {}
  }

  private disableWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  private enableAudioKeepAlive() {
    try {
      if (!this.audioKeepAlive) {
        const audio = document.createElement('audio');
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
        audio.loop = true;
        audio.volume = 0.01;
        this.audioKeepAlive = audio;
      }
      this.audioKeepAlive.play().catch(() => {});
    } catch (e) {}
  }

  private disableAudioKeepAlive() {
    if (this.audioKeepAlive) {
      this.audioKeepAlive.pause();
    }
  }
}

export const gpsTracker = new HighPrecisionGpsTracker();