"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, RiderLocation } from '../utils/db';
import { 
  Bike, 
  LogOut, 
  Plus, 
  DollarSign, 
  Users, 
  Map as MapIcon,
  X,
  Maximize2,
  Minimize2,
  Navigation,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle
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
             currentEstName.includes(destName) ||
             destName.replace(/\s+/g, '') === currentEstName.replace(/\s+/g, '');
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
             currentEstName.includes(destName) ||
             destName.replace(/\s+/g, '') === currentEstName.replace(/\s+/g, '');
    }
    
    return false;
  };

  const loadData = () => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    const freshUser = db.getUsers().find(u => u.email.toLowerCase() === currentUser.email.toLowerCase()) || currentUser;
    let estId = freshUser.establishmentId;

    const allEsts = db.getEstablishments();
    let currentEst = allEsts.find(e => e.id === estId);

    if (!currentEst) {
      currentEst = allEsts.find(e => e.email && e.email.toLowerCase() === freshUser.email.toLowerCase());
    }

    if (!currentEst) {
      const emailPrefix = freshUser.email.split('@')[0].toLowerCase();
      if (emailPrefix && emailPrefix !== 'gerente' && emailPrefix !== 'admin') {
        currentEst = allEsts.find(e => 
          e.name.toLowerCase().includes(emailPrefix) || 
          emailPrefix.includes(e.name.toLowerCase().replace(/\s+/g, ''))
        );
      }
    }

    if (!currentEst && freshUser.name) {
      const cleanName = freshUser.name.replace('Gerente ', '').toLowerCase().trim();
      if (cleanName && cleanName.length > 2) {
        currentEst = allEsts.find(e => 
          e.name.toLowerCase().trim() === cleanName || 
          e.name.toLowerCase().trim().includes(cleanName) ||
          cleanName.includes(e.name.toLowerCase().trim())
        );
      }
    }

    if (!currentEst) return;
    setEstablishment(currentEst);

    const currentEstName = currentEst.name.toLowerCase().trim();
    const matchingEstIds = allEsts
      .filter(e => {
        const name = e.name.toLowerCase().trim();
        return name === currentEstName || 
               name.includes(currentEstName) || 
               currentEstName.includes(name) ||
               name.replace(/\s+/g, '') === currentEstName.replace(/\s+/g, '');
      })
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
    }, 3000);

    const handleSyncComplete = () => {
      loadData();
    };
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
              const rider = db.resolveUser(d.riderId);
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Cliente';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(
                `Nova mensagem de ${sender}`,
                `Pedido #${d.orderNumber || d.id.slice(-4)} (${rider?.name || 'Entregador'}): "${messageText}"`
              );

              playNotificationSound();
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [todayDeliveries, user]);

  useEffect(() => {
    if (!establishment || !mapContainerRef.current) return;

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
        html: `<div style="background-color: #4f46e5; color: white; width: 36px; height: 36px; border-radius: 50%; border: 2px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
        className: 'custom-est-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      L.marker([lat, lng], { icon: estIcon })
        .addTo(mapInstance)
        .bindPopup(`<b>${establishment.name}</b><br/>Seu Estabelecimento`)
        .openPopup();

      setEstCoords({ lat, lng });
    };

    const geocodeEstablishment = async () => {
      if (mapRef.current) return;
      const addr = establishment.address;

      let finalLat: number | null = null;
      let finalLng: number | null = null;

      if (establishment.name.toLowerCase().includes('burgrill') && addr?.street === 'Rua Aprígio Veloso') {
        finalLat = -7.2150;
        finalLng = -35.9130;
      }

      if (!finalLat && addr && addr.street && addr.city) {
        try {
          const fullQuery = `${addr.street} ${addr.number || ''}, ${addr.neighborhood || ''}, ${addr.city} ${addr.state || ''}, Brasil`;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`);
          const data = await res.json();
          if (data && data.length > 0) {
            finalLat = parseFloat(data[0].lat);
            finalLng = parseFloat(data[0].lon);
          }
        } catch (err) {
          console.warn('Geocoding address error:', err);
        }
      }

      if (!finalLat && addr?.zipCode) {
        const cepClean = addr.zipCode.replace(/\D/g, '');
        if (KNOWN_CEPS[cepClean]) {
          finalLat = KNOWN_CEPS[cepClean].lat;
          finalLng = KNOWN_CEPS[cepClean].lng;
        } else if (cepClean.length === 8) {
          try {
            const vRes = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
            const vData = await vRes.json();
            if (vData && !vData.erro) {
              const cepQuery = `${vData.logradouro}, ${vData.bairro}, ${vData.localidade} - ${vData.uf}, Brasil`;
              const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cepQuery)}&limit=1`);
              const nData = await nRes.json();
              if (nData && nData.length > 0) {
                finalLat = parseFloat(nData[0].lat);
                finalLng = parseFloat(nData[0].lon);
              }
            }
          } catch (e) {}
        }
      }

      if (!finalLat || !finalLng) {
        finalLat = defaultLat;
        finalLng = defaultLng;
      }

      initMap(finalLat, finalLng);
    };

    geocodeEstablishment();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        hasSetInitialBoundsRef.current = false;
        hasCenteredEstRef.current = false;
      }
    };
  }, [establishment?.id]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const allUsers = db.getUsers();
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 60000;

    const activeRiderIdsOnMap = new Set<string>();

    riderLocations.forEach(loc => {
      const lastUpdateMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      const isOnline = (now - lastUpdateMs) < ONLINE_THRESHOLD_MS;

      if (!isOnline) {
        if (markersRef.current[loc.riderId]) {
          currentMap.removeLayer(markersRef.current[loc.riderId]);
          delete markersRef.current[loc.riderId];
        }
        return;
      }

      const isRiderInSchedule = scheduledRiders.some(r => {
        if (r.id === loc.riderId) return true;
        if (r.name.toLowerCase().trim() === loc.riderName.toLowerCase().trim()) return true;
        const locUser = allUsers.find(u => u.id === loc.riderId);
        return locUser && locUser.email.toLowerCase() === r.email.toLowerCase();
      });

      if (!isRiderInSchedule && scheduledRiders.length > 0) {
        if (markersRef.current[loc.riderId]) {
          currentMap.removeLayer(markersRef.current[loc.riderId]);
          delete markersRef.current[loc.riderId];
        }
        return;
      }

      activeRiderIdsOnMap.add(loc.riderId);

      const riderName = loc.riderName || 'Entregador';
      const existingMarker = markersRef.current[loc.riderId];

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
      } else {
        const riderIcon = L.divIcon({
          html: `<div style="background-color: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; border: 2px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M18 18v-3l-3-4H9l-3 4v3" /><rect x="8" y="6" width="5" height="5" rx="1" /><path d="M15 11l1.5-4.5H19" /></svg></div>`,
          className: 'custom-rider-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon })
          .addTo(currentMap)
          .bindPopup(`<b>${riderName}</b><br/>Entregador em Rota`);

        markersRef.current[loc.riderId] = marker;
      }
    });

    Object.keys(markersRef.current).forEach(rId => {
      if (!activeRiderIdsOnMap.has(rId)) {
        currentMap.removeLayer(markersRef.current[rId]);
        delete markersRef.current[rId];
      }
    });

    if (!hasSetInitialBoundsRef.current) {
      const points: L.LatLngExpression[] = [];
      if (estCoords) points.push([estCoords.lat, estCoords.lng]);
      
      riderLocations.forEach(loc => {
        const lastUpdateMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
        if ((now - lastUpdateMs) < ONLINE_THRESHOLD_MS) {
          points.push([loc.lat, loc.lng]);
        }
      });

      if (points.length >= 2) {
        const bounds = L.latLngBounds(points);
        currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        hasSetInitialBoundsRef.current = true;
      } else if (points.length === 1 && !hasCenteredEstRef.current) {
        currentMap.setView(points[0], 16);
        hasCenteredEstRef.current = true;
      }
    }
  }, [scheduledRiders, riderLocations, estCoords]);

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 60000;

    const points: L.LatLngExpression[] = [];
    if (estCoords) points.push([estCoords.lat, estCoords.lng]);
    riderLocations.forEach(loc => {
      const lastUpdateMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      if ((now - lastUpdateMs) < ONLINE_THRESHOLD_MS) {
        points.push([loc.lat, loc.lng]);
      }
    });

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      currentMap.setView(points[0], 16);
    }
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    const estId = establishment?.id || user?.establishmentId;
    if (!estId) return;

    const todayStr = db.getLocalDateString();
    const activeSchedule = todaySchedules.find(s => s.riderId === deliveryForm.riderId);
    const allDeliveries = db.getDeliveries();
    const nowStr = new Date().toISOString();

    if (editingDelivery) {
      const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        riderId: deliveryForm.riderId,
        value: val,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        scheduleId: activeSchedule?.id || d.scheduleId,
        updatedAt: nowStr
      } : d);
      db.setDeliveries(updated);
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: estId,
        date: todayStr,
        time: new Date().toTimeString().slice(0, 5),
        value: val,
        status: 'active',
        scheduleId: activeSchedule?.id,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        updatedAt: nowStr
      };
      db.setDeliveries([...allDeliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    setDeliveryForm({ riderId: '', value: '', orderNumber: '', notes: '' });
    loadData();
  };

  const handleSaveNotes = (deliveryId: string, updatedNotes: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === deliveryId ? {
      ...d,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    } : d);
    db.setDeliveries(updated);
    loadData();
  };

  const handleSaveScheduleChat = (scheduleId: string, updatedChat: string) => {
    const allSchedules = db.getSchedules();
    const updated = allSchedules.map(s => s.id === scheduleId ? {
      ...s,
      chat: updatedChat,
      updatedAt: new Date().toISOString()
    } : s);
    db.setSchedules(updated);
    loadData();
  };

  const totalEstEarningsToday = todayDeliveries
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = todaySchedules.find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{establishment?.name || 'Painel Estabelecimento'}</h1>
              <p className="text-xs text-slate-400">Gestão e Rastreamento em Tempo Real</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-1 text-sm text-red-400">
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Motoboys Escalados</p>
                <p className="text-2xl font-bold text-slate-800">{scheduledRiders.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Total Hoje</p>
                <p className="text-2xl font-bold text-slate-800">R$ {Number(totalEstEarningsToday || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Bike className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Corridas Hoje</p>
                <p className="text-2xl font-bold text-slate-800">
                  {todayDeliveries.filter(d => d.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <span>Motoboys Escalados Hoje</span>
              </h2>
              <button
                onClick={() => {
                  if (scheduledRiders.length === 0) {
                    alert('Não há motoboys escalados para hoje.');
                    return;
                  }
                  setEditingDelivery(null);
                  setDeliveryForm({ riderId: scheduledRiders[0].id, value: '', orderNumber: '', notes: '' });
                  setShowDeliveryModal(true);
                }}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Lançar Corrida</span>
              </button>
            </div>

            {scheduledRiders.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhum motoboy escalado para hoje. Fale com o administrador para criar escalas.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {scheduledRiders.map(rider => {
                  const riderDeliveries = todayDeliveries.filter(d => d.riderId === rider.id && d.status === 'active');
                  const total = riderDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
                  const isOnline = riderLocations.some(l => {
                    const isSameRider = l.riderId === rider.id || l.riderName.toLowerCase().trim() === rider.name.toLowerCase().trim();
                    const isRecent = Date.now() - new Date(l.updatedAt).getTime() < 60000;
                    return isSameRider && isRecent;
                  });
                  const riderSchedule = todaySchedules.find(s => s.riderId === rider.id);

                  return (
                    <div key={rider.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                            {rider.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{rider.name}</p>
                            <p className="text-xs text-slate-500">{rider.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {riderSchedule && (
                            <button
                              onClick={() => setActiveScheduleChatId(riderSchedule.id)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative"
                              title="Chat de Turno"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}
                          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-xs text-slate-400">Corridas</p>
                          <p className="text-sm font-bold text-slate-700">{riderDeliveries.length}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-xs text-slate-400">Total</p>
                          <p className="text-sm font-bold text-emerald-600">R$ {Number(total || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico de Corridas de Hoje */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
                <span>Corridas Lançadas Hoje</span>
              </span>
              <span className="text-xs text-slate-400 font-normal">{todayDeliveries.length} lançamento(s)</span>
            </h3>

            {todayDeliveries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhuma corrida lançada hoje.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayDeliveries.map(del => {
                  const rider = scheduledRiders.find(r => r.id === del.riderId) || db.resolveUser(del.riderId);
                  return (
                    <div key={del.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-bold text-slate-800 text-sm">{rider?.name || 'Motoboy'}</p>
                          {del.orderNumber && (
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              #{del.orderNumber}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            del.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            del.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Cancelada'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{del.time}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setNotesDeliveryId(del.id)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                          title="Observações da Corrida"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="hidden sm:inline">Observações</span>
                        </button>
                        <span className="font-bold text-emerald-600 text-sm">
                          R$ {Number(del.value || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col transition-all duration-300 ${
            isMapExpanded 
              ? 'fixed inset-4 z-50 h-[calc(100vh-32px)]' 
              : 'h-[500px]'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                <MapIcon className="h-5 w-5 text-indigo-600" />
                <span>Rastreamento em Tempo Real</span>
              </h2>
              <div className="flex items-center space-x-2">
                <button onClick={handleRecenterMap} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                  <Navigation className="h-4 w-4 text-indigo-600" />
                </button>
                <button onClick={() => setIsMapExpanded(!isMapExpanded)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                  {isMapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div ref={mapContainerRef} className="flex-1 rounded-xl border border-slate-200 overflow-hidden z-10" style={{ minHeight: '300px' }} />
          </div>
        </div>
      </main>

      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}
              </h3>
              <button onClick={() => { setShowDeliveryModal(false); setEditingDelivery(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDelivery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
                <select
                  required
                  value={deliveryForm.riderId}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                >
                  {scheduledRiders.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº do Pedido (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 1042"
                  value={deliveryForm.orderNumber}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Corrida (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={deliveryForm.value}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações / Instruções (Opcional)</label>
                <textarea
                  placeholder="Ex: Troco para R$ 50,00, condomínio bloco B..."
                  value={deliveryForm.notes}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowDeliveryModal(false); setEditingDelivery(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                  {editingDelivery ? 'Salvar Alterações' : 'Lançar Corrida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="establishment"
        userName={user?.name || 'Gerente'}
        onSaveNotes={handleSaveNotes}
      />

      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="establishment"
        userName={user?.name || 'Gerente'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}