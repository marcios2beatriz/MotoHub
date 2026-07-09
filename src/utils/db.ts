"use client";

import { supabase } from './supabase';

export interface User {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  role: 'admin' | 'rider';
  active: boolean;
  passwordHash: string;
  mustResetPassword?: boolean;
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
  status: 'active' | 'cancelled';
  scheduleId?: string;
}

export interface Notification {
  id: string;
  riderId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

// Seed Data inicial para fallback
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

// Sincronização assíncrona em background com Supabase com tratamento de erro detalhado
const syncToSupabase = async (table: string, data: any[]) => {
  try {
    // Mapeamento simples para o formato do banco de dados
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
          must_reset_password: item.mustResetPassword || false
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
          schedule_id: item.scheduleId || null
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
      return item;
    });

    const { error } = await supabase.from(table).upsert(formattedData);
    if (error) {
      console.error(`Erro ao sincronizar tabela ${table}:`, error.message);
    }
  } catch (err: any) {
    console.warn('Erro ao sincronizar com o Supabase:', err?.message || err);
  }
};

export const db = {
  getUsers: () => getStorageData<User[]>('dm_users', INITIAL_USERS),
  setUsers: (users: User[]) => {
    setStorageData('dm_users', users);
    syncToSupabase('users', users);
  },
  
  getEstablishments: () => getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS),
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

  // Função para carregar dados do Supabase e, se estiver vazio, empurrar localStorage
  pullFromSupabase: async () => {
    try {
      // ── USERS ──────────────────────────────────────────────────────────────
      const { data: users, error: usersError } = await supabase.from('users').select('*');
      if (usersError) throw usersError;
      if (users && users.length > 0) {
        const mappedUsers: User[] = users.map(u => ({
          id: u.id,
          name: u.name,
          cpf: u.cpf,
          phone: u.phone || '',
          email: u.email,
          role: u.role as any,
          active: u.active,
          passwordHash: u.password_hash,
          mustResetPassword: u.must_reset_password
        }));
        setStorageData('dm_users', mappedUsers);
      } else {
        // Tabela vazia → enviar dados do localStorage para o Supabase
        const localUsers = getStorageData<User[]>('dm_users', INITIAL_USERS);
        await syncToSupabase('users', localUsers);
      }

      // ── ESTABLISHMENTS ─────────────────────────────────────────────────────
      const { data: ests, error: estsError } = await supabase.from('establishments').select('*');
      if (estsError) throw estsError;
      if (ests && ests.length > 0) {
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
        setStorageData('dm_establishments', mappedEsts);
      } else {
        const localEsts = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS);
        await syncToSupabase('establishments', localEsts);
      }

      // ── SCHEDULES ──────────────────────────────────────────────────────────
      const { data: schs, error: schsError } = await supabase.from('schedules').select('*');
      if (schsError) throw schsError;
      if (schs && schs.length > 0) {
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
        setStorageData('dm_schedules', mappedSchs);
      } else {
        const localSchs = getStorageData<Schedule[]>('dm_schedules', []);
        if (localSchs.length > 0) await syncToSupabase('schedules', localSchs);
      }

      // ── DELIVERIES ─────────────────────────────────────────────────────────
      const { data: dels, error: delsError } = await supabase.from('deliveries').select('*');
      if (delsError) throw delsError;
      if (dels && dels.length > 0) {
        const mappedDels: Delivery[] = dels.map(d => ({
          id: d.id,
          riderId: d.rider_id,
          establishmentId: d.establishment_id,
          date: d.date,
          time: d.time,
          value: Number(d.value),
          status: d.status as any,
          scheduleId: d.schedule_id || undefined
        }));
        setStorageData('dm_deliveries', mappedDels);
      } else {
        const localDels = getStorageData<Delivery[]>('dm_deliveries', []);
        if (localDels.length > 0) await syncToSupabase('deliveries', localDels);
      }

      // ── NOTIFICATIONS ──────────────────────────────────────────────────────
      const { data: notifs, error: notifsError } = await supabase.from('notifications').select('*');
      if (notifsError) throw notifsError;
      if (notifs && notifs.length > 0) {
        const mappedNotifs: Notification[] = notifs.map(n => ({
          id: n.id,
          riderId: n.rider_id,
          title: n.title,
          message: n.message,
          date: n.date,
          read: n.read
        }));
        setStorageData('dm_notifications', mappedNotifs);
      } else {
        const localNotifs = getStorageData<Notification[]>('dm_notifications', []);
        if (localNotifs.length > 0) await syncToSupabase('notifications', localNotifs);
      }

      console.log('✅ Sincronização com Supabase concluída.');
    } catch (err) {
      console.warn('Não foi possível sincronizar com o Supabase:', err);
    }
  }
};