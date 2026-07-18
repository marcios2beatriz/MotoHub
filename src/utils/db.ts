"use client";

import { supabase } from './supabase';

export interface User {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  role: 'admin' | 'rider' | 'establishment';
  active: boolean;
  passwordHash: string;
  mustResetPassword?: boolean;
  establishmentId?: string; // Linked establishment for establishment users
  updatedAt?: string;
}

export interface Establishment {
  id: string;
  name: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  active: boolean;
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  shift: 'morning' | 'afternoon' | 'night';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdBy: string; // Admin name
  createdAt: string;
  chat?: string; // Campo opcional para chat direto de turno
  updatedAt?: string; // Timestamp para controle de concorrência
}

export interface Delivery {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  value: number;
  status: 'active' | 'cancelled' | 'pending' | 'rejected';
  scheduleId?: string;
  orderNumber?: string; // Optional order number
  notes?: string; // Campo opcional de observações (Chat com Estabelecimento)
  customerChat?: string; // Campo exclusivo para o Chat com o Cliente
  updatedAt?: string; // Timestamp para controle de concorrência
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

// Tables that don't exist or fail in Supabase will be disabled dynamically to use only LocalStorage
const disabledTables = new Set<string>();

// Seed Data com endereços reais de Campina Grande e João Pessoa - PB
const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Administrador Geral',
    cpf: '000.000.000-00',
    phone: '(83) 99999-9999',
    email: 'admin@delivery.com',
    role: 'admin',
    active: true,
    passwordHash: 'admin123',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u2',
    name: 'Carlos Silva (Motoqueiro)',
    cpf: '111.111.111-11',
    phone: '(83) 98888-8888',
    email: 'carlos@delivery.com',
    role: 'rider',
    active: true,
    passwordHash: 'moto123',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u3',
    name: 'Lucas Souza (Motoqueiro)',
    cpf: '222.222.222-22',
    phone: '(83) 97777-7777',
    email: 'lucas@delivery.com',
    role: 'rider',
    active: true,
    passwordHash: 'moto123',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u4',
    name: 'Gerente Bella Italia',
    cpf: '333.333.333-33',
    phone: '(83) 3222-1111',
    email: 'bella@delivery.com',
    role: 'establishment',
    active: true,
    passwordHash: 'bella123',
    establishmentId: 'e1',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u5',
    name: 'Gerente Burgrill',
    cpf: '444.444.444-44',
    phone: '(83) 3111-2222',
    email: 'burgrill@delivery.com',
    role: 'establishment',
    active: true,
    passwordHash: 'burger123',
    establishmentId: 'e2',
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_ESTABLISHMENTS: Establishment[] = [
  {
    id: 'e1',
    name: 'Pizzaria Bella Italia',
    address: {
      street: 'Rua Martinho Lutero',
      number: '32',
      neighborhood: 'Malvinas',
      city: 'Campina Grande',
      state: 'PB',
      zipCode: '58433-488'
    },
    phone: '(83) 3222-1111',
    active: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'e2',
    name: 'Burgrill',
    address: {
      street: 'Avenida Olinda',
      number: '200',
      neighborhood: 'Tambaú',
      city: 'João Pessoa',
      state: 'PB',
      zipCode: '58039-120'
    },
    phone: '(83) 3111-2222',
    active: true,
    updatedAt: new Date().toISOString()
  }
];

// Coordenadas iniciais de teste em Campina Grande - PB (Malvinas, próximas ao CEP 58433-488)
const INITIAL_LOCATIONS: RiderLocation[] = [
  {
    riderId: 'u2',
    riderName: 'Carlos Silva (Motoqueiro)',
    lat: -7.2315,
    lng: -35.9240,
    updatedAt: new Date().toISOString()
  },
  {
    riderId: 'u3',
    riderName: 'Lucas Souza (Motoqueiro)',
    lat: -7.2308,
    lng: -35.9250,
    updatedAt: new Date().toISOString()
  }
];

export const getStorageData = <T>(key: string, initialData: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(data);
};

export const setStorageData = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Tombstone Helpers para rastrear exclusões
const getDeletedIds = (): string[] => getStorageData<string[]>('dm_deleted_ids', []);

const addDeletedId = (id: string, supabaseTable: string) => {
  const deleted = getDeletedIds();
  if (!deleted.includes(id)) {
    const updated = [...deleted, id];
    setStorageData('dm_deleted_ids', updated);
    
    // Tenta excluir do Supabase imediatamente
    supabase.from(supabaseTable).delete().eq('id', id).then(({ error }) => {
      if (error) console.warn(`[Supabase] Erro ao excluir ID ${id} da tabela ${supabaseTable}:`, error.message);
    });
  }
};

// Compara a lista antiga com a nova para detectar exclusões automáticas (ex: filtros de array)
const trackDeletions = (key: string, newData: { id: string }[], supabaseTable: string) => {
  const oldData = getStorageData<{ id: string }[]>(key, []);
  const newIds = new Set(newData.map(item => item.id));
  
  oldData.forEach(oldItem => {
    if (!newIds.has(oldItem.id)) {
      addDeletedId(oldItem.id, supabaseTable);
    }
  });
};

// Helper to merge local and remote data by ID with timestamp check
const mergeById = <T extends { id: string; updatedAt?: string }>(local: T[], remote: T[]): T[] => {
  const deletedIds = getDeletedIds();
  const map = new Map<string, T>();
  
  // Popula o mapa com os itens locais ativos
  local.filter(item => !deletedIds.includes(item.id)).forEach(item => map.set(item.id, item));
  
  // Mescla com os itens remotos ativos
  remote.filter(item => !deletedIds.includes(item.id)).forEach(item => {
    const existing = map.get(item.id);
    if (existing) {
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const remoteTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      
      // Só sobrescreve se o remoto for estritamente mais recente ou se ambos não tiverem timestamp
      if (remoteTime > localTime || (remoteTime === 0 && localTime === 0)) {
        const merged = { ...existing };
        (Object.keys(item) as (keyof T)[]).forEach(key => {
          const value = item[key];
          if (value !== undefined) {
            merged[key] = value;
          }
        });
        map.set(item.id, merged);
      }
    } else {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

// Async background sync with Supabase
const syncToSupabase = async (table: string, data: any[]) => {
  if (disabledTables.has(table)) {
    return;
  }

  try {
    const formattedData = data.map(item => {
      if (table === 'users') {
        return {
          id: item.id,
          name: item.name,
          cpf: item.cpf,
          phone: item.phone,
          email: item.email,
          role: item.role,
          active: item.active,
          password_hash: item.passwordHash,
          must_reset_password: item.mustResetPassword || false,
          establishment_id: item.establishmentId || null,
          updated_at: item.updatedAt || new Date().toISOString()
        };
      }
      if (table === 'establishments') {
        return {
          id: item.id,
          name: item.name,
          street: item.address.street,
          number: item.address.number,
          complement: item.address.complement || null,
          neighborhood: item.address.neighborhood,
          city: item.address.city,
          state: item.address.state,
          zip_code: item.address.zipCode,
          phone: item.phone,
          active: item.active,
          updated_at: item.updatedAt || new Date().toISOString()
        };
      }
      if (table === 'schedules') {
        const payload = {
          createdBy: item.createdBy,
          chat: item.chat || '',
          updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
        };

        return {
          id: item.id,
          rider_id: item.riderId,
          establishment_id: item.establishmentId,
          date: item.date,
          shift: item.shift,
          start_time: item.startTime,
          end_time: item.endTime,
          created_by: JSON.stringify(payload),
          created_at: item.createdAt,
          updated_at: item.updatedAt || item.createdAt || new Date().toISOString()
        };
      }
      if (table === 'deliveries') {
        const payload = {
          orderNumber: item.orderNumber || '',
          notes: item.notes || '',
          customerChat: item.customerChat || '',
          updatedAt: item.updatedAt || new Date().toISOString()
        };

        return {
          id: item.id,
          rider_id: item.riderId,
          establishment_id: item.establishmentId,
          date: item.date,
          time: item.time,
          value: item.value,
          status: item.status,
          schedule_id: item.scheduleId || null,
          order_number: JSON.stringify(payload),
          updated_at: item.updatedAt || new Date().toISOString()
        };
      }
      if (table === 'notifications') {
        return {
          id: item.id,
          rider_id: item.riderId,
          title: item.title,
          message: item.message,
          date: item.date,
          read: item.read
        };
      }
      if (table === 'partner_requests') {
        return {
          id: item.id,
          establishment_name: item.establishmentName,
          owner_name: item.ownerName,
          phone: item.phone,
          address: item.address,
          status: item.status,
          created_at: item.createdAt
        };
      }
      return item;
    });

    let { error } = await supabase.from(table).upsert(formattedData);
    
    if (error) {
      let currentData = [...formattedData];
      let attempts = 0;
      while (error && error.message.includes("Could not find the '") && attempts < 10) {
        attempts++;
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(`⚠️ Coluna '${missingCol}' não encontrada na tabela '${table}' do Supabase. Removendo do envio...`);
          currentData = currentData.map(item => {
            const { [missingCol]: _, ...rest } = item;
            return rest;
          });
          const retry = await supabase.from(table).upsert(currentData);
          error = retry.error;
        } else {
          break;
        }
      }
    }

    if (error) {
      console.warn(`⚠️ Erro ao sincronizar tabela "${table}" com Supabase.`, error.message);
      if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("relation")) {
        disabledTables.add(table);
      }
    }
  } catch (err: any) {
    console.warn('Erro ao sincronizar com o Supabase:', err?.message || err);
  }
};

export const db = {
  getLocalDateString: (date = new Date()) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  },

  // Resolvedores inteligentes para auto-cura de IDs desalinhados
  resolveUser: (id: string): User | undefined => {
    const allUsers = db.getUsers();
    const found = allUsers.find(u => u.id === id);
    if (found) return found;
    
    // Fallback para IDs legados conhecidos
    let emailFallback = '';
    if (id === 'u1') emailFallback = 'admin@delivery.com';
    else if (id === 'u2') emailFallback = 'carlos@delivery.com';
    else if (id === 'u3') emailFallback = 'lucas@delivery.com';
    else if (id === 'u4') emailFallback = 'bella@delivery.com';
    else if (id === 'u5') emailFallback = 'burgrill@delivery.com';
    
    if (emailFallback) {
      return allUsers.find(u => u.email.toLowerCase() === emailFallback);
    }
    return undefined;
  },

  resolveEstablishment: (id: string): Establishment | undefined => {
    const allEsts = db.getEstablishments();
    const found = allEsts.find(e => e.id === id);
    if (found) return found;
    
    // Fallback para IDs legados conhecidos
    let nameFallback = '';
    if (id === 'e1') nameFallback = 'Pizzaria Bella Italia';
    else if (id === 'e2') nameFallback = 'Burgrill';
    
    if (nameFallback) {
      return allEsts.find(e => e.name.toLowerCase().trim() === nameFallback.toLowerCase().trim());
    }
    return undefined;
  },

  getUsers: () => {
    const deletedIds = getDeletedIds();
    const users = getStorageData<User[]>('dm_users', INITIAL_USERS).filter(u => !deletedIds.includes(u.id));
    let updated = false;
    const merged = [...users];
    INITIAL_USERS.forEach(initUser => {
      if (!deletedIds.includes(initUser.id) && !merged.some(u => u.email.toLowerCase() === initUser.email.toLowerCase())) {
        merged.push(initUser);
        updated = true;
      }
    });
    if (updated) {
      setStorageData('dm_users', merged);
    }
    return merged;
  },
  setUsers: (users: User[]) => {
    trackDeletions('dm_users', users, 'users');
    setStorageData('dm_users', users);
    syncToSupabase('users', users);
  },
  deleteUser: (id: string) => {
    addDeletedId(id, 'users');
    const users = db.getUsers().filter(u => u.id !== id);
    setStorageData('dm_users', users);
  },
  
  getEstablishments: () => {
    const deletedIds = getDeletedIds();
    const ests = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS).filter(e => !deletedIds.includes(e.id));
    
    const updatedEsts = ests.map(e => {
      if (e.id === 'e1') {
        return {
          ...e,
          name: 'Pizzaria Bella Italia',
          address: {
            street: 'Rua Martinho Lutero',
            number: '32',
            neighborhood: 'Malvinas',
            city: 'Campina Grande',
            state: 'PB',
            zipCode: '58433-488'
          }
        };
      }
      if (e.id === 'e2') {
        return {
          ...e,
          name: 'Burgrill',
          address: {
            street: 'Avenida Olinda',
            number: '200',
            neighborhood: 'Tambaú',
            city: 'João Pessoa',
            state: 'PB',
            zipCode: '58039-120'
          }
        };
      }
      return e;
    });

    if (JSON.stringify(ests) !== JSON.stringify(updatedEsts)) {
      setStorageData('dm_establishments', updatedEsts);
      return updatedEsts;
    }
    return ests;
  },
  setEstablishments: (est: Establishment[]) => {
    trackDeletions('dm_establishments', est, 'establishments');
    setStorageData('dm_establishments', est);
    syncToSupabase('establishments', est);
  },
  deleteEstablishment: (id: string) => {
    addDeletedId(id, 'establishments');
    const ests = db.getEstablishments().filter(e => e.id !== id);
    setStorageData('dm_establishments', ests);
  },
  
  getSchedules: () => {
    const deletedIds = getDeletedIds();
    return getStorageData<Schedule[]>('dm_schedules', []).filter(s => !deletedIds.includes(s.id));
  },
  setSchedules: (sch: Schedule[]) => {
    trackDeletions('dm_schedules', sch, 'schedules');
    setStorageData('dm_schedules', sch);
    syncToSupabase('schedules', sch);
  },
  
  getDeliveries: () => {
    const deletedIds = getDeletedIds();
    return getStorageData<Delivery[]>('dm_deliveries', []).filter(d => !deletedIds.includes(d.id));
  },
  setDeliveries: (del: Delivery[]) => {
    trackDeletions('dm_deliveries', del, 'deliveries');
    setStorageData('dm_deliveries', del);
    syncToSupabase('deliveries', del);
  },
  
  getNotifications: () => {
    const deletedIds = getDeletedIds();
    return getStorageData<Notification[]>('dm_notifications', []).filter(n => !deletedIds.includes(n.id));
  },
  setNotifications: (notif: Notification[]) => {
    trackDeletions('dm_notifications', notif, 'notifications');
    setStorageData('dm_notifications', notif);
    syncToSupabase('notifications', notif);
  },

  getPartnerRequests: () => {
    const deletedIds = getDeletedIds();
    return getStorageData<PartnerRequest[]>('dm_partner_requests', []).filter(r => !deletedIds.includes(r.id));
  },
  setPartnerRequests: (reqs: PartnerRequest[]) => {
    trackDeletions('dm_partner_requests', reqs, 'partner_requests');
    setStorageData('dm_partner_requests', reqs);
    syncToSupabase('partner_requests', reqs);
  },

  getRiderLocations: (): RiderLocation[] => getStorageData<RiderLocation[]>('dm_rider_locations', INITIAL_LOCATIONS),
  setRiderLocations: (locations: RiderLocation[]) => {
    setStorageData('dm_rider_locations', locations);
    syncToSupabase('rider_locations', locations).catch(() => {});
  },
  updateRiderLocation: (riderId: string, riderName: string, lat: number, lng: number) => {
    const locations = db.getRiderLocations();
    const existingIdx = locations.findIndex(l => l.riderId === riderId);
    const newLoc: RiderLocation = {
      riderId,
      riderName,
      lat,
      lng,
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      locations[existingIdx] = newLoc;
    } else {
      locations.push(newLoc);
    }
    setStorageData('dm_rider_locations', locations);

    supabase
      .from('rider_locations')
      .upsert({
        rider_id: riderId,
        rider_name: riderName,
        lat,
        lng,
        updated_at: newLoc.updatedAt
      }, { onConflict: 'rider_id' })
      .then(({ error }) => {
        if (error) console.warn('GPS sync error:', error.message);
      });
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem('dm_current_user');
    return user ? JSON.parse(user) : null;
  },
  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('dm_current_user', JSON.stringify(user));
      localStorage.setItem('dm_last_activity', Date.now().toString());
    } else {
      localStorage.removeItem('dm_current_user');
      localStorage.removeItem('dm_last_activity');
    }
  },

  getLoginAttempts: (): { count: number; blockedUntil: number | null } => {
    const attempts = localStorage.getItem('dm_login_attempts');
    return attempts ? JSON.parse(attempts) : { count: 0, blockedUntil: null };
  },
  setLoginAttempts: (attempts: { count: number; blockedUntil: number | null }) => {
    localStorage.setItem('dm_login_attempts', JSON.stringify(attempts));
  },

  pullFromSupabase: async () => {
    try {
      const deletedIds = getDeletedIds();

      // 1. Sincronizar Estabelecimentos
      const { data: ests, error: estsError } = await supabase.from('establishments').select('*');
      let localEsts = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
      const estIdMap = new Map<string, string>();

      if (!estsError && ests) {
        ests.forEach(e => {
          const localMatch = localEsts.find(le => le.name.toLowerCase().trim() === e.name.toLowerCase().trim());
          if (localMatch) {
            if (localMatch.id !== e.id) {
              estIdMap.set(localMatch.id, e.id);
              localMatch.id = e.id; // Atualiza o ID local para o UUID do Supabase
            }
          }
        });

        const mappedEsts: Establishment[] = ests
          .filter(e => !deletedIds.includes(e.id))
          .map(e => ({
            id: e.id,
            name: e.name,
            address: {
              street: e.street,
              number: e.number,
              complement: e.complement || '',
              neighborhood: e.neighborhood,
              city: e.city,
              state: e.state,
              zipCode: e.zip_code
            },
            phone: e.phone || '',
            active: e.active,
            updatedAt: e.updated_at || undefined
          }));

        localEsts = mergeById(localEsts, mappedEsts);
        setStorageData('dm_establishments', localEsts);
      }

      // 2. Sincronizar Usuários (Motoboys, Admins, Gerentes)
      const { data: users, error: usersError } = await supabase.from('users').select('*');
      let localUsers = getStorageData<User[]>('dm_users', INITIAL_USERS);
      const userIdMap = new Map<string, string>();

      if (!usersError && users) {
        users.forEach(u => {
          const localMatch = localUsers.find(lu => lu.email.toLowerCase().trim() === u.email.toLowerCase().trim());
          if (localMatch) {
            if (localMatch.id !== u.id) {
              userIdMap.set(localMatch.id, u.id);
              localMatch.id = u.id; // Atualiza o ID local para o UUID do Supabase
            }
          }
        });

        const mappedUsers: User[] = users
          .filter(u => !deletedIds.includes(u.id))
          .map(u => ({
            id: u.id,
            name: u.name,
            cpf: u.cpf,
            phone: u.phone || '',
            email: u.email,
            role: u.role as any,
            active: u.active,
            passwordHash: u.password_hash,
            mustResetPassword: u.must_reset_password,
            establishmentId: u.establishment_id || undefined,
            updatedAt: u.updated_at || undefined
          }));

        localUsers = mergeById(localUsers, mappedUsers);

        // Atualiza referências de estabelecimentos nos usuários locais
        if (estIdMap.size > 0) {
          localUsers = localUsers.map(u => {
            if (u.establishmentId && estIdMap.has(u.establishmentId)) {
              return { ...u, establishmentId: estIdMap.get(u.establishmentId) };
            }
            return u;
          });
        }

        setStorageData('dm_users', localUsers);

        // Atualiza a sessão do usuário logado se o ID dele mudou para UUID
        const currentUser = db.getCurrentUser();
        if (currentUser) {
          const updatedCurrent = localUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
          if (updatedCurrent) {
            db.setCurrentUser(updatedCurrent);
          }
        }
      }

      // 3. Sincronizar Escalas (Schedules)
      const { data: schs, error: schsError } = await supabase.from('schedules').select('*');
      let localSchs = getStorageData<Schedule[]>('dm_schedules', []);

      // Atualiza referências de IDs locais para UUIDs nas escalas locais
      localSchs = localSchs.map(s => ({
        ...s,
        riderId: userIdMap.get(s.riderId) || s.riderId,
        establishmentId: estIdMap.get(s.establishmentId) || s.establishmentId
      }));

      if (!schsError && schs) {
        const mappedSchs: Schedule[] = schs
          .filter(s => !deletedIds.includes(s.id))
          .map(s => {
            let createdBy = s.created_by || 'Admin';
            let chat = undefined;
            let updatedAt = s.updated_at || undefined;

            if (s.created_by && s.created_by.startsWith('{')) {
              try {
                const parsed = JSON.parse(s.created_by);
                createdBy = parsed.createdBy || 'Admin';
                chat = parsed.chat || undefined;
                updatedAt = parsed.updatedAt || undefined;
              } catch (e) {
                console.warn('Erro ao fazer parse do JSON do schedule:', e);
              }
            }

            return {
              id: s.id,
              riderId: userIdMap.get(s.rider_id) || s.rider_id,
              establishmentId: estIdMap.get(s.establishment_id) || s.establishment_id,
              date: s.date,
              shift: s.shift as any,
              startTime: s.start_time,
              endTime: s.end_time,
              createdBy,
              createdAt: s.created_at,
              chat,
              updatedAt
            };
          });

        localSchs = mergeById(localSchs, mappedSchs);
        setStorageData('dm_schedules', localSchs);
      }

      // 4. Sincronizar Corridas (Deliveries)
      const { data: dels, error: delsError } = await supabase.from('deliveries').select('*');
      let localDels = getStorageData<Delivery[]>('dm_deliveries', []);

      // Atualiza referências de IDs locais para UUIDs nas corridas locais
      localDels = localDels.map(d => ({
        ...d,
        riderId: userIdMap.get(d.riderId) || d.riderId,
        establishmentId: estIdMap.get(d.establishmentId) || d.establishmentId
      }));

      if (!delsError && dels) {
        const mappedDels: Delivery[] = dels
          .filter(d => !deletedIds.includes(d.id))
          .map(d => {
            let orderNumber = d.order_number || undefined;
            let notes = d.notes || undefined;
            let customerChat = d.customer_chat || undefined;
            let updatedAt = d.updated_at || undefined;

            if (d.order_number && d.order_number.startsWith('{')) {
              try {
                const parsed = JSON.parse(d.order_number);
                orderNumber = parsed.orderNumber || undefined;
                notes = parsed.notes || undefined;
                customerChat = parsed.customerChat || undefined;
                updatedAt = parsed.updatedAt || undefined;
              } catch (e) {
                console.warn('Erro ao fazer parse do JSON do delivery:', e);
              }
            } else if (d.order_number && d.order_number.includes('|||')) {
              const parts = d.order_number.split('|||');
              orderNumber = parts[0] || undefined;
              notes = parts[1] || undefined;
            }

            return {
              id: d.id,
              riderId: userIdMap.get(d.rider_id) || d.rider_id,
              establishmentId: estIdMap.get(d.establishment_id) || d.establishment_id,
              date: d.date,
              time: d.time,
              value: Number(d.value),
              status: d.status as any,
              scheduleId: d.schedule_id || undefined,
              orderNumber,
              notes,
              customerChat,
              updatedAt
            };
          });

        localDels = mergeById(localDels, mappedDels);
        setStorageData('dm_deliveries', localDels);
      }

      // 5. Sincronizar Notificações
      const { data: notifs, error: notifsError } = await supabase.from('notifications').select('*');
      let localNotifs = getStorageData<Notification[]>('dm_notifications', []);

      localNotifs = localNotifs.map(n => ({
        ...n,
        riderId: userIdMap.get(n.riderId) || n.riderId
      }));

      if (!notifsError && notifs) {
        const mappedNotifs: Notification[] = notifs
          .filter(n => !deletedIds.includes(n.id))
          .map(n => ({
            id: n.id,
            riderId: userIdMap.get(n.rider_id) || n.rider_id,
            title: n.title,
            message: n.message,
            date: n.date,
            read: n.read
          }));

        localNotifs = mergeById(localNotifs, mappedNotifs);
        setStorageData('dm_notifications', localNotifs);
      }

      // 6. Sincronizar Solicitações de Parceria
      const { data: reqs, error: reqsError } = await supabase.from('partner_requests').select('*');
      if (!reqsError && reqs) {
        const mappedReqs: PartnerRequest[] = reqs
          .filter(r => !deletedIds.includes(r.id))
          .map(r => ({
            id: r.id,
            establishmentName: r.establishment_name,
            ownerName: r.owner_name,
            phone: r.phone,
            address: r.address,
            status: r.status as any,
            createdAt: r.created_at
          }));
        const localReqs = getStorageData<PartnerRequest[]>('dm_partner_requests', []);
        const merged = mergeById(localReqs, mappedReqs);
        setStorageData('dm_partner_requests', merged);
      }

      // 7. Sincronizar Localizações de GPS
      const { data: locs, error: locsError } = await supabase.from('rider_locations').select('*');
      if (!locsError && locs) {
        const mappedLocs: RiderLocation[] = locs.map(l => ({
          riderId: l.rider_id,
          riderName: l.rider_name,
          lat: l.lat,
          lng: l.lng,
          updatedAt: l.updated_at
        }));
        setStorageData('dm_rider_locations', mappedLocs);
      }

    } catch (err) {
      console.warn('Erro geral na sincronização com o Supabase:', err);
    }

    console.log('✅ Sincronização com Supabase concluída de forma robusta.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-sync-complete'));
    }
  }
};