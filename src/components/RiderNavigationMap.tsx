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
  ExternalLink
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

type MapProviderType = 'google_roadmap' | 'google_satellite' | 'google_terrain' | 'osm';

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

  // ESTADO PARA O NÚMERO DA RESIDÊNCIA (QUANDO É UMA RUA)
  const [selectedStreetResult, setSelectedStreetResult] = useState<CustomSearchResult | null>(null);
  const [houseNumberInput, setHouseNumberInput] = useState('');

  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mapType, setMapType] = useState<MapProviderType>('google_roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);

  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: string;
    durationMin: number;
  } | null>(null);

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const lastSpokenInstructionRef = useRef<string>('');
  const NAV_ZOOM_LEVEL = 17;

  useEffect(() => {
    gpsTracker.startTracking();
    const unsubscribe = gpsTracker.subscribe((state) => {
      setGpsState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const activePos = gpsState.currentLocation || (externalLocation ? {
    lat: externalLocation.lat,
    lng: externalLocation.lng,
    accuracy: 10,
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
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpokenInstructionRef.current = text;
  };

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

      try {
        const fullQuery = activeDestination.addressText.toLowerCase().includes('campina grande') 
          ? activeDestination.addressText 
          : `${activeDestination.addressText}, Campina Grande - PB, Brasil`;

        // 1. Tentar Esri ArcGIS World Geocoding
        const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(fullQuery)}&f=json&maxLocations=1`;
        const esriRes = await fetch(esriUrl);
        const esriData = await esriRes.json();
        if (esriData && esriData.candidates && esriData.candidates.length > 0) {
          const loc = esriData.candidates[0].location;
          foundLat = loc.y;
          foundLng = loc.x;
        }

        // 2. Fallback Nominatim
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

  // Inicialização do Mapa Leaflet
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
    }).setView([initialLat, initialLng], activePos ? NAV_ZOOM_LEVEL : 14);

    mapInstance.on('dragstart', () => {
      setAutoFollow(false);
    });

    mapRef.current = mapInstance;
    updateMapTileLayer('google_roadmap', false);

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

  // Alternar Camada do Mapa
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
    } else if (provider === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }

    const newLayer = L.tileLayer(tileUrl, { maxZoom: 20 });
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;

    if (traffic && provider.startsWith('google')) {
      const trafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@121,traffic&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.7
      });
      trafficLayer.addTo(map);
      trafficLayerRef.current = trafficLayer;
    }

    setMapType(provider);
    setShowTraffic(traffic);
  };

  // Renderização do Ponto do Motoboy no Mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos) return;

    const heading = activePos.heading || 0;
    
    const riderIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 52px; height: 52px; border-radius: 50%; background: rgba(37,99,235,0.35); border: 2.5px solid #2563eb;"></div>
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.2s ease-out;
            background: #1d4ed8;
            color: white;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 3.5px solid #ffffff;
            box-shadow: 0 6px 16px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 100;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
        </div>
      `,
      className: 'custom-rider-nav-icon',
      iconSize: [60, 60],
      iconAnchor: [30, 30]
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
      map.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL, {
        animate: true,
        duration: 0.5
      });
      initialCenterDoneRef.current = true;
    }

    if (isNavigating && routeCoordinates.length > 0) {
      const offRoute = isPointOffRoute({ lat: activePos.lat, lng: activePos.lng }, routeCoordinates, 45);
      if (offRoute && !isOffRouteDetected) {
        setIsOffRouteDetected(true);
        speakInstruction('Você saiu da rota. Recalculando percurso...');
      }
    }
  }, [activePos?.lat, activePos?.lng, activePos?.heading, autoFollow, isNavigating, routeCoordinates]);

  // Traçar Rota
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
          background: #ef4444;
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 3.5px solid white;
          box-shadow: 0 0 18px rgba(239,68,68,0.85);
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
              color: '#3b82f6',
              weight: 8,
              opacity: 0.95,
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

  // PESQUISA POR COMANDO DE VOZ
  const handleStartVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador ou dispositivo não suporta pesquisa por voz.');
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

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  // MOTOR DE BUSCA MULTISSISTEMAS (ESRI ARCGIS + PHOTON + NOMINATIM)
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

          // 1. Esri World GeocodeServer (O motor do Maps/ArcGIS de maior precisão comercial e residencial)
          const esriQuery = rawText.toLowerCase().includes('campina grande') 
            ? rawText 
            : `${rawText}, Campina Grande - PB`;
          const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(esriQuery)}&f=json&maxLocations=6&location=${lng},${lat}`;

          // 2. Photon API
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawText)}&lat=${lat}&lon=${lng}&limit=6`;
          
          // 3. Nominatim
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(esriQuery)}&limit=4&viewbox=${lng-0.4},${lat+0.4},${lng+0.4},${lat-0.4}`;

          const [esriRes, photonRes, nomRes] = await Promise.all([
            fetch(esriUrl).then(r => r.json()).catch(() => null),
            fetch(photonUrl).then(r => r.json()).catch(() => null),
            fetch(nomUrl).then(r => r.json()).catch(() => null)
          ]);

          const combined: CustomSearchResult[] = [];
          const seenKeys = new Set<string>();

          // A. Processar resultados do Esri ArcGIS (Prioridade Máxima)
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
              if (lower.includes('condom') || lower.includes('residencial') || lower.includes('edificio') || lower.includes('torre') || lower.includes('villas')) {
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

          // B. Processar Photon API
          if (photonRes && photonRes.features) {
            photonRes.features.forEach((feat: any) => {
              const props = feat.properties;
              const coords = feat.geometry.coordinates; // [lon, lat]
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
              if (lowerTitle.includes('condom') || lowerTitle.includes('residencial') || lowerTitle.includes('edificio') || lowerTitle.includes('torre')) {
                type = 'condo';
              } else if (props.osm_key === 'highway' || lowerTitle.startsWith('rua') || lowerTitle.startsWith('av') || lowerTitle.startsWith('alameda')) {
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

          // C. Processar Nominatim OSM
          if (nomRes && Array.isArray(nomRes)) {
            nomRes.forEach((item: any) => {
              const itemLat = parseFloat(item.lat);
              const itemLng = parseFloat(item.lon);
              const key = `${itemLat.toFixed(4)},${itemLng.toFixed(4)}`;

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                const parts = item.display_name.split(',');
                const title = parts[0] || 'Endereço';
                const subtitle = parts.slice(1, 4).join(',').trim();

                let type: 'poi' | 'street' | 'condo' = 'street';
                const lower = item.display_name.toLowerCase();
                if (lower.includes('condom') || lower.includes('residencial') || lower.includes('edificio')) {
                  type = 'condo';
                } else if (item.class === 'amenity' || item.class === 'shop' || item.class === 'building' || item.class === 'office') {
                  type = 'poi';
                }

                combined.push({
                  id: 'nom_' + item.place_id,
                  title,
                  subtitle,
                  fullAddress: item.display_name,
                  lat: itemLat,
                  lng: itemLng,
                  type,
                  source: 'osm'
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
    // Se a busca for uma rua sem número definido, abre a caixinha solicitando o número
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
        } else {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithNum)}&limit=1`
          );
          const data = await res.json();
          if (data && data.length > 0) {
            finalLat = parseFloat(data[0].lat);
            finalLng = parseFloat(data[0].lon);
          }
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
        speakInstruction(`Iniciando navegação para ${activeDestination?.name || 'seu destino'}. ${steps[0].instruction}`);
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

  // Garante que a transmissão GPS e serviço Keep-Alive em background permaneçam rodando antes de abrir aplicativo externo
  const openExternalGps = (url: string) => {
    gpsTracker.startTracking();
    window.open(url, '_blank');
  };

  const openInWaze = () => {
    if (!destCoords) return;
    openExternalGps(`https://waze.com/ul?ll=${destCoords.lat},${destCoords.lng}&navigate=yes`);
  };

  const openInGoogleMaps = () => {
    if (!destCoords) return;
    openExternalGps(`https://www.google.com/maps/dir/?api=1&destination=${destCoords.lat},${destCoords.lng}&travelmode=driving`);
  };

  const activeStep = steps[currentStepIndex] || {
    instruction: activeDestination ? `Navegando para ${activeDestination.name}` : 'Digite ou fale um endereço para traçar rota...',
    distance: 0,
    duration: 0
  };

  const gpsQualityLabel = 
    gpsState.quality === 'excellent' ? 'Sinal Excelente' :
    gpsState.quality === 'good' ? 'Sinal Bom' :
    gpsState.quality === 'weak' ? 'Sinal Capturado' :
    gpsState.quality === 'denied' ? 'Permissão Negada' : 'Aguardando GPS...';

  const gpsQualityColor = 
    gpsState.quality === 'excellent' ? 'bg-emerald-500' :
    gpsState.quality === 'good' ? 'bg-blue-500' :
    gpsState.quality === 'weak' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={`flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl transition-all font-sans ${
      isFullscreen 
        ? 'fixed inset-0 z-50 rounded-none' 
        : 'relative h-[540px] sm:h-[620px] w-full rounded-2xl border border-slate-800'
    }`}>
      
      {/* BANNER NAVEGAÇÃO TURNO A TURNO */}
      <div className="bg-emerald-600 text-white px-3.5 py-2.5 z-30 shadow-md flex items-center justify-between relative border-b border-emerald-500 flex-shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className="p-2 bg-white/20 rounded-xl text-white flex-shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-emerald-800/80 text-emerald-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                {isNavigating ? 'Navegação Ativa' : 'GPS em Tempo Real'}
              </span>
              {activeStep.distance > 0 && (
                <span className="text-[11px] font-extrabold text-emerald-200">
                  em {activeStep.distance}m
                </span>
              )}
            </div>
            <h2 className="text-xs sm:text-sm font-black truncate leading-tight mt-0.5">
              {activeStep.instruction}
            </h2>
          </div>
        </div>

        {/* CONTROLES DE ÁUDIO, NAVEGAÇÃO E TELA */}
        <div className="flex items-center space-x-1 flex-shrink-0 pl-1">
          <button
            onClick={toggleNavigationMode}
            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-md transition-all ${
              isNavigating 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : 'bg-white text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            {isNavigating ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{isNavigating ? 'Parar' : 'Iniciar'}</span>
          </button>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              voiceEnabled ? 'bg-emerald-500 text-white' : 'bg-emerald-800 text-emerald-300'
            }`}
            title={voiceEnabled ? 'Voz de Navegação Ativa' : 'Voz Mutada'}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => {
                if (mapRef.current) mapRef.current.invalidateSize();
              }, 200);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-emerald-100"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 text-red-200 hover:text-white rounded-lg transition-colors"
              title="Encerrar Navegação"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* BARRA SUPERIOR DE BUSCA COM MICROFONE E DIAGNÓSTICO DO GPS */}
      <div className="bg-slate-900 border-b border-slate-800 p-2 z-20 relative flex-shrink-0 space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={isListeningVoice ? "Fale o endereço agora..." : "Buscar condomínio, loja, órgão ou rua com nº..."}
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            className={`w-full text-white placeholder-slate-400 text-xs pl-8 pr-16 py-2 rounded-lg border focus:outline-none focus:ring-1 transition-all ${
              isListeningVoice 
                ? 'bg-red-950/80 border-red-500 focus:ring-red-500 animate-pulse' 
                : 'bg-slate-800 border-slate-700 focus:ring-indigo-500'
            }`}
          />
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />

          {/* CONTROLES DA BARRA DE PESQUISA (MICROFONE + LIMPAR) */}
          <div className="absolute right-2 flex items-center gap-1">
            {isSearching && (
              <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin mr-1" />
            )}
            
            {!isSearching && searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="text-slate-400 hover:text-white p-1"
                title="Limpar texto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleStartVoiceSearch}
              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${
                isListeningVoice 
                  ? 'bg-red-600 text-white animate-bounce' 
                  : 'bg-slate-700 hover:bg-indigo-600 text-slate-200'
              }`}
              title="Pesquisar por voz"
            >
              {isListeningVoice ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* METRO DE DIAGNÓSTICO DO SINAL DO GPS */}
        <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${gpsQualityColor} animate-pulse`} />
            <span className="font-bold text-slate-300">{gpsQualityLabel}</span>
            {activePos && (
              <span className="text-slate-500">
                (Precisão: ±{activePos.accuracy}m)
              </span>
            )}
          </div>

          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded font-bold transition-colors"
          >
            <Layers className="h-3 w-3 text-indigo-400" />
            <span>Camadas</span>
          </button>
        </div>

        {/* MENU DE SELEÇÃO DE CAMADAS */}
        {showLayerMenu && (
          <div className="absolute right-2 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 min-w-[180px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Tipo de Mapa</p>
            <button
              onClick={() => { updateMapTileLayer('google_roadmap', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_roadmap' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Normal</span>
            </button>
            <button
              onClick={() => { updateMapTileLayer('google_satellite', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_satellite' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Satélite</span>
            </button>
            <button
              onClick={() => { updateMapTileLayer('google_terrain', showTraffic); setShowLayerMenu(false); }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${mapType === 'google_terrain' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <span>Google Terreno</span>
            </button>
            
            <div className="border-t border-slate-800 my-1 pt-1">
              <button
                onClick={() => { updateMapTileLayer(mapType, !showTraffic); setShowLayerMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${showTraffic ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                <span>Trânsito ao Vivo</span>
                {showTraffic && <span className="text-[9px] bg-emerald-800 px-1.5 py-0.5 rounded uppercase">ON</span>}
              </button>
            </div>
          </div>
        )}

        {/* OVERLAY PARA SELEÇÃO DO NÚMERO DA RESIDÊNCIA */}
        {selectedStreetResult && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 border-2 border-indigo-500 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <Home className="h-4 w-4" />
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
              className="space-y-2"
            >
              <div>
                <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                  Qual o número da residência?
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: 882, 10B, S/N..."
                  value={houseNumberInput}
                  onChange={(e) => setHouseNumberInput(e.target.value)}
                  className="w-full bg-slate-800 text-white placeholder-slate-500 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-md"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Traçar Rota com Nº</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAddressWithNumber('')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition-colors"
                >
                  Sem número
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE SUGESTÕES EM TEMPO REAL AO DIGITAR OU FALAR */}
        {!selectedStreetResult && searchResults.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-64 overflow-y-auto">
            <div className="bg-slate-950 px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Locais e Endereços sugeridos</span>
              <span>{searchResults.length} resultado(s)</span>
            </div>
            {searchResults.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelectSearchResult(res)}
                className="w-full p-2.5 text-left hover:bg-indigo-950/60 transition-colors flex items-start space-x-2.5 group"
              >
                <div className={`p-1.5 rounded-lg text-white transition-colors mt-0.5 flex-shrink-0 ${
                  res.type === 'condo' ? 'bg-amber-600' :
                  res.type === 'poi' ? 'bg-indigo-600' : 'bg-slate-800 group-hover:bg-indigo-600 text-emerald-400 group-hover:text-white'
                }`}>
                  {res.type === 'condo' ? <Building2 className="h-3.5 w-3.5" /> :
                   res.type === 'poi' ? <Store className="h-3.5 w-3.5" /> :
                   <MapPin className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate group-hover:text-indigo-200">
                      {res.title}
                    </p>
                    {res.type === 'condo' && (
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                        Condomínio
                      </span>
                    )}
                    {res.type === 'poi' && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                        Local / Ponto
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {res.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MAPA INTERATIVO */}
      <div className="relative flex-1 min-h-[220px]">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 bg-slate-950" />

        {!activePos && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="p-4 bg-indigo-600/20 text-indigo-400 rounded-full animate-bounce">
              <CompassIcon className="h-10 w-10" />
            </div>
            <h3 className="text-base font-bold text-white">Localizando seu dispositivo...</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              No computador ou celular, confirme a permissão de localização.
            </p>
            <button
              onClick={() => gpsTracker.requestManualPermission()}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all"
            >
              <LocateFixed className="h-4 w-4" />
              <span>Detectar Posição Agora</span>
            </button>
          </div>
        )}

        {/* VELOCÍMETRO FLUTUANTE EM TEMPO REAL */}
        {activePos && (
          <div className="absolute bottom-4 left-3 z-20 bg-slate-900/90 border border-slate-700 p-2 rounded-xl shadow-xl backdrop-blur-md flex flex-col items-center justify-center min-w-[60px]">
            <span className={`text-xl font-black leading-none ${
              (activePos.speedKmh || 0) > 60 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activePos.speedKmh || 0}
            </span>
            <span className="text-[8px] font-extrabold uppercase text-slate-400 tracking-wider mt-0.5">km/h</span>
          </div>
        )}

        {/* CONTROLES DE ZOOM E RECENTRALIZAR CÂMERA */}
        <div className="absolute bottom-4 right-3 z-20 flex flex-col space-y-1.5">
          <button
            onClick={() => {
              if (mapRef.current) mapRef.current.zoomIn();
            }}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 transition-all flex items-center justify-center"
            title="Aumentar Zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => {
              if (mapRef.current) mapRef.current.zoomOut();
            }}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 transition-all flex items-center justify-center"
            title="Diminuir Zoom"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            onClick={handleRecenter}
            className={`p-2.5 rounded-xl shadow-xl border transition-all flex items-center justify-center gap-1 font-bold text-xs ${
              autoFollow 
                ? 'bg-indigo-600 text-white border-indigo-500' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
            }`}
            title="Recentralizar na minha localização exata"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {loadingRoute && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl flex items-center space-x-2 text-indigo-400 font-bold text-xs shadow-xl">
              <Navigation className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Calculando rota inicial...</span>
            </div>
          </div>
        )}
      </div>

      {/* RODAPÉ COMPACTO DO DESTINO E ATALHOS PARA WAZE E GOOGLE MAPS */}
      <div className="bg-slate-900 border-t border-slate-800 p-2.5 z-20 space-y-2 flex-shrink-0">
        {activeDestination && (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-1 bg-red-500/20 text-red-400 rounded">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{activeDestination.name}</p>
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
                className="text-[10px] text-slate-400 hover:text-red-400 font-bold px-2 py-0.5 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>

            {/* BOTÕES DE ATALHO DE 1 CLIQUE COM PERSISTÊNCIA DE GPS GARANTIDA */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={openInWaze}
                disabled={!destCoords}
                className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                title="Abrir no Waze mantendo o rastreamento ativo na loja"
              >
                <span>Abrir no Waze 🚗</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={openInGoogleMaps}
                disabled={!destCoords}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                title="Abrir no Google Maps mantendo o rastreamento ativo na loja"
              >
                <span>Google Maps 🗺️</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-lg">
            <p className="text-[9px] uppercase font-extrabold text-emerald-400">Tempo Est.</p>
            <p className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              <span>{routeInfo ? `${routeInfo.durationMin} min` : '--'}</span>
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-1.5 rounded-lg">
            <p className="text-[9px] uppercase font-extrabold text-blue-400">Distância</p>
            <p className="text-sm font-black text-blue-400 flex items-center justify-center gap-1 mt-0.5">
              <Route className="h-3 w-3" />
              <span>{routeInfo ? `${routeInfo.distanceKm} km` : '--'}</span>
            </p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-1.5 rounded-lg">
            <p className="text-[9px] uppercase font-extrabold text-purple-400">Precisão GPS</p>
            <p className="text-xs font-bold text-purple-300 mt-0.5 truncate">
              {activePos ? `±${activePos.accuracy}m` : 'Buscando...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}