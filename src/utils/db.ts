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
  createdAt?: string;
  phone: string;
  cpf: string;
  passwordHash: string;
  mustResetPassword?: boolean;
  establishmentId?: string;
  updatedAt?: string;
  synced?: boolean;
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
  synced?: boolean;
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
  synced?: boolean;
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
  synced?: boolean;
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
  synced?: boolean;
}

export interface RiderLocation {
  riderId: string;
  riderName: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface DeletedItem {
  id: string;
  table: string;
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
  MISSING_COLUMNS: 'delivery_system_missing_columns',
  DELETED_IDS: 'delivery_system_deleted_ids'
};

// Cache persistente de colunas inexistentes por tabela para evitar requisições redundantes e lentidão
const getMissingColumnsCache = (): Record<string, string[]> => {
  const data = localStorage.getItem(KEYS.MISSING_COLUMNS);
  return data ? JSON.parse(data) : {};
};

const saveMissingColumnsCache = (cache: Record<string, string[]>) => {
  localStorage.setItem(KEYS.MISSING_COLUMNS, JSON.stringify(cache));
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

// Helper para verificar se um endereço está vazio ou contém apenas placeholders padrão
function isAddressEmptyOrPlaceholder(addr: any): boolean {
  if (!addr) return true;
  const street = (addr.street || '').toLowerCase().trim();
  const neighborhood = (addr.neighborhood || '').toLowerCase().trim();
  
  const isEmpty = !street || !neighborhood;
  const isPlaceholder = street === 'sem rua' || street === 'a definir' || neighborhood === 'sem bairro' || neighborhood === 'a definir';
  
  return isEmpty || isPlaceholder;
}

// Função de Auto-Cura para Upsert no Supabase
async function safeUpsert(tableName: string, rawPayload: Record<string, any>): Promise<{ success: boolean; error?: any }> {
  const payload = { ...rawPayload };
  
  // Remove colunas que já sabemos que não existem nesta tabela
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
    // Detecta se o erro é de coluna inexistente no banco de dados
    const match = msg.match(/Could not find the '([^']+)' column/) || 
                  msg.match(/column "([^"]+)"/) || 
                  msg.match(/column '([^']+)'/);
    
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`[Auto-Cura] Removendo coluna inexistente '${missingCol}' da tabela '${tableName}' e tentando novamente.`);
      
      // Adiciona ao cache persistente para evitar tentar enviar esta coluna no futuro
      const currentCache = getMissingColumnsCache();
      if (!currentCache[tableName]) {
        currentCache[tableName] = [];
      }
      if (!currentCache[tableName].includes(missingCol)) {
        currentCache[tableName].push(missingCol);
        saveMissingColumnsCache(currentCache);
      }

      delete payload[missingCol];
      continue; // Tenta novamente com o payload podado
    }

    // Se for outro tipo de erro, retorna o erro para log
    return { success: false, error };
  }

  return { success: false, error: 'Limite de tentativas de auto-cura excedido' };
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

  // --- REGISTRO DE EXCLUSÕES PENDENTES ---
  getDeletedItems(): DeletedItem[] {
    const data = localStorage.getItem(KEYS.DELETED_IDS);
    return data ? JSON.parse(data) : [];
  },
  addDeletedItem(id: string, table: string) {
    const items = this.getDeletedItems();
    if (!items.some(x => x.id === id)) {
      items.push({ id, table });
      localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(items));
    }
  },
  removeDeletedItem(id: string) {
    const items = this.getDeletedItems().filter(x => x.id !== id);
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(items));
  },

  async syncDeletions() {
    const items = this.getDeletedItems();
    for (const item of items) {
      try {
        const { error } = await supabase.from(item.table).delete().eq('id', item.id);
        if (!error) {
          this.removeDeletedItem(item.id);
        } else {
          console.warn(`[Sync] Falha ao deletar ${item.id} da tabela ${item.table}:`, error);
        }
      } catch (e) {
        console.error(`Erro ao deletar ${item.id} da tabela ${item.table}:`, e);
      }
    }
  },

  // --- RESOLVERS & HELPERS ULTRA-ROBUSTOS ---
  resolveUser(id: string): User | undefined {
    if (!id) return undefined;
    const users = this.getUsers();
    const found = users.find(u => u.id === id);
    if (found) return found;

    // Fallback por nome aproximado
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

    // Fallback por nome aproximado
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
    this.addDeletedItem(id, 'users');
    await this.syncDeletions();
  },

  async deleteEstablishment(id: string) {
    const ests = this.getEstablishments().filter(e => e.id !== id);
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    this.addDeletedItem(id, 'establishments');
    await this.syncDeletions();
  },

  async deleteSchedule(id: string) {
    const schedules = this.getSchedules().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    this.addDeletedItem(id, 'schedules');
    await this.syncDeletions();
  },

  async deletePartnerRequest(id: string) {
    const requests = this.getPartnerRequests().filter(r => r.id !== id);
    localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(requests));
    this.addDeletedItem(id, 'partner_requests');
    await this.syncDeletions();
  },

  async deleteDelivery(id: string) {
    const deliveries = this.getDeliveries().filter(d => d.id !== id);
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    this.addDeletedItem(id, 'deliveries');
    await this.syncDeletions();
  },

  // --- RIDER REAL-TIME LOCATION COM AUTO-CURA ---
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
    
    // Envia para o Supabase em background utilizando safeUpsert para evitar erros 400
    const rawPayload = {
      rider_id: riderId,
      rider_name: riderName,
      lat: lat,
      lng: lng,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString()
    };

    safeUpsert('rider_locations', rawPayload).then((result) => {
      if (!result.success) {
        console.warn('Erro ao sincronizar localização com Supabase:', result.error);
      }
    });
  },

  getRiderLocationsRecord(): Record<string, RiderLocation> {
    const data = localStorage.getItem(KEYS.RIDER_LOCATIONS);
    return data ? JSON.parse(data) : {};
  },

  getRiderLocations(): RiderLocation[] {
    return Object.values(this.getRiderLocationsRecord());
  },

  // --- FORÇAR ENVIO DE DADOS LOCAIS PENDENTES ---
  async pushLocalDataToSupabase() {
    const localUsers = this.getUsers();
    const localEsts = this.getEstablishments();
    const localRequests = this.getPartnerRequests();

    // IMPORTANTE: Sincronizar estabelecimentos ANTES de usuários para evitar violação de chave estrangeira (foreign key constraint)
    try {
      if (localEsts.length > 0) {
        await this.syncEstablishmentsToSupabase(localEsts);
      }
    } catch (e) {
      console.warn('Erro ao empurrar estabelecimentos locais:', e);
    }

    try {
      if (localUsers.length > 0) {
        await this.syncUsersToSupabase(localUsers);
      }
    } catch (e) {
      console.warn('Erro ao empurrar usuários locais:', e);
    }

    try {
      if (localRequests.length > 0) {
        await this.syncPartnerRequestsToSupabase(localRequests);
      }
    } catch (e) {
      console.warn('Erro ao empurrar solicitações locais:', e);
    }

    try {
      await this.syncToSupabase();
    } catch (e) {
      console.warn('Erro ao empurrar escalas/corridas locais:', e);
    }

    try {
      await this.syncDeletions();
    } catch (e) {
      console.warn('Erro ao empurrar exclusões pendentes:', e);
    }
  },

  // --- SUPABASE SYNCHRONIZATION ---
  async pullFromSupabase() {
    // 0. PRIMEIRO PASSO (PUSH): Envia qualquer alteração local pendente para o Supabase
    try {
      await this.pushLocalDataToSupabase();
    } catch (err) {
      console.warn('Erro ao enviar dados locais pendentes para o Supabase:', err);
    }

    const deletedIds = new Set(this.getDeletedItems().map(x => x.id));

    // 1. Sincronizar Usuários
    try {
      const { data: usersData, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (usersData) {
        const localUsers = this.getUsers();
        const mappedUsers: User[] = usersData
          .filter(u => !deletedIds.has(u.id))
          .map(u => {
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
              updatedAt: u.updated_at,
              synced: true
            };
          });
        const remoteIds = new Set(mappedUsers.map(u => u.id));
        const unsyncedLocal = localUsers.filter(u => !remoteIds.has(u.id) && !deletedIds.has(u.id) && !u.synced);
        localStorage.setItem(KEYS.USERS, JSON.stringify([...mappedUsers, ...unsyncedLocal]));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "users" do Supabase:', err);
    }

    // 2. Sincronizar Estabelecimentos com Parseamento Seguro de Endereço
    try {
      const { data: estsData, error } = await supabase.from('establishments').select('*');
      if (error) throw error;
      if (estsData) {
        const localEsts = this.getEstablishments();
        const mappedEsts: Establishment[] = estsData
          .filter(e => !deletedIds.has(e.id))
          .map(e => {
            let parsedAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' };
            
            // Se o banco de dados retornou colunas individuais de endereço
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
              // Se retornou como coluna JSON única
              if (typeof e.address === 'object') {
                parsedAddress = { ...parsedAddress, ...e.address };
              } else if (typeof e.address === 'string') {
                try {
                  let temp = JSON.parse(e.address);
                  if (typeof temp === 'string') {
                    temp = JSON.parse(temp);
                  }
                  if (temp && typeof temp === 'object') {
                    parsedAddress = { ...parsedAddress, ...temp };
                  }
                } catch (err) {
                  console.warn('Erro ao parsear endereço do estabelecimento:', err);
                }
              }
            }

            // Preservação de endereço local se o remoto estiver vazio
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
              updatedAt: e.updated_at,
              synced: true
            };
          });
        const remoteIds = new Set(mappedEsts.map(e => e.id));
        const unsyncedLocal = localEsts.filter(e => !remoteIds.has(e.id) && !deletedIds.has(e.id) && !e.synced);
        localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify([...mappedEsts, ...unsyncedLocal]));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "establishments" do Supabase:', err);
    }

    // 3. Sincronizar Escalas (Schedules)
    try {
      const { data: schData, error } = await supabase.from('schedules').select('*');
      if (error) throw error;
      if (schData) {
        const localSchedules = this.getSchedules();
        const mappedSchedules: Schedule[] = schData
          .filter(s => !deletedIds.has(s.id))
          .map(s => {
            const local = localSchedules.find(l => l.id === s.id);
            return {
              id: s.id,
              riderId: s.rider_id,
              establishmentId: s.establishment_id,
              date: s.date,
              shift: s.shift,
              startTime: s.start_time,
              endTime: s.end_time,
              chat: mergeChatStrings(local?.chat, s.chat),
              createdBy: s.created_by || undefined,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true
            };
          });
        const remoteIds = new Set(mappedSchedules.map(s => s.id));
        const unsyncedLocal = localSchedules.filter(s => !remoteIds.has(s.id) && !deletedIds.has(s.id) && !s.synced);
        localStorage.setItem(KEYS.SCHEDULES, JSON.stringify([...mappedSchedules, ...unsyncedLocal]));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "schedules" do Supabase:', err);
    }

    // 4. Sincronizar Corridas (Deliveries)
    try {
      const { data: delData, error } = await supabase.from('deliveries').select('*');
      if (error) throw error;
      if (delData) {
        const localDeliveries = this.getDeliveries();
        
        const mappedDeliveries: Delivery[] = delData
          .filter(d => !deletedIds.has(d.id))
          .map(d => {
            const local = localDeliveries.find(l => l.id === d.id);
            
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
                if (d.order_number.includes('|')) {
                  const parts = d.order_number.split('|');
                  orderNumber = parts[0] || undefined;
                  notes = parts[1] || undefined;
                  customerChat = parts[2] || undefined;
                }
              }
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
              paid: d.paid || false,
              synced: true
            };
          });

        const remoteIds = new Set(mappedDeliveries.map(d => d.id));
        const unsyncedLocal = localDeliveries.filter(l => !remoteIds.has(l.id) && !deletedIds.has(l.id) && !l.synced);
        
        localStorage.setItem(KEYS.DELIVERIES, JSON.stringify([...mappedDeliveries, ...unsyncedLocal]));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "deliveries" do Supabase:', err);
    }

    // 5. Sincronizar Solicitações de Parceria
    try {
      const { data: reqsData, error } = await supabase.from('partner_requests').select('*');
      if (error) throw error;
      if (reqsData) {
        const localReqs = this.getPartnerRequests();
        const mappedReqs: PartnerRequest[] = reqsData
          .filter(r => !deletedIds.has(r.id))
          .map(r => ({
            id: r.id,
            establishmentName: r.establishment_name,
            ownerName: r.owner_name,
            phone: r.phone,
            address: r.address,
            status: r.status,
            createdAt: r.created_at,
            synced: true
          }));
        const remoteIds = new Set(mappedReqs.map(r => r.id));
        const unsyncedLocal = localReqs.filter(r => !remoteIds.has(r.id) && !deletedIds.has(r.id) && !r.synced);
        localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify([...mappedReqs, ...unsyncedLocal]));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "partner_requests" do Supabase:', err);
    }

    // 6. Sincronizar Localizações dos Motoboys (Rider Locations) do Supabase para outros computadores
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
      console.warn('Erro ao sincronizar tabela "rider_locations" do Supabase:', err);
    }

    // Dispara evento global para atualizar as telas em tempo real
    window.dispatchEvent(new Event('db-sync-complete'));
  },

  async syncUsersToSupabase(users: User[]) {
    const deletedIds = new Set(this.getDeletedItems().map(x => x.id));
    let updated = false;
    const localUsers = this.getUsers();
    for (const u of users) {
      if (deletedIds.has(u.id)) continue;
      try {
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

        const result = await safeUpsert('users', rawPayload);
        if (result.success) {
          const localUser = localUsers.find(x => x.id === u.id);
          if (localUser && !localUser.synced) {
            localUser.synced = true;
            updated = true;
          }
        } else {
          console.error(`[Sync] Falha ao sincronizar usuário ${u.id}:`, result.error);
        }
      } catch (e) {
        console.error(`Exceção ao sincronizar usuário ${u.id}:`, e);
      }
    }
    if (updated) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(localUsers));
    }
  },

  async syncEstablishmentsToSupabase(ests: Establishment[]) {
    const deletedIds = new Set(this.getDeletedItems().map(x => x.id));
    let updated = false;
    const localEsts = this.getEstablishments();
    for (const e of ests) {
      if (deletedIds.has(e.id)) continue;
      try {
        const rawPayload = {
          id: e.id,
          name: e.name,
          email: e.email || null,
          active: e.active,
          phone: e.phone || '',
          address: typeof e.address === 'object' ? JSON.stringify(e.address) : e.address,
          // Colunas individuais para compatibilidade com tabelas que não usam JSON
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

        const result = await safeUpsert('establishments', rawPayload);
        if (result.success) {
          const localEst = localEsts.find(x => x.id === e.id);
          if (localEst && !localEst.synced) {
            localEst.synced = true;
            updated = true;
          }
        } else {
          console.error(`[Sync] Falha ao sincronizar estabelecimento ${e.id}:`, result.error);
        }
      } catch (err) {
        console.error(`Exceção ao sincronizar estabelecimento ${e.id}:`, err);
      }
    }
    if (updated) {
      localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(localEsts));
    }
  },

  async syncPartnerRequestsToSupabase(requests: PartnerRequest[]) {
    const deletedIds = new Set(this.getDeletedItems().map(x => x.id));
    let updated = false;
    const localReqs = this.getPartnerRequests();
    try {
      for (const r of requests) {
        if (deletedIds.has(r.id)) continue;
        const rawPayload = {
          id: r.id,
          establishment_name: r.establishmentName,
          owner_name: r.ownerName,
          phone: r.phone,
          address: r.address,
          status: r.status,
          created_at: r.createdAt
        };

        const result = await safeUpsert('partner_requests', rawPayload);
        if (result.success) {
          const localReq = localReqs.find(x => x.id === r.id);
          if (localReq && !localReq.synced) {
            localReq.synced = true;
            updated = true;
          }
        } else {
          console.warn(`[Sync] Tabela partner_requests pode não existir ou falhou:`, result.error);
        }
      }
    } catch (e) {
      console.error('Erro ao sincronizar solicitações de parceria com Supabase:', e);
    }
    if (updated) {
      localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(localReqs));
    }
  },

  async syncToSupabase() {
    const deletedIds = new Set(this.getDeletedItems().map(x => x.id));
    let updatedSchedules = false;
    let updatedDeliveries = false;
    const localSchedules = this.getSchedules();
    const localDeliveries = this.getDeliveries();

    try {
      // 1. Sincronizar Escalas (Schedules)
      const schedules = this.getSchedules();
      for (const s of schedules) {
        if (deletedIds.has(s.id)) continue;
        try {
          const rawPayload = {
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
          };

          const result = await safeUpsert('schedules', rawPayload);
          if (result.success) {
            const localSch = localSchedules.find(x => x.id === s.id);
            if (localSch && !localSch.synced) {
              localSch.synced = true;
              updatedSchedules = true;
            }
          } else {
            console.warn(`[Sync] Falha ao sincronizar escala ${s.id}:`, result.error);
          }
        } catch (e) {
          console.error(`Erro ao sincronizar escala ${s.id}:`, e);
        }
      }

      // 2. Sincronizar Corridas (Deliveries)
      const deliveries = this.getDeliveries();
      for (const d of deliveries) {
        if (deletedIds.has(d.id)) continue;
        try {
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

          const result = await safeUpsert('deliveries', rawPayload);
          if (result.success) {
            const localDel = localDeliveries.find(x => x.id === d.id);
            if (localDel && !localDel.synced) {
              localDel.synced = true;
              updatedDeliveries = true;
            }
          } else {
            console.warn(`[Sync] Falha ao sincronizar corrida ${d.id}:`, result.error);
          }
        } catch (e) {
          console.error(`Erro ao sincronizar corrida ${d.id}:`, e);
        }
      }
    } catch (err) {
      console.error('Erro ao enviar dados para o Supabase:', err);
    }

    if (updatedSchedules) {
      localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(localSchedules));
    }
    if (updatedDeliveries) {
      localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(localDeliveries));
    }
  }
};