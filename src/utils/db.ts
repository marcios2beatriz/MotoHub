import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase utilizando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'establishment' | 'rider';
  active: boolean;
  createdAt?: string; // Tornou-se opcional para evitar erros de compilação
  phone: string;
  cpf: string;
  passwordHash: string;
  mustResetPassword?: boolean;
  establishmentId?: string;
  updatedAt?: string;
}

export interface Establishment {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  phone: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt?: string; // Tornou-se opcional para evitar erros de compilação
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  shift: 'morning' | 'afternoon' | 'night';
  startTime: string;
  endTime: string;
  chat?: string; // Histórico de chat do turno
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Delivery {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  value: number;
  status: 'pending' | 'active' | 'rejected' | 'cancelled';
  scheduleId?: string;
  orderNumber?: string;
  notes?: string; // Chat/Observações com o estabelecimento
  customerChat?: string; // Chat com o cliente final
  updatedAt?: string;
  paid?: boolean;
}

export interface Notification {
  id: string;
  riderId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface PartnerRequest {
  id: string;
  establishmentName: string;
  ownerName: string;
  phone: string;
  address: string;
  status: 'pending' | 'contacted';
  createdAt: string;
}

export interface RiderLocation {
  riderId: string;
  riderName: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

// Chaves para o LocalStorage
const KEYS = {
  USERS: 'delivery_system_users',
  ESTABLISHMENTS: 'delivery_system_establishments',
  SCHEDULES: 'delivery_system_schedules',
  DELIVERIES: 'delivery_system_deliveries',
  NOTIFICATIONS: 'delivery_system_notifications',
  CURRENT_USER: 'delivery_system_current_user',
  RIDER_LOCATIONS: 'delivery_system_rider_locations',
  PARTNER_REQUESTS: 'delivery_system_partner_requests'
};

// Helper para mesclar strings de chat sem duplicar mensagens
function mergeChatStrings(localChat: string | undefined, remoteChat: string | undefined): string {
  if (!localChat) return remoteChat || '';
  if (!remoteChat) return localChat || '';
  
  const localLines = localChat.split('\n').map(l => l.trim()).filter(Boolean);
  const remoteLines = remoteChat.split('\n').map(l => l.trim()).filter(Boolean);
  
  const uniqueLines = Array.from(new Set([...localLines, ...remoteLines]));
  return uniqueLines.join('\n');
}

export const db = {
  // --- LOCAL STORAGE GETTERS & SETTERS ---
  getUsers(): User[] {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  setUsers(users: User[]) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    this.syncUsersToSupabase(users);
  },

  getEstablishments(): Establishment[] {
    const data = localStorage.getItem(KEYS.ESTABLISHMENTS);
    return data ? JSON.parse(data) : [];
  },
  setEstablishments(ests: Establishment[]) {
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    this.syncEstablishmentsToSupabase(ests);
  },

  getSchedules(): Schedule[] {
    const data = localStorage.getItem(KEYS.SCHEDULES);
    return data ? JSON.parse(data) : [];
  },
  setSchedules(schedules: Schedule[]) {
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    this.syncToSupabase();
  },

  getDeliveries(): Delivery[] {
    const data = localStorage.getItem(KEYS.DELIVERIES);
    return data ? JSON.parse(data) : [];
  },
  setDeliveries(deliveries: Delivery[]) {
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    this.syncToSupabase();
  },

  getNotifications(): Notification[] {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  },
  setNotifications(notifications: Notification[]) {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  },

  getPartnerRequests(): PartnerRequest[] {
    const data = localStorage.getItem(KEYS.PARTNER_REQUESTS);
    return data ? JSON.parse(data) : [];
  },
  setPartnerRequests(requests: PartnerRequest[]) {
    localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(requests));
    this.syncPartnerRequestsToSupabase(requests);
  },

  getCurrentUser(): User | null {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },
  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // --- RESOLVERS & HELPERS ---
  resolveUser(id: string): User | undefined {
    return this.getUsers().find(u => u.id === id);
  },

  resolveEstablishment(id: string): Establishment | undefined {
    return this.getEstablishments().find(e => e.id === id);
  },

  generateUniqueDummyCpf(): string {
    const rand = () => Math.floor(Math.random() * 10);
    return `000.000.000-${rand()}${rand()}`;
  },

  async deleteUser(id: string) {
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    try {
      await supabase.from('users').delete().eq('id', id);
    } catch (e) {
      console.error('Erro ao deletar usuário do Supabase:', e);
    }
  },

  async deleteEstablishment(id: string) {
    const ests = this.getEstablishments().filter(e => e.id !== id);
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    try {
      await supabase.from('establishments').delete().eq('id', id);
    } catch (e) {
      console.error('Erro ao deletar estabelecimento do Supabase:', e);
    }
  },

