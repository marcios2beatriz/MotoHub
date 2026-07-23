"use client";

import React, { useEffect, useRef, useState } from 'react';
import { 
  Navigation, 
  MapPin, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Compass, 
  Clock, 
  Route, 
  X, 
  Volume2, 
  VolumeX,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import L from 'leaflet';

interface RiderNavigationMapProps {
  currentLocation: { lat: number; lng: number } | null;
  destination: {
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null;
  onClose?: () => void;
}

interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
}

export default function RiderNavigationMap({ currentLocation, destination, onClose }: RiderNavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: string;
    durationMin: number;
    steps: RouteStep[];
  } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Fallback default coordinates (Campina Grande center)
  const defaultLat = -7.2247;
  const defaultLng = -35.8878;

  // Geocode destination if coordinates are not direct
  useEffect(() => {
    if (!destination) return;

    if (destination.lat && destination.lng) {
      setDestCoords({ lat: destination.lat, lng: destination.lng });
      return;
    }

    const geocode = async () => {
      setLoadingRoute(true);
      let foundLat: number | null = null;
      let foundLng: number | null = null;

      if (destination.name.toLowerCase().includes('burgrill') || destination.addressText.includes('Aprígio Veloso')) {
        foundLat = -7.2150;
        foundLng = -35.9130;
      } else {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination.addressText + ', Brasil')}&limit=1`
          );
          const data = await res.json();
          if (data && data.length > 0) {
            foundLat = parseFloat(data[0].lat);
            foundLng = parseFloat(data[0].lon);
          }
        } catch (e) {}
      }

      if (!foundLat || !foundLng) {
        foundLat = defaultLat;
        foundLng = defaultLng;
      }

      setDestCoords({ lat: foundLat, lng: foundLng });
      setLoadingRoute(false);
    };

    geocode();
  }, [destination?.addressText, destination?.name]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const startLat = currentLocation?.lat || defaultLat;
    const startLng = currentLocation?.lng || defaultLng;

    const mapInstance = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([startLat, startLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapInstance);

    mapRef.current = mapInstance;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Rider Location Marker and Map Center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation) return;

    const riderIcon = L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(29,78,216,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
        </div>
      `,
      className: 'custom-navigation-rider-icon',
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
      riderMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: riderIcon })
        .addTo(map)
        .bindPopup('<b>Você (Sua Posição)</b>');
    }

    if (autoFollow) {
      map.panTo([currentLocation.lat, currentLocation.lng], { animate: true, duration: 0.5 });
    }
  }, [currentLocation, autoFollow]);

  // Fetch Route from OSRM and Render Route Line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation || !destCoords) return;

    // Destination Marker
    const destIcon = L.divIcon({
      html: `
        <div style="
          background: #ef4444;
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(239,68,68,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      className: 'custom-navigation-dest-icon',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destCoords.lat, destCoords.lng]);
    } else {
      destMarkerRef.current = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>${destination?.name || 'Destino'}</b>`);
    }

    // Fetch OSRM driving route
    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

          // Draw Polyline
          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coordinates);
          } else {
            routePolylineRef.current = L.polyline(coordinates, {
              color: '#3b82f6',
              weight: 6,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }

          // Parse Route Steps
          const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
            instruction: formatOsmInstruction(step.maneuver, step.name),
            distance: step.distance,
            duration: step.duration
          }));

          setRouteInfo({
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: Math.ceil(route.duration / 60),
            steps
          });

          // Fit bounds once at beginning
          const bounds = L.latLngBounds([
            [currentLocation.lat, currentLocation.lng],
            [destCoords.lat, destCoords.lng]
          ]);
          map.fitBounds(bounds, { padding: [60, 60] });
        }
      } catch (err) {
        console.warn('Erro ao buscar rota OSRM:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [currentLocation?.lat, currentLocation?.lng, destCoords]);

  // Translate OSRM maneuvers to friendly Portuguese instructions
  const formatOsmInstruction = (maneuver: any, streetName: string) => {
    const type = maneuver.type;
    const modifier = maneuver.modifier;
    const nameStr = streetName ? ` na ${streetName}` : '';

    if (type === 'depart') return `Siga em frente${nameStr}`;
    if (type === 'arrive') return `Você chegou ao seu destino!`;
    
    switch (modifier) {
      case 'left':
      case 'sharp left':
        return `Vire à esquerda${nameStr}`;
      case 'slight left':
        return `Mantenha à esquerda${nameStr}`;
      case 'right':
      case 'sharp right':
        return `Vire à direita${nameStr}`;
      case 'slight right':
        return `Mantenha à direita${nameStr}`;
      case 'straight':
        return `Siga em frente${nameStr}`;
      case 'uturn':
        return `Faça o retorno${nameStr}`;
      default:
        return `Siga em direção ao destino${nameStr}`;
    }
  };

  const handleRecenter = () => {
    if (mapRef.current && currentLocation) {
      mapRef.current.setView([currentLocation.lat, currentLocation.lng], 17, { animate: true });
      setAutoFollow(true);
    }
  };

  const handleOpenExternalGoogleMaps = () => {
    if (!destination) return;
    const query = encodeURIComponent(`${destination.name}, ${destination.addressText}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const currentNextStep = routeInfo?.steps?.[0] || {
    instruction: destination ? `Em direção a ${destination.name}` : 'Calculando rota...',
    distance: 0,
    duration: 0
  };

  return (
    <div className={`flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 transition-all ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative h-[550px] w-full'
    }`}>
      {/* Top Banner Navigation Header */}
      <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-white/20 rounded-xl text-white flex-shrink-0 animate-pulse">
            <Compass className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">Próxima Manobra</p>
            <h3 className="text-base font-black truncate leading-tight">{currentNextStep.instruction}</h3>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-indigo-100"
            title={soundEnabled ? 'Áudio Ativado' : 'Áudio Mudo'}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-indigo-100"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 text-red-200 hover:text-white rounded-xl transition-colors"
              title="Fechar Navegação"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 bg-slate-950" />

        {/* Floating Controls over Map */}
        <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
          <button
            onClick={handleRecenter}
            className={`p-3 rounded-2xl shadow-xl border border-slate-700 transition-all flex items-center justify-center ${
              autoFollow ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Centralizar Minha Moto"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          <button
            onClick={handleOpenExternalGoogleMaps}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl shadow-xl border border-slate-700 transition-all flex items-center justify-center"
            title="Abrir no Google Maps Externo"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>

        {/* Loading Overlay */}
        {loadingRoute && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex items-center space-x-3 text-indigo-400 font-bold text-sm shadow-2xl">
              <Navigation className="h-5 w-5 animate-spin" />
              <span>Calculando rota em tempo real...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Route Summary Bar (Waze style) */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 z-20 space-y-3">
        {destination && (
          <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{destination.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{destination.addressText}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-emerald-400">Tempo Estimado</p>
            <p className="text-xl font-black text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="h-4 w-4" />
              <span>{routeInfo ? `${routeInfo.durationMin} min` : '--'}</span>
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-blue-400">Distância Rota</p>
            <p className="text-xl font-black text-blue-400 flex items-center justify-center gap-1 mt-0.5">
              <Route className="h-4 w-4" />
              <span>{routeInfo ? `${routeInfo.distanceKm} km` : '--'}</span>
            </p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-purple-400">GPS Posição</p>
            <p className="text-xs font-bold text-purple-300 mt-1 truncate">
              {currentLocation ? 'Conectado' : 'Buscando...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}