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
  notes?: string; // Campo opcional de observações
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

// Seed Data with an initial establishment user for testing
const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Administrador Geral',
    cpf: '000.000.000-00',
    phone: '(11) 99999-9999',
    email: 'admin@delivery.com',
    role: 'admin',
    active: true,
    passwordHash: 'admin123'
  },
  {
    id: 'u2',
    name: 'Carlos Silva (Motoqueiro)',
    cpf: '111.111.111-11',
    phone: '(11) 98888-8888',
    email: 'carlos@delivery.com',
    role: 'rider',
    active: true,
    passwordHash: 'moto123'
  },
  {
    id: 'u3',
    name: 'Lucas Souza (Motoqueiro)',
    cpf: '222.222.222-22',
    phone: '(11) 97777-7777',
    email: 'lucas@delivery.com',
    role: 'rider',
    active: true,
    passwordHash: 'moto123'
  },
  {
    id: 'u4',
    name: 'Gerente Bella Italia',
    cpf: '333.333.333-33',
    phone: '(11) 3222-1111',
    email: 'bella@delivery.com',
    role: 'establishment',
    active: true,
    passwordHash: 'bella123',
    establishmentId: 'e1'
  }
];

const INITIAL_ESTABLISHMENTS: Establishment[] = [
  {
    id: 'e1',
    name: 'Pizzaria Bella Italia',
    address: {
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100'
    },
    phone: '(11) 3222-1111',
    active: true
  },
  {
    id: 'e2',
    name: 'Burger House',
    address: {
      street: 'Rua Augusta',
      number: '500',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01305-000'
    },
    phone: '(11) 3111-2222',
    active: true
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

// Helper to merge local and remote data by ID with timestamp check
const mergeById = <T extends { id: string; updatedAt?: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>();
  local.forEach(item => map.set(item.id, item));
  remote.forEach(item => {
    const existing = map.get(item.id);
    if (existing) {
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const remoteTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      
      if (remoteTime >= localTime) {
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
          establishment_id: item.establishmentId || null
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
          active: item.active
        };
      }
      if (table === 'schedules') {
        return {
          id: item.id,
          rider_id: item.riderId,
          establishment_id: item.establishmentId,
          date: item.date,
          shift: item.shift,
          start_time: item.startTime,
          end_time: item.endTime,
          created_by: item.createdBy,
          created_at: item.createdAt
        };
      }
      if (table === 'deliveries') {
        return {
          id: item.id,
          rider_id: item.riderId,
          establishment_id: item.establishmentId,
          date: item.date,
          time: item.time,
          value: item.value,
          status: item.status,
          schedule_id: item.scheduleId || null,
          order_number: item.orderNumber || null,
          notes: item.notes || null,
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

    const { error } = await supabase.from(table).upsert(formattedData);
    if (error) {
      console.warn(`⚠️ Erro ao sincronizar tabela "${table}" com Supabase.`, error.message);
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

  getUsers: () => {
    const users = getStorageData<User[]>('dm_users', INITIAL_USERS);
    let updated = false;
    const merged = [...users];
    INITIAL_USERS.forEach(initUser => {
      if (!merged.some(u => u.email.toLowerCase() === initUser.email.toLowerCase())) {
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
    setStorageData('dm_users', users);
    syncToSupabase('users', users);
  },
  
  getEstablishments: () => {
    const ests = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
    let updated = false;
    const merged = [...ests];
    INITIAL_ESTABLISHMENTS.forEach(initEst => {
      if (!merged.some(e => e.id === initEst.id)) {
        merged.push(initEst);
        updated = true;
      }
    });
    if (updated) {
      setStorageData('dm_establishments', merged);
    }
    return merged;
  },
  setEstablishments: (est: Establishment[]) => {
    setStorageData('dm_establishments', est);
    syncToSupabase('establishments', est);
  },
  
  getSchedules: () => getStorageData<Schedule[]>('dm_schedules', []),
  setSchedules: (sch: Schedule[]) => {
    setStorageData('dm_schedules', sch);
    syncToSupabase('schedules', sch);
  },
  
  getDeliveries: () => getStorageData<Delivery[]>('dm_deliveries', []),
  setDeliveries: (del: Delivery[]) => {
    setStorageData('dm_deliveries', del);
    syncToSupabase('deliveries', del);
  },
  
  getNotifications: () => getStorageData<Notification[]>('dm_notifications', []),
  setNotifications: (notif: Notification[]) => {
    setStorageData('dm_notifications', notif);
    syncToSupabase('notifications', notif);
  },

  getPartnerRequests: () => getStorageData<PartnerRequest[]>('dm_partner_requests', []),
  setPartnerRequests: (reqs: PartnerRequest[]) => {
    setStorageData('dm_partner_requests', reqs);
    syncToSupabase('partner_requests', reqs);
  },

  getRiderLocations: (): RiderLocation[] => getStorageData<RiderLocation[]>('dm_rider_locations', []),
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
      // 1. Carregar estabelecimentos primeiro
      const { data: ests, error: estsError } = await supabase.from('establishments').select('*');
      let localEsts = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
      const estIdMap = new Map<string, string>(); // De ID antigo para ID novo do Supabase

      if (!estsError && ests) {
        const mappedEsts: Establishment[] = ests.map(e => ({
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
          active: e.active
        }));

        // Mesclar estabelecimentos por nome único para evitar duplicados
        const mergedEsts: Establishment[] = [];
        localEsts.forEach(local => {
          const remoteMatch = mappedEsts.find(r => r.name.toLowerCase() === local.name.toLowerCase());
          if (remoteMatch) {
            if (local.id !== remoteMatch.id) {
              estIdMap.set(local.id, remoteMatch.id);
            }
            mergedEsts.push({ ...local, id: remoteMatch.id });
          } else {
            mergedEsts.push(local);
          }
        });

        mappedEsts.forEach(remote => {
          if (!mergedEsts.some(e => e.id === remote.id)) {
            mergedEsts.push(remote);
          }
        });

        localEsts = mergedEsts;
        setStorageData('dm_establishments', localEsts);
        await syncToSupabase('establishments', localEsts);
      }

      // 2. Carregar usuários
      const { data: users, error: usersError } = await supabase.from('users').select('*');
      let localUsers = getStorageData<User[]>('dm_users', INITIAL_USERS);
      const userIdMap = new Map<string, string>(); // De ID antigo para ID novo do Supabase

      if (!usersError && users) {
        const mappedUsers: User[] = users.map(u => ({
          id: u.id,
          name: u.name,
          cpf: u.cpf,
          phone: u.phone || '',
          email: u.email,
          role: u.role as any,
          active: u.active,
          passwordHash: u.password_hash,
          mustResetPassword: u.must_reset_password,
          establishmentId: u.establishment_id || undefined
        }));

        // Mesclar usuários por e-mail ou CPF único para evitar duplicados
        const mergedUsers: User[] = [];
        localUsers.forEach(local => {
          const remoteMatch = mappedUsers.find(
            r => r.email.toLowerCase() === local.email.toLowerCase() || r.cpf === local.cpf
          );
          if (remoteMatch) {
            if (local.id !== remoteMatch.id) {
              userIdMap.set(local.id, remoteMatch.id);
            }
            mergedUsers.push({ 
              ...local, 
              id: remoteMatch.id,
              establishmentId: remoteMatch.establishmentId || local.establishmentId 
            });
          } else {
            mergedUsers.push(local);
          }
        });

        mappedUsers.forEach(remote => {
          if (!mergedUsers.some(u => u.id === remote.id)) {
            mergedUsers.push(remote);
          }
        });

        localUsers = mergedUsers;

        // Atualizar referências de estabelecimentos nos usuários
        if (estIdMap.size > 0) {
          localUsers = localUsers.map(u => {
            if (u.establishmentId && estIdMap.has(u.establishmentId)) {
              return { ...u, establishmentId: estIdMap.get(u.establishmentId) };
            }
            return u;
          });
        }

        setStorageData('dm_users', localUsers);

        // Atualizar usuário logado se o ID dele mudou
        const currentUser = db.getCurrentUser();
        if (currentUser) {
          const updatedCurrent = localUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
          if (updatedCurrent) {
            db.setCurrentUser(updatedCurrent);
          }
        }

        await syncToSupabase('users', localUsers);
      }

      // 3. Carregar escalas e atualizar referências de IDs
      const { data: schs, error: schsError } = await supabase.from('schedules').select('*');
      let localSchs = getStorageData<Schedule[]>('dm_schedules', []);

      // Atualizar referências de IDs antigos para novos nas escalas locais
      if (userIdMap.size > 0 || estIdMap.size > 0) {
        localSchs = localSchs.map(s => ({
          ...s,
          riderId: userIdMap.get(s.riderId) || s.riderId,
          establishmentId: estIdMap.get(s.establishmentId) || s.establishmentId
        }));
      }

      if (!schsError && schs) {
        const mappedSchs: Schedule[] = schs.map(s => ({
          id: s.id,
          riderId: s.rider_id,
          establishmentId: s.establishment_id,
          date: s.date,
          shift: s.shift as any,
          startTime: s.start_time,
          endTime: s.end_time,
          createdBy: s.created_by || 'Admin',
          createdAt: s.created_at
        }));

        const merged = mergeById(localSchs, mappedSchs);
        localSchs = merged;
        setStorageData('dm_schedules', localSchs);
        await syncToSupabase('schedules', localSchs);
      } else {
        setStorageData('dm_schedules', localSchs);
      }

      // 4. Carregar corridas e atualizar referências de IDs
      const { data: dels, error: delsError } = await supabase.from('deliveries').select('*');
      let localDels = getStorageData<Delivery[]>('dm_deliveries', []);

      if (userIdMap.size > 0 || estIdMap.size > 0) {
        localDels = localDels.map(d => ({
          ...d,
          riderId: userIdMap.get(d.riderId) || d.riderId,
          establishmentId: estIdMap.get(d.establishmentId) || d.establishmentId
        }));
      }

      if (!delsError && dels) {
        const mappedDels: Delivery[] = dels.map(d => ({
          id: d.id,
          riderId: d.rider_id,
          establishmentId: d.establishment_id,
          date: d.date,
          time: d.time,
          value: Number(d.value),
          status: d.status as any,
          scheduleId: d.schedule_id || undefined,
          orderNumber: d.order_number || undefined,
          notes: d.notes || undefined,
          updatedAt: d.updated_at || undefined
        }));

        const merged = mergeById(localDels, mappedDels);
        localDels = merged;
        setStorageData('dm_deliveries', localDels);
        await syncToSupabase('deliveries', localDels);
      } else {
        setStorageData('dm_deliveries', localDels);
      }

      // 5. Carregar notificações e atualizar referências de IDs
      const { data: notifs, error: notifsError } = await supabase.from('notifications').select('*');
      let localNotifs = getStorageData<Notification[]>('dm_notifications', []);

      if (userIdMap.size > 0) {
        localNotifs = localNotifs.map(n => ({
          ...n,
          riderId: userIdMap.get(n.riderId) || n.riderId
        }));
      }

      if (!notifsError && notifs) {
        const mappedNotifs: Notification[] = notifs.map(n => ({
          id: n.id,
          riderId: n.rider_id,
          title: n.title,
          message: n.message,
          date: n.date,
          read: n.read
        }));

        const merged = mergeById(localNotifs, mappedNotifs);
        localNotifs = merged;
        setStorageData('dm_notifications', localNotifs);
        await syncToSupabase('notifications', localNotifs);
      } else {
        setStorageData('dm_notifications', localNotifs);
      }

      // 6. Carregar solicitações de parceria
      const { data: reqs, error: reqsError } = await supabase.from('partner_requests').select('*');
      if (!reqsError && reqs) {
        const mappedReqs: PartnerRequest[] = reqs.map(r => ({
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
        await syncToSupabase('partner_requests', merged);
      }

      // 7. Carregar localizações dos motoboys
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