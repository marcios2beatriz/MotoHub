"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Schedule, Delivery, Notification, Establishment } from '../utils/db';
import { 
  DollarSign, 
  Calendar, 
  Navigation, 
  Bell, 
  LogOut, 
  TrendingUp, 
  CheckCircle, 
  MapPin, 
  Clock,
  AlertCircle,
  History,
  Filter,
  X,
  Satellite,
  WifiOff,
  Radio,
  Plus,
  Hash,
  Edit2,
  Share2,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import CustomerChatModal from '../components/CustomerChatModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(db.getCurrentUser());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'history' | 'notifications'>('dashboard');
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'active' | 'error' | 'denied'>('requesting');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Refs para armazenar o estado anterior das notas e chats para evitar notificações duplicadas
  const prevNotesRef = useRef<Record<string, string>>({});
  const prevChatRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  // Modal de Lançar/Editar Corrida
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [launchForm, setLaunchForm] = useState({
    establishmentId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  // IDs dos Modais Ativos para Sincronização em Tempo Real
  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  // Filtros das escalas futuras
  const [scheduleEstFilter, setScheduleEstFilter] = useState('');
  const [scheduleDateFilter, setScheduleDateFilter] = useState('');

  // Filtros do histórico
  const [historyEstFilter, setHistoryEstFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // Helper ultra-robusto para resolver estabelecimento por ID ou nome aproximado
  const resolveEst = (id: string): Establishment | undefined => {
    const allEsts = db.getEstablishments();
    let found = allEsts.find(e => e.id === id);
    if (found) return found;
    
    // Fallback por nome aproximado caso o ID seja diferente ou corrompido
    found = allEsts.find(e => 
      e.name.toLowerCase().trim() === id.toLowerCase().trim() ||
      e.name.toLowerCase().trim().includes(id.toLowerCase().trim()) ||
      id.toLowerCase().trim().includes(e.name.toLowerCase().trim())
    );
    return found;
  };

  const loadData = () => {
    if (!user) return;
    const allUsers = db.getUsers();
    const freshUser = allUsers.find(u => u.id === user.id) || user;
    
    // Filtro ultra-robusto por ID ou e-mail do motoboy para evitar sumiço por divergência de IDs
    const allSchedules = db.getSchedules().filter(s => {
      if (s.riderId === freshUser.id) return true;
      const riderOfSch = allUsers.find(u => u.id === s.riderId);
      return riderOfSch && riderOfSch.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allDeliveries = db.getDeliveries().filter(d => {
      if (d.riderId === freshUser.id) return true;
      const riderOfDel = allUsers.find(u => u.id === d.riderId);
      return riderOfDel && riderOfDel.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allNotifications = db.getNotifications().filter(n => {
      if (n.riderId === freshUser.id) return true;
      const riderOfNotif = allUsers.find(u => u.id === n.riderId);
      return riderOfNotif && riderOfNotif.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allEsts = db.getEstablishments().filter(e => e.active);
    
    setSchedules(allSchedules);
    setDeliveries(allDeliveries);
    setNotifications(allNotifications);
    setEstablishments(allEsts);
  };

  useEffect(() => {
    if (!user || user.role !== 'rider') {
      navigate('/login');
      return;
    }
    loadData();

    // Sincronização periódica a cada 5 segundos para receber mensagens e atualizações em tempo real
    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 5000);

    return () => clearInterval(interval);
  }, [user, navigate, activeTab]);

  // Monitoramento de novas mensagens no chat com Estabelecimento
  useEffect(() => {
    deliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const est = resolveEst(d.establishmentId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(
                `Mensagem do Estabelecimento`,
                `Pedido #${d.orderNumber || d.id.slice(-4)} (${est?.name || 'Corrida'}): "${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [deliveries, user, establishments]);

  // Monitoramento de novas mensagens no chat com Cliente
  useEffect(() => {
    deliveries.forEach(d => {
      const prevChat = prevChatRef.current[d.id];
      if (prevChat !== undefined && d.customerChat && d.customerChat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = d.customerChat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(
                `Mensagem do Cliente`,
                `Pedido #${d.orderNumber || d.id.slice(-4)}: "${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();
            }
          });
        }
      }
      prevChatRef.current[d.id] = d.customerChat || '';
    });
  }, [deliveries, user]);

  // Monitoramento de novas mensagens no chat de turno
  useEffect(() => {
    schedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const est = resolveEst(s.establishmentId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              sendDeviceNotification(
                `Mensagem de Turno de ${est?.name || 'Estabelecimento'}`,
                `"${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [schedules, user, establishments]);

  useEffect(() => {
    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener('db-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, [user]);

  // Solicitar Wake Lock para manter a tela ativa e evitar suspensão do GPS
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock ativado com sucesso. Tela permanecerá ligada.');
      }
    } catch (err) {
      console.warn('Não foi possível ativar o Wake Lock:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
    }
  };

  const startGpsTracking = () => {
    if (!user || user.role !== 'rider') return;
    
    // Ativar Wake Lock para manter a tela ligada e o GPS ativo
    requestWakeLock();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    setGpsStatus('requesting');

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setGpsCoords({ lat: latitude, lng: longitude });
      setGpsStatus('active');
      db.updateRiderLocation(user.id, user.name, latitude, longitude);
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        setGpsStatus('denied');
      } else {
        setGpsStatus('error');
      }
      console.warn('Erro de GPS:', err.message);
    };

    // Configurações de Alta Precisão Absoluta
    const options: PositionOptions = {
      enableHighAccuracy: true, // Força o uso do chip de GPS integrado (Hardware)
      maximumAge: 0,            // Ignora cache, exige leitura em tempo real
      timeout: 10000            // Timeout de 10 segundos
    };

    // Primeira leitura imediata
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    
    // Monitoramento contínuo nativo
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);

    // Loop de Atualização Ativa (Força nova leitura a cada 5 segundos para evitar suspensão do navegador)
    fallbackIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, (err) => {
        console.warn('Atualização ativa de GPS falhou:', err.message);
      }, options);
    }, 5000);
  };

  useEffect(() => {
    startGpsTracking();

    // Re-solicitar Wake Lock se a página voltar a ficar visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [user]);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleShareTracking = (deliveryId: string) => {
    const link = `${window.location.origin}/#/track/${deliveryId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(deliveryId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getTodayDateString = () => db.getLocalDateString();

  const getStartOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(today.setDate(diff));
    start.setHours(0,0,0,0);
    return start;
  };

  const getStartOfMonth = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  };

  const todayStr = getTodayDateString();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  const todayDeliveries = deliveries.filter(d => d.date === todayStr);
  const todayEarnings = todayDeliveries.filter(d => d.status === 'active').reduce((sum, d) => sum + d.value, 0);

  const weekEarnings = deliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return dDate >= startOfWeek && d.status === 'active';
  }).reduce((sum, d) => sum + d.value, 0);

  const monthEarnings = deliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return dDate >= startOfMonth && d.status === 'active';
  }).reduce((sum, d) => sum + d.value, 0);

  const getFutureSchedules = () => {
    const todayStr = db.getLocalDateString();
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitDateStr = db.getLocalDateString(limit);

    return schedules.filter(s => {
      return s.date >= todayStr && s.date <= limitDateStr;
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  const filteredFutureSchedules = getFutureSchedules().filter(s => {
    let matchesEst = true;
    if (scheduleEstFilter) {
      const filterEst = establishments.find(e => e.id === scheduleEstFilter);
      const schEst = resolveEst(s.establishmentId);
      if (filterEst && schEst) {
        matchesEst = filterEst.name.toLowerCase().trim() === schEst.name.toLowerCase().trim();
      } else {
        matchesEst = s.establishmentId === scheduleEstFilter;
      }
    }
    const matchesDate = scheduleDateFilter ? s.date === scheduleDateFilter : true;
    return matchesEst && matchesDate;
  });

  const handleOpenGPS = (address: any) => {
    if (!address) return;
    const query = encodeURIComponent(`${address.street || ''}, ${address.number || ''}, ${address.neighborhood || ''}, ${address.city || ''} - ${address.state || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    const allNotif = db.getNotifications();
    const updatedAll = allNotif.map(n => n.id === id ? { ...n, read: true } : n);
    db.setNotifications(updatedAll);
  };

  const getScheduledEstablishmentsToday = () => {
    const todaySchedules = schedules.filter(s => s.date === todayStr);
    const scheduledIds = todaySchedules.map(s => s.establishmentId);
    return establishments.filter(e => scheduledIds.includes(e.id));
  };

  const handleLaunchDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(launchForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    if (!user) return;

    const activeSchedule = schedules.find(s => s.establishmentId === launchForm.establishmentId && s.date === todayStr);
    const allDeliveries = db.getDeliveries();
    const nowStr = new Date().toISOString();

    if (editingDelivery) {
      if (editingDelivery.status !== 'pending') {
        alert('Erro: Apenas corridas pendentes podem ser editadas.');
        return;
      }

      const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        establishmentId: launchForm.establishmentId,
        value: val,
        orderNumber: launchForm.orderNumber.trim() || undefined,
        notes: launchForm.notes.trim() || undefined,
        scheduleId: activeSchedule?.id || d.scheduleId,
        updatedAt: nowStr
      } : d);

      db.setDeliveries(updated);
      alert('Corrida atualizada com sucesso! Aguardando aprovação.');
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: user.id,
        establishmentId: launchForm.establishmentId,
        date: todayStr,
        time: new Date().toTimeString().slice(0, 5),
        value: val,
        status: 'pending',
        scheduleId: activeSchedule?.id,
        orderNumber: launchForm.orderNumber.trim() || undefined,
        notes: launchForm.notes.trim() || undefined,
        updatedAt: nowStr
      };

      db.setDeliveries([...allDeliveries, newDelivery]);
      alert('Corrida lançada com sucesso! Aguardando aprovação do estabelecimento ou administrador.');
    }

    setShowLaunchModal(false);
    setEditingDelivery(null);
    setLaunchForm({ establishmentId: '', value: '', orderNumber: '', notes: '' });
    loadData();
  };

  const handleSendCustomerMessage = (text: string) => {
    if (!customerChatDeliveryId) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const formattedMessage = `[${dateStr} ${timeStr} - Motoboy (${user?.name})]: ${text}`;
    const currentDelivery = deliveries.find(d => d.id === customerChatDeliveryId);
    if (!currentDelivery) return;

    const updatedChat = currentDelivery.customerChat ? `${currentDelivery.customerChat}\n${formattedMessage}` : formattedMessage;

    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === customerChatDeliveryId ? {
      ...d,
      customerChat: updatedChat,
      updatedAt: new Date().toISOString()
    } : d);

    db.setDeliveries(updated);
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const getShiftLabel = (shift: string) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'night': return 'Noite';
      default: return shift;
    }
  };

  const scheduledEstsToday = getScheduledEstablishmentsToday();
  const todaySchedule = schedules.find(s => s.date === todayStr);

  // Derivação de Estados dos Chats em Tempo Real
  const activeNotesDelivery = deliveries.find(d => d.id === notesDeliveryId) || null;
  const activeCustomerChatDelivery = deliveries.find(d => d.id === customerChatDeliveryId) || null;
  const activeScheduleChat = schedules.find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-200">Olá, bem-vindo!</p>
            <h1 className="text-lg font-bold truncate max-w-[200px] sm:max-w-none">{user?.name}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (scheduledEstsToday.length === 0) {
                  alert('Aviso: Você não possui escalas ativas para hoje. Não é possível lançar corridas.');
                  return;
                }
                setEditingDelivery(null);
                setLaunchForm({ establishmentId: scheduledEstsToday[0].id, value: '', orderNumber: '', notes: '' });
                setShowLaunchModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Lançar Corrida</span>
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-indigo-700 rounded-full transition-colors flex items-center space-x-1 text-sm"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Banner de Orientação de GPS de Alta Precisão */}
        <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-indigo-900">Rastreamento em Tempo Real Ativo</h4>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              Para garantir que o estabelecimento e o cliente acompanhem sua rota com precisão absoluta, <strong>mantenha esta tela ligada</strong> e certifique-se de que concedeu permissão de <strong>Alta Precisão (GPS)</strong> ao seu navegador.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 bg-white rounded-lg p-1 shadow-sm mb-6 border border-slate-200 gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Ganhos</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Escalas</span>
            <span className="sm:hidden">Escala</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Histórico</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-1.5 transition-colors relative ${
              activeTab === 'notifications' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Avisos</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Card de Status do GPS */}
            <div className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              gpsStatus === 'active'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : gpsStatus === 'requesting'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  gpsStatus === 'active' ? 'bg-emerald-100' : gpsStatus === 'requesting' ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  {gpsStatus === 'active' && <Radio className="h-5 w-5 text-emerald-600 animate-pulse" />}
                  {gpsStatus === 'requesting' && <Satellite className="h-5 w-5 text-blue-600 animate-spin" />}
                  {(gpsStatus === 'error' || gpsStatus === 'denied') && <WifiOff className="h-5 w-5 text-red-600" />}
                </div>
                <div className="min-w-0">
                  {gpsStatus === 'active' && (
                    <>
                      <p className="font-bold text-sm">📡 GPS Ativo — Transmitindo localização</p>
                      {gpsCoords && (
                        <p className="text-xs opacity-75 font-mono truncate">
                          {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                        </p>
                      )}
                    </>
                  )}
                  {gpsStatus === 'requesting' && (
                    <p className="font-bold text-sm">Aguardando permissão de localização...</p>
                  )}
                  {gpsStatus === 'denied' && (
                    <>
                      <p className="font-bold text-sm">⚠️ Permissão de GPS negada</p>
                      <p className="text-xs opacity-75">Habilite a localização nas configurações do navegador.</p>
                    </>
                  )}
                  {gpsStatus === 'error' && (
                    <>
                      <p className="font-bold text-sm">⚠️ GPS indisponível ou HTTP não seguro</p>
                      <p className="text-xs opacity-75">Acesse via HTTPS ou ative o GPS do celular.</p>
                    </>
                  )}
                </div>
              </div>
              {gpsStatus !== 'active' && (
                <button
                  onClick={startGpsTracking}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors self-start sm:self-auto"
                >
                  Ativar GPS Manualmente
                </button>
              )}
            </div>

            {/* Card de Chat de Turno Rápido */}
            {todaySchedule && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-indigo-900">Chat de Turno Ativo</p>
                    <p className="text-xs text-indigo-700">Fale diretamente com o gerente do estabelecimento hoje.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveScheduleChatId(todaySchedule.id)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  Abrir Chat
                </button>
              </div>
            )}

            {/* Cards de Faturamento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {todayEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Esta Semana</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {weekEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Este Mês</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {monthEarnings.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Corridas do Dia */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <span>Corridas de Hoje</span>
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  {todayDeliveries.length} {todayDeliveries.length === 1 ? 'corrida' : 'corridas'}
                </span>
              </div>

              {todayDeliveries.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nenhuma corrida registrada hoje.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayDeliveries.map((delivery) => {
                    const est = resolveEst(delivery.establishmentId);
                    return (
                      <div key={delivery.id} className="py-3 flex justify-between items-center">
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <p className="font-semibold text-slate-700">{est?.name || 'Estabelecimento'}</p>
                            {delivery.orderNumber && (
                              <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                #{delivery.orderNumber}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              delivery.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : delivery.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : delivery.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {delivery.status === 'active' && 'Aprovada'}
                              {delivery.status === 'pending' && 'Pendente'}
                              {delivery.status === 'rejected' && 'Rejeitada'}
                              {delivery.status === 'cancelled' && 'Cancelada'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{delivery.time}</span>
                          </p>
                          {delivery.status === 'rejected' && delivery.notes ? (
                            <div className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5 font-medium leading-relaxed">
                              <strong>Motivo da Rejeição:</strong> {
                                delivery.notes.includes('Rejeitado:') 
                                  ? delivery.notes.split('Rejeitado:').pop()?.trim() 
                                  : delivery.notes.includes('Motivo da rejeição:')
                                  ? delivery.notes.split('Motivo da rejeição:').pop()?.trim()
                                  : delivery.notes
                              }
                            </div>
                          ) : delivery.notes ? (
                            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 mt-1.5 italic truncate max-w-[300px]">
                              Obs: {delivery.notes.split('\n').pop()?.replace(/\[.*?\]: /, '') || delivery.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Botão Chat com Estabelecimento */}
                          <button
                            onClick={() => setNotesDeliveryId(delivery.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors relative"
                            title="Chat com Estabelecimento"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] px-1 rounded-full">Est</span>
                          </button>

                          {/* Botão Chat com Cliente */}
                          {(delivery.status === 'active' || delivery.status === 'pending') && (
                            <button
                              onClick={() => setCustomerChatDeliveryId(delivery.id)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors relative"
                              title="Chat com Cliente"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[8px] px-1 rounded-full">Cli</span>
                            </button>
                          )}

                          {/* Link de Rastreamento disponível para corridas Ativas e Pendentes */}
                          {(delivery.status === 'active' || delivery.status === 'pending') && (
                            <button
                              onClick={() => handleShareTracking(delivery.id)}
                              className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                                copiedId === delivery.id 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title="Compartilhar Link de Rastreamento"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>{copiedId === delivery.id ? 'Copiado!' : 'Enviar Link'}</span>
                            </button>
                          )}
                          <span className={`font-bold ${delivery.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            R$ {delivery.value.toFixed(2)}
                          </span>
                          {delivery.status === 'pending' && (
                            <button
                              onClick={() => {
                                setEditingDelivery(delivery);
                                setLaunchForm({
                                  establishmentId: delivery.establishmentId,
                                  value: delivery.value.toString(),
                                  orderNumber: delivery.orderNumber || '',
                                  notes: delivery.notes || ''
                                });
                                setShowLaunchModal(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Editar Corrida Pendente"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Schedules */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="text-lg font-bold text-slate-800">Escalas dos Próximos 30 Dias</h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                {filteredFutureSchedules.length} escala{filteredFutureSchedules.length !== 1 ? 's' : ''} encontrada{filteredFutureSchedules.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filtros de Escala */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-indigo-500" />
                Filtrar Escalas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Filtro por Estabelecimento */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Estabelecimento</label>
                  <select
                    value={scheduleEstFilter}
                    onChange={e => setScheduleEstFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todos os estabelecimentos</option>
                    {db.getEstablishments().filter(e => e.active).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Data */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Data Específica</label>
                  <input
                    type="date"
                    value={scheduleDateFilter}
                    onChange={e => setScheduleDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {(scheduleEstFilter || scheduleDateFilter) && (
                <button
                  onClick={() => { setScheduleEstFilter(''); setScheduleDateFilter(''); }}
                  className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpar filtros
                </button>
              )}
            </div>
            
            {filteredFutureSchedules.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium">Nenhuma escala encontrada para os filtros selecionados.</p>
                <p className="text-sm text-slate-400 mt-1">Tente ajustar os filtros ou fale com o administrador.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFutureSchedules.map((schedule) => {
                  const est = resolveEst(schedule.establishmentId);
                  const isTransition = schedule.date === todayStr;

                  return (
                    <div 
                      key={schedule.id} 
                      className={`bg-white p-5 rounded-xl shadow-sm border transition-all ${
                        isTransition ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {isTransition && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
                              Hoje
                            </span>
                          )}
                          <h4 className="text-lg font-bold text-slate-800">{est?.name || 'Estabelecimento'}</h4>
                          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-1.5 mt-1">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span>{new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span className="text-slate-300">•</span>
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-indigo-600">{getShiftLabel(schedule.shift)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{schedule.startTime} - {schedule.endTime}</span>
                          </p>
                        </div>
                        {isTransition && (
                          <button
                            onClick={() => setActiveScheduleChatId(schedule.id)}
                            className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 px-3 rounded-lg transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Chat de Turno</span>
                          </button>
                        )}
                      </div>

                      {est && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start space-x-2">
                            <MapPin className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-600">
                              <p className="font-medium">{est.address?.street || 'Endereço não cadastrado'}, {est.address?.number || 'S/N'}</p>
                              <p>{est.address?.neighborhood || ''} {est.address?.city ? `- ${est.address.city}` : ''}/{est.address?.state || ''}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenGPS(est.address)}
                            className="flex items-center justify-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 px-3 rounded-md transition-colors"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Abrir no GPS</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: History */}
        {activeTab === 'history' && (() => {
          const todayStr = db.getLocalDateString();
          const allEsts = db.getEstablishments();
          const pastSchedules = schedules
            .filter(s => s.date < todayStr)
            .sort((a, b) => b.date.localeCompare(a.date));

          const estFiltered = historyEstFilter
            ? pastSchedules.filter(s => s.establishmentId === historyEstFilter)
            : pastSchedules;

          const dateFiltered = estFiltered.filter(s => {
            if (historyDateFrom && s.date < historyDateFrom) return false;
            if (historyDateTo && s.date > historyDateTo) return false;
            return true;
          });

          const usedEstIds = Array.from(new Set(pastSchedules.map(s => s.establishmentId)));
          const usedEsts = allEsts.filter(e => usedEstIds.includes(e.id));

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-500" />
                  Histórico de Escalas
                </h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {dateFiltered.length} registro{dateFiltered.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Filtros */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" />Filtros
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={historyEstFilter}
                    onChange={e => setHistoryEstFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todos os estabelecimentos</option>
                    {usedEsts.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">De</label>
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={e => setHistoryDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Até</label>
                    <input
                      type="date"
                      value={historyDateTo}
                      onChange={e => setHistoryDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {(historyEstFilter || historyDateFrom || historyDateTo) && (
                  <button
                    onClick={() => { setHistoryEstFilter(''); setHistoryDateFrom(''); setHistoryDateTo(''); }}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Lista */}
              {dateFiltered.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-400">
                  <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium">Nenhuma escala encontrada.</p>
                  <p className="text-sm mt-1">Tente ajustar os filtros.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dateFiltered.map(schedule => {
                    const est = resolveEst(schedule.establishmentId);
                    return (
                      <div key={schedule.id} className="bg-white border border-slate-200 rounded-xl p-4 opacity-80">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-700">{est?.name || 'Estabelecimento'}</p>
                            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-1.5 mt-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            </p>
                            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span className={`font-medium ${schedule.shift === 'morning' ? 'text-amber-600' : schedule.shift === 'afternoon' ? 'text-orange-600' : schedule.shift === 'night' ? 'text-blue-600' : ''}`}>
                                {getShiftLabel(schedule.shift)}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-600 text-xs bg-slate-100 px-1.5 py-0.5 rounded">{schedule.startTime} — {schedule.endTime}</span>
                            </p>
                          </div>
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex-shrink-0">
                            Concluída
                          </span>
                        </div>
                        {est && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span>{est.address?.street || 'Endereço não cadastrado'}, {est.address?.number || 'S/N'} — {est.address?.neighborhood || ''}, {est.address?.city || ''}/{est.address?.state || ''}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab Content: Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Histórico de Avisos</h3>

            {notifications.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-400">
                <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p>Nenhum aviso recebido.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      notif.read 
                        ? 'bg-white border-slate-200 opacity-75' 
                        : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full mt-0.5 ${notif.read ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>
                          <Bell className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">
                            {new Date(notif.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      {!notif.read && (
                        <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: LANÇAR CORRIDA */}
      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingDelivery ? 'Editar Corrida Pendente' : 'Lançar Nova Corrida'}
              </h3>
              <button onClick={() => { setShowLaunchModal(false); setEditingDelivery(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleLaunchDelivery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
                <select
                  required
                  value={launchForm.establishmentId}
                  onChange={(e) => setLaunchForm({ ...launchForm, establishmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                >
                  {scheduledEstsToday.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
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
                    value={launchForm.orderNumber}
                    onChange={(e) => setLaunchForm({ ...launchForm, orderNumber: e.target.value })}
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
                  value={launchForm.value}
                  onChange={(e) => setLaunchForm({ ...launchForm, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações (Opcional)</label>
                <textarea
                  placeholder="Ex: Troco para R$ 100,00, condomínio bloco C..."
                  value={launchForm.notes}
                  onChange={(e) => setLaunchForm({ ...launchForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowLaunchModal(false); setEditingDelivery(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  -- Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {editingDelivery ? 'Salvar Alterações' : 'Lançar Corrida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVAÇÕES / CHAT COM ESTABELECIMENTO */}
      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="rider"
        userName={user?.name || 'Motoboy'}
        onSaveNotes={handleSaveNotes}
      />

      {/* MODAL DE CHAT COM CLIENTE */}
      <CustomerChatModal
        isOpen={!!customerChatDeliveryId}
        onClose={() => setCustomerChatDeliveryId(null)}
        delivery={activeCustomerChatDelivery}
        onSendMessage={handleSendCustomerMessage}
        viewerRole="rider"
      />

      {/* MODAL DE CHAT DE TURNO */}
      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="rider"
        userName={user?.name || 'Motoboy'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}