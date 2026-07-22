import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase utilizando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pjEo4HVVSPTMF-fQDwKpLQ_o9HAIOWR';
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'establishment' | 'rider';
  active: boolean;
  createdAt?: string;
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
  createdAt?: string;
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
  PARTNER_REQUESTS: 'delivery_system_partner_requests',
  MISSING_COLUMNS: 'delivery_system_missing_columns'
};

const getMissingColumnsCache = (): Record<string, string[]> => {
  const data = localStorage.getItem(KEYS.MISSING_COLUMNS);
  return data ? JSON.parse(data) : {};
};

const saveMissingColumnsCache = (cache: Record<string, string[]>) => {
  localStorage.setItem(KEYS.MISSING_COLUMNS, JSON.stringify(cache));
};

// Helper para mesclar mensagens de chat preservando mensagens repetidas enviadas em momentos diferentes
function mergeChatStrings(localChat: string | undefined, remoteChat: string | undefined): string {
  if (!localChat) return remoteChat || '';
  if (!remoteChat) return localChat || '';
  if (localChat === remoteChat) return localChat;
  
  const localLines = localChat.split('\n').map(l => l.trim()).filter(Boolean);
  const remoteLines = remoteChat.split('\n').map(l => l.trim()).filter(Boolean);
  
  const merged: string[] = [];
  const seen = new Set<string>();
  
  localLines.forEach(l => {
    merged.push(l);
    seen.add(l);
  });
  
  remoteLines.forEach(l => {
    if (!seen.has(l)) {
      merged.push(l);
      seen.add(l);
    }
  });

  return merged.join('\n');
}

function isAddressEmptyOrPlaceholder(addr: any): boolean {
  if (!addr) return true;
  const street = (addr.street || '').toLowerCase().trim();
  const neighborhood = (addr.neighborhood || '').toLowerCase().trim();
  
  return !street || !neighborhood || street === 'sem rua' || street === 'a definir' || neighborhood === 'sem bairro' || neighborhood === 'a definir';
}

// Função de Auto-Cura para Upsert no Supabase
async function safeUpsert(tableName: string, rawPayload: Record<string, any>): Promise<{ success: boolean; error?: any }> {
  const payload = { ...rawPayload };
  
  const cache = getMissingColumnsCache();
  const missingCols = cache[tableName] || [];
  missingCols.forEach(col => {
    delete payload[col];
  });

  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error } = await supabase.from(tableName).upsert(payload);
    
    if (!error) {
      return { success: true };
    }

    const msg = error.message || '';
    const match = msg.match(/Could not find the '([^']+)' column/) || 
                  msg.match(/column "([^"]+)"/) || 
                  msg.match(/column '([^']+)'/);
    
    if (match && match[1]) {
      const missingCol = match[1];
      const currentCache = getMissingColumnsCache();
      if (!currentCache[tableName]) currentCache[tableName] = [];
      if (!currentCache[tableName].includes(missingCol)) {
        currentCache[tableName].push(missingCol);
        saveMissingColumnsCache(currentCache);
      }

      delete payload[missingCol];
      continue;
    }

    return { success: false, error };
  }

  return { success: false, error: 'Limite de tentativas de auto-cura excedido' };
}