  // --- RIDER REAL-TIME LOCATION ---
  updateRiderLocation(riderId: string, riderName: string, lat: number, lng: number) {
    const locations = this.getRiderLocationsRecord();
    const updated = {
      ...locations,
      [riderId]: {
        riderId,
        riderName,
        lat,
        lng,
        updatedAt: new Date().toISOString()
      }
    };
    localStorage.setItem(KEYS.RIDER_LOCATIONS, JSON.stringify(updated));
    
    // Envia para o Supabase em background
    supabase.from('rider_locations').upsert({
      rider_id: riderId,
      rider_name: riderName,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.warn('Erro ao sincronizar localização com Supabase:', error);
    });
  },

  getRiderLocationsRecord(): Record<string, RiderLocation> {
    const data = localStorage.getItem(KEYS.RIDER_LOCATIONS);
    return data ? JSON.parse(data) : {};
  },

  getRiderLocations(): RiderLocation[] {
    return Object.values(this.getRiderLocationsRecord());
  },

  // --- SUPABASE SYNCHRONIZATION ---
  async pullFromSupabase() {
    try {
      // 1. Sincronizar Usuários
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) {
        const mappedUsers: User[] = usersData.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          createdAt: u.created_at,
          phone: u.phone || '',
          cpf: u.cpf || '',
          passwordHash: u.password_hash || '',
          mustResetPassword: u.must_reset_password || false,
          establishmentId: u.establishment_id || undefined,
          updatedAt: u.updated_at
        }));
        localStorage.setItem(KEYS.USERS, JSON.stringify(mappedUsers));
      }

      // 2. Sincronizar Estabelecimentos
      const { data: estsData } = await supabase.from('establishments').select('*');
      if (estsData) {
        const mappedEsts: Establishment[] = estsData.map(e => ({
          id: e.id,
          name: e.name,
          email: e.email,
          active: e.active,
          phone: e.phone || '',
          address: e.address ? JSON.parse(e.address) : { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' },
          createdAt: e.created_at,
          updatedAt: e.updated_at
        }));
        localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(mappedEsts));
      }

