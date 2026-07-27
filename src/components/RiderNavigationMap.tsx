"use client";

import React, { useEffect, useRef, useState } from 'react';
import { 
  Navigation, 
  MapPin, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Clock, 
  X, 
  Search,
  Volume2, 
  VolumeX,
  Play,
  Square,
  Loader2,
  Check,
  ShieldCheck,
  ArrowUp,
  Hand,
  AlertCircle,
  CompassIcon,
  LocateFixed,
  Plus,
  Minus
} from 'lucide-react';
import L from 'leaflet';
import { gpsTracker, GpsState, isPointOffRoute } from '../utils/gpsTracker';
import { searchFreeTextAddress, GeocodedAddress } from '../utils/geocoding';

interface RiderNavigationMapProps {
  currentLocation: { lat: number; lng: number } | null;
  destination: {
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null;
  onClose?: () => void;
  defaultFullscreen?: boolean;
}

interface PendingConfirmation {
  name: string;
  addressText: string;
  lat: number;
  lng: number;
  isApproximate?: boolean;
  locationType?: string;
  exactNumberMatched?: boolean;
  requestedNumber?: string | null;
  unconfirmedReason?: string;
  placeId?: string;
}

export default function RiderNavigationMap({ 
  currentLocation: externalLocation, 
  destination: initialDestination, 
  onClose,
  defaultFullscreen = false 
}: RiderNavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);

  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const initialCenterDoneRef = useRef(false);
  const lastFetchedRouteKeyRef = useRef<string>('');
  const searchTimeoutRef = useRef<any>(null);

  const [gpsState, setGpsState] = useState<GpsState>({
    currentLocation: null,
    quality: 'off',
    errorMessage: null,
    isNavigating: false
  });

  const [activeDestination, setActiveDestination] = useState<{
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null>(initialDestination);

  // Confirmação Prévia "É este o endereço?"
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [notFoundAlert, setNotFoundAlert] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    title: string;
    subtitle: string;
    fullAddress: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modo de ajuste manual do pino no mapa
  const [isPinAdjustmentMode, setIsPinAdjustmentMode] = useState(false);
  const [tempAdjustedCoords, setTempAdjustedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: string;
    durationMin: number;
    etaTimeString: string;
  } | null>(null);

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const lastSpokenInstructionRef = useRef<string>('');
  const NAV_ZOOM_LEVEL = 18;

  useEffect(() => {
    gpsTracker.startTracking();
    const unsubscribe = gpsTracker.subscribe((state) => {
      setGpsState(state);
    });
    return () => unsubscribe();
  }, []);

  const activePos = gpsState.currentLocation || (externalLocation ? {
    lat: externalLocation.lat,
    lng: externalLocation.lng,
    accuracy: 8,
    speedKmh: 0,
    heading: 0,
    timestamp: Date.now()
  } : null);

  useEffect(() => {
    if (initialDestination) {
      setActiveDestination(initialDestination);
    }
  }, [initialDestination]);

  const speakInstruction = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    if (lastSpokenInstructionRef.current === text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpokenInstructionRef.current = text;
  };

  useEffect(() => {
    if (!activeDestination) return;

    if (activeDestination.lat && activeDestination.lng) {
      setDestCoords({ lat: activeDestination.lat, lng: activeDestination.lng });
      return;
    }

    const geocode = async () => {
      setLoadingRoute(true);
      const res = await searchFreeTextAddress(activeDestination.addressText);
      if (res) {
        setDestCoords({ lat: res.lat, lng: res.lng });
      } else {
        setLoadingRoute(false);
      }
    };

    geocode();
  }, [activeDestination?.addressText, activeDestination?.name]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initialLat = activePos ? activePos.lat : -7.2247;
    const initialLng = activePos ? activePos.lng : -35.8878;

    const mapInstance = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([initialLat, initialLng], activePos ? NAV_ZOOM_LEVEL : 15);

    mapInstance.on('dragstart', () => {
      setAutoFollow(false);
    });

    mapInstance.on('move', () => {
      if (isPinAdjustmentMode) {
        const center = mapInstance.getCenter();
        setTempAdjustedCoords({ lat: center.lat, lng: center.lng });
      }
    });

    mapRef.current = mapInstance;

    const tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 });
    tileLayer.addTo(mapInstance);
    tileLayerRef.current = tileLayer;

