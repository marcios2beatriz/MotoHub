import { supabase } from './supabase';
import { db } from './db';

export interface LocationPayload {
  riderId: string;
  riderName: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  timestamp: number;
}

type LocationCallback = (payload: LocationPayload) => void;

class RealtimeGpsManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listeners: Set<LocationCallback> = new Set();
  private isSubscribed = false;

  public init() {
    if (this.channel) return;

    this.channel = supabase.channel('motoboy-live-tracking', {
      config: {
        broadcast: { self: false }
      }
    });

    this.channel
      .on('broadcast', { event: 'location-update' }, (response) => {
        const payload = response.payload as LocationPayload;
        if (payload && payload.riderId && payload.lat && payload.lng) {
          // Atualiza localmente no banco
          db.updateRiderLocation(payload.riderId, payload.riderName, payload.lat, payload.lng);
          // Notifica os ouvintes do mapa do estabelecimento
          this.listeners.forEach((listener) => listener(payload));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
        }
      });
  }

  public sendLocation(payload: LocationPayload) {
    if (!this.channel) {
      this.init();
    }

    if (this.channel && this.isSubscribed) {
      this.channel.send({
        type: 'broadcast',
        event: 'location-update',
        payload
      }).catch(() => {});
    }

    // Garante salvamento no banco de dados e Supabase via safeUpsert
    db.updateRiderLocation(payload.riderId, payload.riderName, payload.lat, payload.lng);
  }

  public subscribeToLocations(callback: LocationCallback) {
    this.listeners.add(callback);
    if (!this.channel) {
      this.init();
    }
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const realtimeGps = new RealtimeGpsManager();
realtimeGps.init();