"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, Delivery, User, Establishment, RiderLocation } from '../utils/db';
import { Bike, MapPin, Clock, ShieldCheck, RefreshCw, MessageSquare, Navigation } from 'lucide-react';
import L from 'leaflet';
import CustomerChatModal from '../components/CustomerChatModal';
import { sendDeviceNotification } from '../utils/notifications';

const KNOWN_CEPS: Record<string, { lat: number; lng: number }> = {
  '58433488': { lat: -7.2311, lng: -35.9245 },
  '58429900': { lat: -7.2150, lng: -35.9130 },
};

export default function CustomerTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [rider, setRider] = useState<User | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [estCoords, setEstCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const estMarkerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  
  const hasSetInitialBoundsRef = useRef(false);
  const hasCenteredEstRef = useRef(false);
  const prevChatRef = useRef<string>('');

  const loadTrackingData = () => {
    if (!deliveryId) return;
    
    const allDeliveries = db.getDeliveries();
    const currentDelivery = allDeliveries.find(d => d.id === deliveryId);
    
    if (currentDelivery) {
      const deliveryDateTime = new Date(`${currentDelivery.date}T${currentDelivery.time}:00`);
      const timeDifferenceMs = Date.now() - deliveryDateTime.getTime();
      const twoHoursInMs = 120 * 60 * 1000;
      
      if (timeDifferenceMs > twoHoursInMs) {
        setIsExpired(true);
        setLoading(false);
        return;
      }

      setDelivery(currentDelivery);
      
      const allUsers = db.getUsers();
      const currentRider = allUsers.find(u => u.id === currentDelivery.riderId);
      if (currentRider) setRider(currentRider);

      const allEsts = db.getEstablishments();
      const currentEst = allEsts.find(e => e.id === currentDelivery.establishmentId);
      if (currentEst) setEstablishment(currentEst);

      const locations = db.getRiderLocations();
      const currentLoc = locations.find(l => l.riderId === currentDelivery.riderId);
      if (currentLoc) setRiderLocation(currentLoc);
    }
    setLoading(false);
  };

  useEffect(() => {
    db.pullFromSupabase().then(() => loadTrackingData());

    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadTrackingData());
    }, 3000);

    return () => clearInterval(interval);
  }, [deliveryId]);

  useEffect(() => {
    if (delivery && prevChatRef.current !== undefined && delivery.customerChat && delivery.customerChat !== prevChatRef.current) {
      const prevLines = prevChatRef.current ? prevChatRef.current.split('\n') : [];
      const currentLines = delivery.customerChat.split('\n');

      if (currentLines.length > prevLines.length) {
        const newLines = currentLines.slice(prevLines.length);
        newLines.forEach(line => {
          const isMe = line.includes('- Cliente');
          if (!isMe) {
            const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Estabelecimento';
            const messageText = line.substring(line.indexOf(']: ') + 3);
            
            sendDeviceNotification(
              `Nova mensagem de ${sender}`,
              `Pedido #${delivery.orderNumber || delivery.id.slice(-4)}: "${messageText}"`
            );
          }
        });
      }
    }
    if (delivery) {
      prevChatRef.current = delivery.customerChat || '';
    }
  }, [delivery]);

  useEffect(() => {
    if (!establishment || !mapContainerRef.current || mapRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const defaultLat = -7.2247;
    const defaultLng = -35.8878;

    const initMap = (lat: number, lng: number) => {
      if (mapRef.current) return;
      const mapInstance = L.map(mapContainerRef.current!).setView([lat, lng], 16);
      mapRef.current = mapInstance;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance);

      const estIcon = L.divIcon({
        html: `<div style="background-color: #4f46e5; color: white; width: 36px; height: 36px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
        className: 'custom-est-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: estIcon })
        .addTo(mapInstance)
        .bindPopup(`<b>${establishment.name}</b><br/>Ponto de Partida`);
      
      estMarkerRef.current = marker;
      setEstCoords({ lat, lng });
    };

    const geocode = async () => {
      const addr = establishment.address;
      let finalLat = defaultLat;
      let finalLng = defaultLng;
      let geocoded = false;

      if (establishment.name.toLowerCase().includes('burgrill') && establishment.address.street === 'Rua Aprígio Veloso') {
        finalLat = -7.2150;
        finalLng = -35.9130;
        geocoded = true;
      }

      if (!geocoded && addr) {
        const cepClean = addr.zipCode ? addr.zipCode.replace(/\D/g, '') : '';
        if (cepClean && KNOWN_CEPS[cepClean]) {
          finalLat = KNOWN_CEPS[cepClean].lat;
          finalLng = KNOWN_CEPS[cepClean].lng;
          geocoded = true;
        }
      }

      initMap(finalLat, finalLng);
    };

    geocode();
  }, [establishment?.id]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    if (riderLocation) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderLocation.lat, riderLocation.lng]);
      } else {
        const riderIcon = L.divIcon({
          html: `<div style="background-color: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M18 18v-3l-3-4H9l-3 4v3" /><rect x="8" y="6" width="5" height="5" rx="1" /><path d="M15 11l1.5-4.5H19" /></svg></div>`,
          className: 'custom-rider-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([riderLocation.lat, riderLocation.lng], { icon: riderIcon })
          .addTo(currentMap)
          .bindPopup(`<b>${rider?.name || 'Entregador'}</b><br/>A caminho do seu endereço!`);

        riderMarkerRef.current = marker;
      }
    }

    if (!hasSetInitialBoundsRef.current) {
      const points: L.LatLngExpression[] = [];
      if (estCoords) points.push([estCoords.lat, estCoords.lng]);
      if (riderLocation) points.push([riderLocation.lat, riderLocation.lng]);

      if (points.length === 2) {
        const bounds = L.latLngBounds(points);
        currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        hasSetInitialBoundsRef.current = true;
      } else if (points.length === 1 && !hasCenteredEstRef.current) {
        currentMap.setView(points[0], 16);
        hasCenteredEstRef.current = true;
      }
    }
  }, [riderLocation, rider, estCoords]);

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const points: L.LatLngExpression[] = [];
    if (estCoords) points.push([estCoords.lat, estCoords.lng]);
    if (riderLocation) points.push([riderLocation.lat, riderLocation.lng]);

    if (points.length === 2) {
      const bounds = L.latLngBounds(points);
      currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      currentMap.setView(points[0], 16);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!delivery) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const formattedMessage = `[${dateStr} ${timeStr} - Cliente]: ${text}`;
    const updatedChat = delivery.customerChat ? `${delivery.customerChat}\n${formattedMessage}` : formattedMessage;

    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === delivery.id ? {
      ...d,
      customerChat: updatedChat,
      updatedAt: new Date().toISOString()
    } : d);

    db.setDeliveries(updated);
    setDelivery({ ...delivery, customerChat: updatedChat });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-2" />
        <p className="text-sm text-slate-600 font-medium">Carregando mapa de rastreamento...</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <Clock className="h-12 w-12 text-red-500 mb-3 animate-pulse" />
        <h2 className="text-lg font-bold text-slate-800">Link de Acompanhamento Expirado</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Este link de rastreamento expirou por limite de tempo (limite de 2 horas desde o início da entrega).
        </p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
          Voltar ao Início
        </button>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <MapPin className="h-12 w-12 text-slate-300 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Rastreamento não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">Este link de entrega pode ter expirado ou não existe no sistema.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
          Voltar ao Início
        </button>
      </div>
    );
  }

  const isOnline = riderLocation && (Date.now() - new Date(riderLocation.updatedAt).getTime() < 60000);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Acompanhe sua Entrega</h1>
              <p className="text-[10px] text-slate-500">Pedido #{delivery.orderNumber || delivery.id.slice(-4)}</p>
            </div>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Rastreamento Seguro
          </span>
        </div>
      </header>

      <div className="flex-1 relative min-h-[350px]">
        <div ref={mapContainerRef} className="absolute inset-0 z-10" />
        
        <button
          onClick={handleRecenterMap}
          className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-50 text-slate-700 p-2.5 rounded-full shadow-lg border border-slate-200 transition-all flex items-center justify-center"
          title="Centralizar no mapa"
        >
          <Navigation className="h-5 w-5 text-indigo-600" />
        </button>
        
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status do Pedido</span>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                {delivery.status === 'rejected' ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-red-600">Corrida Rejeitada</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span>{delivery.status === 'active' ? 'Saiu para Entrega' : 'Aguardando Envio'}</span>
                  </>
                )}
              </h3>
            </div>
          </div>

          {rider && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {rider.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Seu Entregador</p>
                  <p className="text-sm font-bold text-slate-800">{rider.name}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {isOnline ? 'Localização em tempo real' : 'Última localização vista'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </button>
            </div>
          )}

          {establishment && (
            <div className="space-y-1 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Origem: {establishment.name}</p>
              <p className="text-slate-500">{establishment.address.street}, {establishment.address.number} - {establishment.address.neighborhood}</p>
            </div>
          )}
        </div>
      </div>

      <CustomerChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        delivery={delivery}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}