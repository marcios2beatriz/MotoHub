"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Schedule, Delivery, Notification, Establishment } from '../utils/db';
import { 
  Bike, 
  LogOut, 
  Clock, 
  DollarSign, 
  MapPin, 
  TrendingUp, 
  RefreshCw,
  Check,
  MessageSquare,
  Navigation,
  Play,
  Square,
  AlertTriangle,
  Calendar,
  Bell,
  Plus,
  X
} from 'lucide-react';

import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import CustomerChatModal from '../components/CustomerChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'deliveries' | 'notifications'>('dashboard');
  
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    establishmentId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);

  const prevNotesRef = useRef<Record<string, string>>({});
  const watchIdRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<number | null>(null);

  const handleLogout = () => {
    stopGpsTracking();
    db.setCurrentUser(null);
    navigate('/login');
  };

  const loadData = () => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    const todayStr = db.getLocalDateString();
    const schedulesList = db.getSchedules();
    const deliveriesList = db.getDeliveries();
    const notificationsList = db.getNotifications();
    const estsList = db.getEstablishments();

    setEstablishments(estsList);

    // Filtrar escalas do motoboy
    const riderSchedules = schedulesList.filter(s => s.riderId === currentUser.id);
    setAllSchedules(riderSchedules);
    setTodaySchedules(riderSchedules.filter(s => s.date === todayStr));

    // Filtrar corridas do motoboy
    const riderDeliveries = deliveriesList.filter(d => d.riderId === currentUser.id);
    setAllDeliveries(riderDeliveries);
    setTodayDeliveries(riderDeliveries.filter(d => d.date === todayStr));

    // Filtrar notificações do motoboy
    const riderNotifications = notificationsList.filter(n => n.riderId === currentUser.id);
    setNotifications(riderNotifications.sort((a, b) => b.date.localeCompare(a.date)));
  };

  // Wake Lock para manter a tela ativa
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock não suportado ou negado:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
    }
  };

  // Loop de áudio silencioso para evitar suspensão do navegador em segundo plano
  const startSilentAudio = () => {
    try {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      audioIntervalRef.current = window.setInterval(() => {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 20000; // Frequência inaudível
        gain.gain.value = 0.001; // Volume extremamente baixo
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }, 15000);
    } catch (e) {
      console.warn('Erro ao iniciar áudio silencioso:', e);
    }
  };

  const stopSilentAudio = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Envio de localização para o banco
  const updateLocationInDb = (lat: number, lng: number) => {
    if (!user) return;
    db.updateRiderLocation(user.id, user.name, lat, lng);
    setLastCoords({ lat, lng });
  };

  // Rastreamento de GPS Ativo
  const startGpsTracking = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('GPS não suportado neste dispositivo.');
      return;
    }

    setGpsError(null);
    setIsTracking(true);
    requestWakeLock();
    startSilentAudio();

    const successCallback = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      updateLocationInDb(latitude, longitude);
    };

    const errorCallback = (error: GeolocationPositionError) => {
      console.warn('Erro no watchPosition:', error.message);
      setGpsError(`Sinal de GPS fraco ou permissão negada.`);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(successCallback, errorCallback, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });

    fallbackIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLocationInDb(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Erro no fallback de GPS:', err.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 15000);
  };

  const stopGpsTracking = () => {
    setIsTracking(false);
    releaseWakeLock();
    stopSilentAudio();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (fallbackIntervalRef.current !== null) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  };

  // Reativação ativa do GPS ao mudar visibilidade
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTracking) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        if (fallbackIntervalRef.current !== null) {
          clearInterval(fallbackIntervalRef.current);
        }
        
        const successCallback = (position: GeolocationPosition) => {
          updateLocationInDb(position.coords.latitude, position.coords.longitude);
        };
        watchIdRef.current = navigator.geolocation.watchPosition(successCallback, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        });

        fallbackIntervalRef.current = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (pos) => updateLocationInDb(pos.coords.latitude, pos.coords.longitude),
            () => {},
            { enableHighAccuracy: true, timeout: 5000 }
          );
        }, 15000);

        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking]);

  useEffect(() => {
    if (!user || user.role !== 'rider') {
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
      stopGpsTracking();
    };
  }, [user, navigate]);

  // Notificações de novas corridas e mensagens
  useEffect(() => {
    todayDeliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const sender = line.includes('- Estabelecimento') ? 'Estabelecimento' : 'Cliente';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(`Mensagem do ${sender}`, `Pedido #${d.orderNumber || d.id.slice(-4)}: "${messageText}"`);
              playNotificationSound();
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [todayDeliveries, user]);

  const handleAcceptDelivery = (id: string) => {
    const updated = db.getDeliveries().map(d => {
      if (d.id === id) {
        return { ...d, status: 'accepted' as const };
      }
      return d;
    });
    db.setDeliveries(updated);
    loadData();
  };

  const handleCompleteDelivery = (id: string) => {
    const updated = db.getDeliveries().map(d => {
      if (d.id === id) {
        return { ...d, status: 'completed' as const };
      }
      return d;
    });
    db.setDeliveries(updated);
    loadData();
  };

  const handleSendCustomerMessage = (text: string) => {
    if (!customerChatDeliveryId) return;
    const delivery = todayDeliveries.find(d => d.id === customerChatDeliveryId);
    if (!delivery) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const formattedMessage = `[${dateStr} ${timeStr} - Motoboy (${user?.name})]: ${text}`;
    const updatedChat = delivery.customerChat ? `${delivery.customerChat}\n${formattedMessage}` : formattedMessage;

    const updatedDeliveries = db.getDeliveries().map(d => 
      d.id === delivery.id ? { ...d, customerChat: updatedChat, updatedAt: new Date().toISOString() } : d
    );
    db.setDeliveries(updatedDeliveries);
    loadData();
  };

  const handleLaunchDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const val = parseFloat(deliveryForm.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }

    const todayStr = db.getLocalDateString();
    const activeSchedule = todaySchedules.find(s => s.establishmentId === deliveryForm.establishmentId);

    const newDelivery: Delivery = {
      id: 'del_' + Math.random().toString(36).substr(2, 9),
      establishmentId: deliveryForm.establishmentId,
      riderId: user.id,
      scheduleId: activeSchedule?.id || '',
      value: val,
      status: 'pending',
      date: todayStr,
      time: new Date().toTimeString().slice(0, 5),
      orderNumber: deliveryForm.orderNumber,
      notes: deliveryForm.notes || '',
      updatedAt: new Date().toISOString()
    };

    db.setDeliveries([...db.getDeliveries(), newDelivery]);
    setShowDeliveryModal(false);
    setDeliveryForm({ establishmentId: '', value: '', orderNumber: '', notes: '' });
    loadData();
    alert('Corrida lançada com sucesso!');
  };

  const handleMarkNotificationRead = (id: string) => {
    const updated = db.getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    db.setNotifications(updated);
    loadData();
  };

  const handleOpenGps = (est: Establishment) => {
    const address = `${est.address.street}, ${est.address.number}, ${est.address.neighborhood}, ${est.address.city}, ${est.address.state}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  // Cálculos de faturamento
  const todayStr = db.getLocalDateString();
  const todayCompleted = allDeliveries.filter(d => d.date === todayStr && d.status === 'completed');
  const todayEarnings = todayCompleted.reduce((sum, d) => sum + d.value, 0);

  // Faturamento semanal (segunda a domingo)
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
    const monday = new Date(now.setDate(diff));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { monday, sunday };
  };
  const { monday, sunday } = getWeekRange();
  const weekCompleted = allDeliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return d.status === 'completed' && dDate >= monday && dDate <= sunday;
  });
  const weekEarnings = weekCompleted.reduce((sum, d) => sum + d.value, 0);

  // Faturamento mensal
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthCompleted = allDeliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return d.status === 'completed' && dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
  });
  const monthEarnings = monthCompleted.reduce((sum, d) => sum + d.value, 0);

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight">
                {user?.name || 'Carregando...'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Painel do Entregador</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-sm">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex flex-col items-center gap-1 ${
              activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex flex-col items-center gap-1 ${
              activeTab === 'schedules' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Escalas</span>
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex flex-col items-center gap-1 ${
              activeTab === 'deliveries' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Corridas</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex flex-col items-center gap-1 relative ${
              activeTab === 'notifications' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notificações</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-6 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Controle de Rastreamento GPS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Rastreamento de GPS</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Mantenha ativo durante o seu turno de trabalho.</p>
                </div>
                <span className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`}></span>
              </div>

              {gpsError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="font-medium">{gpsError}</p>
                </div>
              )}

              {lastCoords && isTracking && (
                <div className="bg-slate-50 p-3 rounded-xl text-xs font-mono text-slate-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Lat: {lastCoords.lat.toFixed(5)}, Lng: {lastCoords.lng.toFixed(5)}</span>
                </div>
              )}

              <button
                onClick={isTracking ? stopGpsTracking : startGpsTracking}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                  isTracking 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10'
                }`}
              >
                {isTracking ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    Parar Rastreamento
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Rastreamento
                  </>
                )}
              </button>
            </div>

            {/* Desempenho Financeiro */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                Desempenho Financeiro
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Hoje</span>
                  <p className="text-sm font-black text-slate-800 mt-1">R$ {todayEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Semana</span>
                  <p className="text-sm font-black text-slate-800 mt-1">R$ {weekEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Mês</span>
                  <p className="text-sm font-black text-slate-800 mt-1">R$ {monthEarnings.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700">Corridas Realizadas Hoje</span>
                <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {todayCompleted.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ESCALAS */}
        {activeTab === 'schedules' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Escalas dos Próximos 30 Dias
            </h3>

            {allSchedules.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhuma escala futura cadastrada.
              </div>
            ) : (
              <div className="space-y-3">
                {allSchedules.map(s => {
                  const est = establishments.find(e => e.id === s.establishmentId);
                  const isToday = s.date === todayStr;
                  return (
                    <div 
                      key={s.id} 
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isToday ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {isToday && (
                              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                                Hoje
                              </span>
                            )}
                            <h4 className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {est?.address.street}, {est?.address.number} - {est?.address.neighborhood}
                          </p>
                        </div>
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          {s.shift === 'morning' ? 'Manhã' : s.shift === 'afternoon' ? 'Tarde' : 'Noite'}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveScheduleChatId(s.id)}
                          className="flex-1 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Chat do Turno
                        </button>
                        {est && (
                          <button
                            onClick={() => handleOpenGps(est)}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Navigation className="w-4 h-4" />
                            Navegar GPS
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: CORRIDAS */}
        {activeTab === 'deliveries' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bike className="w-5 h-5 text-indigo-600" />
                Suas Corridas de Hoje
              </h3>
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Lançar Corrida
              </button>
            </div>

            <div className="space-y-3">
              {todayDeliveries.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Nenhuma corrida lançada para você hoje.</p>
              ) : (
                todayDeliveries.map(d => {
                  const est = establishments.find(e => e.id === d.establishmentId);
                  return (
                    <div key={d.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">Pedido #{d.orderNumber || d.id.slice(-4)}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{est?.name || 'Estabelecimento'}</p>
                        </div>
                        <span className="font-black text-slate-900 text-base">R$ {d.value.toFixed(2)}</span>
                      </div>

                      {d.notes && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs text-slate-600 font-medium whitespace-pre-wrap">
                          {d.notes}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setNotesDeliveryId(d.id)}
                          className="flex-1 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Notas / Chat
                        </button>

                        <button
                          onClick={() => setCustomerChatDeliveryId(d.id)}
                          className="flex-1 py-2 bg-white hover:bg-emerald-50 text-emerald-600 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Chat Cliente
                        </button>

                        {d.status === 'pending' && (
                          <button
                            onClick={() => handleAcceptDelivery(d.id)}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            Aceitar
                          </button>
                        )}

                        {d.status === 'accepted' && (
                          <button
                            onClick={() => handleCompleteDelivery(d.id)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            Concluir
                          </button>
                        )}

                        {d.status === 'completed' && (
                          <span className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                            <Check className="w-4 h-4" />
                            Concluída
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB: NOTIFICAÇÕES */}
        {activeTab === 'notifications' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Histórico de Notificações
            </h3>

            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma notificação recebida.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-4 rounded-xl border transition-all space-y-2 ${
                      n.read ? 'bg-slate-50/50 border-slate-100 opacity-70' : 'bg-indigo-50/30 border-indigo-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">{n.title}</h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(n.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Modal de Lançamento de Corrida pelo Entregador */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Lançar Nova Corrida</h3>
              <button 
                onClick={() => setShowDeliveryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchDelivery} className="mt-4 space-y-4">
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estabelecimento</label>
                <select
                  required
                  value={deliveryForm.establishmentId}
                  onChange={e => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="">Selecione o estabelecimento</option>
                  {establishments.filter(e => e.active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
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
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/10"
                >
                  Lançar Corrida
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
          userRole="rider"
          userName={user?.name || 'Motoboy'}
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
          schedule={allSchedules.find(s => s.id === activeScheduleChatId) || null}
          userRole="rider"
          userName={user?.name || 'Motoboy'}
          onSaveChat={(scheduleId, updatedChat) => {
            const updatedSchedules = db.getSchedules().map(s => 
              s.id === scheduleId ? { ...s, chat: updatedChat, updatedAt: new Date().toISOString() } : s
            );
            db.setSchedules(updatedSchedules);
            loadData();
          }}
        />
      )}

      {customerChatDeliveryId && (
        <CustomerChatModal
          isOpen={customerChatDeliveryId !== null}
          onClose={() => setCustomerChatDeliveryId(null)}
          delivery={todayDeliveries.find(d => d.id === customerChatDeliveryId) || null}
          onSendMessage={handleSendCustomerMessage}
          viewerRole="rider"
        />
      )}
    </div>
  );
}