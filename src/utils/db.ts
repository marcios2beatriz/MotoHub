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

// Tables that don't exist in Supabase will be disabled dynamically to use only LocalStorage
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

// Helper to merge local and remote data by ID
const mergeById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>();
  local.forEach(item => map.set(item.id, item));
  remote.forEach(item => {
    const existing = map.get(item.id);
    if (existing) {
      const merged = { ...existing };
      (Object.keys(item) as (keyof T)[]).forEach(key => {
        const value = item[key];
        if (value !== undefined) {
          merged[key] = value;
        }
      });
      map.set(item.id, merged);
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
          notes: item.notes || null
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
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn(`⚠️ Tabela "${table}" não existe no Supabase. Usando LocalStorage como fallback.`);
        disabledTables.add(table);
      } else {
        console.error(`Erro ao sincronizar tabela ${table}:`, error.message);
      }
    }
  } catch (err: any) {
    console.warn('Erro ao sincronizar com o Supabase:', err?.message || err);
  }
};

export const db = {
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
    // Also sync to Supabase if table exists
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
    // Salva localmente
    setStorageData('dm_rider_locations', locations);

    // Envia direto ao Supabase (upsert em tempo real, sem batch)
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
    // ── USERS ──────────────────────────────────────────────────────────────
    if (!disabledTables.has('users')) {
      try {
        const { data: users, error: usersError } = await supabase.from('users').select('*');
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
          const localUsers = getStorageData<User[]>('dm_users', INITIAL_USERS);
          const merged = mergeById(localUsers, mappedUsers);
          setStorageData('dm_users', merged);
          await syncToSupabase('users', merged);
        } else {
          if (usersError?.message?.includes('schema cache') || usersError?.message?.includes('does not exist') || usersError?.code === '42P01') {
            disabledTables.add('users');
          }
          const localUsers = getStorageData<User[]>('dm_users', INITIAL_USERS);
          await syncToSupabase('users', localUsers);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela users:', err);
      }
    }

    // ── ESTABLISHMENTS ─────────────────────────────────────────────────────
    if (!disabledTables.has('establishments')) {
      try {
        const { data: ests, error: estsError } = await supabase.from('establishments').select('*');
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
          const localEsts = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
          const merged = mergeById(localEsts, mappedEsts);
          setStorageData('dm_establishments', merged);
          await syncToSupabase('establishments', merged);
        } else {
          if (estsError?.message?.includes('schema cache') || estsError?.message?.includes('does not exist') || estsError?.code === '42P01') {
            disabledTables.add('establishments');
          }
          const localEsts = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
          await syncToSupabase('establishments', localEsts);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela establishments:', err);
      }
    }

    // ── SCHEDULES ──────────────────────────────────────────────────────────
    if (!disabledTables.has('schedules')) {
      try {
        const { data: schs, error: schsError } = await supabase.from('schedules').select('*');
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
          const localSchs = getStorageData<Schedule[]>('dm_schedules', []);
          const merged = mergeById(localSchs, mappedSchs);
          setStorageData('dm_schedules', merged);
          await syncToSupabase('schedules', merged);
        } else {
          if (schsError?.message?.includes('schema cache') || schsError?.message?.includes('does not exist') || schsError?.code === '42P01') {
            disabledTables.add('schedules');
          }
          const localSchs = getStorageData<Schedule[]>('dm_schedules', []);
          if (localSchs.length > 0) await syncToSupabase('schedules', localSchs);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela schedules:', err);
      }
    }

    // ── DELIVERIES ─────────────────────────────────────────────────────────
    if (!disabledTables.has('deliveries')) {
      try {
        const { data: dels, error: delsError } = await supabase.from('deliveries').select('*');
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
            notes: d.notes || undefined
          }));
          const localDels = getStorageData<Delivery[]>('dm_deliveries', []);
          const merged = mergeById(localDels, mappedDels);
          setStorageData('dm_deliveries', merged);
          await syncToSupabase('deliveries', merged);
        } else {
          if (delsError?.message?.includes('schema cache') || delsError?.message?.includes('does not exist') || delsError?.code === '42P01') {
            disabledTables.add('deliveries');
          }
          const localDels = getStorageData<Delivery[]>('dm_deliveries', []);
          if (localDels.length > 0) await syncToSupabase('deliveries', localDels);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela deliveries:', err);
      }
    }

    // ── NOTIFICATIONS ──────────────────────────────────────────────────────
    if (!disabledTables.has('notifications')) {
      try {
        const { data: notifs, error: notifsError } = await supabase.from('notifications').select('*');
        if (!notifsError && notifs) {
          const mappedNotifs: Notification[] = notifs.map(n => ({
            id: n.id,
            riderId: n.rider_id,
            title: n.title,
            message: n.message,
            date: n.date,
            read: n.read
          }));
          const localNotifs = getStorageData<Notification[]>('dm_notifications', []);
          const merged = mergeById(localNotifs, mappedNotifs);
          setStorageData('dm_notifications', merged);
          await syncToSupabase('notifications', merged);
        } else {
          if (notifsError?.message?.includes('schema cache') || notifsError?.message?.includes('does not exist') || notifsError?.code === '42P01') {
            disabledTables.add('notifications');
          }
          const localNotifs = getStorageData<Notification[]>('dm_notifications', []);
          if (localNotifs.length > 0) await syncToSupabase('notifications', localNotifs);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela notifications:', err);
      }
    }

    // ── PARTNER REQUESTS ───────────────────────────────────────────────────
    if (!disabledTables.has('partner_requests')) {
      try {
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
        } else {
          if (reqsError?.message?.includes('schema cache') || reqsError?.message?.includes('does not exist') || reqsError?.code === '42P01') {
            disabledTables.add('partner_requests');
          }
          const localReqs = getStorageData<PartnerRequest[]>('dm_partner_requests', []);
          if (localReqs.length > 0) await syncToSupabase('partner_requests', localReqs);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela partner_requests:', err);
      }
    }

    // ── RIDER LOCATIONS (pull only – escritas feitas direto pelo motoboy) ──
    if (!disabledTables.has('rider_locations')) {
      try {
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
        } else {
          if (locsError?.message?.includes('does not exist') || locsError?.code === '42P01') {
            disabledTables.add('rider_locations');
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar tabela rider_locations:', err);
      }
    }

    console.log('✅ Sincronização com Supabase concluída de forma robusta.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-sync-complete'));
    }
  }
};