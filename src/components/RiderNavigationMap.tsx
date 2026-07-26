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
  Plus,
  Minus,
  Layers,
  Play,
  Square,
  LocateFixed,
  CompassIcon,
  Loader2,
  Home,
  Check,
  Building2,
  Store,
  Mic,
  MicOff,
  ShieldCheck,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCw
} from 'lucide-react';
import L from 'leaflet';
import { gpsTracker, GpsState, isPointOffRoute } from '../utils/gpsTracker';

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

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  modifier?: string;
  type?: string;
}

interface CustomSearchResult {
  id: string;
  title: string;
  subtitle: string;
  fullAddress: string;
  lat: number;
  lng: number;
  type: 'poi' | 'street' | 'condo';
  source?: 'esri' | 'photon' | 'osm';
}

type MapProviderType = 'google_roadmap' | 'google_satellite' | 'google_terrain';

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
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const initialCenterDoneRef = useRef(false);
  const lastFetchedDestRef = useRef<string>('');
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  const [selectedStreetResult, setSelectedStreetResult] = useState<CustomSearchResult | null>(null);
  const [houseNumberInput, setHouseNumberInput] = useState('');

  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mapType, setMapType] = useState<MapProviderType>('google_roadmap');
  const [showTraffic, setShowTraffic] = useState(true);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);

  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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
      let foundLat: number | null = null;
      let foundLng: number | null = null;

      try {
        const fullQuery = activeDestination.addressText.toLowerCase().includes('campina grande') 
          ? activeDestination.addressText 
          : `${activeDestination.addressText}, Campina Grande - PB, Brasil`;

        const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(fullQuery)}&f=json&maxLocations=1`;
        const esriRes = await fetch(esriUrl);
        const esriData = await esriRes.json();
        if (esriData && esriData.candidates && esriData.candidates.length > 0) {
          const loc = esriData.candidates[0].location;
          foundLat = loc.y;
          foundLng = loc.x;
        }

        if (!foundLat || !foundLng) {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`
          );
          const data = await res.json();
          if (data && data.length > 0) {
            foundLat = parseFloat(data[0].lat);
            foundLng = parseFloat(data[0].lon);
          }
        }
      } catch (e) {}

      if (foundLat && foundLng) {
        setDestCoords({ lat: foundLat, lng: foundLng });
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

    mapRef.current = mapInstance;
    updateMapTileLayer('google_roadmap', true);

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

  const updateMapTileLayer = (provider: MapProviderType, traffic: boolean) => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current = null;
    }

    let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    if (provider === 'google_satellite') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
    } else if (provider === 'google_terrain') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
    }

    const newLayer = L.tileLayer(tileUrl, { maxZoom: 20 });
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;

    if (traffic) {
      const trafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@121,traffic&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.75
      });
      trafficLayer.addTo(map);
      trafficLayerRef.current = trafficLayer;
    }

    setMapType(provider);
    setShowTraffic(traffic);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos) return;

    const heading = activePos.heading || 0;
    
    // Ícone de seta de navegação Google 3D azul
    const riderIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background: rgba(26, 115, 232, 0.25); border: 2px solid #1a73e8; animation: pulse 2s infinite;"></div>
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.2s ease-out;
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

    if (!initialCenterDoneRef.current || autoFollow) {
      map.invalidateSize();
      map.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL, { animate: true });
      initialCenterDoneRef.current = true;
    }

    if (isNavigating && routeCoordinates.length > 0) {
      const offRoute = isPointOffRoute({ lat: activePos.lat, lng: activePos.lng }, routeCoordinates, 40);
      if (offRoute && !isOffRouteDetected) {
        setIsOffRouteDetected(true);
        speakInstruction('Você saiu da rota. Recalculando trajeto no Google Maps...');
      }
    }
  }, [activePos?.lat, activePos?.lng, activePos?.heading, autoFollow, isNavigating, routeCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos || !destCoords) return;

    const destKey = `${destCoords.lat.toFixed(5)},${destCoords.lng.toFixed(5)}`;
    
    if (lastFetchedDestRef.current === destKey && !isOffRouteDetected && routeCoordinates.length > 0) {
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
        const url = `https://router.project-osrm.org/route/v1/driving/${activePos.lng},${activePos.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

          setRouteCoordinates(coords);
          lastFetchedDestRef.current = destKey;

          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coords);
          } else {
            routePolylineRef.current = L.polyline(coords, {
              color: '#1a73e8', // Azul oficial do Google Maps
              weight: 8,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }

          const routeSteps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
            instruction: formatOsmInstruction(step.maneuver, step.name),
            distance: Math.round(step.distance),
            duration: Math.round(step.duration),
            modifier: step.maneuver?.modifier,
            type: step.maneuver?.type
          }));

          setSteps(routeSteps);
          setCurrentStepIndex(0);

          const durationMinutes = Math.ceil(route.duration / 60);
          const etaDate = new Date(Date.now() + durationMinutes * 60000);
          const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          setRouteInfo({
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: durationMinutes,
            etaTimeString
          });

          setIsOffRouteDetected(false);

          if (autoFollow) {
            map.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL, { animate: true });
          }

          if (isNavigating && routeSteps.length > 0) {
            speakInstruction(`Siga a rota. ${routeSteps[0].instruction}`);
          }
        }
      } catch (err) {
        console.warn('Erro ao calcular rota:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [destCoords?.lat, destCoords?.lng, isOffRouteDetected]);

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

  const getManeuverIcon = (step: RouteStep) => {
    const modifier = step.modifier;
    const type = step.type;

    if (type === 'arrive') return <MapPin className="h-8 w-8 text-white" />;
    if (modifier === 'left' || modifier === 'sharp left') return <CornerUpLeft className="h-8 w-8 text-white" />;
    if (modifier === 'slight left') return <ArrowUpLeft className="h-8 w-8 text-white" />;
    if (modifier === 'right' || modifier === 'sharp right') return <CornerUpRight className="h-8 w-8 text-white" />;
    if (modifier === 'slight right') return <ArrowUpRight className="h-8 w-8 text-white" />;
    if (modifier === 'uturn') return <RotateCw className="h-8 w-8 text-white" />;

    return <ArrowUp className="h-8 w-8 text-white" />;
  };

  const handleStartVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Pesquisa por voz não suportada neste navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript;
        if (spokenText) {
          handleSearchInput(spokenText);
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);

      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    
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

          const esriQuery = rawText.toLowerCase().includes('campina grande') 
            ? rawText 
            : `${rawText}, Campina Grande - PB`;
          const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(esriQuery)}&f=json&maxLocations=6&location=${lng},${lat}`;

          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawText)}&lat=${lat}&lon=${lng}&limit=6`;

          const [esriRes, photonRes] = await Promise.all([
            fetch(esriUrl).then(r => r.json()).catch(() => null),
            fetch(photonUrl).then(r => r.json()).catch(() => null)
          ]);

          const combined: CustomSearchResult[] = [];
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

              let type: 'poi' | 'street' | 'condo' = 'street';
              const lower = fullAddr.toLowerCase();
              if (lower.includes('condom') || lower.includes('residencial') || lower.includes('edificio') || lower.includes('torre')) {
                type = 'condo';
              } else if (cand.attributes && (cand.attributes.Type === 'POI' || cand.attributes.Type === 'Establishment')) {
                type = 'poi';
              }

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                combined.push({
                  id: 'esri_' + Math.random(),
                  title,
                  subtitle: subtitle || 'Campina Grande - PB',
                  fullAddress: fullAddr,
                  lat: loc.y,
                  lng: loc.x,
                  type,
                  source: 'esri'
                });
              }
            });
          }

          if (photonRes && photonRes.features) {
            photonRes.features.forEach((feat: any) => {
              const props = feat.properties;
              const coords = feat.geometry.coordinates;
              if (!coords || coords.length < 2) return;

              const title = props.name || props.street || 'Local';
              const district = props.district || props.suburb || props.neighbourhood || '';
              const city = props.city || props.town || 'Campina Grande';
              const state = props.state || 'PB';

              let subtitleParts = [];
              if (props.housenumber) subtitleParts.push(`Nº ${props.housenumber}`);
              if (props.street && props.street !== title) subtitleParts.push(props.street);
              if (district) subtitleParts.push(district);
              if (city) subtitleParts.push(`${city}/${state}`);

              const subtitle = subtitleParts.join(' • ') || `${city}/${state}`;
              const key = `${coords[1].toFixed(4)},${coords[0].toFixed(4)}`;

              let type: 'poi' | 'street' | 'condo' = 'poi';
              const lowerTitle = title.toLowerCase();
              if (lowerTitle.includes('condom') || lowerTitle.includes('residencial') || lowerTitle.includes('edificio')) {
                type = 'condo';
              } else if (props.osm_key === 'highway' || lowerTitle.startsWith('rua') || lowerTitle.startsWith('av')) {
                type = 'street';
              }

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                combined.push({
                  id: 'photon_' + Math.random(),
                  title,
                  subtitle,
                  fullAddress: `${title}, ${subtitle}`,
                  lat: coords[1],
                  lng: coords[0],
                  type,
                  source: 'photon'
                });
              }
            });
          }

          setSearchResults(combined);
        } catch (err) {
          console.warn('Erro na busca de locais:', err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: CustomSearchResult) => {
    const hasNumberInTitle = /\d+/.test(result.title) || /\d+/.test(searchQuery);

    if (result.type === 'street' && !hasNumberInTitle && result.source !== 'esri') {
      setSelectedStreetResult(result);
      setHouseNumberInput('');
      setSearchResults([]);
    } else {
      lastFetchedDestRef.current = '';
      setActiveDestination({
        name: result.title,
        addressText: result.fullAddress,
        lat: result.lat,
        lng: result.lng
      });

      setAutoFollow(true);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const handleConfirmAddressWithNumber = async (numberOverride?: string) => {
    if (!selectedStreetResult) return;

    const num = numberOverride !== undefined ? numberOverride : houseNumberInput.trim();
    const streetTitle = selectedStreetResult.title;

    const title = num ? `${streetTitle}, Nº ${num}` : streetTitle;
    const fullAddress = num ? `${streetTitle}, ${num} - ${selectedStreetResult.subtitle}` : selectedStreetResult.fullAddress;

    let finalLat = selectedStreetResult.lat;
    let finalLng = selectedStreetResult.lng;

    if (num) {
      setLoadingRoute(true);
      try {
        const queryWithNum = `${streetTitle}, ${num}, Campina Grande - PB, Brasil`;
        const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(queryWithNum)}&f=json&maxLocations=1`;
        const esriRes = await fetch(esriUrl);
        const esriData = await esriRes.json();
        if (esriData && esriData.candidates && esriData.candidates.length > 0) {
          const loc = esriData.candidates[0].location;
          finalLat = loc.y;
          finalLng = loc.x;
        }
      } catch (err) {
        console.warn('Erro geocodificando número exato:', err);
      } finally {
        setLoadingRoute(false);
      }
    }

    lastFetchedDestRef.current = '';
    setActiveDestination({
      name: title,
      addressText: fullAddress,
      lat: finalLat,
      lng: finalLng
    });

    setAutoFollow(true);
    setSelectedStreetResult(null);
    setSearchQuery('');
  };

  const toggleNavigationMode = () => {
    const nextState = !isNavigating;
    setIsNavigating(nextState);
    gpsTracker.setNavigating(nextState);

    if (nextState) {
      setAutoFollow(true);
      if (steps.length > 0) {
        speakInstruction(`Iniciando navegação Google Maps para ${activeDestination?.name || 'seu destino'}. ${steps[0].instruction}`);
      }
    } else {
      speakInstruction('Navegação encerrada.');
    }
  };

  const handleRecenter = () => {
    if (mapRef.current && activePos) {
      mapRef.current.invalidateSize();
      mapRef.current.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL, { animate: true });
      setAutoFollow(true);
    } else {
      gpsTracker.requestManualPermission();
    }
  };

  const activeStep = steps[currentStepIndex] || {
    instruction: activeDestination ? `Siga em direção a ${activeDestination.name}` : 'Digite ou fale o endereço no Google Maps...',
    distance: 0,
    duration: 0
  };

  return (
    <div className={`flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl transition-all font-sans ${
      isFullscreen 
        ? 'fixed inset-0 z-50 rounded-none' 
        : 'relative h-[600px] sm:h-[680px] w-full rounded-2xl border border-slate-800'
    }`}>
      
      {/* HEADER GOOGLE MAPS - VERDE GOOGLE NAVEGAÇÃO (#137333) */}
      <div className="bg-[#137333] text-white px-4 py-3 z-30 shadow-lg flex items-center justify-between relative border-b border-emerald-800 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-2.5 bg-black/20 rounded-2xl text-white flex-shrink-0 border border-white/20">
            {getManeuverIcon(activeStep)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {activeStep.distance > 0 && (
                <span className="text-sm font-black text-emerald-200">
                  em {activeStep.distance}m
                </span>
              )}
              <span className="bg-emerald-950/80 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Rastreio Loja 100% On
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold truncate leading-snug mt-0.5">
              {activeStep.instruction}
            </h2>
          </div>
        </div>

        {/* BOTOES DE CONTROLE DO MAPA */}
        <div className="flex items-center space-x-1.5 flex-shrink-0 pl-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2.5 rounded-xl transition-colors ${
              voiceEnabled ? 'bg-emerald-600 text-white shadow-inner' : 'bg-emerald-950 text-emerald-400'
            }`}
            title={voiceEnabled ? 'Voz Google Ativa' : 'Voz Mutada'}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => {
                if (mapRef.current) mapRef.current.invalidateSize();
              }, 200);
            }}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-emerald-100"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-red-500/20 text-red-200 hover:text-white rounded-xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* SEARCH BAR ESTILO GOOGLE MAPS MOBILE */}
      <div className="bg-slate-900 border-b border-slate-800 p-2.5 z-20 relative flex-shrink-0 space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={isListeningVoice ? "Fale o endereço agora..." : "Buscar condomínio, loja, órgão ou rua com nº..."}
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            className={`w-full text-white placeholder-slate-400 text-xs sm:text-sm pl-9 pr-20 py-2.5 rounded-xl border focus:outline-none transition-all shadow-inner ${
              isListeningVoice 
                ? 'bg-red-950/80 border-red-500 focus:ring-red-500 animate-pulse' 
                : 'bg-slate-800 border-slate-700 focus:ring-1 focus:ring-blue-500'
            }`}
          />
          <Search className="h-4 w-4 text-slate-400 absolute left-3 pointer-events-none" />

          <div className="absolute right-2 flex items-center gap-1">
            {isSearching && (
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin mr-1" />
            )}
            
            {!isSearching && searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleStartVoiceSearch}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                isListeningVoice 
                  ? 'bg-red-600 text-white animate-bounce' 
                  : 'bg-slate-700 hover:bg-blue-600 text-slate-200'
              }`}
              title="Pesquisar por voz"
            >
              {isListeningVoice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-extrabold text-slate-200">Google Maps HD</span>
            {activePos && (
              <span className="text-slate-500">
                (Sinal: ±{activePos.accuracy}m)
              </span>
            )}
          </div>

          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-bold transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            <span>Camadas</span>
          </button>
        </div>

        {showLayerMenu && (
          <div className="absolute right-2 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 min-w-[190px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Tipo de Mapa Google</p>
            <button
              onClick={() => { updateMapTileLayer('google_roadmap', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_roadmap' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Vetorial</span>
            </button>
            <button
              onClick={() => { updateMapTileLayer('google_satellite', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_satellite' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Satélite</span>
            </button>
            <button
              onClick={() => { updateMapTileLayer('google_terrain', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_terrain' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Terreno</span>
            </button>
            
            <div className="border-t border-slate-800 my-1 pt-1">
              <button
                onClick={() => { updateMapTileLayer(mapType, !showTraffic); setShowLayerMenu(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between ${showTraffic ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                <span>Trânsito em Tempo Real</span>
                {showTraffic && <span className="text-[9px] bg-emerald-800 px-1.5 py-0.5 rounded uppercase font-black">ON</span>}
              </button>
            </div>
          </div>
        )}

        {selectedStreetResult && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 border-2 border-blue-500 rounded-2xl p-4 shadow-2xl z-50">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Home className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">{selectedStreetResult.title}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                    {selectedStreetResult.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStreetResult(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAddressWithNumber();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">
                  Qual o número do imóvel/residência?
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: 882, 10B, S/N..."
                  value={houseNumberInput}
                  onChange={(e) => setHouseNumberInput(e.target.value)}
                  className="w-full bg-slate-800 text-white placeholder-slate-500 text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 shadow-md"
                >
                  <Check className="h-4 w-4" />
                  <span>Navegar para o Número</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAddressWithNumber('')}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-xl transition-colors"
                >
                  Sem número
                </button>
              </div>
            </form>
          </div>
        )}

        {!selectedStreetResult && searchResults.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-64 overflow-y-auto">
            <div className="bg-slate-950 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Locais sugeridos Google</span>
              <span>{searchResults.length} encontrado(s)</span>
            </div>
            {searchResults.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelectSearchResult(res)}
                className="w-full p-3 text-left hover:bg-blue-950/60 transition-colors flex items-start space-x-3 group"
              >
                <div className={`p-2 rounded-xl text-white transition-colors mt-0.5 flex-shrink-0 ${
                  res.type === 'condo' ? 'bg-amber-600' :
                  res.type === 'poi' ? 'bg-blue-600' : 'bg-slate-800 group-hover:bg-blue-600 text-emerald-400 group-hover:text-white'
                }`}>
                  {res.type === 'condo' ? <Building2 className="h-4 w-4" /> :
                   res.type === 'poi' ? <Store className="h-4 w-4" /> :
                   <MapPin className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate group-hover:text-blue-200">
                    {res.title}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {res.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MAPA INTERATIVO DO GOOGLE MAPS INCORPORADO */}
      <div className="relative flex-1 min-h-[240px]">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 bg-slate-950" />

        {!activePos && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="p-4 bg-blue-600/20 text-blue-400 rounded-full animate-bounce">
              <CompassIcon className="h-10 w-10" />
            </div>
            <h3 className="text-base font-bold text-white">Localizando seu dispositivo...</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Garanta que o GPS do seu smartphone esteja ativo.
            </p>
            <button
              onClick={() => gpsTracker.requestManualPermission()}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all"
            >
              <LocateFixed className="h-4 w-4" />
              <span>Conectar GPS Agora</span>
            </button>
          </div>
        )}

        {/* VELOCÍMETRO GOOGLE MAPS EM TEMPO REAL */}
        {activePos && (
          <div className="absolute bottom-5 left-4 z-20 bg-slate-900/90 border border-slate-700 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center justify-center min-w-[65px]">
            <span className={`text-2xl font-black leading-none ${
              (activePos.speedKmh || 0) > 60 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activePos.speedKmh || 0}
            </span>
            <span className="text-[8px] font-extrabold uppercase text-slate-400 tracking-wider mt-0.5">km/h</span>
          </div>
        )}

        {/* BOTÃO RECENTRALIZAR CAMERA GOOGLE MAPS */}
        <div className="absolute bottom-5 right-4 z-20 flex flex-col space-y-2">
          <button
            onClick={() => {
              if (mapRef.current) mapRef.current.zoomIn();
            }}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 transition-all flex items-center justify-center"
            title="Aumentar Zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => {
              if (mapRef.current) mapRef.current.zoomOut();
            }}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 transition-all flex items-center justify-center"
            title="Diminuir Zoom"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            onClick={handleRecenter}
            className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center justify-center ${
              autoFollow 
                ? 'bg-blue-600 text-white border-blue-500' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
            }`}
            title="Recentralizar na minha localização"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        {loadingRoute && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex items-center space-x-3 text-blue-400 font-bold text-xs shadow-2xl">
              <Navigation className="h-5 w-5 animate-spin text-emerald-400" />
              <span>Calculando melhor rota Google...</span>
            </div>
          </div>
        )}
      </div>

      {/* CARD INFERIOR ESTILO GOOGLE MAPS MOBILE (ETA, DISTÂNCIA E INICIAR) */}
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
                Chegada estimada: <strong className="text-white font-bold">{routeInfo?.etaTimeString || '--:--'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={toggleNavigationMode}
            className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all ${
              isNavigating 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : 'bg-[#1a73e8] hover:bg-blue-700 text-white'
            }`}
          >
            {isNavigating ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{isNavigating ? 'Encerrar' : 'INICIAR'}</span>
          </button>
        </div>

        {activeDestination && (
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-1.5 bg-red-500/20 text-red-400 rounded-lg flex-shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">{activeDestination.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{activeDestination.addressText}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveDestination(null);
                setSteps([]);
                setRouteInfo(null);
                lastFetchedDestRef.current = '';
                if (routePolylineRef.current) {
                  routePolylineRef.current.remove();
                  routePolylineRef.current = null;
                }
              }}
              className="text-[10px] text-slate-400 hover:text-red-400 font-bold px-2 py-1 rounded-lg hover:bg-slate-700/80 transition-colors flex-shrink-0"
            >
              Remover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}