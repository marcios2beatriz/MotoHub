"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Schedule, Delivery, RiderLocation } from '../utils/db';
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
  AlertTriangle
} from 'lucide-react';

import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import CustomerChatModal from '../components/CustomerChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => db.getCurrentUser());
  
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);

  const prevNotesRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

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
    const allSchedules = db.getSchedules();
    
    const riderSchedules = allSchedules.filter(s => {
      if (s.date !== todayStr) return false;
      if (s.riderId === currentUser.id) return true;
      const resolvedRider = db.resolveUser(s.riderId);
      return resolvedRider && resolvedRider.email.toLowerCase() === currentUser.email.toLowerCase();
    });
    setTodaySchedules(riderSchedules);

    const allDeliveries = db.getDeliveries();
    const riderDeliveries = allDeliveries.filter(d => {
      if (d.date !== todayStr) return false;
      if (d.riderId === currentUser.id) return true;
      const resolvedRider = db.resolveUser(d.riderId);
      return resolvedRider && resolvedRider.email.toLowerCase() === currentUser.email.toLowerCase();
    });
    setTodayDeliveries(riderDeliveries);
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

    // WatchPosition de alta precisão
    watchIdRef.current = navigator.geolocation.watchPosition(successCallback, errorCallback, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });

    // Fallback ativo de intervalo para garantir atualizações mesmo se o watchPosition falhar em segundo plano
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

  // REATIVAÇÃO ATIVA DO GPS AO MUDAR VISIBILIDADE (TELA APAGADA / MINIMIZADA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTracking) {
        // Se o app voltou a ficar visível e o rastreamento estava ativo, reinicia os sensores para acordá-los
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        if (fallbackIntervalRef.current !== null) {
          clearInterval(fallbackIntervalRef.current);
        }
        
        // Re-registra os sensores de GPS
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
                {user?.name || 'Carregando...'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Painel do Entregador</p>
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

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6">
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

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corridas</span>
            <p className="text-xl font-black text-slate-900 mt-1">{todayDeliveries.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ganhos</span>
            <p className="text-xl font-black text-slate-900 mt-1">R$ {completedValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Escalas Ativas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Seu Turno de Hoje
          </h3>

          {todaySchedules.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Você não tem escalas para hoje.</p>
          ) : (
            todaySchedules.map(s => {
              const est = db.resolveEstablishment(s.establishmentId);
              return (
                <div key={s.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{est?.address?.street || 'Sem endereço cadastrado'}</p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                      {s.shift}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveScheduleChatId(s.id)}
                    className="w-full py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat do Turno
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Lista de Corridas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Bike className="w-5 h-5 text-indigo-600" />
            Suas Corridas de Hoje
          </h3>

          <div className="space-y-3">
            {todayDeliveries.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma corrida lançada para você hoje.</p>
            ) : (
              todayDeliveries.map(d => (
                <div key={d.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">Pedido #{d.orderNumber || d.id.slice(-4)}</span>
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
                      className="flex-1 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Notas / Chat
                    </button>

                    <button
                      onClick={() => setCustomerChatDeliveryId(d.id)}
                      className="flex-1 py-2 bg-white hover:bg-emerald-50 text-emerald-600 border border-slate-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
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
              ))
            )}
          </div>
        </div>
      </main>

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
          schedule={todaySchedules.find(s => s.id === activeScheduleChatId) || null}
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