    const trafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@121,traffic&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      opacity: 0.75
    });
    trafficLayer.addTo(mapInstance);
    trafficLayerRef.current = trafficLayer;

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        if (activePos) {
          mapRef.current.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL);
        }
      }
    }, 300);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Marcador de Pré-Visualização / Confirmação
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingConfirmation) {
      const pendingIcon = L.divIcon({
        html: `
          <div style="
            background: #f59e0b;
            color: white;
            width: 46px;
            height: 46px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bounce 1s infinite;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        className: 'custom-pending-icon',
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });

      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.setLatLng([pendingConfirmation.lat, pendingConfirmation.lng]);
      } else {
        pendingMarkerRef.current = L.marker([pendingConfirmation.lat, pendingConfirmation.lng], {
          icon: pendingIcon,
          zIndexOffset: 3500
        }).addTo(map);
      }

      map.panTo([pendingConfirmation.lat, pendingConfirmation.lng], { animate: true });
      setAutoFollow(false);
    } else {
      if (pendingMarkerRef.current) {
        map.removeLayer(pendingMarkerRef.current);
        pendingMarkerRef.current = null;
      }
    }
  }, [pendingConfirmation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos) return;

    const heading = activePos.heading || 0;
    
    const riderIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background: rgba(26, 115, 232, 0.25); border: 2px solid #1a73e8; animation: pulse 2s infinite;"></div>
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
            background: #1a73e8;
            color: white;
            width: 46px;
            height: 46px;
            border-radius: 50%;
            border: 3.5px solid #ffffff;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 100;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
        </div>
      `,
      className: 'custom-rider-google-nav-icon',
      iconSize: [64, 64],
      iconAnchor: [32, 32]
    });

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([activePos.lat, activePos.lng]);
      riderMarkerRef.current.setIcon(riderIcon);
    } else {
      riderMarkerRef.current = L.marker([activePos.lat, activePos.lng], { 
        icon: riderIcon,
        zIndexOffset: 3000
      }).addTo(map);
    }

    if (!initialCenterDoneRef.current) {
      map.invalidateSize();
      map.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL);
      initialCenterDoneRef.current = true;
    } else if (autoFollow && !isPinAdjustmentMode && !pendingConfirmation) {
      map.panTo([activePos.lat, activePos.lng], { animate: true, duration: 0.8 });
    }

    if (isNavigating && routeCoordinates.length > 0) {
      const offRoute = isPointOffRoute({ lat: activePos.lat, lng: activePos.lng }, routeCoordinates, 40);
      if (offRoute && !isOffRouteDetected) {
        setIsOffRouteDetected(true);
        speakInstruction('Você saiu da rota. Recalculando trajeto no sentido correto...');
      }
    }
  }, [activePos?.lat, activePos?.lng, activePos?.heading, autoFollow, isNavigating, routeCoordinates, isPinAdjustmentMode, pendingConfirmation]);

  // Cálculo de Rota
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos || !destCoords) return;

    const coordsList: { lat: number; lng: number }[] = [activePos, destCoords];
    const routeKey = coordsList.map(c => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`).join(';');
    
    if (lastFetchedRouteKeyRef.current === routeKey && !isOffRouteDetected && routeCoordinates.length > 0) {
      return;
    }

    const destIcon = L.divIcon({
      html: `
        <div style="
          background: #ea4335;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3.5px solid white;
          box-shadow: 0 4px 15px rgba(234,67,53,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      className: 'custom-dest-google-nav-icon',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destCoords.lat, destCoords.lng]);
    } else {
      destMarkerRef.current = L.marker([destCoords.lat, destCoords.lng], { 
        icon: destIcon,
        zIndexOffset: 2000
      }).addTo(map);
    }

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const waypointsString = `${activePos.lng},${activePos.lat};${destCoords.lng},${destCoords.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson&steps=true&continue_straight=true`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

          setRouteCoordinates(coords);
          lastFetchedRouteKeyRef.current = routeKey;

          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coords);
          } else {
            routePolylineRef.current = L.polyline(coords, {
              color: '#1a73e8',
              weight: 8,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }

          const durationMinutes = Math.ceil(route.duration / 60);
          const etaDate = new Date(Date.now() + durationMinutes * 60000);
          const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          setRouteInfo({
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: durationMinutes,
            etaTimeString
          });

          setIsOffRouteDetected(false);
        }
      } catch (err) {
        console.warn('Erro ao calcular rota:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [destCoords?.lat, destCoords?.lng, isOffRouteDetected]);

  const handleRecenter = () => {
    if (mapRef.current && activePos) {
      mapRef.current.invalidateSize();
      mapRef.current.panTo([activePos.lat, activePos.lng], { animate: true });
      setAutoFollow(true);
    } else {
      gpsTracker.requestManualPermission();
    }
  };

  // EXECUÇÃO DO ENTER OU BOTÃO 🔍 SEM SELEÇÃO OBRIGATÓRIA DE AUTOCOMPLETE
  const handleExecuteDirectSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const originalQuery = searchQuery.trim();
    if (!originalQuery) return;

    setSearchResults([]);
    setIsSearching(true);
    setNotFoundAlert(null);

    const geocodeResult = await searchFreeTextAddress(originalQuery);

    setIsSearching(false);

    if (geocodeResult) {
      setPendingConfirmation({
        name: originalQuery,
        addressText: geocodeResult.formattedAddress || originalQuery,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        isApproximate: geocodeResult.isApproximate,
        locationType: geocodeResult.locationType,
        exactNumberMatched: geocodeResult.exactNumberMatched,
        requestedNumber: geocodeResult.requestedNumber,
        unconfirmedReason: geocodeResult.unconfirmedReason,
        placeId: geocodeResult.placeId
      });
    } else {
      setNotFoundAlert("Não encontramos este endereço automaticamente. Posicione o pino manualmente no mapa.");
      handleEnablePinAdjustment();
    }
  };

  const handleConfirmLocation = () => {
    if (!pendingConfirmation) return;

    lastFetchedRouteKeyRef.current = '';
    setDestCoords({ lat: pendingConfirmation.lat, lng: pendingConfirmation.lng });
    setActiveDestination({
      name: pendingConfirmation.name,
      addressText: pendingConfirmation.addressText,
      lat: pendingConfirmation.lat,
      lng: pendingConfirmation.lng
    });

    setPendingConfirmation(null);
    setAutoFollow(true);
    setSearchQuery('');
  };

  const handleSelectSearchResult = async (result: {
    id: string;
    title: string;
    subtitle: string;
    fullAddress: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  }) => {
    setSearchResults([]);

    if (result.lat && result.lng) {
      setPendingConfirmation({
        name: result.title,
        addressText: result.fullAddress,
        lat: result.lat,
        lng: result.lng,
        isApproximate: false,
        exactNumberMatched: true,
        placeId: result.placeId
      });
    } else {
      setIsSearching(true);
      const geocodeRes = await searchFreeTextAddress(result.fullAddress);
      setIsSearching(false);

      if (geocodeRes) {
        setPendingConfirmation({
          name: result.title,
          addressText: geocodeRes.formattedAddress || result.fullAddress,
          lat: geocodeRes.lat,
          lng: geocodeRes.lng,
          isApproximate: geocodeRes.isApproximate,
          locationType: geocodeRes.locationType,
          exactNumberMatched: geocodeRes.exactNumberMatched,
          requestedNumber: geocodeRes.requestedNumber,
          unconfirmedReason: geocodeRes.unconfirmedReason,
          placeId: geocodeRes.placeId || result.placeId
        });
      } else {
        setNotFoundAlert("Local não geocodificado. Posicione o pino no mapa.");
        handleEnablePinAdjustment();
      }
    }
  };

  const handleEnablePinAdjustment = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setTempAdjustedCoords({ lat: center.lat, lng: center.lng });
    }
    setIsPinAdjustmentMode(true);
    setAutoFollow(false);
  };

  const handleConfirmPinAdjustment = () => {
    if (tempAdjustedCoords) {
      setPendingConfirmation({
        name: 'Local Confirmado Manualmente',
        addressText: `Coordenadas: ${tempAdjustedCoords.lat.toFixed(5)}, ${tempAdjustedCoords.lng.toFixed(5)}`,
        lat: tempAdjustedCoords.lat,
        lng: tempAdjustedCoords.lng,
        exactNumberMatched: true,
        locationType: 'ROOFTOP'
      });
    }
    setIsPinAdjustmentMode(false);
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setNotFoundAlert(null);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const rawText = value.trim();

    if (rawText.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const lat = activePos ? activePos.lat : -7.2247;
          const lng = activePos ? activePos.lng : -35.8878;

          // Autocomplete Google Maps via JS SDK se injetado
          if (typeof window !== 'undefined' && (window as any).google?.maps?.places?.AutocompleteService) {
            const service = new (window as any).google.maps.places.AutocompleteService();
            service.getPlacePredictions({
              input: rawText,
              componentRestrictions: { country: 'br' }
            }, (predictions: any[], status: string) => {
              if (status === 'OK' && predictions && predictions.length > 0) {
                const mapped = predictions.map(p => ({
                  id: p.place_id,
                  title: p.structured_formatting?.main_text || p.description.split(',')[0],
                  subtitle: p.structured_formatting?.secondary_text || p.description,
                  fullAddress: p.description,
                  placeId: p.place_id
                }));
                setSearchResults(mapped);
                setIsSearching(false);
                return;
              }
            });
          }

          // Consultas aos serviços secundários de suporte
          const esriQuery = rawText.toLowerCase().includes('campina grande') 
            ? rawText 
            : `${rawText}, Campina Grande - PB`;
          const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(esriQuery)}&f=json&maxLocations=5&location=${lng},${lat}`;

          const esriRes = await fetch(esriUrl).then(r => r.json()).catch(() => null);

          const combined: Array<{
            id: string;
            title: string;
            subtitle: string;
            fullAddress: string;
            lat?: number;
            lng?: number;
            placeId?: string;
          }> = [];
          const seenKeys = new Set<string>();

          if (esriRes && esriRes.candidates) {
            esriRes.candidates.forEach((cand: any) => {
              const loc = cand.location;
              if (!loc) return;

              const key = `${loc.y.toFixed(4)},${loc.x.toFixed(4)}`;
              const fullAddr = cand.address || 'Endereço encontrado';
              const parts = fullAddr.split(',');
              const title = parts[0] ? parts[0].trim() : 'Endereço';
              const subtitle = parts.slice(1).join(',').trim();

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                combined.push({
                  id: 'esri_' + Math.random(),
                  title,
                  subtitle: subtitle || 'Campina Grande - PB',
                  fullAddress: fullAddr,
                  lat: loc.y,
                  lng: loc.x
                });
              }
            });
          }

          setSearchResults(combined);
        } catch (err) {
          console.warn('Erro no Autocomplete:', err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const activeStepInstruction = activeDestination ? `Siga em direção a ${activeDestination.name}` : 'Digite o endereço completo e pressione ENTER...';

  return (
    <div className={`flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl transition-all font-sans ${
      isFullscreen 
        ? 'fixed inset-0 z-50 rounded-none' 
        : 'relative h-[600px] sm:h-[680px] w-full rounded-2xl border border-slate-800'
    }`}>
      
      {/* HEADER NAVEGAÇÃO GOOGLE MAPS (#137333) */}
      <div className="bg-[#137333] text-white px-4 py-3 z-30 shadow-lg flex items-center justify-between relative border-b border-emerald-800 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-2.5 bg-black/20 rounded-2xl text-white flex-shrink-0 border border-white/20">
            <ArrowUp className="h-8 w-8 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-950/80 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Google Maps GPS
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold truncate leading-snug mt-0.5">
              {activeStepInstruction}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0 pl-2">
          <button
            onClick={handleEnablePinAdjustment}
            className={`p-2.5 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold ${
              isPinAdjustmentMode ? 'bg-amber-500 text-slate-950' : 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
            }`}
            title="Ajustar Ponto no Mapa Manualmente"
          >
            <Hand className="h-5 w-5" />
          </button>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2.5 rounded-xl transition-colors ${
              voiceEnabled ? 'bg-emerald-600 text-white shadow-inner' : 'bg-emerald-950 text-emerald-400'
            }`}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-emerald-100"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {onClose && (
            <button onClick={onClose} className="p-2.5 hover:bg-red-500/20 text-red-200 rounded-xl">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* BANNER ALERTA DE ENDEREÇO NÃO ENCONTRADO AUTOMATICAMENTE */}
      {notFoundAlert && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 z-40 flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{notFoundAlert}</span>
          </div>
          <button onClick={() => setNotFoundAlert(null)} className="p-1 hover:bg-black/10 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MODO DE AJUSTE MANUAL DE PINO */}
      {isPinAdjustmentMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 z-40 flex items-center justify-between font-bold text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <Hand className="h-5 w-5 text-slate-950 animate-bounce" />
            <span>Arraste o mapa até o imóvel correto e confirme</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsPinAdjustmentMode(false)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs">
              Cancelar
            </button>
            <button onClick={handleConfirmPinAdjustment} className="bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-black shadow">
              Confirmar Local
            </button>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE BUSCA LIVRE (ENTER / 🔍 LIBERADOS SEM OBRIGAR SUGESTÃO) */}
      <div className="bg-slate-900 border-b border-slate-800 p-2.5 z-20 relative flex-shrink-0 space-y-2">
        <form onSubmit={handleExecuteDirectSearch} className="relative flex items-center gap-1.5">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              placeholder="Digite o endereço exato e pressione ENTER..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full text-white placeholder-slate-400 text-xs sm:text-sm pl-9 pr-10 py-2.5 rounded-xl border bg-slate-800 border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 pointer-events-none" />

            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="text-slate-400 hover:text-white absolute right-3 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* BOTÃO PESQUISAR 🔍 */}
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md flex-shrink-0"
            title="Pesquisar Endereço (ENTER)"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Pesquisar</span>
          </button>
        </form>

        {/* SUGESTÕES OPCIONAIS DO AUTOCOMPLETE */}
        {searchResults.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-64 overflow-y-auto">
            <div className="bg-slate-950 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Sugestões Google Autocomplete</span>
              <span className="text-blue-400">Ou pressione ENTER para o texto digitado</span>
            </div>
            {searchResults.map((res) => (
              <div 
                key={res.id} 
                onClick={() => handleSelectSearchResult(res)}
                className="p-3 hover:bg-blue-950/60 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <MapPin className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-blue-200">{res.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{res.subtitle}</p>
                  </div>
                </div>
                <span className="text-[10px] bg-blue-600/30 text-blue-300 font-bold px-2 py-1 rounded-lg flex-shrink-0">
                  Selecionar
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MAPA INTERATIVO */}
      <div className="relative flex-1 min-h-[240px]">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 bg-slate-950" />

        {isPinAdjustmentMode && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="relative flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-2 border-amber-400 rounded-full animate-ping absolute" />
              <div className="p-3 bg-red-600 text-white rounded-full shadow-2xl border-2 border-white z-10">
                <MapPin className="h-7 w-7" />
              </div>
            </div>
          </div>
        )}

        {/* CARD DE CONFIRMAÇÃO PRÉVIA: "É ESTE O ENDEREÇO?" */}
        {pendingConfirmation && (
          <div className="absolute bottom-4 left-4 right-4 z-40 bg-slate-900 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl space-y-3 animate-bounce-short">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                    {pendingConfirmation.exactNumberMatched 
                      ? "Ponto do Imóvel Confirmado (Google ROOFTOP)"
                      : "Localização de Via Encontrada"}
                  </h4>
                  <p className="text-sm font-bold text-white mt-0.5">{pendingConfirmation.name}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[260px]">{pendingConfirmation.addressText}</p>
                  
                  {pendingConfirmation.unconfirmedReason && (
                    <div className="bg-amber-950/80 border border-amber-500/40 rounded-lg p-2 mt-1 text-[10px] text-amber-200">
                      ⚠️ <strong>Aviso do Google:</strong> {pendingConfirmation.unconfirmedReason}
                    </div>
                  )}

                  <p className="text-[9px] text-slate-500 font-mono mt-1">
                    Coordenadas: {pendingConfirmation.lat.toFixed(5)}, {pendingConfirmation.lng.toFixed(5)} | Precisão: {pendingConfirmation.locationType || 'N/A'}
                  </p>
                </div>
              </div>

              <button onClick={() => setPendingConfirmation(null)} className="text-slate-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <button
                onClick={handleConfirmLocation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>CONFIRMAR LOCALIZAÇÃO</span>
              </button>

              <button
                onClick={() => {
                  const targetLat = pendingConfirmation.lat;
                  const targetLng = pendingConfirmation.lng;
                  setPendingConfirmation(null);
                  if (mapRef.current) mapRef.current.setView([targetLat, targetLng], 18);
                  handleEnablePinAdjustment();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Hand className="h-4 w-4" />
                <span>AJUSTAR NO MAPA</span>
              </button>
            </div>
          </div>
        )}

        <div className="absolute bottom-5 right-4 z-20 flex flex-col space-y-2">
          <button onClick={handleRecenter} className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* CARD INFERIOR (ESTATÍSTICAS DA ROTA) */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 z-20 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-emerald-400">
                  {routeInfo ? `${routeInfo.durationMin} min` : '--'}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  ({routeInfo ? `${routeInfo.distanceKm} km` : '--'})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                ETA: <strong className="text-white font-bold">{routeInfo?.etaTimeString || '--:--'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const nextState = !isNavigating;
              setIsNavigating(nextState);
              gpsTracker.setNavigating(nextState);
            }}
            className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all ${
              isNavigating ? 'bg-red-600 text-white animate-pulse' : 'bg-[#1a73e8] text-white'
            }`}
          >
            {isNavigating ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{isNavigating ? 'Encerrar' : 'INICIAR NAVEGAÇÃO'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}