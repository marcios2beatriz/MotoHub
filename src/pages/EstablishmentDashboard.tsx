"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, RiderLocation } from '../utils/db';
import { 
  Bike, 
  LogOut, 
  Plus, 
  Trash2, 
  Clock, 
  DollarSign, 
  MapPin, 
  Users, 
  TrendingUp, 
  Map as MapIcon,
  RefreshCw,
  Hash,
  Check,
  X,
  Edit2,
  Maximize2,
  Minimize2,
  Share2,
  Navigation,
  MessageSquare
} from 'lucide-react';

import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

const KNOWN_CEPS: { [key: string]: { lat: number; lng: number } } = {
  '58433488': { lat: -7.2311, lng: -35.9245 },
  '58429900': { lat: -7.2150, lng: -35.9130 },
};

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const cur = db.getCurrentUser();
    if (cur) {
      const full = db.getUsers().find(u => u.email.toLowerCase() === cur.email.toLowerCase());
      if (full) {
        db.setCurrentUser(full);
        return full;
      }
    }
    return cur;
  });
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  
  const [scheduledRiders, setScheduledRiders] = useState<User[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [estCoords, setEstCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const prevNotesRef = useRef<Record<string, string>>({});

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  
  const hasSetInitialBoundsRef = useRef(false);
  const hasCenteredEstRef = useRef(false);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const isScheduleForCurrentEst = (s: Schedule, currentEstName: string, matchingEstIds: string[]) => {
    if (!currentEstName) return false;
    if (matchingEstIds.includes(s.establishmentId)) return true;
    const destEst = db.resolveEstablishment(s.establishmentId);
    if (destEst) {
      const destName = destEst.name.toLowerCase().trim();
      return destName === currentEstName || 
             destName.includes(currentEstName) || 
             currentEstName.includes(destName);
    }
    return false;
  };

  const isDeliveryForCurrentEst = (d: Delivery, currentEstName: string, matchingEstIds: string[]) => {
    if (!currentEstName) return false;
    if (matchingEstIds.includes(d.establishmentId)) return true;
    
    let destEst = db.resolveEstablishment(d.establishmentId);
    if (!destEst && d.scheduleId) {
      const sch = db.getSchedules().find(s => s.id === d.scheduleId);
      if (sch) {
        destEst = db.resolveEstablishment(sch.establishmentId);
      }
    }
    
    if (destEst) {
      const destName = destEst.name.toLowerCase().trim();
      return destName === currentEstName || 
             destName.includes(currentEstName) || 
             currentEstName.includes(destName);
    }
    return false;
  };

  const loadData = () => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    const freshUser = db.getUsers().find(u => u.id === currentUser.id) || currentUser;
    let estId = freshUser.establishmentId;

    const allEsts = db.getEstablishments();
    let currentEst = allEsts.find(e => e.id === estId);

    if (!currentEst) {
      currentEst = allEsts.find(e => e.email && e.email.toLowerCase() === freshUser.email.toLowerCase());
    }

    if (!currentEst && freshUser.name) {
      const cleanName = freshUser.name.replace('Gerente ', '').toLowerCase().trim();
      if (cleanName && cleanName.length > 2) {
        currentEst = allEsts.find(e => e.name.toLowerCase().trim().includes(cleanName));
      }
    }

    if (!currentEst) return;
    setEstablishment(currentEst);

    const currentEstName = currentEst.name.toLowerCase().trim();
    const matchingEstIds = allEsts
      .filter(e => e.name.toLowerCase().trim().includes(currentEstName) || currentEstName.includes(e.name.toLowerCase().trim()))
      .map(e => e.id);

    const todayStr = db.getLocalDateString();
    const allSchedules = db.getSchedules();
    
    const estSchedules = allSchedules.filter(s => isScheduleForCurrentEst(s, currentEstName, matchingEstIds) && s.date === todayStr);
    setTodaySchedules(estSchedules);

    const allUsers = db.getUsers();
    const riders = allUsers.filter(u => 
      estSchedules.some(s => {
        if (s.riderId === u.id) return true;
        const riderOfSch = db.resolveUser(s.riderId);
        return riderOfSch && riderOfSch.email.toLowerCase() === u.email.toLowerCase();
      })
    );
    setScheduledRiders(riders);

    const allDeliveries = db.getDeliveries();
    const estDeliveriesToday = allDeliveries.filter(d => isDeliveryForCurrentEst(d, currentEstName, matchingEstIds) && d.date === todayStr);
    setTodayDeliveries(estDeliveriesToday);

    const locations = db.getRiderLocations();
    setRiderLocations(locations);
  };

  useEffect(() => {
    if (!user || user.role !== 'establishment') {
      navigate('/login');
      return;
    }

    db.pullFromSupabase().then(() => loadData());

    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 5000);

    const handleSyncComplete = () => loadData();
    window.addEventListener('db-sync-complete', handleSyncComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, [user, navigate]);

  useEffect(() => {
    todayDeliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Estabelecimento') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Cliente';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(`Nova mensagem de ${sender}`, `Pedido #${d.orderNumber || d.id.slice(-4)}: "${messageText}"`);
              playNotificationSound();
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [todayDeliveries, user]);

  // Geocodificação do Estabelecimento
  useEffect(() => {
    if (!establishment) return;
    
    const cepClean = establishment.address?.zipCode ? establishment.address.zipCode.replace(/\D/g, '') : '';
    if (cepClean && KNOWN_CEPS[cepClean]) {
      setEstCoords(KNOWN_CEPS[cepClean]);
      return;
    }

    const addressQuery = `${establishment.address?.street || ''}, ${establishment.address?.neighborhood || ''}, Campina Grande, PB, Brazil`;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data[0]) {
          setEstCoords({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          });
        } else {
          setEstCoords({ lat: -7.2245, lng: -35.8890 });
        }
      })
      .catch(() => {
        setEstCoords({ lat: -7.2245, lng: -35.8890 });
      });
  }, [establishment]);

  // Inicialização e Atualização do Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([-7.2245, -35.8890], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Ícone do Estabelecimento
    const estIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-indigo-500/30 rounded-full animate-ping"></div>
          <div class="relative bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg border-2 border-white flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (estCoords) {
      if (markersRef.current['establishment']) {
        markersRef.current['establishment'].setLatLng([estCoords.lat, estCoords.lng]);
      } else {
        markersRef.current['establishment'] = L.marker([estCoords.lat, estCoords.lng], { icon: estIcon })
          .addTo(map)
          .bindPopup(`<div class="font-sans font-semibold text-gray-800">${establishment?.name || 'Seu Estabelecimento'}</div>`);
      }

      if (!hasCenteredEstRef.current) {
        map.setView([estCoords.lat, estCoords.lng], 14);
        hasCenteredEstRef.current = true;
      }
    }

    const scheduledRiderIds = scheduledRiders.map(r => r.id);
    const scheduledRiderEmails = scheduledRiders.map(r => r.email.toLowerCase());

    const activeLocations = riderLocations.filter(loc => {
      const resolvedRider = db.resolveUser(loc.riderId);
      if (!resolvedRider) return false;
      return scheduledRiderIds.includes(resolvedRider.id) || 
             scheduledRiderEmails.includes(resolvedRider.email.toLowerCase());
    });

    const currentMarkerKeys = new Set<string>(['establishment']);

    activeLocations.forEach(loc => {
      const resolvedRider = db.resolveUser(loc.riderId);
      if (!resolvedRider) return;

      const markerKey = `rider-${resolvedRider.id}`;
      currentMarkerKeys.add(markerKey);

      const riderIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 bg-emerald-500/20 rounded-full animate-pulse"></div>
            <div class="relative bg-emerald-500 text-white p-2 rounded-full shadow-md border-2 border-white flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M15 6h1a2 2 0 0 1 2 2v2"/><path d="M12 15.2V8a2 2 0 0 0-2-2H4"/><path d="M12 12H9"/></svg>
            </div>
          </div>
        `,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const lastUpdate = new Date(loc.updatedAt);
      const timeStr = lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const popupContent = `
        <div class="font-sans p-1">
          <div class="font-bold text-gray-900 text-sm flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            ${resolvedRider.name}
          </div>
          <div class="text-xs text-gray-500 mt-1">Último sinal: ${timeStr}</div>
          <div class="text-xs text-indigo-600 font-medium mt-0.5">${resolvedRider.phone || 'Sem telefone'}</div>
        </div>
      `;

      if (markersRef.current[markerKey]) {
        markersRef.current[markerKey].setLatLng([loc.lat, loc.lng]);
        markersRef.current[markerKey].getPopup()?.setContent(popupContent);
      } else {
        markersRef.current[markerKey] = L.marker([loc.lat, loc.lng], { icon: riderIcon })
          .addTo(map)
          .bindPopup(popupContent);
      }
    });

    Object.keys(markersRef.current).forEach(key => {
      if (!currentMarkerKeys.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    if (activeLocations.length > 0 && estCoords && !hasSetInitialBoundsRef.current) {
      const points: L.LatLngExpression[] = [[estCoords.lat, estCoords.lng]];
      activeLocations.forEach(loc => points.push([loc.lat, loc.lng]));
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
      hasSetInitialBoundsRef.current = true;
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, [riderLocations, scheduledRiders, estCoords, isMapExpanded, establishment]);

  const handleRecenterMap = () => {
    if (!mapRef.current || !estCoords) return;
    
    const points: L.LatLngExpression[] = [[estCoords.lat, estCoords.lng]];
    
    const scheduledRiderIds = scheduledRiders.map(r => r.id);
    const scheduledRiderEmails = scheduledRiders.map(r => r.email.toLowerCase());

    const activeLocations = riderLocations.filter(loc => {
      const resolvedRider = db.resolveUser(loc.riderId);
      if (!resolvedRider) return false;
      return scheduledRiderIds.includes(resolvedRider.id) || 
             scheduledRiderEmails.includes(resolvedRider.email.toLowerCase());
    });

    activeLocations.forEach(loc => points.push([loc.lat, loc.lng]));
    
    if (points.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else {
      mapRef.current.setView([estCoords.lat, estCoords.lng], 15);
    }
  };

  const handleCreateOrUpdateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishment) return;

    const val = parseFloat(deliveryForm.value.replace(',', '.'));
    if (isNaN(val)) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    const activeSchedule = todaySchedules.find(s => {
      if (s.riderId === deliveryForm.riderId) return true;
      const riderOfSch = db.resolveUser(s.riderId);
      const selectedRider = db.resolveUser(deliveryForm.riderId);
      return riderOfSch && selectedRider && riderOfSch.email.toLowerCase() === selectedRider.email.toLowerCase();
    });

    if (editingDelivery) {
      const updated = db.getDeliveries().map(d => {
        if (d.id === editingDelivery.id) {
          return {
            ...d,
            riderId: deliveryForm.riderId,
            scheduleId: activeSchedule?.id || d.scheduleId,
            value: val,
            orderNumber: deliveryForm.orderNumber,
            notes: deliveryForm.notes,
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });
      db.setDeliveries(updated);
    } else {
      const newDelivery: Delivery = {
        id: 'del_' + Math.random().toString(36).substr(2, 9),
        establishmentId: establishment.id,
        riderId: deliveryForm.riderId,
        scheduleId: activeSchedule?.id || '',
        value: val,
        status: 'pending',
        date: db.getLocalDateString(),
        time: new Date().toTimeString().slice(0, 5),
        orderNumber: deliveryForm.orderNumber,
        notes: deliveryForm.notes || '',
        updatedAt: new Date().toISOString()
      };
      db.setDeliveries([...db.getDeliveries(), newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    setDeliveryForm({ riderId: '', value: '', orderNumber: '', notes: '' });
    loadData();
  };

  const handleDeleteDelivery = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta corrida?')) {
      const updated = db.getDeliveries().filter(d => d.id !== id);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleEditDelivery = (d: Delivery) => {
    setEditingDelivery(d);
    setDeliveryForm({
      riderId: d.riderId,
      value: d.value.toString(),
      orderNumber: d.orderNumber || '',
      notes: d.notes || ''
    });
    setShowDeliveryModal(true);
  };

  const totalValue = todayDeliveries.reduce((acc, d) => acc + d.value, 0);
  const completedDeliveries = todayDeliveries.filter(d => d.status === 'completed');
  const completedValue = completedDeliveries.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">
                {establishment?.name || 'Carregando...'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Painel do Estabelecimento</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Corridas</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Hash className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{todayDeliveries.length}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concluídas</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Check className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{completedDeliveries.length}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Total</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><DollarSign className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">R$ {totalValue.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Concluído</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">R$ {completedValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Mapa de Rastreamento */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ${isMapExpanded ? 'fixed inset-0 z-50 m-0 rounded-none' : 'relative h-[400px]'}`}>
          <div className="absolute top-3 right-3 z-[1000] flex gap-2">
            <button 
              onClick={handleRecenterMap}
              className="bg-white text-slate-700 hover:bg-slate-50 p-2.5 rounded-xl shadow-lg border border-slate-100 transition-all flex items-center justify-center"
              title="Centralizar Mapa"
            >
              <Navigation className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="bg-white text-slate-700 hover:bg-slate-50 p-2.5 rounded-xl shadow-lg border border-slate-100 transition-all flex items-center justify-center"
            >
              {isMapExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Seção de Escalas e Corridas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Escalas do Dia */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Motoboys Escalados
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {scheduledRiders.length} hoje
              </span>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {scheduledRiders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Nenhum motoboy escalado para hoje.
                </div>
              ) : (
                scheduledRiders.map(rider => {
                  const schedule = todaySchedules.find(s => {
                    if (s.riderId === rider.id) return true;
                    const riderOfSch = db.resolveUser(s.riderId);
                    return riderOfSch && riderOfSch.email.toLowerCase() === rider.email.toLowerCase();
                  });
                  
                  return (
                    <div key={rider.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{rider.name}</p>
                        <p className="text-xs text-slate-500 truncate">{rider.phone || 'Sem telefone'}</p>
                        {schedule && (
                          <span className="inline-block mt-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                            {schedule.shift}
                          </span>
                        )}
                      </div>
                      {schedule && (
                        <button
                          onClick={() => setActiveScheduleChatId(schedule.id)}
                          className="p-2 bg-white hover:bg-indigo-50 text-indigo-600 rounded-xl border border-slate-100 transition-all relative"
                          title="Chat do Turno"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {schedule.chat && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white"></span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Corridas do Dia */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Bike className="w-5 h-5 text-indigo-600" />
                Corridas de Hoje
              </h2>
              <button
                onClick={() => {
                  setEditingDelivery(null);
                  setDeliveryForm({ riderId: '', value: '', orderNumber: '', notes: '' });
                  setShowDeliveryModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Nova Corrida
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Pedido</th>
                    <th className="pb-3">Motoboy</th>
                    <th className="pb-3">Valor</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {todayDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Nenhuma corrida lançada hoje.
                      </td>
                    </tr>
                  ) : (
                    todayDeliveries.map(d => {
                      const rider = db.resolveUser(d.riderId);
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 font-semibold text-slate-700">
                            #{d.orderNumber || d.id.slice(-4)}
                          </td>
                          <td className="py-3 text-slate-600 font-medium">
                            {rider?.name || 'Não atribuído'}
                          </td>
                          <td className="py-3 font-bold text-slate-900">
                            R$ {d.value.toFixed(2)}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              d.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                              d.status === 'accepted' ? 'bg-blue-50 text-blue-700' :
                              d.status === 'active' ? 'bg-indigo-50 text-indigo-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {d.status === 'completed' ? 'Concluída' :
                               d.status === 'accepted' ? 'Em trânsito' : 
                               d.status === 'active' ? 'Ativa' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1">
                            <button
                              onClick={() => setNotesDeliveryId(d.id)}
                              className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-lg border border-slate-100 transition-all inline-flex items-center justify-center relative"
                              title="Notas e Chat"
                            >
                              <MessageSquare className="w-4 h-4" />
                              {d.notes && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full"></span>
                              )}
                            </button>
                            <button
                              onClick={() => handleEditDelivery(d)}
                              className="p-1.5 bg-slate-50 hover:bg-amber-50 text-amber-600 rounded-lg border border-slate-100 transition-all inline-flex items-center justify-center"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDelivery(d.id)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-rose-600 rounded-lg border border-slate-100 transition-all inline-flex items-center justify-center"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Lançamento/Edição de Corrida */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}
              </h3>
              <button 
                onClick={() => {
                  setShowDeliveryModal(false);
                  setEditingDelivery(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateDelivery} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Número do Pedido (Opcional)</label>
                <input
                  type="text"
                  value={deliveryForm.orderNumber}
                  onChange={e => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
                  placeholder="Ex: 1234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Motoboy Escalado</label>
                <select
                  required
                  value={deliveryForm.riderId}
                  onChange={e => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="">Selecione um motoboy</option>
                  {scheduledRiders.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Valor da Corrida (R$)</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.value}
                  onChange={e => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                  placeholder="Ex: 7,50"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas / Endereço de Entrega</label>
                <textarea
                  value={deliveryForm.notes}
                  onChange={e => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  placeholder="Insira o endereço ou observações da entrega..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeliveryModal(false);
                    setEditingDelivery(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/10"
                >
                  {editingDelivery ? 'Salvar Alterações' : 'Lançar Corrida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modais de Notas e Chat */}
      {notesDeliveryId && (
        <DeliveryNotesModal 
          isOpen={notesDeliveryId !== null}
          onClose={() => setNotesDeliveryId(null)}
          delivery={todayDeliveries.find(d => d.id === notesDeliveryId) || null}
          userRole="establishment"
          userName={user?.name || 'Gerente'}
          onSaveNotes={(deliveryId, updatedNotes) => {
            const updatedDeliveries = db.getDeliveries().map(d => 
              d.id === deliveryId ? { ...d, notes: updatedNotes, updatedAt: new Date().toISOString() } : d
            );
            db.setDeliveries(updatedDeliveries);
            loadData();
          }}
        />
      )}

      {activeScheduleChatId && (
        <ScheduleChatModal 
          isOpen={activeScheduleChatId !== null}
          onClose={() => setActiveScheduleChatId(null)}
          schedule={todaySchedules.find(s => s.id === activeScheduleChatId) || null}
          userRole="establishment"
          userName={user?.name || 'Gerente'}
          onSaveChat={(scheduleId, updatedChat) => {
            const updatedSchedules = db.getSchedules().map(s => 
              s.id === scheduleId ? { ...s, chat: updatedChat, updatedAt: new Date().toISOString() } : s
            );
            db.setSchedules(updatedSchedules);
            loadData();
          }}
        />
      )}
    </div>
  );
}