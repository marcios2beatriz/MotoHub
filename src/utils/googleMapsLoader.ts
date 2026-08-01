"use client";

let loadPromise: Promise<boolean> | null = null;

export function loadGoogleMapsSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if ((window as any).google?.maps?.places) {
    return Promise.resolve(true);
  }

  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
    return Promise.resolve(false);
  }

  loadPromise = new Promise((resolve) => {
    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = (err) => {
      console.warn('Falha ao carregar Google Maps JS SDK:', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}