      // 3. Sincronizar Escalas (Schedules)
      const { data: schData } = await supabase.from('schedules').select('*');
      if (schData) {
        const localSchedules = this.getSchedules();
        const mappedSchedules: Schedule[] = schData.map(s => {
          const local = localSchedules.find(l => l.id === s.id);
          return {
            id: s.id,
            riderId: s.rider_id,
            establishment_id: s.establishment_id,
            date: s.date,
            shift: s.shift,
            startTime: s.start_time,
            endTime: s.end_time,
            chat: mergeChatStrings(local?.chat, s.chat),
            createdBy: s.created_by || undefined,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          };
        });
        localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(mappedSchedules));
      }

      // 4. Sincronizar Corridas (Deliveries) com Lógica de Mesclagem Robusta
      const { data: delData } = await supabase.from('deliveries').select('*');
      if (delData) {
        const localDeliveries = this.getDeliveries();
        
        const mappedDeliveries: Delivery[] = delData.map(d => {
          const local = localDeliveries.find(l => l.id === d.id);
          
          // Decodificação segura do order_number que pode conter metadados serializados
          let orderNumber = d.order_number || undefined;
          let notes = d.notes || undefined;
          let customerChat = d.customer_chat || undefined;
          let updatedAt = d.updated_at;

          if (d.order_number && d.order_number.startsWith('{')) {
            try {
              const parsed = JSON.parse(d.order_number);
              orderNumber = parsed.orderNumber || undefined;
              notes = parsed.notes || undefined;
              customerChat = parsed.customerChat || undefined;
              updatedAt = parsed.updatedAt || d.updated_at;
            } catch (e) {
              // Fallback se falhar
              if (d.order_number.includes('|')) {
                const parts = d.order_number.split('|');
                orderNumber = parts[0] || undefined;
                notes = parts[1] || undefined;
                customerChat = parts[2] || undefined;
              }
            }
          }

          // --- REGRA DE OURO DE MESCLAGEM (PREVENÇÃO DE RETORNO A PENDENTE) ---
          let finalStatus: 'pending' | 'active' | 'rejected' | 'cancelled' = d.status;
          
          if (local) {
            const isRemoteResolved = ['active', 'rejected', 'cancelled'].includes(d.status);
            const isLocalResolved = ['active', 'rejected', 'cancelled'].includes(local.status);

            if (isRemoteResolved && local.status === 'pending') {
              finalStatus = d.status; // Mantém o status resolvido do servidor
            } else if (!isRemoteResolved && isLocalResolved) {
              finalStatus = local.status; // Se o local resolveu primeiro, mantém o local
            } else {
              // Se ambos têm o mesmo nível de resolução, decide pela data de atualização mais recente
              const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
              const remoteTime = updatedAt ? new Date(updatedAt).getTime() : 0;
              finalStatus = localTime > remoteTime ? local.status : d.status;
            }
          }

          return {
            id: d.id,
            riderId: d.rider_id,
            establishmentId: d.establishment_id,
            date: d.date,
            time: d.time,
            value: Number(d.value),
            status: finalStatus,
            scheduleId: d.schedule_id || undefined,
            orderNumber,
            notes: mergeChatStrings(local?.notes, notes),
            customerChat: mergeChatStrings(local?.customerChat, customerChat),
            updatedAt,
            paid: d.paid || false
          };
        });

        // Adiciona corridas locais que ainda não foram enviadas para o servidor
        const remoteIds = new Set(mappedDeliveries.map(d => d.id));
        const unsyncedLocal = localDeliveries.filter(l => !remoteIds.has(l.id));
        
        localStorage.setItem(KEYS.DELIVERIES, JSON.stringify([...mappedDeliveries, ...unsyncedLocal]));
      }

      // 5. Sincronizar Solicitações de Parceria
      const { data: reqsData } = await supabase.from('partner_requests').select('*');
      if (reqsData) {
        const mappedReqs: PartnerRequest[] = reqsData.map(r => ({
          id: r.id,
          establishmentName: r.establishment_name,
          ownerName: r.owner_name,
          phone: r.phone,
          address: r.address,
          status: r.status,
          createdAt: r.created_at
        }));
        localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(mappedReqs));
      }

      // Dispara evento global para atualizar as telas em tempo real
      window.dispatchEvent(new Event('db-sync-complete'));
    } catch (err) {
      console.error('Erro ao sincronizar dados do Supabase:', err);
    }
  },

  async syncUsersToSupabase(users: User[]) {
    try {
      for (const u of users) {
        await supabase.from('users').upsert({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          phone: u.phone,
          cpf: u.cpf,
          password_hash: u.passwordHash,
          must_reset_password: u.mustResetPassword || false,
          establishment_id: u.establishmentId || null,
          created_at: u.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Erro ao sincronizar usuários com Supabase:', e);
    }
  },

  async syncEstablishmentsToSupabase(ests: Establishment[]) {
    try {
      for (const e of ests) {
        await supabase.from('establishments').upsert({
          id: e.id,
          name: e.name,
          email: e.email || '',
          active: e.active,
          phone: e.phone || '',
          address: e.address ? JSON.stringify(e.address) : null,
          created_at: e.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Erro ao sincronizar estabelecimentos com Supabase:', err);
    }
  },

  async syncPartnerRequestsToSupabase(requests: PartnerRequest[]) {
    try {
      for (const r of requests) {
        await supabase.from('partner_requests').upsert({
          id: r.id,
          establishment_name: r.establishmentName,
          owner_name: r.ownerName,
          phone: r.phone,
          address: r.address,
          status: r.status,
          created_at: r.createdAt
        });
      }
    } catch (e) {
      console.error('Erro ao sincronizar solicitações de parceria com Supabase:', e);
    }
  },

  async syncToSupabase() {
    try {
      // 1. Sincronizar Escalas (Schedules)
      const schedules = this.getSchedules();
      for (const s of schedules) {
        await supabase.from('schedules').upsert({
          id: s.id,
          rider_id: s.riderId,
          establishment_id: s.establishmentId,
          date: s.date,
          shift: s.shift,
          start_time: s.startTime,
          end_time: s.endTime,
          chat: s.chat || null,
          created_by: s.createdBy || null,
          created_at: s.createdAt || new Date().toISOString(),
          updated_at: s.updatedAt || new Date().toISOString()
        });
      }

      // 2. Sincronizar Corridas (Deliveries)
      const deliveries = this.getDeliveries();
      for (const d of deliveries) {
        // Serializa metadados no order_number para garantir compatibilidade total de colunas
        const serializedOrderNumber = JSON.stringify({
          orderNumber: d.orderNumber || '',
          notes: d.notes || '',
          customerChat: d.customerChat || '',
          updatedAt: d.updatedAt || new Date().toISOString()
        });

        await supabase.from('deliveries').upsert({
          id: d.id,
          rider_id: d.riderId,
          establishment_id: d.establishmentId,
          date: d.date,
          time: d.time,
          value: d.value,
          status: d.status,
          schedule_id: d.scheduleId || null,
          order_number: serializedOrderNumber,
          notes: d.notes || null,
          customer_chat: d.customerChat || null,
          updated_at: d.updatedAt || new Date().toISOString(),
          paid: d.paid || false
        });
      }
    } catch (err) {
      console.error('Erro ao enviar dados para o Supabase:', err);
    }
  }
};