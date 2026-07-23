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
  Search,
  Volume2, 
  VolumeX,
  Zap,
  CheckCircle2,
  Bike
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
  distance: number; // metros
  duration: number; // segundos
  spoken?: boolean;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function RiderNavigationMap({ currentLocation, destination: initialDestination, onClose }: RiderNavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [activeDestination, setActiveDestination] = useState<{
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null>(initialDestination);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: string;
    durationMin: number;
  } | null>(null);

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const prevLocationRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastSpokenInstructionRef = useRef<string>('');

  const defaultLat = -7.2247;
  const defaultLng = -35.8878;

  useEffect(() => {
    if (initialDestination) {
      setActiveDestination(initialDestination);
    }
  }, [initialDestination]);

  // Função para sintetizar voz (Text-To-Speech) no navegador sem sair do app
  const speakInstruction = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    if (lastSpokenInstructionRef.current === text) return;

    window.speechSynthesis.cancel(); // Cancela falas anteriores
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpokenInstructionRef.current = text;
  };

  // Cálculo de velocidade atual baseada na mudança de coordenadas GPS
  useEffect(() => {
    if (!currentLocation) return;

    const now = Date.now();
    if (prevLocationRef.current) {
      const prev = prevLocationRef.current;
      const timeDiffSec = (now - prev.time) / 1000;

      if (timeDiffSec > 0.5) {
        // Fórmula de Haversine para metros
        const R = 6371000;
        const dLat = (currentLocation.lat - prev.lat) * (Math.PI / 180);
        const dLng = (currentLocation.lng - prev.lng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(prev.lat * (Math.PI / 180)) * Math.cos(currentLocation.lat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = R * c;

        // Converter m/s para km/h
        const speedKmh = Math.round((distanceMeters / timeDiffSec) * 3.6);
        if (speedKmh >= 0 && speedKmh < 160) {
          setCurrentSpeed(speedKmh);
        }
      }
    }

    prevLocationRef.current = { lat: currentLocation.lat, lng: currentLocation.lng, time: now };
  }, [currentLocation]);

  // Geocodificação do destino
  useEffect(() => {
    if (!activeDestination) return;

    if (activeDestination.lat && activeDestination.lng) {
      setDestCoords({ lat: activeDestination.lat, lng: activeDestination.lng });
      return;
    }

    const geocode = async () => {
      setLoadingRoute(true);
      let foundLat: number | null = null;
      let foundLng: number | null = null;

      if (activeDestination.name.toLowerCase().includes('burgrill') || activeDestination.addressText.includes('Aprígio Veloso')) {
        foundLat = -7.2150;
        foundLng = -35.9130;
      } else {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeDestination.addressText + ', Brasil')}&limit=1`
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
  }, [activeDestination?.addressText, activeDestination?.name]);

  // Inicializa o Mapa
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
    }).setView([startLat, startLng], 17);

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

  // Atualização em Tempo Real da Moto do Entregador
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation) return;

    const riderIcon = L.divIcon({
      html: `
        <div style="
          background: #2563eb;
          color: white;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 0 20px rgba(37,99,235,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
        </div>
      `,
      className: 'custom-rider-nav-icon',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
      riderMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: riderIcon })
        .addTo(map);
    }

    if (autoFollow) {
      map.panTo([currentLocation.lat, currentLocation.lng], { animate: true, duration: 0.5 });
    }
  }, [currentLocation, autoFollow]);

  // Busca a Rota no Servidor de Roteamento OSRM
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation || !destCoords) return;

    const destIcon = L.divIcon({
      html: `
        <div style="
          background: #ef4444;
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 15px rgba(239,68,68,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      className: 'custom-dest-nav-icon',
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destCoords.lat, destCoords.lng]);
    } else {
      destMarkerRef.current = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
        .addTo(map);
    }

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coordinates);
          } else {
            routePolylineRef.current = L.polyline(coordinates, {
              color: '#3b82f6',
              weight: 8,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }

          const routeSteps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
            instruction: formatOsmInstruction(step.maneuver, step.name),
            distance: Math.round(step.distance),
            duration: Math.round(step.duration)
          }));

          setSteps(routeSteps);
          setCurrentStepIndex(0);
          setRouteInfo({
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: Math.ceil(route.duration / 60)
          });

          // Fala a primeira instrução por voz
          if (routeSteps.length > 0) {
            speakInstruction(`Iniciando navegação. ${routeSteps[0].instruction}`);
          }
        }
      } catch (err) {
        console.warn('Erro ao calcular rota OSRM:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [currentLocation?.lat, currentLocation?.lng, destCoords]);

  // Monitora aproximação de passos para falar por voz
  useEffect(() => {
    if (steps.length > 0 && currentStepIndex < steps.length) {
      const currentStep = steps[currentStepIndex];
      if (currentStep && currentStep.instruction) {
        speakInstruction(currentStep.instruction);
      }
    }
  }, [currentStepIndex, steps]);

  const formatOsmInstruction = (maneuver: any, streetName: string) => {
    const modifier = maneuver.modifier;
    const nameStr = streetName ? ` na ${streetName}` : '';

    if (maneuver.type === 'depart') return `Siga em frente${nameStr}`;
    if (maneuver.type === 'arrive') return `Você chegou ao seu destino!`;

    switch (modifier) {
      case 'left':
      case 'sharp left':
        return `Vire à esquerda${nameStr}`;
      case 'slight left':
        return `Mantenha-se à esquerda${nameStr}`;
      case 'right':
      case 'sharp right':
        return `Vire à direita${nameStr}`;
      case 'slight right':
        return `Mantenha-se à direita${nameStr}`;
      case 'straight':
        return `Siga em frente${nameStr}`;
      case 'uturn':
        return `Faça o retorno${nameStr}`;
      default:
        return `Siga em direção ao destino${nameStr}`;
    }
  };

  const handleSearchAddresses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim() + ', Brasil')}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data || []);
    } catch (err) {
      console.warn('Erro ao buscar endereço:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const title = result.display_name.split(',')[0] || 'Destino';

    setActiveDestination({
      name: title,
      addressText: result.display_name,
      lat,
      lng
    });

    setSearchResults([]);
    setSearchQuery('');
  };

  const activeStep = steps[currentStepIndex] || {
    instruction: activeDestination ? `Navegando para ${activeDestination.name}` : 'Digite um endereço para navegar',
    distance: 0,
    duration: 0
  };

  return (
    <div className={`flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl transition-all font-sans ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative h-[700px] w-full rounded-2xl border border-slate-800'
    }`}>
      
      {/* BANNER SUPERIOR DE NAVEGAÇÃO EM TEMPO REAL (ESTILO GPS VEICULAR WAZE/MAPS) */}
      <div className="bg-emerald-600 text-white px-4 py-3 z-30 shadow-2xl flex items-center justify-between relative border-b border-emerald-500">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-3 bg-white/20 rounded-2xl text-white flex-shrink-0 animate-pulse">
            <Compass className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-800/80 text-emerald-100 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                Navegação MotoHub Ativa
              </span>
              {activeStep.distance > 0 && (
                <span className="text-xs font-extrabold text-emerald-200">
                  em {activeStep.distance}m
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black truncate leading-tight mt-0.5">
              {activeStep.instruction}
            </h2>
          </div>
        </div>

        {/* BOTÕES DE CONTROLE DA NAVEGAÇÃO */}
        <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2.5 rounded-xl transition-colors ${
              voiceEnabled ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-emerald-800 text-emerald-300'
            }`}
            title={voiceEnabled ? 'Voz Ativada' : 'Voz Mutada'}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-emerald-100"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-red-500/20 text-red-200 hover:text-white rounded-xl transition-colors"
              title="Encerrar Navegação"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE PESQUISA INTERNA DE ENDEREÇO */}
      <div className="bg-slate-900 border-b border-slate-800 p-2.5 z-20 relative">
        <form onSubmit={handleSearchAddresses} className="relative flex items-center">
          <input
            type="text"
            placeholder="Buscar novo endereço de entrega..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm pl-9 pr-24 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="h-4 w-4 text-slate-400 absolute left-3 pointer-events-none" />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            {isSearching ? <Navigation className="h-3.5 w-3.5 animate-spin" /> : <span>Buscar</span>}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="absolute left-2.5 right-2.5 top-full mt-1 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-56 overflow-y-auto">
            {searchResults.map((res) => (
              <button
                key={res.place_id}
                onClick={() => handleSelectSearchResult(res)}
                className="w-full p-3 text-left hover:bg-slate-800 transition-colors flex items-start space-x-2.5"
              >
                <MapPin className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{res.display_name.split(',')[0]}</p>
                  <p className="text-[10px] text-slate-400 truncate">{res.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MAPA PRINCIPAL */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 bg-slate-950" />

        {/* VELOCÍMETRO FLUTUANTE EM TEMPO REAL NO CANTO INFERIOR ESQUERDO */}
        <div className="absolute bottom-6 left-4 z-20 bg-slate-900/90 border border-slate-700 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center justify-center min-w-[70px]">
          <span className="text-2xl font-black text-emerald-400 leading-none">{currentSpeed}</span>
          <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider mt-0.5">km/h</span>
        </div>

        {/* BOTÃO RECENTRALIZAR CÂMERA */}
        <div className="absolute bottom-6 right-4 z-20">
          <button
            onClick={() => {
              if (mapRef.current && currentLocation) {
                mapRef.current.setView([currentLocation.lat, currentLocation.lng], 17, { animate: true });
                setAutoFollow(true);
              }
            }}
            className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-2xl border border-indigo-500 transition-all flex items-center justify-center"
            title="Centralizar Minha Posição"
          >
            <RotateCcw className="h-6 w-6" />
          </button>
        </div>

        {loadingRoute && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex items-center space-x-3 text-indigo-400 font-bold text-sm shadow-2xl">
              <Navigation className="h-5 w-5 animate-spin" />
              <span>Calculando rota no MotoHub...</span>
            </div>
          </div>
        )}
      </div>

      {/* RODAPÉ INFORMATIVO (TEMPO RESTANTE E DISTÂNCIA TOTAL) */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 z-20 space-y-2">
        {activeDestination && (
          <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{activeDestination.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{activeDestination.addressText}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveDestination(null);
                setSteps([]);
                setRouteInfo(null);
                if (routePolylineRef.current) {
                  routePolylineRef.current.remove();
                  routePolylineRef.current = null;
                }
              }}
              className="text-xs text-slate-400 hover:text-red-400 font-bold px-2 py-1 rounded hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-emerald-400">Tempo Estimado</p>
            <p className="text-lg font-black text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="h-4 w-4" />
              <span>{routeInfo ? `${routeInfo.durationMin} min` : '--'}</span>
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-blue-400">Distância Total</p>
            <p className="text-lg font-black text-blue-400 flex items-center justify-center gap-1 mt-0.5">
              <Route className="h-4 w-4" />
              <span>{routeInfo ? `${routeInfo.distanceKm} km` : '--'}</span>
            </p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-extrabold text-purple-400">GPS Conexão</p>
            <p className="text-xs font-bold text-purple-300 mt-1 truncate">
              {currentLocation ? 'Conectado' : 'Buscando...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}