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
  Hash
} from 'lucide-react';

// Leaflet imports
import L from 'leaflet';

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(db.getCurrentUser());
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  
  // Data states
  const [scheduledRiders, setScheduledRiders] = useState<User[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);

  // Form state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    value: '',
    orderNumber: ''
  });

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const loadData = () => {
    if (!user || !user.establishmentId) return;

    const allEsts = db.getEstablishments();
    const currentEst = allEsts.find(e => e.id === user.establishmentId);
    if (currentEst) {
      setEstablishment(currentEst);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const allSchedules = db.getSchedules();
    const estSchedulesToday = allSchedules.filter(s => s.establishmentId === user.establishmentId && s.date === todayStr);
    setTodaySchedules(estSchedulesToday);

    const allUsers = db.getUsers();
    const scheduledRiderIds = estSchedulesToday.map(s => s.riderId);
    const riders = allUsers.filter(u => scheduledRiderIds.includes(u.id));
    setScheduledRiders(riders);

    const allDeliveries = db.getDeliveries();
    const estDeliveriesToday = allDeliveries.filter(d => d.establishmentId === user.establishmentId && d.date === todayStr);
    setTodayDeliveries(estDeliveriesToday);

    const locations = db.getRiderLocations();
    setRiderLocations(locations);
  };

  useEffect(() => {
    if (!user || user.role !== 'establishment') {
      navigate('/login');
      return;
    }
    loadData();

    // Poll for rider locations every 5 seconds
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  // Initialize Map and Handle Markers in a single robust effect
  useEffect(() => {
    if (!establishment || !mapContainerRef.current) return;

    // Dynamically load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Default coordinates (São Paulo center if no specific coordinates)
    const defaultLat = -23.55052;
    const defaultLng = -46.633308;

    // Create map if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      // Add establishment marker
      const estIcon = L.divIcon({
        html: `<div class="bg-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      L.marker([defaultLat, defaultLng], { icon: estIcon })
        .addTo(mapRef.current)
        .bindPopup(`<b>${establishment.name}</b><br/>Seu Estabelecimento`)
        .openPopup();
    }

    // Update Rider Markers safely
    const currentMap = mapRef.current;
    const scheduledRiderIds = scheduledRiders.map(r => r.id);

    // 1. Remove markers for riders that are no longer scheduled or active
    Object.keys(markersRef.current).forEach(riderId => {
      if (!scheduledRiderIds.includes(riderId)) {
        markersRef.current[riderId].remove();
        delete markersRef.current[riderId];
      }
    });

    // 2. Add or update active rider markers
    riderLocations.forEach(loc => {
      if (!scheduledRiderIds.includes(loc.riderId)) return;

      const riderName = loc.riderName;
      const existingMarker = markersRef.current[loc.riderId];

      if (existingMarker && currentMap.hasLayer(existingMarker)) {
        // Update position safely
        existingMarker.setLatLng([loc.lat, loc.lng]);
      } else {
        // Create new marker
        const riderIcon = L.divIcon({
          html: `<div class="bg-emerald-500 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="15" width="14" height="4" rx="1"/><path d="M12 15V5a2 2 0 0 0-2-2H4"/><path d="M12 5h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-7"/></svg></div>`,
          className: 'custom-div-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon })
          .addTo(currentMap)
          .bindPopup(`<b>${riderName}</b><br/>Entregador em Rota`);

        markersRef.current[loc.riderId] = marker;
      }
    });

    return () => {
      // Cleanup map on unmount
      if (mapRef.current) {
        // Remove all markers
        Object.keys(markersRef.current).forEach(riderId => {
          markersRef.current[riderId].remove();
        });
        markersRef.current = {};
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [establishment, scheduledRiders, riderLocations]);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    if (!user?.establishmentId) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const activeSchedule = todaySchedules.find(s => s.riderId === deliveryForm.riderId);

    const newDelivery: Delivery = {
      id: 'd_' + Date.now(),
      riderId: deliveryForm.riderId,
      establishmentId: user.establishmentId,
      date: todayStr,
      time: new Date().toTimeString().slice(0, 5),
      value: val,
      status: 'active',
      scheduleId: activeSchedule?.id,
      orderNumber: deliveryForm.orderNumber.trim() || undefined
    };

    const allDeliveries = db.getDeliveries();
    db.setDeliveries([...allDeliveries, newDelivery]);

    setShowDeliveryModal(false);
    setDeliveryForm({ riderId: '', value: '', orderNumber: '' });
    loadData();
  };

  const handleCancelDelivery = (id: string) => {
    if (confirm('Deseja realmente cancelar esta corrida?')) {
      const allDeliveries = db.getDeliveries();
      const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  // Calculations
  const getRiderTotalEarnings = (riderId: string) => {
    return todayDeliveries
      .filter(d => d.riderId === riderId && d.status === 'active')
      .reduce((sum, d) => sum + d.value, 0);
  };

  const getRiderDeliveryCount = (riderId: string) => {
    return todayDeliveries.filter(d => d.riderId === riderId && d.status === 'active').length;
  };

  const totalEstEarningsToday = todayDeliveries
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{establishment?.name || 'Painel Estabelecimento'}</h1>
              <p className="text-xs text-slate-400">Lançamento de Corridas e Rastreamento</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-1 text-sm text-red-400"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scheduled Riders & Delivery Launching */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Cards */}
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
                <p className="text-2xl font-bold text-slate-800">R$ {totalEstEarningsToday.toFixed(2)}</p>
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

          {/* Scheduled Riders List */}
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
                  setDeliveryForm({ riderId: scheduledRiders[0].id, value: '', orderNumber: '' });
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
                  const total = getRiderTotalEarnings(rider.id);
                  const count = getRiderDeliveryCount(rider.id);
                  const isOnline = riderLocations.some(l => l.riderId === rider.id && (Date.now() - new Date(l.updatedAt).getTime() < 60000));

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
                        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={isOnline ? 'Online' : 'Offline'} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-xs text-slate-400">Corridas</p>
                          <p className="text-sm font-bold text-slate-700">{count}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-xs text-slate-400">Total</p>
                          <p className="text-sm font-bold text-emerald-600">R$ {total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Deliveries History */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <span>Histórico de Corridas de Hoje</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Motoboy</th>
                    <th className="py-3 px-4">Nº Pedido</th>
                    <th className="py-3 px-4">Horário</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {todayDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhuma corrida lançada hoje.
                      </td>
                    </tr>
                  ) : (
                    todayDeliveries.map(del => {
                      const rider = scheduledRiders.find(r => r.id === del.riderId);
                      return (
                        <tr key={del.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-medium text-slate-800">{rider?.name || 'Motoboy'}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {del.orderNumber ? (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                                #{del.orderNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{del.time}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-600">R$ {del.value.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              del.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {del.status === 'active' ? 'Ativa' : 'Cancelada'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {del.status === 'active' && (
                              <button
                                onClick={() => handleCancelDelivery(del.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                title="Cancelar Corrida"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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

        {/* Right Column: Real-time GPS Tracking Map */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                <MapIcon className="h-5 w-5 text-indigo-600" />
                <span>Rastreamento em Tempo Real</span>
              </h2>
              <button 
                onClick={loadData}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Atualizar Mapa"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Map Container */}
            <div 
              ref={mapContainerRef} 
              className="flex-1 rounded-xl border border-slate-200 overflow-hidden z-10"
              style={{ minHeight: '300px' }}
            />

            <div className="mt-4 text-xs text-slate-500 flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>O mapa atualiza automaticamente a posição dos motoboys ativos.</span>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: LANÇAR CORRIDA */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Lançar Nova Corrida</h3>
              <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-600">
                <Trash2 className="h-5 w-5" />
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
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 1042"
                    value={deliveryForm.orderNumber}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                  />
                </div>
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
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Lançar Corrida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}