export const db = {
  getUsers(): User[] {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  setUsers(users: User[]) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    users.forEach(u => {
      const rawPayload = {
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
      };
      safeUpsert('users', rawPayload);
    });
  },

  getEstablishments(): Establishment[] {
    const data = localStorage.getItem(KEYS.ESTABLISHMENTS);
    return data ? JSON.parse(data) : [];
  },
  setEstablishments(ests: Establishment[]) {
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    ests.forEach(e => {
      const rawPayload = {
        id: e.id,
        name: e.name,
        email: e.email || null,
        active: e.active,
        phone: e.phone || '',
        address: typeof e.address === 'object' ? JSON.stringify(e.address) : e.address,
        street: e.address?.street || '',
        number: e.address?.number || '',
        complement: e.address?.complement || '',
        neighborhood: e.address?.neighborhood || '',
        city: e.address?.city || '',
        state: e.address?.state || '',
        zip_code: e.address?.zipCode || '',
        created_at: e.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      safeUpsert('establishments', rawPayload);
    });
  },

  getSchedules(): Schedule[] {
    const data = localStorage.getItem(KEYS.SCHEDULES);
    return data ? JSON.parse(data) : [];
  },
  setSchedules(schedules: Schedule[]) {
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    schedules.forEach(s => {
      const serializedCreatedBy = JSON.stringify({
        createdBy: s.createdBy || '',
        chat: s.chat || '',
        updatedAt: s.updatedAt || new Date().toISOString()
      });

      const rawPayload = {
        id: s.id,
        rider_id: s.riderId,
        establishment_id: s.establishmentId,
        date: s.date,
        shift: s.shift,
        start_time: s.startTime,
        end_time: s.endTime,
        chat: s.chat || null,
        created_by: serializedCreatedBy,
        created_at: s.createdAt || new Date().toISOString(),
        updated_at: s.updatedAt || new Date().toISOString()
      };
      safeUpsert('schedules', rawPayload);
    });
  },

  getDeliveries(): Delivery[] {
    const data = localStorage.getItem(KEYS.DELIVERIES);
    return data ? JSON.parse(data) : [];
  },
  setDeliveries(deliveries: Delivery[]) {
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    deliveries.forEach(d => {
      const serializedOrderNumber = JSON.stringify({
        orderNumber: d.orderNumber || '',
        notes: d.notes || '',
        customerChat: d.customerChat || '',
        updatedAt: d.updatedAt || new Date().toISOString()
      });

      const rawPayload = {
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
      };
      safeUpsert('deliveries', rawPayload);
    });
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
    requests.forEach(r => {
      const rawPayload = {
        id: r.id,
        establishment_name: r.establishmentName,
        owner_name: r.ownerName,
        phone: r.phone,
        address: r.address,
        status: r.status,
        created_at: r.createdAt
      };
      safeUpsert('partner_requests', rawPayload);
    });
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

  resolveUser(id: string): User | undefined {
    if (!id) return undefined;
    const users = this.getUsers();
    const found = users.find(u => u.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return users.find(u => 
      u.name && (
        u.name.toLowerCase().trim() === cleanId ||
        u.name.toLowerCase().trim().includes(cleanId) ||
        cleanId.includes(u.name.toLowerCase().trim())
      )
    );
  },

  resolveEstablishment(id: string): Establishment | undefined {
    if (!id) return undefined;
    const ests = this.getEstablishments();
    const found = ests.find(e => e.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return ests.find(e => 
      e.name && (
        e.name.toLowerCase().trim() === cleanId ||
        e.name.toLowerCase().trim().includes(cleanId) ||
        cleanId.includes(e.name.toLowerCase().trim())
      )
    );
  },

  generateUniqueDummyCpf(): string {
    const rand = () => Math.floor(Math.random() * 10);
    return `000.000.000-${rand()}${rand()}`;
  },

  async deleteUser(id: string) {
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    await supabase.from('users').delete().eq('id', id);
  },

  async deleteEstablishment(id: string) {
    const ests = this.getEstablishments().filter(e => e.id !== id);
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    await supabase.from('establishments').delete().eq('id', id);
  },

  async deleteSchedule(id: string) {
    const schedules = this.getSchedules().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    await supabase.from('schedules').delete().eq('id', id);
  },

  async deletePartnerRequest(id: string) {
    const requests = this.getPartnerRequests().filter(r => r.id !== id);
    localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(requests));
    await supabase.from('partner_requests').delete().eq('id', id);
  },

  async deleteDelivery(id: string) {
    const deliveries = this.getDeliveries().filter(d => d.id !== id);
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    await supabase.from('deliveries').delete().eq('id', id);
  },

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
    
    const rawPayload = {
      rider_id: riderId,
      rider_name: riderName,
      lat: lat,
      lng: lng,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString()
    };

    safeUpsert('rider_locations', rawPayload);
  },

  getRiderLocationsRecord(): Record<string, RiderLocation> {
    const data = localStorage.getItem(KEYS.RIDER_LOCATIONS);
    return data ? JSON.parse(data) : {};
  },

  getRiderLocations(): RiderLocation[] {
    return Object.values(this.getRiderLocationsRecord());
  },

  // --- SUPABASE SYNCHRONIZATION (PUXA E MESCLA DADOS EM TEMPO REAL) ---
  async pullFromSupabase() {
    // 1. Usuários
    try {
      const { data: usersData, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (usersData) {
        const localUsers = this.getUsers();
        const mappedUsers: User[] = usersData.map(u => {
          const local = localUsers.find(l => l.id === u.id);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
            createdAt: u.created_at,
            phone: u.phone || local?.phone || '',
            cpf: u.cpf || local?.cpf || '',
            passwordHash: u.password_hash || local?.passwordHash || '',
            mustResetPassword: u.must_reset_password !== undefined ? u.must_reset_password : (local?.mustResetPassword || false),
            establishmentId: u.establishment_id || local?.establishmentId || undefined,
            updatedAt: u.updated_at
          };
        });
        localStorage.setItem(KEYS.USERS, JSON.stringify(mappedUsers));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "users":', err);
    }

    // 2. Estabelecimentos
    try {
      const { data: estsData, error } = await supabase.from('establishments').select('*');
      if (error) throw error;
      if (estsData) {
        const localEsts = this.getEstablishments();
        const mappedEsts: Establishment[] = estsData.map(e => {
          let parsedAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' };
          
          if (e.street || e.neighborhood || e.city) {
            parsedAddress = {
              street: e.street || '',
              number: e.number || '',
              complement: e.complement || '',
              neighborhood: e.neighborhood || '',
              city: e.city || '',
              state: e.state || '',
              zipCode: e.zip_code || e.zipCode || ''
            };
          } else if (e.address) {
            if (typeof e.address === 'object') {
              parsedAddress = { ...parsedAddress, ...e.address };
            } else if (typeof e.address === 'string') {
              try {
                let temp = JSON.parse(e.address);
                if (typeof temp === 'string') temp = JSON.parse(temp);
                if (temp && typeof temp === 'object') parsedAddress = { ...parsedAddress, ...temp };
              } catch (err) {}
            }
          }

          const local = localEsts.find(l => l.id === e.id);
          if (isAddressEmptyOrPlaceholder(parsedAddress) && local && local.address && !isAddressEmptyOrPlaceholder(local.address)) {
            parsedAddress = { ...local.address };
          }

          return {
            id: e.id,
            name: e.name,
            email: e.email || local?.email,
            active: e.active,
            phone: e.phone || local?.phone || '',
            address: parsedAddress,
            createdAt: e.created_at,
            updatedAt: e.updated_at
          };
        });
        localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(mappedEsts));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "establishments":', err);
    }

    // 3. Escalas (Schedules)
    try {
      const { data: schData, error } = await supabase.from('schedules').select('*');
      if (error) throw error;
      if (schData) {
        const localSchedules = this.getSchedules();
        const mappedSchedules: Schedule[] = schData.map(s => {
          const local = localSchedules.find(l => l.id === s.id);
          let chat = s.chat || undefined;
          let createdBy = s.created_by || undefined;

          // Parse do payload redundante gravado no created_by
          if (s.created_by && s.created_by.startsWith('{')) {
            try {
              const parsed = JSON.parse(s.created_by);
              createdBy = parsed.createdBy || undefined;
              if (parsed.chat) {
                chat = mergeChatStrings(chat, parsed.chat);
              }
            } catch (e) {}
          }

          return {
            id: s.id,
            riderId: s.rider_id,
            establishmentId: s.establishment_id,
            date: s.date,
            shift: s.shift,
            startTime: s.start_time,
            endTime: s.end_time,
            chat: mergeChatStrings(local?.chat, chat),
            createdBy,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          };
        });
        localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(mappedSchedules));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "schedules":', err);
    }

    // 4. Corridas (Deliveries)
    try {
      const { data: delData, error } = await supabase.from('deliveries').select('*');
      if (error) throw error;
      if (delData) {
        const localDeliveries = this.getDeliveries();
        const mappedDeliveries: Delivery[] = delData.map(d => {
          const local = localDeliveries.find(l => l.id === d.id);
          
          let orderNumber = d.order_number || undefined;
          let notes = d.notes || undefined;
          let customerChat = d.customer_chat || undefined;
          let updatedAt = d.updated_at;

          // Parse do payload redundante em order_number
          if (d.order_number && d.order_number.startsWith('{')) {
            try {
              const parsed = JSON.parse(d.order_number);
              orderNumber = parsed.orderNumber || undefined;
              if (parsed.notes) notes = mergeChatStrings(notes, parsed.notes);
              if (parsed.customerChat) customerChat = mergeChatStrings(customerChat, parsed.customerChat);
              updatedAt = parsed.updatedAt || d.updated_at;
            } catch (e) {}
          }

          let finalStatus: 'pending' | 'active' | 'rejected' | 'cancelled' = d.status;
          if (local) {
            const isRemoteResolved = ['active', 'rejected', 'cancelled'].includes(d.status);
            const isLocalResolved = ['active', 'rejected', 'cancelled'].includes(local.status);

            if (isRemoteResolved && local.status === 'pending') {
              finalStatus = d.status;
            } else if (!isRemoteResolved && isLocalResolved) {
              finalStatus = local.status;
            } else {
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
        localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(mappedDeliveries));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "deliveries":', err);
    }

    // 5. Solicitações de Parceria
    try {
      const { data: reqsData, error } = await supabase.from('partner_requests').select('*');
      if (error) throw error;
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
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "partner_requests":', err);
    }

    // 6. Localizações dos Motoboys
    try {
      const { data: locData, error } = await supabase.from('rider_locations').select('*');
      if (error) throw error;
      if (locData) {
        const mappedLocs: Record<string, RiderLocation> = {};
        locData.forEach(l => {
          const rId = l.rider_id || l.riderId;
          if (rId) {
            mappedLocs[rId] = {
              riderId: rId,
              riderName: l.rider_name || l.riderName || '',
              lat: parseFloat(l.latitude !== undefined ? l.latitude : l.lat),
              lng: parseFloat(l.longitude !== undefined ? l.longitude : l.lng),
              updatedAt: l.updated_at || l.updatedAt || new Date().toISOString()
            };
          }
        });
        localStorage.setItem(KEYS.RIDER_LOCATIONS, JSON.stringify(mappedLocs));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "rider_locations":', err);
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  }
};