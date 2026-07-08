"use client";

export interface User {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  role: 'admin' | 'rider';
  active: boolean;
  passwordHash: string; // Simulado
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

// Seed Data
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

const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    riderId: 'u2',
    establishmentId: 'e1',
    date: new Date().toISOString().split('T')[0], // Hoje
    shift: 'night',
    createdBy: 'Administrador Geral',
    createdAt: new Date().toISOString()
  },
  {
    id: 's2',
    riderId: 'u3',
    establishmentId: 'e2',
    date: new Date().toISOString().split('T')[0], // Hoje
    shift: 'afternoon',
    createdBy: 'Administrador Geral',
    createdAt: new Date().toISOString()
  }
];

const INITIAL_DELIVERIES: Delivery[] = [
  {
    id: 'd1',
    riderId: 'u2',
    establishmentId: 'e1',
    date: new Date().toISOString().split('T')[0],
    time: '20:30',
    value: 15.50,
    status: 'active',
    scheduleId: 's1'
  },
  {
    id: 'd2',
    riderId: 'u2',
    establishmentId: 'e1',
    date: new Date().toISOString().split('T')[0],
    time: '21:15',
    value: 18.00,
    status: 'active',
    scheduleId: 's1'
  }
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    riderId: 'u2',
    title: 'Nova Escala Cadastrada',
    message: 'Você foi escalado na Pizzaria Bella Italia para o turno da Noite hoje.',
    date: new Date().toISOString(),
    read: false
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

export const db = {
  getUsers: () => getStorageData<User[]>('dm_users', INITIAL_USERS),
  setUsers: (users: User[]) => setStorageData('dm_users', users),
  
  getEstablishments: () => getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS),
  setEstablishments: (est: Establishment[]) => setStorageData('dm_establishments', est),
  
  getSchedules: () => getStorageData<Schedule[]>('dm_schedules', INITIAL_SCHEDULES),
  setSchedules: (sch: Schedule[]) => setStorageData('dm_schedules', sch),
  
  getDeliveries: () => getStorageData<Delivery[]>('dm_deliveries', INITIAL_DELIVERIES),
  setDeliveries: (del: Delivery[]) => setStorageData('dm_deliveries', del),
  
  getNotifications: () => getStorageData<Notification[]>('dm_notifications', INITIAL_NOTIFICATIONS),
  setNotifications: (notif: Notification[]) => setStorageData('dm_notifications', notif),

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
  }
};