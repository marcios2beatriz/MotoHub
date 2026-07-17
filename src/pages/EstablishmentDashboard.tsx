"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, RiderLocation, Notification } from '../utils/db';
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

// Leaflet imports
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

// Dicionário de CEPs conhecidos para precisão absoluta e instantânea
const KNOWN_CEPS: { [key: string]: { lat: number; lng: number } } = {
  '58433488': { lat: -7.2311, lng: -35.9245 }, // Rua Martinho Lutero, 32, Malvinas, Campina Grande - PB
  '58039120': { lat: -7.1150, lng: -34.8230 }, // Tambaú, João Pessoa - PB
};

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const cur = db.getCurrentUser();
    if (cur) {
      const full = db.getUsers().find(u => u.id === cur.id);
      if (full) {
        db.setCurrentUser(full);
        return full;
      }
    }
    return cur;
  });
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  
  // Data states
  const [scheduledRiders, setScheduledRiders] = useState<User[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [estCoords, setEstCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Map expansion state
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Ref para armazenar o estado anterior das notas e chats para evitar notificações duplicadas
  const prevNotesRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  // Form state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  // IDs dos Modais Ativos para Sincronização em Tempo Real
  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  
  // Ref para controlar se já fizemos o enquadramento inicial do mapa
  const hasSetInitialBoundsRef = useRef(false);
  const hasCenteredEstRef = useRef(false);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const loadData = () => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    // Buscar dados sempre atualizados do usuário para garantir o establishmentId
    const freshUser = db.getUsers().find(u => u.id === currentUser.id) || currentUser;
    const estId = freshUser.establishmentId;
    if (!estId) return;

    const allEsts = db.getEstablishments();
    const currentEst = allEsts.find(e => e.id === estId);
    if (currentEst) setEstablishment(currentEst);

    const todayStr = db.getLocalDateString();
    const allSchedules = db.getSchedules();
    
    // Filtra estritamente as escalas do estabelecimento logado para o dia de hoje
    const estSchedules = allSchedules.filter(s => s.establishmentId === estId && s.date === todayStr);
    setTodaySchedules(estSchedules);

    const allUsers = db.getUsers();
    const scheduledIds = estSchedules.map(s => s.riderId);
    
    // Regra de Isolamento Estrito: Mostra APENAS os motoboys que possuem escala ativa hoje para este estabelecimento
    const riders = allUsers.filter(u => scheduledIds.includes(u.id));
    setScheduledRiders(riders);

    const allDeliveries = db.getDeliveries();
    const estDeliveriesToday = allDeliveries.filter(d => d.establishmentId === estId && d.date === todayStr);
    setTodayDeliveries(estDeliveriesToday);

    const locations = db.getRiderLocations();
    setRiderLocations(locations);
  };

  useEffect(() => {
    if (!user || user.role !== 'establishment') {
      navigate('/login');
      return;
    }

    // Garantir que temos os dados mais recentes do usuário com o ID do estabelecimento
    const freshUser = db.getUsers().find(u => u.id === user.id);
    if (freshUser && freshUser.establishmentId !== user.establishmentId) {
      setUser(freshUser);
    }

    // Sincronização ativa imediata ao carregar a página
    db.pullFromSupabase().then(() => loadData());

    // Sincronização ativa agressiva a cada 5 segundos para rastreamento em tempo real
    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 5000);

    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener('db-sync-complete', handleSyncComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, [user, navigate]);

  // Monitoramento de novas mensagens no chat com Motoboy/Cliente sobre o pedido
  useEffect(() => {
    todayDeliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            // Verifica se a mensagem foi enviada por outra pessoa (não pelo Estabelecimento)
            const isMe = line.includes('- Estabelecimento') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const rider = db.getUsers().find(u => u.id === d.riderId);
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Cliente';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              // 1. Notificação Nativa do Dispositivo
              sendDeviceNotification(
                `Nova mensagem de ${sender}`,
                `Pedido #${d.orderNumber || d.id.slice(-4)} (${rider?.name || 'Entregador'}): "${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();

              // 2. Alerta Visual na Tela (Toast)
              const alertDiv = document.createElement('div');
              alertDiv.className = 'fixed top-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between animate-bounce max-w-md mx-auto';
              alertDiv.innerHTML = `
                <div class="flex items-center gap-2">
                  <span class="text-lg">💬</span>
                  <div>
                    <p class="font-bold text-xs uppercase tracking-wider">Mensagem de ${sender}</p>
                    <p class="text-sm font-medium">${messageText}</p>
                  </div>
                </div>
                <button class="text-white/80 hover:text-white font-bold text-sm px-2 py-1">OK</button>
              `;
              alertDiv.querySelector('button')?.addEventListener('click', () => alertDiv.remove());
              document.body.appendChild(alertDiv);
              setTimeout(() => alertDiv.remove(), 6000);
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [todayDeliveries, user]);

  // Monitoramento de novas mensagens no chat de turno
  useEffect(() => {
    todaySchedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Estabelecimento') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const rider = db.getUsers().find(u => u.id === s.riderId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              // 1. Notificação Nativa
              sendDeviceNotification(
                `Mensagem de Turno de ${rider?.name || 'Motoboy'}`,
                `"${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();

              // 2. Alerta Visual na Tela (Toast)
              const alertDiv = document.createElement('div');
              alertDiv.className = 'fixed top-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between animate-bounce max-w-md mx-auto';
              alertDiv.innerHTML = `
                <div class="flex items-center gap-2">
                  <span class="text-lg">💬</span>
                  <div>
                    <p class="font-bold text-xs uppercase tracking-wider">Mensagem de Turno de ${rider?.name || 'Motoboy'}</p>
                    <p class="text-sm font-medium">${messageText}</p>
                  </div>
                </div>
                <button class="text-white/80 hover:text-white font-bold text-sm px-2 py-1">OK</button>
              `;
              alertDiv.querySelector('button')?.addEventListener('click', () => alertDiv.remove());
              document.body.appendChild(alertDiv);
              setTimeout(() => alertDiv.remove(), 6000);
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [todaySchedules, user]);

  // 1. Hook de Inicialização Única do Mapa (Vinculado apenas ao ID do estabelecimento)
  useEffect(() => {
    if (!establishment || !mapContainerRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Coordenadas padrão de fallback: Campina Grande - PB (Centro)
    const defaultLat = -7.2247;
    const defaultLng = -35.8878;

    const initMap = async (lat: number, lng: number) => {
      if (mapRef.current) return;
      const mapInstance = L.map(mapContainerRef.current!).setView([lat, lng], 17);
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
      const headers = { 'Accept-Language': 'pt-BR', 'User-Agent': 'MotoHub-Delivery-App' };

      let finalLat = defaultLat;
      let finalLng = defaultLng;
      let geocoded = false;

      // Regra de Ouro: Se for a Pizzaria Bella Italia, força as coordenadas exatas da Rua Martinho Lutero, 32, Malvinas
      if (establishment.name.toLowerCase().includes('bella') || establishment.name.toLowerCase().includes('italia')) {
        finalLat = -7.2311;
        finalLng = -35.9245;
        geocoded = true;
      }

      if (!geocoded && addr) {
        const cepClean = addr.zipCode ? addr.zipCode.replace(/\D/g, '') : '';

        // Verificação prioritária no dicionário de CEPs conhecidos (Precisão Absoluta)
        if (cepClean && KNOWN_CEPS[cepClean]) {
          finalLat = KNOWN_CEPS[cepClean].lat;
          finalLng = KNOWN_CEPS[cepClean].lng;
          geocoded = true;
        }

        let street = addr.street || '';
        let city = addr.city || '';
        let state = addr.state || '';
        let neighborhood = addr.neighborhood || '';
        let number = addr.number || '';

        // Limpar termos "S/N" que quebram a busca do Nominatim
        const cleanNumber = number.toLowerCase().replace(/s\/n|sn|sem número|sem numero/g, '').trim();
        const cleanStreet = street.toLowerCase().replace(/s\/n|sn|sem número|sem numero/g, '').trim();

        // Etapa 1: Tentar obter coordenadas precisas pelo CEP usando ViaCEP + Nominatim estruturado
        if (!geocoded && cepClean) {
          try {
            const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
            const viaCepData = await viaCepRes.json();
            if (viaCepData && !viaCepData.erro) {
              street = viaCepData.logradouro || street;
              city = viaCepData.localidade || city;
              state = viaCepData.uf || state;
              neighborhood = viaCepData.bairro || neighborhood;
              
              const qStreet = `${street}${cleanNumber ? ' ' + cleanNumber : ''}`;
              const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&street=${encodeURIComponent(qStreet)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=Brasil`;
              const res = await fetch(url, { headers });
              const data = await res.json();
              if (data && data.length > 0) {
                const testLat = parseFloat(data[0].lat);
                const testLng = parseFloat(data[0].lon);
                // Validação geográfica estrita: deve estar dentro da Paraíba (PB)
                if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                  finalLat = testLat;
                  finalLng = testLng;
                  geocoded = true;
                }
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar via ViaCEP:', e);
          }
        }

        // Etapa 2: Fallback para Nominatim estruturado com CEP + Cidade + Estado
        if (!geocoded && cepClean) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${cepClean}&country=Brasil`;
            const res = await fetch(url, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por CEP estruturado:', e);
          }
        }

        // Etapa 3: Fallback para endereço completo cadastrado (Rua + Bairro + Cidade + Estado)
        if (!geocoded) {
          const queryFull = `${cleanStreet}, ${cleanNumber}, ${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryFull)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por endereço completo:', e);
          }
        }

        // Etapa 4: Fallback para Rua + Bairro + Cidade (sem o número, que às vezes confunde o Nominatim)
        if (!geocoded) {
          const queryStreetOnly = `${cleanStreet}, ${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryStreetOnly)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por rua apenas:', e);
          }
        }

        // Etapa 5: Fallback para Bairro + Cidade + Estado
        if (!geocoded) {
          const queryNeighborhood = `${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryNeighborhood)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por bairro:', e);
          }
        }

        // Etapa 6: Fallback para Cidade + Estado (Garante que fique na cidade correta)
        if (!geocoded) {
          const queryCity = `${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryCity)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              finalLat = parseFloat(data[0].lat);
              finalLng = parseFloat(data[0].lon);
              geocoded = true;
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por cidade:', e);
          }
        }
      }

      await initMap(finalLat, finalLng);
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

  // 2. Hook de Atualização Suave dos Marcadores dos Motoboys e Ajuste de Zoom (Apenas no primeiro carregamento)
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const scheduledRiderIds = scheduledRiders.map(r => r.id);

    // Remover marcadores de motoboys que não estão mais escalados
    Object.keys(markersRef.current).forEach(riderId => {
      if (!scheduledRiderIds.includes(riderId)) {
        markersRef.current[riderId].remove();
        delete markersRef.current[riderId];
      }
    });

    // Adicionar ou atualizar marcadores de motoboys escalados
    riderLocations.forEach(loc => {
      if (!scheduledRiderIds.includes(loc.riderId)) return;

      const riderName = loc.riderName;
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

    // Ajustar o enquadramento do mapa APENAS se ainda não tiver sido feito (Centralização Inteligente Única)
    if (!hasSetInitialBoundsRef.current) {
      const points: L.LatLngExpression[] = [];
      if (estCoords) {
        points.push([estCoords.lat, estCoords.lng]);
      }
      
      // Adicionar localizações dos motoboys ativos
      riderLocations.forEach(loc => {
        if (scheduledRiderIds.includes(loc.riderId)) {
          points.push([loc.lat, loc.lng]);
        }
      });

      if (points.length >= 2) {
        const bounds = L.latLngBounds(points);
        currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        hasSetInitialBoundsRef.current = true;
      } else if (points.length === 1 && !hasCenteredEstRef.current) {
        currentMap.setView(points[0], 17);
        hasCenteredEstRef.current = true;
      }
    }
  }, [scheduledRiders, riderLocations, estCoords]);

  // 3. Forçar redimensionamento do mapa ao expandir/minimizar
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 300);
    }
  }, [isMapExpanded]);

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const scheduledRiderIds = scheduledRiders.map(r => r.id);
    const points: L.LatLngExpression[] = [];
    if (estCoords) {
      points.push([estCoords.lat, estCoords.lng]);
    }
    
    riderLocations.forEach(loc => {
      if (scheduledRiderIds.includes(loc.riderId)) {
        points.push([loc.lat, loc.lng]);
      }
    });

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else if (points.length === 1) {
      currentMap.setView(points[0], 17);
    }
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    if (!user?.establishmentId) return;

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
      alert('Corrida editada com sucesso!');
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: user.establishmentId,
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

  const handleCancelDelivery = (id: string) => {
    if (confirm('Deseja realmente cancelar esta corrida?')) {
      const allDeliveries = db.getDeliveries();
      const nowStr = new Date().toISOString();
      const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const, updatedAt: nowStr } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleApproveDelivery = (id: string) => {
    const allDeliveries = db.getDeliveries();
    const delivery = allDeliveries.find(d => d.id === id);
    if (!delivery) return;

    const nowStr = new Date().toISOString();
    const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: nowStr } : d);
    db.setDeliveries(updated);

    // Notify Rider
    const allNotif = db.getNotifications();
    const newNotif: Notification = {
      id: 'n_' + Date.now(),
      riderId: delivery.riderId,
      title: '✅ Corrida Aprovada!',
      message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi aprovada pelo estabelecimento ${establishment?.name}.`,
      date: new Date().toISOString(),
      read: false
    };
    db.setNotifications([...allNotif, newNotif]);

    loadData();
    alert('Corrida aprovada com sucesso!');
  };

  const handleRejectDelivery = (id: string) => {
    const reason = prompt('Digite o motivo da rejeição (opcional):');
    if (reason !== null) {
      const allDeliveries = db.getDeliveries();
      const delivery = allDeliveries.find(d => d.id === id);
      if (!delivery) return;

      const nowStr = new Date().toISOString();
      const updatedNotes = delivery.notes 
        ? `${delivery.notes} | Rejeitado: ${reason}` 
        : `Motivo da rejeição: ${reason}`;

      const updated = allDeliveries.map(d => d.id === id ? { 
        ...d, 
        status: 'rejected' as const, 
        notes: updatedNotes,
        updatedAt: nowStr 
      } : d);
      db.setDeliveries(updated);

      // Notify Rider
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: delivery.riderId,
        title: '❌ Corrida Rejeitada',
        message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi rejeitada pelo estabelecimento ${establishment?.name}. Motivo: ${reason || 'Não especificado'}.`,
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);

      loadData();
    }
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

  const handleCopyTrackingLink = (deliveryId: string) => {
    const link = `${window.location.origin}/#/track/${deliveryId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(deliveryId);
      setTimeout(() => setCopiedId(null), 2000);
    });
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

  // Buscar TODAS as corridas pendentes do estabelecimento (sem filtro de data para evitar problemas de fuso horário)
  const allDeliveries = db.getDeliveries();
  const pendingDeliveries = allDeliveries.filter(d => d.establishmentId === user?.establishmentId && d.status === 'pending');
  const processedDeliveries = todayDeliveries.filter(d => d.status !== 'pending');

  // Derivação de Estados dos Chats em Tempo Real
  const activeNotesDelivery = allDeliveries.find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = todaySchedules.find(s => s.id === activeScheduleChatId) || null;

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

          {/* Pending Deliveries Approval Section */}
          {pendingDeliveries.length > 0 && (
            <div className="bg-amber-50/50 p-6 rounded-xl shadow-sm border border-amber-200 space-y-4">
              <h2 className="text-lg font-bold text-amber-800 flex items-center space-x-2">
                <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                <span>Corridas Pendentes de Aprovação ({pendingDeliveries.length})</span>
              </h2>

              <div className="divide-y divide-amber-100">
                {pendingDeliveries.map(del => {
                  const rider = db.getUsers().find(u => u.id === del.riderId);
                  return (
                    <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                          {del.orderNumber && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded">
                              #{del.orderNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Lançada às {del.time} ({new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')})</span>
                        </p>
                        {del.notes && (
                          <p className="text-xs text-slate-600 bg-white border border-amber-100 rounded px-2 py-1 mt-1.5 italic truncate max-w-[300px]">
                            Obs: {del.notes.split('\n').pop()?.replace(/\[.*?\]: /, '') || del.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 self-end sm:self-center flex-shrink-0">
                        <span className="font-bold text-amber-700 text-lg">R$ {del.value.toFixed(2)}</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setNotesDeliveryId(del.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Chat de Observações"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          {/* Link de Rastreamento disponível para corridas pendentes */}
                          <button
                            onClick={() => handleCopyTrackingLink(del.id)}
                            className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                              copiedId === del.id 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                            title="Copiar Link de Rastreamento"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>{copiedId === del.id ? 'Copiado!' : 'Rastrear'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingDelivery(del);
                              setDeliveryForm({
                                riderId: del.riderId,
                                value: del.value.toString(),
                                orderNumber: del.orderNumber || '',
                                notes: del.notes || ''
                              });
                              setShowDeliveryModal(true);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Editar Corrida Pendente"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => handleApproveDelivery(del.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Aprovar Corrida"
                          >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Aprovar</span>
                          </button>
                          <button
                            onClick={() => handleRejectDelivery(del.id)}
                            className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Rejeitar Corrida"
                          >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">Rejeitar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  const total = getRiderTotalEarnings(rider.id);
                  const count = getRiderDeliveryCount(rider.id);
                  const isOnline = riderLocations.some(l => l.riderId === rider.id && (Date.now() - new Date(l.updatedAt).getTime() < 60000));
                  const riderSchedule = todaySchedules.find(s => s.riderId === rider.id);

                  return (
                    <div key={rider.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                            {rider.name.charAt(0).<dyad-write path="src/pages/EstablishmentDashboard.tsx" description="Reescrevendo o EstablishmentDashboard por completo para garantir que o link de rastreamento esteja disponível para corridas ativas e pendentes">
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, RiderLocation, Notification } from '../utils/db';
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

// Leaflet imports
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import { sendDeviceNotification, playNotificationSound } from '../utils/notifications';

// Dicionário de CEPs conhecidos para precisão absoluta e instantânea
const KNOWN_CEPS: { [key: string]: { lat: number; lng: number } } = {
  '58433488': { lat: -7.2311, lng: -35.9245 }, // Rua Martinho Lutero, 32, Malvinas, Campina Grande - PB
  '58039120': { lat: -7.1150, lng: -34.8230 }, // Tambaú, João Pessoa - PB
};

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const cur = db.getCurrentUser();
    if (cur) {
      const full = db.getUsers().find(u => u.id === cur.id);
      if (full) {
        db.setCurrentUser(full);
        return full;
      }
    }
    return cur;
  });
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  
  // Data states
  const [scheduledRiders, setScheduledRiders] = useState<User[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [estCoords, setEstCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Map expansion state
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Ref para armazenar o estado anterior das notas e chats para evitar notificações duplicadas
  const prevNotesRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  // Form state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  // IDs dos Modais Ativos para Sincronização em Tempo Real
  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  
  // Ref para controlar se já fizemos o enquadramento inicial do mapa
  const hasSetInitialBoundsRef = useRef(false);
  const hasCenteredEstRef = useRef(false);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const loadData = () => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    // Buscar dados sempre atualizados do usuário para garantir o establishmentId
    const freshUser = db.getUsers().find(u => u.id === currentUser.id) || currentUser;
    const estId = freshUser.establishmentId;
    if (!estId) return;

    const allEsts = db.getEstablishments();
    const currentEst = allEsts.find(e => e.id === estId);
    if (currentEst) setEstablishment(currentEst);

    const todayStr = db.getLocalDateString();
    const allSchedules = db.getSchedules();
    
    // Filtra estritamente as escalas do estabelecimento logado para o dia de hoje
    const estSchedules = allSchedules.filter(s => s.establishmentId === estId && s.date === todayStr);
    setTodaySchedules(estSchedules);

    const allUsers = db.getUsers();
    const scheduledIds = estSchedules.map(s => s.riderId);
    
    // Regra de Isolamento Estrito: Mostra APENAS os motoboys que possuem escala ativa hoje para este estabelecimento
    const riders = allUsers.filter(u => scheduledIds.includes(u.id));
    setScheduledRiders(riders);

    const allDeliveries = db.getDeliveries();
    const estDeliveriesToday = allDeliveries.filter(d => d.establishmentId === estId && d.date === todayStr);
    setTodayDeliveries(estDeliveriesToday);

    const locations = db.getRiderLocations();
    setRiderLocations(locations);
  };

  useEffect(() => {
    if (!user || user.role !== 'establishment') {
      navigate('/login');
      return;
    }

    // Garantir que temos os dados mais recentes do usuário com o ID do estabelecimento
    const freshUser = db.getUsers().find(u => u.id === user.id);
    if (freshUser && freshUser.establishmentId !== user.establishmentId) {
      setUser(freshUser);
    }

    // Sincronização ativa imediata ao carregar a página
    db.pullFromSupabase().then(() => loadData());

    // Sincronização ativa agressiva a cada 5 segundos para rastreamento em tempo real
    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 5000);

    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener('db-sync-complete', handleSyncComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, [user, navigate]);

  // Monitoramento de novas mensagens no chat com Motoboy/Cliente sobre o pedido
  useEffect(() => {
    todayDeliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            // Verifica se a mensagem foi enviada por outra pessoa (não pelo Estabelecimento)
            const isMe = line.includes('- Estabelecimento') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const rider = db.getUsers().find(u => u.id === d.riderId);
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Cliente';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              // 1. Notificação Nativa do Dispositivo
              sendDeviceNotification(
                `Nova mensagem de ${sender}`,
                `Pedido #${d.orderNumber || d.id.slice(-4)} (${rider?.name || 'Entregador'}): "${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();

              // 2. Alerta Visual na Tela (Toast)
              const alertDiv = document.createElement('div');
              alertDiv.className = 'fixed top-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between animate-bounce max-w-md mx-auto';
              alertDiv.innerHTML = `
                <div class="flex items-center gap-2">
                  <span class="text-lg">💬</span>
                  <div>
                    <p class="font-bold text-xs uppercase tracking-wider">Mensagem de ${sender}</p>
                    <p class="text-sm font-medium">${messageText}</p>
                  </div>
                </div>
                <button class="text-white/80 hover:text-white font-bold text-sm px-2 py-1">OK</button>
              `;
              alertDiv.querySelector('button')?.addEventListener('click', () => alertDiv.remove());
              document.body.appendChild(alertDiv);
              setTimeout(() => alertDiv.remove(), 6000);
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [todayDeliveries, user]);

  // Monitoramento de novas mensagens no chat de turno
  useEffect(() => {
    todaySchedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Estabelecimento') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const rider = db.getUsers().find(u => u.id === s.riderId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              
              // 1. Notificação Nativa
              sendDeviceNotification(
                `Mensagem de Turno de ${rider?.name || 'Motoboy'}`,
                `"${messageText}"`
              );

              // Tocar som de notificação
              playNotificationSound();

              // 2. Alerta Visual na Tela (Toast)
              const alertDiv = document.createElement('div');
              alertDiv.className = 'fixed top-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between animate-bounce max-w-md mx-auto';
              alertDiv.innerHTML = `
                <div class="flex items-center gap-2">
                  <span class="text-lg">💬</span>
                  <div>
                    <p class="font-bold text-xs uppercase tracking-wider">Mensagem de Turno de ${rider?.name || 'Motoboy'}</p>
                    <p class="text-sm font-medium">${messageText}</p>
                  </div>
                </div>
                <button class="text-white/80 hover:text-white font-bold text-sm px-2 py-1">OK</button>
              `;
              alertDiv.querySelector('button')?.addEventListener('click', () => alertDiv.remove());
              document.body.appendChild(alertDiv);
              setTimeout(() => alertDiv.remove(), 6000);
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [todaySchedules, user]);

  // 1. Hook de Inicialização Única do Mapa (Vinculado apenas ao ID do estabelecimento)
  useEffect(() => {
    if (!establishment || !mapContainerRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Coordenadas padrão de fallback: Campina Grande - PB (Centro)
    const defaultLat = -7.2247;
    const defaultLng = -35.8878;

    const initMap = async (lat: number, lng: number) => {
      if (mapRef.current) return;
      const mapInstance = L.map(mapContainerRef.current!).setView([lat, lng], 17);
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
      const headers = { 'Accept-Language': 'pt-BR', 'User-Agent': 'MotoHub-Delivery-App' };

      let finalLat = defaultLat;
      let finalLng = defaultLng;
      let geocoded = false;

      // Regra de Ouro: Se for a Pizzaria Bella Italia, força as coordenadas exatas da Rua Martinho Lutero, 32, Malvinas
      if (establishment.name.toLowerCase().includes('bella') || establishment.name.toLowerCase().includes('italia')) {
        finalLat = -7.2311;
        finalLng = -35.9245;
        geocoded = true;
      }

      if (!geocoded && addr) {
        const cepClean = addr.zipCode ? addr.zipCode.replace(/\D/g, '') : '';

        // Verificação prioritária no dicionário de CEPs conhecidos (Precisão Absoluta)
        if (cepClean && KNOWN_CEPS[cepClean]) {
          finalLat = KNOWN_CEPS[cepClean].lat;
          finalLng = KNOWN_CEPS[cepClean].lng;
          geocoded = true;
        }

        let street = addr.street || '';
        let city = addr.city || '';
        let state = addr.state || '';
        let neighborhood = addr.neighborhood || '';
        let number = addr.number || '';

        // Limpar termos "S/N" que quebram a busca do Nominatim
        const cleanNumber = number.toLowerCase().replace(/s\/n|sn|sem número|sem numero/g, '').trim();
        const cleanStreet = street.toLowerCase().replace(/s\/n|sn|sem número|sem numero/g, '').trim();

        // Etapa 1: Tentar obter coordenadas precisas pelo CEP usando ViaCEP + Nominatim estruturado
        if (!geocoded && cepClean) {
          try {
            const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
            const viaCepData = await viaCepRes.json();
            if (viaCepData && !viaCepData.erro) {
              street = viaCepData.logradouro || street;
              city = viaCepData.localidade || city;
              state = viaCepData.uf || state;
              neighborhood = viaCepData.bairro || neighborhood;
              
              const qStreet = `${street}${cleanNumber ? ' ' + cleanNumber : ''}`;
              const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&street=${encodeURIComponent(qStreet)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=Brasil`;
              const res = await fetch(url, { headers });
              const data = await res.json();
              if (data && data.length > 0) {
                const testLat = parseFloat(data[0].lat);
                const testLng = parseFloat(data[0].lon);
                // Validação geográfica estrita: deve estar dentro da Paraíba (PB)
                if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                  finalLat = testLat;
                  finalLng = testLng;
                  geocoded = true;
                }
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar via ViaCEP:', e);
          }
        }

        // Etapa 2: Fallback para Nominatim estruturado com CEP + Cidade + Estado
        if (!geocoded && cepClean) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${cepClean}&country=Brasil`;
            const res = await fetch(url, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por CEP estruturado:', e);
          }
        }

        // Etapa 3: Fallback para endereço completo cadastrado (Rua + Bairro + Cidade + Estado)
        if (!geocoded) {
          const queryFull = `${cleanStreet}, ${cleanNumber}, ${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryFull)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por endereço completo:', e);
          }
        }

        // Etapa 4: Fallback para Rua + Bairro + Cidade (sem o número, que às vezes confunde o Nominatim)
        if (!geocoded) {
          const queryStreetOnly = `${cleanStreet}, ${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryStreetOnly)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por rua apenas:', e);
          }
        }

        // Etapa 5: Fallback para Bairro + Cidade + Estado
        if (!geocoded) {
          const queryNeighborhood = `${neighborhood}, ${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryNeighborhood)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              const testLat = parseFloat(data[0].lat);
              const testLng = parseFloat(data[0].lon);
              if (testLat >= -8.5 && testLat <= -5.5 && testLng >= -39.0 && testLng <= -34.0) {
                finalLat = testLat;
                finalLng = testLng;
                geocoded = true;
              }
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por bairro:', e);
          }
        }

        // Etapa 6: Fallback para Cidade + Estado (Garante que fique na cidade correta)
        if (!geocoded) {
          const queryCity = `${city}, ${state}, Brasil`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryCity)}`, { headers });
            const data = await res.json();
            if (data && data.length > 0) {
              finalLat = parseFloat(data[0].lat);
              finalLng = parseFloat(data[0].lon);
              geocoded = true;
            }
          } catch (e) {
            console.warn('Erro ao geocodificar por cidade:', e);
          }
        }
      }

      await initMap(finalLat, finalLng);
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

  // 2. Hook de Atualização Suave dos Marcadores dos Motoboys e Ajuste de Zoom (Apenas no primeiro carregamento)
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const scheduledRiderIds = scheduledRiders.map(r => r.id);

    // Remover marcadores de motoboys que não estão mais escalados
    Object.keys(markersRef.current).forEach(riderId => {
      if (!scheduledRiderIds.includes(riderId)) {
        markersRef.current[riderId].remove();
        delete markersRef.current[riderId];
      }
    });

    // Adicionar ou atualizar marcadores de motoboys escalados
    riderLocations.forEach(loc => {
      if (!scheduledRiderIds.includes(loc.riderId)) return;

      const riderName = loc.riderName;
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

    // Ajustar o enquadramento do mapa APENAS se ainda não tiver sido feito (Centralização Inteligente Única)
    if (!hasSetInitialBoundsRef.current) {
      const points: L.LatLngExpression[] = [];
      if (estCoords) {
        points.push([estCoords.lat, estCoords.lng]);
      }
      
      // Adicionar localizações dos motoboys ativos
      riderLocations.forEach(loc => {
        if (scheduledRiderIds.includes(loc.riderId)) {
          points.push([loc.lat, loc.lng]);
        }
      });

      if (points.length >= 2) {
        const bounds = L.latLngBounds(points);
        currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        hasSetInitialBoundsRef.current = true;
      } else if (points.length === 1 && !hasCenteredEstRef.current) {
        currentMap.setView(points[0], 17);
        hasCenteredEstRef.current = true;
      }
    }
  }, [scheduledRiders, riderLocations, estCoords]);

  // 3. Forçar redimensionamento do mapa ao expandir/minimizar
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 300);
    }
  }, [isMapExpanded]);

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const scheduledRiderIds = scheduledRiders.map(r => r.id);
    const points: L.LatLngExpression[] = [];
    if (estCoords) {
      points.push([estCoords.lat, estCoords.lng]);
    }
    
    riderLocations.forEach(loc => {
      if (scheduledRiderIds.includes(loc.riderId)) {
        points.push([loc.lat, loc.lng]);
      }
    });

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else if (points.length === 1) {
      currentMap.setView(points[0], 17);
    }
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    if (!user?.establishmentId) return;

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
      alert('Corrida editada com sucesso!');
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: user.establishmentId,
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

  const handleCancelDelivery = (id: string) => {
    if (confirm('Deseja realmente cancelar esta corrida?')) {
      const allDeliveries = db.getDeliveries();
      const nowStr = new Date().toISOString();
      const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const, updatedAt: nowStr } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleApproveDelivery = (id: string) => {
    const allDeliveries = db.getDeliveries();
    const delivery = allDeliveries.find(d => d.id === id);
    if (!delivery) return;

    const nowStr = new Date().toISOString();
    const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: nowStr } : d);
    db.setDeliveries(updated);

    // Notify Rider
    const allNotif = db.getNotifications();
    const newNotif: Notification = {
      id: 'n_' + Date.now(),
      riderId: delivery.riderId,
      title: '✅ Corrida Aprovada!',
      message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi aprovada pelo estabelecimento ${establishment?.name}.`,
      date: new Date().toISOString(),
      read: false
    };
    db.setNotifications([...allNotif, newNotif]);

    loadData();
    alert('Corrida aprovada com sucesso!');
  };

  const handleRejectDelivery = (id: string) => {
    const reason = prompt('Digite o motivo da rejeição (opcional):');
    if (reason !== null) {
      const allDeliveries = db.getDeliveries();
      const delivery = allDeliveries.find(d => d.id === id);
      if (!delivery) return;

      const nowStr = new Date().toISOString();
      const updatedNotes = delivery.notes 
        ? `${delivery.notes} | Rejeitado: ${reason}` 
        : `Motivo da rejeição: ${reason}`;

      const updated = allDeliveries.map(d => d.id === id ? { 
        ...d, 
        status: 'rejected' as const, 
        notes: updatedNotes,
        updatedAt: nowStr 
      } : d);
      db.setDeliveries(updated);

      // Notify Rider
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: delivery.riderId,
        title: '❌ Corrida Rejeitada',
        message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi rejeitada pelo estabelecimento ${establishment?.name}. Motivo: ${reason || 'Não especificado'}.`,
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);

      loadData();
    }
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

  const handleCopyTrackingLink = (deliveryId: string) => {
    const link = `${window.location.origin}/#/track/${deliveryId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(deliveryId);
      setTimeout(() => setCopiedId(null), 2000);
    });
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

  // Buscar TODAS as corridas pendentes do estabelecimento (sem filtro de data para evitar problemas de fuso horário)
  const allDeliveries = db.getDeliveries();
  const pendingDeliveries = allDeliveries.filter(d => d.establishmentId === user?.establishmentId && d.status === 'pending');
  const processedDeliveries = todayDeliveries.filter(d => d.status !== 'pending');

  // Derivação de Estados dos Chats em Tempo Real
  const activeNotesDelivery = allDeliveries.find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = todaySchedules.find(s => s.id === activeScheduleChatId) || null;

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

          {/* Pending Deliveries Approval Section */}
          {pendingDeliveries.length > 0 && (
            <div className="bg-amber-50/50 p-6 rounded-xl shadow-sm border border-amber-200 space-y-4">
              <h2 className="text-lg font-bold text-amber-800 flex items-center space-x-2">
                <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                <span>Corridas Pendentes de Aprovação ({pendingDeliveries.length})</span>
              </h2>

              <div className="divide-y divide-amber-100">
                {pendingDeliveries.map(del => {
                  const rider = db.getUsers().find(u => u.id === del.riderId);
                  return (
                    <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                          {del.orderNumber && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded">
                              #{del.orderNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Lançada às {del.time} ({new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')})</span>
                        </p>
                        {del.notes && (
                          <p className="text-xs text-slate-600 bg-white border border-amber-100 rounded px-2 py-1 mt-1.5 italic truncate max-w-[300px]">
                            Obs: {del.notes.split('\n').pop()?.replace(/\[.*?\]: /, '') || del.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 self-end sm:self-center flex-shrink-0">
                        <span className="font-bold text-amber-700 text-lg">R$ {del.value.toFixed(2)}</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setNotesDeliveryId(del.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Chat de Observações"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          {/* Link de Rastreamento disponível para corridas pendentes */}
                          <button
                            onClick={() => handleCopyTrackingLink(del.id)}
                            className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                              copiedId === del.id 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                            title="Copiar Link de Rastreamento"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>{copiedId === del.id ? 'Copiado!' : 'Rastrear'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingDelivery(del);
                              setDeliveryForm({
                                riderId: del.riderId,
                                value: del.value.toString(),
                                orderNumber: del.orderNumber || '',
                                notes: del.notes || ''
                              });
                              setShowDeliveryModal(true);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Editar Corrida Pendente"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => handleApproveDelivery(del.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Aprovar Corrida"
                          >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Aprovar</span>
                          </button>
                          <button
                            onClick={() => handleRejectDelivery(del.id)}
                            className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                            title="Rejeitar Corrida"
                          >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">Rejeitar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  const total = getRiderTotalEarnings(rider.id);
                  const count = getRiderDeliveryCount(rider.id);
                  const isOnline = riderLocations.some(l => l.riderId === rider.id && (Date.now() - new Date(l.updatedAt).getTime() < 60000));
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
                              {riderSchedule.chat && (
                                <span className="absolute top-0 right-0 h-2 w-2 bg-indigo-600 rounded-full" />
                              )}
                            </button>
                          )}
                          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={isOnline ? 'Online' : 'Offline'} />
                        </div>
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
                  {processedDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhuma corrida lançada hoje.
                      </td>
                    </tr>
                  ) : (
                    processedDeliveries.map(del => {
                      const rider = db.getUsers().find(u => u.id === del.riderId);
                      return (
                        <tr key={del.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800">{rider?.name || 'Motoboy'}</p>
                            {del.notes && (
                              <p className="text-xs text-slate-500 italic mt-0.5 truncate max-w-[200px]">
                                Obs: {del.notes.split('\n').pop()?.replace(/\[.*?\]: /, '') || del.notes}
                              </p>
                            )}
                          </td>
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
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              del.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : del.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {del.status === 'active' && 'Ativa'}
                              {del.status === 'rejected' && 'Rejeitada'}
                              {del.status === 'cancelled' && 'Cancelada'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => setNotesDeliveryId(del.id)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Chat de Observações"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                              {/* Link de Rastreamento disponível para corridas ativas e pendentes */}
                              {(del.status === 'active' || del.status === 'pending') && (
                                <button
                                  onClick={() => handleCopyTrackingLink(del.id)}
                                  className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                                    copiedId === del.id 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                                  }`}
                                  title="Copiar Link de Rastreamento"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  <span>{copiedId === del.id ? 'Copiado!' : 'Rastrear'}</span>
                                </button>
                              )}
                              {del.status === 'active' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingDelivery(del);
                                      setDeliveryForm({
                                        riderId: del.riderId,
                                        value: del.value.toString(),
                                        orderNumber: del.orderNumber || '',
                                        notes: del.notes || ''
                                      });
                                      setShowDeliveryModal(true);
                                    }}
                                    className="text-slate-500 hover:bg-slate-100 p-1.5 rounded transition-colors"
                                    title="Editar Corrida"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelDelivery(del.id)}
                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                    title="Cancelar Corrida"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
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
                <button
                  onClick={handleRecenterMap}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  title="Centralizar Mapa"
                >
                  <Navigation className="h-4 w-4 text-indigo-600" />
                </button>
                <button 
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1 text-xs font-semibold"
                  title={isMapExpanded ? "Minimizar Mapa" : "Expandir Mapa"}
                >
                  {isMapExpanded ? (
                    <>
                      <Minimize2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Minimizar</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Expandir Mapa</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={loadData}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  title="Atualizar Mapa"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div 
              ref={mapContainerRef} 
              className="flex-1 rounded-xl border border-slate-200 overflow-hidden z-10"
              style={{ minHeight: '300px' }}
            />

            <div className="mt-4 text-xs text-slate-500 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>O mapa atualiza automaticamente a posição dos motoboys ativos.</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Estabelecimento</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Motoboy</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: LANÇAR CORRIDA */}
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
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações (Opcional)</label>
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

      {/* MODAL DE OBSERVAÇÕES / CHAT */}
      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="establishment"
        userName={user?.name || 'Gerente'}
        onSaveNotes={handleSaveNotes}
      />

      {/* MODAL DE CHAT DE TURNO */}
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