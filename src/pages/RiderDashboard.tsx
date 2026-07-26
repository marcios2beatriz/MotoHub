"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Schedule, Delivery, Notification, Establishment, QueueEntry } from '../utils/db';
import { 
  DollarSign, 
  Calendar, 
  Bell, 
  LogOut, 
  TrendingUp, 
  CheckCircle, 
  MapPin, 
  Clock, 
  AlertCircle,
  History,
  X,
  Plus,
  Share2,
  MessageSquare,
  ShieldAlert,
  Check,
  Compass,
  Users,
  ListOrdered,
  CheckCircle2,
  Play,
  RotateCcw
} from 'lucide-react';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import CustomerChatModal from '../components/CustomerChatModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import RiderNavigationMap from '../components/RiderNavigationMap';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(db.getCurrentUser());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'history' | 'notifications' | 'navigation'>('dashboard');
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'active' | 'error' | 'denied'>('requesting');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);

  const [navDestination, setNavDestination] = useState<{
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  
  const hasInitializedDestRef = useRef(false);

  const watchIdRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const prevNotesRef = useRef<Record<string, string>>({});
  const prevChatRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [launchForm, setLaunchForm] = useState({
    establishmentId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [scheduleEstFilter, setScheduleEstFilter] = useState('');
  const [scheduleDateFilter, setScheduleDateFilter] = useState('');

  const [historyEstFilter, setHistoryEstFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected' | 'cancelled'>('all');

  const resolveEst = (id: string): Establishment | undefined => {
    return db.resolveEstablishment(id);
  };

  const loadData = () => {
    if (!user) return;
    const allUsers = db.getUsers();
    const freshUser = allUsers.find(u => u.id === user.id) || user;
    
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
    const allQueue = db.getQueue();
    
    const sortedSchedules = [...allSchedules].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
    const sortedDeliveries = [...allDeliveries].sort((a, b) => 
      a.date.localeCompare(b.date) || 
      a.time.localeCompare(b.time) || 
      a.id.localeCompare(b.id)
    );

    const sortedNotifications = [...allNotifications].sort((a, b) => b.date.localeCompare(a.date));

    setSchedules(sortedSchedules);
    setDeliveries(sortedDeliveries);
    setNotifications(sortedNotifications);
    setEstablishments(allEsts);
    setQueueEntries(allQueue);

    if (!hasInitializedDestRef.current) {
      const todayStr = db.getLocalDateString();
      const todaySch = sortedSchedules.find(s => s.date === todayStr);
      if (todaySch) {
        const est = db.resolveEstablishment(todaySch.establishmentId);
        if (est && est.address) {
          const addrText = `${est.address.street}, ${est.address.number} - ${est.address.neighborhood}, ${est.address.city}/${est.address.state}`;
          setNavDestination({
            name: est.name,
            addressText: addrText
          });
        }
      }
      hasInitializedDestRef.current = true;
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'rider') {
      navigate('/login');
      return;
    }
    requestNotificationPermission();
    loadData();

    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 2500);

    return () => clearInterval(interval);
  }, [user, navigate, activeTab]);

  // Monitor Delivery Notes Chat
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
              const sender = line.includes('- Estabelecimento') ? 'Estabelecimento' : 'Admin';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Mensagem de ${sender} (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'notes_' + Date.now(),
                title,
                message: messageText,
                sender,
                onClick: () => setNotesDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [deliveries, user]);

  // Monitor Customer Chat
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
              const title = `Mensagem do Cliente (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'customer_' + Date.now(),
                title,
                message: messageText,
                sender: 'Cliente',
                onClick: () => setCustomerChatDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevChatRef.current[d.id] = d.customerChat || '';
    });
  }, [deliveries, user]);

  // Monitor Schedule Shift Chat
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
              const title = `Aviso no Turno (${est?.name || 'Estabelecimento'})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'sch_' + Date.now(),
                title,
                message: messageText,
                sender: est?.name || 'Estabelecimento',
                onClick: () => setActiveScheduleChatId(s.id)
              });
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [schedules, user]);

  useEffect(() => {
    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener('db-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, [user]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {}
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
    }
  };

  const startSilentAudio = () => {
    try {
      if (!audioRef.current) {
        const audio = document.createElement('audio');
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
        audio.loop = true;
        audio.volume = 0.01;
        audioRef.current = audio;
      }
      audioRef.current.play().catch(() => {});
    } catch (err) {}
  };

  const stopSilentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const startGpsTracking = () => {
    if (!user || user.role !== 'rider') return;
    
    requestWakeLock();
    startSilentAudio();

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
      
      let finalLat = latitude;
      let finalLng = longitude;

      if (lastCoordsRef.current) {
        const prev = lastCoordsRef.current;
        const dy = (latitude - prev.lat) * 111000;
        const dx = (longitude - prev.lng) * 111000 * Math.cos(latitude * Math.PI / 180);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
          finalLat = prev.lat;
          finalLng = prev.lng;
        } else {
          finalLat = prev.lat * 0.2 + latitude * 0.8;
          finalLng = prev.lng * 0.2 + longitude * 0.8;
        }
      }

      lastCoordsRef.current = { lat: finalLat, lng: finalLng };
      setGpsCoords({ lat: finalLat, lng: finalLng });
      setGpsStatus('active');
      db.updateRiderLocation(user.id, user.name, finalLat, finalLng);
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        setGpsStatus('denied');
      } else {
        setGpsStatus('error');
      }
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);

    fallbackIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, () => {}, options);
    }, 2000);
  };

  useEffect(() => {
    startGpsTracking();

    const handleVisibilityChange = () => {
      requestWakeLock();
      startSilentAudio();
      startGpsTracking();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleUserInteraction = () => {
      startSilentAudio();
    };
    document.addEventListener('click', handleUserInteraction);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
      releaseWakeLock();
      stopSilentAudio();
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

  const todayStr = db.getLocalDateString();

  const todayDeliveries = deliveries.filter(d => d.date === todayStr);
  const todayEarnings = todayDeliveries.filter(d => d.status === 'active').reduce((sum, d) => sum + Number(d.value || 0), 0);

  const getFutureSchedules = () => {
    const todayStr = db.getLocalDateString();
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitDateStr = db.getLocalDateString(limit);

    return schedules.filter(s => {
      return s.date >= todayStr && s.date <= limitDateStr;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
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

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    const allNotif = db.getNotifications();
    const updatedAll = allNotif.map(n => n.id === id ? { ...n, read: true } : n);
    db.setNotifications(updatedAll);
  };

  const getScheduledEstablishmentsToday = () => {
    const todaySchedules = schedules.filter(s => s.date === todayStr);
    const resolvedEsts = todaySchedules
      .map(s => db.resolveEstablishment(s.establishmentId))
      .filter((e): e is Establishment => !!e);
    
    const uniqueEsts: Establishment[] = [];
    resolvedEsts.forEach(e => {
      if (!uniqueEsts.some(x => x.id === e.id || x.name.toLowerCase().trim() === e.name.toLowerCase().trim())) {
        uniqueEsts.push(e);
      }
    });
    return uniqueEsts;
  };

  const handleJoinQueue = (establishmentId: string) => {
    if (!user) return;
    db.joinQueue(user.id, establishmentId);
    loadData();
  };

  const handleLeaveQueue = (establishmentId: string) => {
    if (!user) return;
    db.leaveQueue(user.id, establishmentId);
    loadData();
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

      // Ao lançar/iniciar corrida, marca como 'delivering' na fila
      db.markRiderDelivering(user.id, launchForm.establishmentId);

      alert('Corrida lançada com sucesso! Aguardando aprovação.');
    }

    setShowLaunchModal(false);
    setEditingDelivery(null);
    setLaunchForm({ establishmentId: '', value: '', orderNumber: '', notes: '' });
    loadData();
  };

  const handleSendCustomerMessage = (text: string) => {
    if (!customerChatDeliveryId) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  const filteredTodayDeliveries = todayDeliveries.filter(d => {
    if (deliveryStatusFilter === 'all') return true;
    return d.status === deliveryStatusFilter;
  });

  const historyDeliveries = deliveries.filter(d => {
    let matchesEst = true;
    if (historyEstFilter) {
      const filterEst = establishments.find(e => e.id === historyEstFilter);
      const delEst = resolveEst(d.establishmentId);
      if (filterEst && delEst) {
        matchesEst = filterEst.name.toLowerCase().trim() === delEst.name.toLowerCase().trim();
      } else {
        matchesEst = d.establishmentId === historyEstFilter;
      }
    }
    const matchesFrom = historyDateFrom ? d.date >= historyDateFrom : true;
    const matchesTo = historyDateTo ? d.date <= historyDateTo : true;
    return matchesEst && matchesFrom && matchesTo;
  });

  const historyTotalEarnings = historyDeliveries
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

  const activeNotesDelivery = deliveries.find(d => d.id === notesDeliveryId) || null;
  const activeCustomerChatDelivery = deliveries.find(d => d.id === customerChatDeliveryId) || null;
  const activeScheduleChat = schedules.find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16 relative">
      <ChatToastBanner toast={activeToast} onClose={() => setActiveToast(null)} />

      <header className="bg-indigo-600 text-white shadow-md sticky top-0 z-20">
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
        <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-900">GPS e Navegação no MotoHub</h4>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              Ao navegar pela aba <strong>GPS App</strong>, sua localização permanece 100% transmitida para a loja sem perda de sinal.
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE ABAS */}
        <div className="grid grid-cols-5 bg-white rounded-lg p-1 shadow-sm mb-6 border border-slate-200 gap-1 text-xs sm:text-sm sticky top-[68px] z-20">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Início</span>
          </button>
          <button
            onClick={() => setActiveTab('navigation')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'navigation' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="h-4 w-4 text-emerald-400" />
            <span>GPS App</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Escalas</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Histórico</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 relative ${
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

        {/* TAB 1: INÍCIO / GANHOS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Faturado Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {todayEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Corridas Aprovadas Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {todayDeliveries.filter(d => d.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>

            {/* CARD FILA DE SAÍDA NO ESTABELECIMENTO */}
            {scheduledEstsToday.length > 0 && (
              <div className="space-y-4">
                {scheduledEstsToday.map(est => {
                  const targetEstObj = db.resolveEstablishment(est.id);

                  const estQueue = queueEntries
                    .filter(q => {
                      if (q.date !== todayStr || q.status !== 'waiting') return false;
                      const qEstObj = db.resolveEstablishment(q.establishmentId);
                      if (q.establishmentId === est.id) return true;
                      if (qEstObj && targetEstObj && qEstObj.name.toLowerCase().trim() === targetEstObj.name.toLowerCase().trim()) return true;
                      return false;
                    })
                    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

                  const myEntryIndex = estQueue.findIndex(q => {
                    if (q.riderId === user?.id) return true;
                    const qRider = db.resolveUser(q.riderId);
                    return qRider && user && qRider.email.toLowerCase() === user.email.toLowerCase();
                  });

                  const isInQueue = myEntryIndex !== -1;
                  const myQueueEntry = isInQueue ? estQueue[myEntryIndex] : null;

                  return (
                    <div key={est.id} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <ListOrdered className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-base">Fila de Saída — {est.name}</h3>
                            <p className="text-xs text-slate-500">{estQueue.length} entregador(es) na fila agora</p>
                          </div>
                        </div>

                        {isInQueue ? (
                          <button
                            onClick={() => handleLeaveQueue(est.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          >
                            Sair da Fila
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinQueue(est.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition-all"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Cheguei no Local (Entrar na Fila)</span>
                          </button>
                        )}
                      </div>

                      {isInQueue ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">Sua Posição Atual</span>
                            <h4 className="text-2xl font-black text-emerald-900 mt-0.5">
                              {myEntryIndex === 0 ? '🥇 1º da Fila (VOCÊ É O PRÓXIMO!)' : `${myEntryIndex + 1}º da Fila`}
                            </h4>
                            <p className="text-xs text-emerald-700 mt-1">
                              Chegada marcada às: <strong>{new Date(myQueueEntry?.joinedAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                            </p>
                          </div>
                          <div className="p-3 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-md animate-pulse">
                            #{myEntryIndex + 1}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center text-xs text-slate-600">
                          Ao chegar na hamburgueria, clique em <strong>"Cheguei no Local"</strong> para garatir sua vez de saída no rodízio.
                        </div>
                      )}

                      {/* LISTA COMPLETA DA FILA DO DIA */}
                      {estQueue.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordem da Fila Hoje:</p>
                          <div className="divide-y divide-slate-100 bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden">
                            {estQueue.map((item, idx) => {
                              const riderUser = db.resolveUser(item.riderId);
                              const isMe = item.riderId === user?.id || (riderUser && user && riderUser.email.toLowerCase() === user.email.toLowerCase());
                              const timeStr = new Date(item.joinedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                              return (
                                <div key={item.id} className={`p-3 flex items-center justify-between text-xs ${isMe ? 'bg-indigo-50 font-bold' : ''}`}>
                                  <div className="flex items-center space-x-2.5">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <span className="text-slate-800 font-semibold">{riderUser?.name || 'Entregador'} {isMe && '(Você)'}</span>
                                  </div>
                                  <span className="text-slate-400 font-mono text-[11px]">{timeStr}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {todaySchedule ? (
              (() => {
                const est = resolveEst(todaySchedule.establishmentId);
                return (
                  <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                          Escala de Hoje
                        </span>
                        <h3 className="text-xl font-extrabold mt-2">{est?.name || 'Estabelecimento'}</h3>
                        <p className="text-xs text-indigo-100 flex items-center gap-1 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Turno da {getShiftLabel(todaySchedule.shift)} ({todaySchedule.startTime} - {todaySchedule.endTime})</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveScheduleChatId(todaySchedule.id)}
                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Chat de Turno"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat</span>
                      </button>
                    </div>

                    {est?.address && (
                      <div className="bg-white/10 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-indigo-200 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-indigo-50">
                            <p className="font-bold">{est.address.street}, {est.address.number}</p>
                            <p>{est.address.neighborhood} • {est.address.city}/{est.address.state}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Nenhuma escala para hoje</p>
                  <p className="text-xs text-amber-700 mt-0.5">Você não está escalado em nenhum estabelecimento hoje. Fale com o administrador para receber escalas.</p>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <span>Corridas de Hoje</span>
                </h3>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
                  <select
                    value={deliveryStatusFilter}
                    onChange={(e) => setDeliveryStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="all">Todas ({todayDeliveries.length})</option>
                    <option value="active">Aprovadas ({todayDeliveries.filter(d => d.status === 'active').length})</option>
                    <option value="pending">Pendentes ({todayDeliveries.filter(d => d.status === 'pending').length})</option>
                    <option value="rejected">Rejeitadas ({todayDeliveries.filter(d => d.status === 'rejected').length})</option>
                    <option value="cancelled">Canceladas ({todayDeliveries.filter(d => d.status === 'cancelled').length})</option>
                  </select>
                </div>
              </div>

              {filteredTodayDeliveries.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nenhuma corrida encontrada para este filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTodayDeliveries.map((delivery) => {
                    const est = resolveEst(delivery.establishmentId);
                    return (
                      <div key={delivery.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {delivery.orderNumber && (
                              <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                #{delivery.orderNumber}
                              </span>
                            )}
                            <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>
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
                          <p className="text-xs text-slate-400 flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>Horário: {delivery.time}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <button
                            onClick={() => setNotesDeliveryId(delivery.id)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                            title="Observações da Corrida"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Observações</span>
                          </button>

                          {(delivery.status === 'active' || delivery.status === 'pending') && (
                            <button
                              onClick={() => setCustomerChatDeliveryId(delivery.id)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                              title="Chat com Cliente"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Chat Cliente</span>
                            </button>
                          )}

                          {(delivery.status === 'active' || delivery.status === 'pending') && (
                            <button
                              onClick={() => handleShareTracking(delivery.id)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
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

                          <span className={`font-black text-sm ml-auto sm:ml-0 ${delivery.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            R$ {Number(delivery.value || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB GPS NAVEGAÇÃO RENDERIZADA INTEGRADA NA ABA */}
        {activeTab === 'navigation' && (
          <div className="space-y-4">
            <RiderNavigationMap
              currentLocation={gpsCoords}
              destination={navDestination}
              defaultFullscreen={false}
            />
          </div>
        )}

        {/* TAB 2: ESCALAS */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <span>Minhas Escalas de Trabalho (Próximos 30 dias)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Estabelecimento</label>
                  <select
                    value={scheduleEstFilter}
                    onChange={(e) => setScheduleEstFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todos os Estabelecimentos</option>
                    {establishments.map(est => (
                      <option key={est.id} value={est.id}>{est.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Data</label>
                  <input
                    type="date"
                    value={scheduleDateFilter}
                    onChange={(e) => setScheduleDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {filteredFutureSchedules.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma escala futura encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFutureSchedules.map((sch) => {
                    const est = resolveEst(sch.establishmentId);
                    const isToday = sch.date === todayStr;

                    return (
                      <div 
                        key={sch.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isToday 
                            ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isToday && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  Hoje
                                </span>
                              )}
                              <h4 className="text-base font-bold text-slate-800">{est?.name || 'Estabelecimento'}</h4>
                            </div>

                            <p className="text-xs text-slate-600 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-indigo-600">Turno da {getShiftLabel(sch.shift)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-500">{sch.startTime}–{sch.endTime}</span>
                            </p>

                            {est?.address && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <span>{est.address.street}, {est.address.number} - {est.address.neighborhood}, {est.address.city}/{est.address.state}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                            <button
                              onClick={() => setActiveScheduleChatId(sch.id)}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Chat do Turno"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="hidden sm:inline">Chat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HISTÓRICO */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                <span>Histórico de Corridas</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
                  <select
                    value={historyEstFilter}
                    onChange={(e) => setHistoryEstFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    {establishments.map(est => (
                      <option key={est.id} value={est.id}>{est.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">De</label>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <div>
                  <p className="text-xs text-indigo-600 font-bold uppercase">Corridas Filtradas</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-0.5">{historyDeliveries.length}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase">Faturamento Total</p>
                  <p className="text-xl font-extrabold text-emerald-700 mt-0.5">R$ {historyTotalEarnings.toFixed(2)}</p>
                </div>
              </div>

              {historyDeliveries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {historyDeliveries.map((del) => {
                    const est = resolveEst(del.establishmentId);
                    return (
                      <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {del.orderNumber && (
                              <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                #{del.orderNumber}
                              </span>
                            )}
                            <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              del.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Cancelada'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <button
                            onClick={() => setNotesDeliveryId(del.id)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                          >
                            Observações
                          </button>
                          <span className={`font-black text-sm ${del.status === 'active' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
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
        )}

        {/* TAB 4: AVISOS / NOTIFICAÇÕES */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-indigo-600" />
                  <span>Central de Avisos e Notificações</span>
                </h2>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {unreadCount} não lida(s)
                  </span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Nenhum aviso recebido até o momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 rounded-xl border transition-all ${
                        !notif.read ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(notif.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0"
                            title="Marcar como lida"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Lida</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL PARA LANÇAR CORRIDA */}
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
                <input
                  type="text"
                  placeholder="Ex: 1042"
                  value={launchForm.orderNumber}
                  onChange={(e) => setLaunchForm({ ...launchForm, orderNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações / Instruções (Opcional)</label>
                <textarea
                  placeholder="Ex: Entregar na recepção, troco para R$ 50,00..."
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
        userRole="rider"
        userName={user?.name || 'Motoboy'}
        onSaveNotes={handleSaveNotes}
      />

      <CustomerChatModal
        isOpen={!!customerChatDeliveryId}
        onClose={() => setCustomerChatDeliveryId(null)}
        delivery={activeCustomerChatDelivery}
        onSendMessage={handleSendCustomerMessage}
        viewerRole="rider"
      />

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