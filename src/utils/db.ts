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

// Seed Data com endereços reais de Campina Grande - PB
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
    passwordHash: 'burgrill',
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
      street: 'Rua Aprígio Veloso',
      number: '882',
      neighborhood: 'Bodocongó',
      city: 'Campina Grande',
      state: 'PB',
      zipCode: '58429-900'
    },
    phone: '(83) 3111-2222',
    active: true,
    updatedAt: new Date().toISOString()
  }
];

// Coordenadas iniciais de teste em Campina Grande - PB
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

const getDeletedIds = (): string[] => getStorageData<string[]>('dm_deleted_ids', []);

const addDeletedId = (id: string, supabaseTable: string) => {
  const deleted = getDeletedIds();
  if (!deleted.includes(id)) {
    const updated = [...deleted, id];
    setStorageData('dm_deleted_ids', updated);
    
    supabase.from(supabaseTable).delete().eq('id', id).then(({ error }) => {
      if (error) console.warn(`[Supabase] Erro ao excluir ID ${id} da tabela ${supabaseTable}:`, error.message);
    });
  }
};

const trackDeletions = (key: string, newData: { id: string }[], supabaseTable: string) => {
  const oldData = getStorageData<{ id: string }[]>(key, []);
  const newIds = new Set(newData.map(item => item.id));
  
  oldData.forEach(oldItem => {
    if (!newIds.has(oldItem.id)) {
      addDeletedId(oldItem.id, supabaseTable);
    }
  });
};

// Helper inteligente para extrair o nome da coluna ausente de qualquer formato de erro do Supabase/PostgREST
const getMissingColumn = (msg: string): string | null => {
  let match = msg.match(/Could not find the '([^']+)' column/i);
  if (match) return match[1];
  
  match = msg.match(/column "([^"]+)"/i);
  if (match) return match[1];

  match = msg.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  if (match) return match[1];
  
  return null;
};

// Sincronização activa com o Supabase
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
        return {
          id: item.id,
          rider_id: item.riderId,
          establishment_id: item.establishmentId,
          date: item.date,
          shift: item.shift,
          start_time: item.startTime,
          end_time: item.endTime,
          created_by: item.createdBy || 'Admin',
          chat: item.chat || null,
          created_at: item.createdAt,
          updated_at: item.updatedAt || item.createdAt || new Date().toISOString()
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
          order_number: item.orderNumber || null, // Apenas o número do pedido curto!
          notes: item.notes || null, // Coluna separada
          customer_chat: item.customerChat || null, // Coluna separada
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
      let missingCol = getMissingColumn(error.message);
      
      while (error && missingCol && attempts < 10) {
        attempts++;
        console.warn(`⚠️ Coluna '${missingCol}' não encontrada na tabela '${table}' do Supabase. Removendo do envio...`);
        currentData = currentData.map(item => {
          const { [missingCol!]: _, ...rest } = item;
          return rest;
        });
        const retry = await supabase.from(table).upsert(currentData);
        error = retry.error;
        missingCol = error ? getMissingColumn(error.message) : null;
      }
    }

    if (error) {
      console.error(`❌ Erro crítico ao salvar na tabela "${table}" do Supabase:`, error.message);
      if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("relation")) {
        disabledTables.add(table);
      }
    } else {
      console.log(`🚀 Dados sincronizados com sucesso no Supabase para a tabela "${table}".`);
    }
  } catch (err: any) {
    console.error('Erro de conexão ao sincronizar com o Supabase:', err?.message || err);
  }
};

export const db = {
  getLocalDateString: (date = new Date()) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  },

  resolveUser: (id: string): User | undefined => {
    const allUsers = db.getUsers();
    return allUsers.find(u => u.id === id);
  },

  resolveEstablishment: (id: string): Establishment | undefined => {
    const allEsts = db.getEstablishments();
    return allEsts.find(e => e.id === id);
  },

  getUsers: () => {
    let deletedIds = getDeletedIds();
    
    // GARANTIA DE SEGURANÇA: Se o usuário Burgrill (u5) foi deletado por engano, vamos restaurá-lo limpando-o da lista de deletados
    if (deletedIds.includes('u5')) {
      deletedIds = deletedIds.filter(id => id !== 'u5');
      setStorageData('dm_deleted_ids', deletedIds);
    }

    let users = getStorageData<User[]>('dm_users', INITIAL_USERS).filter(u => !deletedIds.includes(u.id));
    const ests = getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS).filter(e => !deletedIds.includes(e.id));
    
    // Auto-correção de segurança dinâmica para garantir que o usuário do Burgrill tenha os dados corretos
    let updated = false;
    users = users.map(u => {
      if (u.email.toLowerCase() === 'burgrill@delivery.com') {
        // Encontra dinamicamente o ID do estabelecimento Burgrill ativo
        const burgrillEst = ests.find(e => e.name.toLowerCase().includes('burgrill'));
        const targetEstId = burgrillEst ? burgrillEst.id : 'e2';

        if (u.passwordHash !== 'burgrill' || u.name !== 'Gerente Burgrill' || u.establishmentId !== targetEstId || u.role !== 'establishment') {
          updated = true;
          return { 
            ...u, 
            name: 'Gerente Burgrill',
            passwordHash: 'burgrill',
            role: 'establishment' as const,
            establishmentId: targetEstId
          };
        }
      }
      return u;
    });

    // GARANTIA SUPREMA: O administrador padrão (ID 'u1') NUNCA pode ser alterado, deletado ou desativado
    const adminUser = users.find(u => u.id === 'u1');
    if (!adminUser || adminUser.email !== 'admin@delivery.com' || adminUser.role !== 'admin' || !adminUser.active || adminUser.name !== 'Administrador Geral') {
      updated = true;
      const defaultAdmin = INITIAL_USERS[0];
      
      // Remove o ID do admin da lista de deletados se estiver lá
      const deleted = getDeletedIds().filter(id => id !== defaultAdmin.id);
      setStorageData('dm_deleted_ids', deleted);

      // Adiciona ou reativa o admin
      users = users.filter(u => u.id !== 'u1');
      users.unshift(defaultAdmin);
    }

    if (updated) {
      setStorageData('dm_users', users);
    }
    return users;
  },
  setUsers: (users: User[]) => {
    trackDeletions('dm_users', users, 'users');
    setStorageData('dm_users', users);
    syncToSupabase('users', users);
  },
  deleteUser: (id: string) => {
    if (id === 'u1') {
      console.warn('Tentativa de deletar o administrador padrão bloqueada.');
      return;
    }
    addDeletedId(id, 'users');

    // Limpar escalas vinculadas ao motoboy/gerente para evitar violação de chave estrangeira no Supabase
    const allSchedules = db.getSchedules();
    const schedulesToDelete = allSchedules.filter(s => s.riderId === id);
    schedulesToDelete.forEach(s => addDeletedId(s.id, 'schedules'));
    const updatedSchedules = allSchedules.filter(s => s.riderId !== id);
    setStorageData('dm_schedules', updatedSchedules);

    // Limpar corridas vinculadas ao motoboy para evitar violação de chave estrangeira no Supabase
    const allDeliveries = db.getDeliveries();
    const deliveriesToDelete = allDeliveries.filter(d => d.riderId === id);
    deliveriesToDelete.forEach(d => addDeletedId(d.id, 'deliveries'));
    const updatedDeliveries = allDeliveries.filter(d => d.riderId !== id);
    setStorageData('dm_deliveries', updatedDeliveries);

    const users = db.getUsers().filter(u => u.id !== id);
    setStorageData('dm_users', users);
  },
  
  getEstablishments: () => {
    let deletedIds = getDeletedIds();

    // GARANTIA DE SEGURANÇA: Se o estabelecimento Burgrill (e2) foi deletado por engano, vamos restaurá-lo limpando-o da lista de deletados
    if (deletedIds.includes('e2')) {
      deletedIds = deletedIds.filter(id => id !== 'e2');
      setStorageData('dm_deleted_ids', deletedIds);
    }

    return getStorageData<Establishment[]>('dm_establishments', INITIAL_ESTABLISHMENTS).filter(e => !deletedIds.includes(e.id));
  },
  setEstablishments: (est: Establishment[]) => {
    trackDeletions('dm_establishments', est, 'establishments');
    setStorageData('dm_establishments', est);
    syncToSupabase('establishments', est);
  },
  deleteEstablishment: (id: string) => {
    // 1. Adicionar ID do estabelecimento aos deletados
    addDeletedId(id, 'establishments');
    
    // 2. Limpar referências em outras tabelas locais e disparar deletes no Supabase para evitar violação de chave estrangeira
    // Usuários vinculados: remover o vínculo de estabelecimento
    const allUsers = db.getUsers();
    const updatedUsers = allUsers.map(u => u.establishmentId === id ? { ...u, establishmentId: undefined } : u);
    db.setUsers(updatedUsers);

    // Escalas vinculadas: deletar
    const allSchedules = db.getSchedules();
    const schedulesToDelete = allSchedules.filter(s => s.establishmentId === id);
    schedulesToDelete.forEach(s => addDeletedId(s.id, 'schedules'));
    const updatedSchedules = allSchedules.filter(s => s.establishmentId !== id);
    setStorageData('dm_schedules', updatedSchedules);

    // Corridas vinculadas: deletar
    const allDeliveries = db.getDeliveries();
    const deliveriesToDelete = allDeliveries.filter(d => d.establishmentId === id);
    deliveriesToDelete.forEach(d => addDeletedId(d.id, 'deliveries'));
    const updatedDeliveries = allDeliveries.filter(d => d.establishmentId !== id);
    setStorageData('dm_deliveries', updatedDeliveries);

    // Filtrar e salvar estabelecimentos
    const ests = db.getEstablishments().filter(e => e.id !== id);
    setStorageData('dm_establishments', ests);
  },
  
  getSchedules: () => {
    const deletedIds = getDeletedIds();
    const ests = db.getEstablishments();
    const estIds = new Set(ests.map(e => e.id));
    
    // Auto-cura: Filtra escalas que apontam para estabelecimentos que foram deletados
    return getStorageData<Schedule[]>('dm_schedules', [])
      .filter(s => !deletedIds.includes(s.id) && estIds.has(s.establishmentId));
  },
  setSchedules: (sch: Schedule[]) => {
    trackDeletions('dm_schedules', sch, 'schedules');
    setStorageData('dm_schedules', sch);
    syncToSupabase('schedules', sch);
  },
  
  getDeliveries: () => {
    const deletedIds = getDeletedIds();
    const ests = db.getEstablishments();
    const estIds = new Set(ests.map(e => e.id));

    // Auto-cura: Filtra corridas que apontam para estabelecimentos que foram deletados
    return getStorageData<Delivery[]>('dm_deliveries', [])
      .filter(d => !deletedIds.includes(d.id) && estIds.has(d.establishmentId));
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

    if (!disabledTables.has('rider_locations')) {
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
          if (error) {
            console.warn('GPS sync error:', error.message);
            if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("relation")) {
              disabledTables.add('rider_locations');
            }
          }
        });
    }
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
      if (!disabledTables.has('establishments')) {
        const { data: ests, error: estsError } = await supabase.from('establishments').select('*');
        if (estsError) {
          if (estsError.message.includes("404") || estsError.message.includes("not found") || estsError.message.includes("relation")) {
            disabledTables.add('establishments');
          }
        } else if (ests && ests.length > 0) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = ests.filter(e => deletedIds.includes(e.id));
          toDeleteRemotely.forEach(e => {
            supabase.from('establishments').delete().eq('id', e.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar estabelecimento órfão:', error.message);
            });
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
          
          // Sobrescrita direta para propagar exclusões remotas
          setStorageData('dm_establishments', mappedEsts);
        }
      }

      // 2. Sincronizar Usuários
      if (!disabledTables.has('users')) {
        const { data: users, error: usersError } = await supabase.from('users').select('*');
        if (usersError) {
          if (usersError.message.includes("404") || usersError.message.includes("not found") || usersError.message.includes("relation")) {
            disabledTables.add('users');
          }
        } else if (users && users.length > 0) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = users.filter(u => deletedIds.includes(u.id));
          toDeleteRemotely.forEach(u => {
            supabase.from('users').delete().eq('id', u.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar usuário órfão:', error.message);
            });
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
          
          // Sobrescrita direta para propagar exclusões remotas
          setStorageData('dm_users', mappedUsers);

          // Atualiza a sessão do usuário logado
          const currentUser = db.getCurrentUser();
          if (currentUser) {
            const updatedCurrent = mappedUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
            if (updatedCurrent) {
              db.setCurrentUser(updatedCurrent);
            }
          }
        }
      }

      // 3. Sincronizar Escalas (Schedules) com De-duplicação e Auto-Cura Ativa
      if (!disabledTables.has('schedules')) {
        const { data: schs, error: schsError } = await supabase.from('schedules').select('*');
        if (schsError) {
          if (schsError.message.includes("404") || schsError.message.includes("not found") || schsError.message.includes("relation")) {
            disabledTables.add('schedules');
          }
        } else if (schs) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = schs.filter(s => deletedIds.includes(s.id));
          toDeleteRemotely.forEach(s => {
            supabase.from('schedules').delete().eq('id', s.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar escala órfã:', error.message);
            });
          });

          const mappedSchs: Schedule[] = schs
            .filter(s => !deletedIds.includes(s.id))
            .map(s => {
              let createdBy = s.created_by || 'Admin';
              let chat = s.chat || undefined;
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
                riderId: s.rider_id,
                establishmentId: s.establishment_id,
                date: s.date,
                shift: s.shift as any,
                startTime: s.start_time,
                endTime: s.end_time,
                createdBy,
                createdAt: s.created_at,
                chat: chat || s.chat || undefined,
                updatedAt
              };
            });
          
          // MECANISMO DE AUTO-CURA: De-duplicar escalas (mesmo riderId, date e shift)
          // Isso limpa escalas fantasmas que ficaram presas no banco de dados do Supabase
          const uniqueSchs: Schedule[] = [];
          const seenKeys = new Set<string>();
          const duplicateIdsToDelete: string[] = [];

          mappedSchs.forEach(s => {
            const key = `${s.riderId}_${s.date}_${s.shift}`;
            if (seenKeys.has(key)) {
              duplicateIdsToDelete.push(s.id);
            } else {
              seenKeys.add(key);
              uniqueSchs.push(s);
            }
          });

          // Se houver duplicatas no Supabase, tenta excluí-las em segundo plano para limpar o banco definitivamente
          if (duplicateIdsToDelete.length > 0) {
            console.log(`[Auto-Cura] Detectadas ${duplicateIdsToDelete.length} escalas duplicadas no Supabase. Removendo...`);
            duplicateIdsToDelete.forEach(id => {
              supabase.from('schedules').delete().eq('id', id).then(({ error }) => {
                if (error) console.warn('Erro ao remover escala duplicada:', error.message);
              });
            });
          }

          // Sobrescrita direta para propagar exclusões remotas e evitar duplicidade
          setStorageData('dm_schedules', uniqueSchs);
        }
      }

      // 4. Sincronizar Corridas (Deliveries)
      if (!disabledTables.has('deliveries')) {
        const { data: dels, error: delsError } = await supabase.from('deliveries').select('*');
        if (delsError) {
          if (delsError.message.includes("404") || delsError.message.includes("not found") || delsError.message.includes("relation")) {
            disabledTables.add('deliveries');
          }
        } else if (dels) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = dels.filter(d => deletedIds.includes(d.id));
          toDeleteRemotely.forEach(d => {
            supabase.from('deliveries').delete().eq('id', d.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar corrida órfã:', error.message);
            });
          });

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
                riderId: d.rider_id,
                establishmentId: d.establishment_id,
                date: d.date,
                time: d.time,
                value: Number(d.value),
                status: d.status as any,
                scheduleId: d.schedule_id || undefined,
                orderNumber: orderNumber || undefined,
                notes: notes || d.notes || undefined,
                customerChat: customerChat || d.customer_chat || undefined,
                updatedAt
              };
            });
          
          // Sobrescrita direta para propagar exclusões remotas
          setStorageData('dm_deliveries', mappedDels);
        }
      }

      // 5. Sincronizar Notificações
      if (!disabledTables.has('notifications')) {
        const { data: notifs, error: notifsError } = await supabase.from('notifications').select('*');
        if (notifsError) {
          if (notifsError.message.includes("404") || notifsError.message.includes("not found") || notifsError.message.includes("relation")) {
            disabledTables.add('notifications');
          }
        } else if (notifs) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = notifs.filter(n => deletedIds.includes(n.id));
          toDeleteRemotely.forEach(n => {
            supabase.from('notifications').delete().eq('id', n.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar notificação órfã:', error.message);
            });
          });

          const mappedNotifs: Notification[] = notifs
            .filter(n => !deletedIds.includes(n.id))
            .map(n => ({
              id: n.id,
              riderId: n.rider_id,
              title: n.title,
              message: n.message,
              date: n.date,
              read: n.read
            }));
          
          // Sobrescrita direta para propagar exclusões remotas
          setStorageData('dm_notifications', mappedNotifs);
        }
      }

      // 6. Sincronizar Solicitações de Parceria
      if (!disabledTables.has('partner_requests')) {
        const { data: reqs, error: reqsError } = await supabase.from('partner_requests').select('*');
        if (reqsError) {
          if (reqsError.message.includes("404") || reqsError.message.includes("not found") || reqsError.message.includes("relation")) {
            disabledTables.add('partner_requests');
          }
        } else if (reqs) {
          // Auto-cura: Deletar do Supabase itens que já foram excluídos localmente
          const toDeleteRemotely = reqs.filter(r => deletedIds.includes(r.id));
          toDeleteRemotely.forEach(r => {
            supabase.from('partner_requests').delete().eq('id', r.id).then(({ error }) => {
              if (error) console.warn('Erro ao deletar solicitação órfã:', error.message);
            });
          });

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
          
          // Sobrescrita direta para propagar exclusões remotas
          setStorageData('dm_partner_requests', mappedReqs);
        }
      }

      // 7. Sincronizar Localizações de GPS
      if (!disabledTables.has('rider_locations')) {
        const { data: locs, error: locsError } = await supabase.from('rider_locations').select('*');
        if (locsError) {
          if (locsError.message.includes("404") || locsError.message.includes("not found") || locsError.message.includes("relation")) {
            disabledTables.add('rider_locations');
          }
        } else if (locs) {
          const mappedLocs: RiderLocation[] = locs.map(l => ({
            riderId: l.rider_id,
            riderName: l.rider_name,
            lat: l.lat,
            lng: l.lng,
            updatedAt: l.updated_at
          }));
          setStorageData('dm_rider_locations', mappedLocs);
        }
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