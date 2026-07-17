import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, Notification, PartnerRequest } from '../utils/db';
import { 
  Users, 
  Store, 
  Calendar, 
  CalendarDays,
  Bike, 
  BarChart3, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Download, 
  Search,
  Clock,
  Send,
  LayoutGrid,
  List,
  ChevronDown,
  MessageSquare,
  Building2,
  CheckCircle2,
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';

// Importando os modais modulares
import UserModal from '../components/UserModal';
import EstablishmentModal from '../components/EstablishmentModal';
import ScheduleModal from '../components/ScheduleModal';
import WeeklyScheduleModal from '../components/WeeklyScheduleModal';
import RiderSchedulesModal from '../components/RiderSchedulesModal';
import DeliveryModal from '../components/DeliveryModal';

// Constantes para a escala semanal automática
const DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'users' | 'establishments' | 'schedules' | 'deliveries' | 'reports' | 'requests'>('users');

  // Listas de dados
  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);

  // Filtros e buscas
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'rider' | 'establishment'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  // Controle de visualização de senhas
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Modais e Formulários
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    role: 'rider' as 'admin' | 'rider' | 'establishment',
    password: '',
    establishmentId: '',
    establishmentName: '',
    zipCode: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const [showEstModal, setShowEstModal] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [estForm, setEstForm] = useState({
    name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: ''
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ 
    riderId: '', 
    establishmentId: '', 
    date: '', 
    shift: 'morning' as 'morning' | 'afternoon' | 'night',
    startTime: '08:00',
    endTime: '12:00'
  });
  const [scheduleConflictWarning, setScheduleConflictWarning] = useState('');

  // Modal de Escala Semanal Automática
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState({
    riderId: '',
    establishmentId: '',
    shift: 'morning' as 'morning' | 'afternoon' | 'night',
    startTime: '08:00',
    endTime: '12:00',
    weekStart: '',
    days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false }
  });
  const [weeklyPreview, setWeeklyPreview] = useState<{ date: string; label: string; conflict: boolean; key: string; enabled: boolean }[]>([]);
  const [weeklyStep, setWeeklyStep] = useState<'form' | 'preview'>('form');

  // Card accordion da aba Escalas
  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [scheduleViewMode, setScheduleViewMode] = useState<'accordion' | 'grid' | 'timeline'>('accordion');
  const [scheduleSearch, setScheduleSearch] = useState('');
  // Modal "Ver Todas" do card
  const [riderSchedulesModal, setRiderSchedulesModal] = useState<string | null>(null);
  // Filtros do histórico no modal
  const [modalHistoryEst, setModalHistoryEst] = useState('');
  const [modalHistoryFrom, setModalHistoryFrom] = useState('');
  const [modalHistoryTo, setModalHistoryTo] = useState('');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '', notes: '' });

  // Relatórios
  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const loadData = () => {
    setUsers(db.getUsers());
    setEstablishments(db.getEstablishments());
    setSchedules(db.getSchedules());
    setDeliveries(db.getDeliveries());
    setPartnerRequests(db.getPartnerRequests());
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [adminUser, navigate, activeTab]);

  useEffect(() => {
    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener('db-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('db-sync-complete', handleSyncComplete);
    };
  }, []);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  // --- GESTÃO DE USUÁRIOS ---
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();
    const allEsts = db.getEstablishments();

    const userCpf = userForm.role === 'establishment' ? '000.000.000-00' : userForm.cpf;

    const duplicateCpf = allUsers.find(u => u.cpf === userCpf && (!editingUser || u.id !== editingUser.id));
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === userForm.email.toLowerCase() && (!editingUser || u.id !== editingUser.id));

    if (userForm.role !== 'establishment' && duplicateCpf && userCpf !== '000.000.000-00') {
      alert('Erro: CPF já cadastrado no sistema.');
      return;
    }
    if (duplicateEmail) {
      alert('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    const nowStr = new Date().toISOString();
    let finalEstId = userForm.establishmentId;

    // Se for gerente de estabelecimento, cria ou vincula o estabelecimento automaticamente com o endereço fornecido
    if (userForm.role === 'establishment' && userForm.establishmentName) {
      const existingEst = allEsts.find(e => e.name.toLowerCase() === userForm.establishmentName.toLowerCase());
      if (existingEst) {
        finalEstId = existingEst.id;
        // Atualiza o endereço do estabelecimento existente se necessário
        const updatedEsts = allEsts.map(e => e.id === existingEst.id ? {
          ...e,
          address: {
            street: userForm.street || e.address.street,
            number: userForm.number || e.address.number,
            complement: e.address.complement || '',
            neighborhood: userForm.neighborhood || e.address.neighborhood,
            city: userForm.city || e.address.city,
            state: userForm.state || e.address.state,
            zipCode: userForm.zipCode || e.address.zipCode
          },
          updatedAt: nowStr
        } : e);
        db.setEstablishments(updatedEsts);
      } else {
        const newEstId = 'e_' + Date.now();
        const newEst: Establishment = {
          id: newEstId,
          name: userForm.establishmentName,
          phone: userForm.phone || '',
          active: true,
          address: {
            street: userForm.street || 'A definir',
            number: userForm.number || 'S/N',
            complement: '',
            neighborhood: userForm.neighborhood || 'A definir',
            city: userForm.city || 'A definir',
            state: userForm.state || 'PB',
            zipCode: userForm.zipCode || '00000-000'
          },
          updatedAt: nowStr
        };
        db.setEstablishments([...allEsts, newEst]);
        finalEstId = newEstId;
      }
    }

    if (editingUser) {
      const updated = allUsers.map(u => u.id === editingUser.id ? {
        ...u,
        name: userForm.name,
        cpf: userCpf,
        phone: userForm.phone,
        email: userForm.email,
        role: userForm.role,
        establishmentId: userForm.role === 'establishment' ? finalEstId : undefined,
        passwordHash: userForm.password || u.passwordHash,
        mustResetPassword: userForm.password ? true : u.mustResetPassword,
        updatedAt: nowStr
      } : u);
      db.setUsers(updated);
    } else {
      const newUser: User = {
        id: 'u_' + Date.now(),
        name: userForm.name,
        cpf: userCpf,
        phone: userForm.phone,
        email: userForm.email,
        role: userForm.role,
        active: true,
        passwordHash: userForm.password || 'moto123',
        establishmentId: userForm.role === 'establishment' ? finalEstId : undefined,
        updatedAt: nowStr
      };
      db.setUsers([...allUsers, newUser]);
    }

    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ name: '', cpf: '', phone: '', email: '', role: 'rider', password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '' });
    loadData();
  };

  const handleDeleteUser = (id: string) => {
    if (id === adminUser?.id) {
      alert('Erro: Você não pode excluir a si mesmo.');
      return;
    }
    if (confirm('Deseja realmente excluir este usuário definitivamente? Esta ação não pode ser desfeita.')) {
      db.deleteUser(id);
      loadData();
    }
  };

  const toggleUserStatus = (id: string) => {
    const allUsers = db.getUsers();
    const updated = allUsers.map(u => u.id === id ? { ...u, active: !u.active, updatedAt: new Date().toISOString() } : u);
    db.setUsers(updated);
    loadData();
  };

  const handleApproveRider = (id: string) => {
    const allUsers = db.getUsers();
    const allEsts = db.getEstablishments();
    
    const userToApprove = allUsers.find(u => u.id === id);
    if (!userToApprove) return;

    // Ativar Usuário
    const updatedUsers = allUsers.map(u => u.id === id ? { ...u, active: true, updatedAt: new Date().toISOString() } : u);
    db.setUsers(updatedUsers);

    // Se for gerente, ativar também o estabelecimento vinculado
    if (userToApprove.role === 'establishment' && userToApprove.establishmentId) {
      const updatedEsts = allEsts.map(e => e.id === userToApprove.establishmentId ? { ...e, active: true, updatedAt: new Date().toISOString() } : e);
      db.setEstablishments(updatedEsts);
    }
    
    if (userToApprove.role === 'rider') {
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: userToApprove.id,
        title: '🎉 Cadastro Aprovado!',
        message: 'Seu cadastro foi aprovado! Você já pode acessar o sistema com seu e-mail e senha.',
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);
    }
    
    loadData();
    alert('Usuário aprovado e ativado com sucesso!');
  };

  // --- GESTÃO DE ESTABELECIMENTOS ---
  const handleSaveEst = (e: React.FormEvent) => {
    e.preventDefault();
    const allEst = db.getEstablishments();
    const allUsers = db.getUsers();

    const duplicateName = allEst.find(es => es.name.toLowerCase() === estForm.name.toLowerCase() && (!editingEst || es.id !== editingEst.id));
    if (duplicateName) {
      alert('Erro: Já existe um estabelecimento com este nome.');
      return;
    }

    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === estForm.email.toLowerCase() && (!editingEst || u.establishmentId !== editingEst.id));
    if (duplicateEmail) {
      alert('Erro: E-mail já cadastrado para outro usuário.');
      return;
    }

    const estId = editingEst ? editingEst.id : 'e_' + Date.now();
    const nowStr = new Date().toISOString();

    if (editingEst) {
      // Atualizar Estabelecimento
      const updated = allEst.map(es => es.id === editingEst.id ? {
        ...es,
        name: estForm.name,
        phone: estForm.phone,
        address: {
          street: estForm.street,
          number: estForm.number,
          complement: estForm.complement || '',
          neighborhood: estForm.neighborhood,
          city: estForm.city,
          state: estForm.state,
          zipCode: estForm.zipCode
        },
        updatedAt: nowStr
      } : es);
      db.setEstablishments(updated);

      // Verificar se já existe um usuário gerente para este estabelecimento
      const hasManager = allUsers.some(u => u.establishmentId === editingEst.id);

      if (hasManager) {
        // Atualizar Usuário correspondente existente
        const updatedUsers = allUsers.map(u => u.establishmentId === editingEst.id ? {
          ...u,
          name: 'Gerente ' + estForm.name,
          email: estForm.email,
          passwordHash: estForm.password || u.passwordHash,
          phone: estForm.phone,
          updatedAt: nowStr
        } : u);
        db.setUsers(updatedUsers);
      } else if (estForm.email) {
        // Criar um novo Usuário gerente caso não existisse antes
        const newEstUser: User = {
          id: 'u_' + Date.now(),
          name: 'Gerente ' + estForm.name,
          cpf: '000.000.000-00',
          phone: estForm.phone,
          email: estForm.email,
          role: 'establishment',
          active: true,
          passwordHash: estForm.password || 'bella123',
          establishmentId: editingEst.id,
          updatedAt: nowStr
        };
        db.setUsers([...allUsers, newEstUser]);
      }
    } else {
      // Criar Estabelecimento
      const newEst: Establishment = {
        id: estId,
        name: estForm.name,
        phone: estForm.phone,
        active: true,
        address: {
          street: estForm.street,
          number: estForm.number,
          complement: estForm.complement || '',
          neighborhood: estForm.neighborhood,
          city: estForm.city,
          state: estForm.state,
          zipCode: estForm.zipCode
        },
        updatedAt: nowStr
      };
      db.setEstablishments([...allEst, newEst]);

      // Criar Usuário correspondente
      if (estForm.email) {
        const newEstUser: User = {
          id: 'u_' + Date.now(),
          name: 'Gerente ' + estForm.name,
          cpf: '000.000.000-00',
          phone: estForm.phone,
          email: estForm.email,
          role: 'establishment',
          active: true,
          passwordHash: estForm.password || 'bella123',
          establishmentId: estId,
          updatedAt: nowStr
        };
        db.setUsers([...allUsers, newEstUser]);
      }
    }

    setShowEstModal(false);
    setEditingEst(null);
    setEstForm({ name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: '' });
    loadData();
  };

  const handleDeleteEst = (id: string) => {
    if (confirm('Deseja realmente excluir este estabelecimento definitivamente? Todos os gerentes vinculados perderão o acesso.')) {
      db.deleteEstablishment(id);
      loadData();
    }
  };

  const toggleEstStatus = (id: string) => {
    const allEst = db.getEstablishments();
    const updated = allEst.map(es => es.id === id ? { ...es, active: !es.active, updatedAt: new Date().toISOString() } : es);
    db.setEstablishments(updated);
    loadData();
  };

  // --- GESTÃO DE ESCALAS ---
  const checkScheduleConflict = (riderId: string, date: string, shift: string) => {
    const conflict = schedules.find(s => s.riderId === riderId && s.date === date && s.shift === shift);
    if (conflict) {
      const rider = users.find(r => r.id === riderId);
      const est = establishments.find(e => e.id === conflict.establishmentId);
      return `Aviso: O motoboy ${rider?.name} já está escalado no estabelecimento ${est?.name} neste mesmo dia e turno!`;
    }
    return '';
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const conflict = checkScheduleConflict(scheduleForm.riderId, scheduleForm.date, scheduleForm.shift);
    
    if (conflict && !scheduleConflictWarning) {
      setScheduleConflictWarning(conflict);
      return;
    }

    const newSchedule: Schedule = {
      id: 's_' + Date.now(),
      riderId: scheduleForm.riderId,
      establishmentId: scheduleForm.establishmentId,
      date: scheduleForm.date,
      shift: scheduleForm.shift,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      createdBy: adminUser?.name || 'Admin',
      createdAt: new Date().toISOString()
    };

    const updatedSchedules = [...schedules, newSchedule];
    db.setSchedules(updatedSchedules);

    const est = establishments.find(es => es.id === scheduleForm.establishmentId);
    const allNotif = db.getNotifications();
    const newNotif: Notification = {
      id: 'n_' + Date.now(),
      riderId: scheduleForm.riderId,
      title: '📍 Novo Encaminhamento de Rota',
      message: `Você foi designado para o estabelecimento ${est?.name} no dia ${new Date(scheduleForm.date + 'T00:00:00').toLocaleDateString('pt-BR')} no turno da ${getShiftLabel(scheduleForm.shift)} (${scheduleForm.startTime} - ${scheduleForm.endTime}). Por favor, dirija-se ao local.`,
      date: new Date().toISOString(),
      read: false
    };
    db.setNotifications([...allNotif, newNotif]);

    setShowScheduleModal(false);
    setScheduleForm({ 
      riderId: '', 
      establishmentId: '', 
      date: '', 
      shift: 'morning',
      startTime: '08:00',
      endTime: '12:00'
    });
    setScheduleConflictWarning('');
    loadData();
  };

  const handleCancelSchedule = (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;

    if (confirm('Tem certeza que deseja cancelar esta escala?')) {
      const updated = schedules.filter(s => s.id !== id);
      db.setSchedules(updated);

      const est = establishments.find(es => es.id === schedule.establishmentId);
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: schedule.riderId,
        title: 'Escala Cancelada',
        message: `Sua escala no estabelecimento ${est?.name} para o dia ${new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')} foi cancelada.`,
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);

      loadData();
    }
  };

  // --- ESCALA SEMANAL AUTOMÁTICA ---
  const getThisMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday.toISOString().split('T')[0];
  };

  const buildWeeklyPreview = (form: typeof weeklyForm) => {
    if (!form.weekStart || !form.riderId || !form.establishmentId) return;
    const monday = new Date(form.weekStart + 'T00:00:00');
    const allSchedules = db.getSchedules();
    const preview = DAY_KEYS.map((key, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const conflict = !!allSchedules.find(
        s => s.riderId === form.riderId && s.date === dateStr && s.shift === form.shift
      );
      return { date: dateStr, label: DAY_LABELS[idx], conflict, key, enabled: form.days[key] };
    });
    setWeeklyPreview(preview);
    setWeeklyStep('preview');
  };

  const handleSaveWeeklySchedule = () => {
    const allSchedules = db.getSchedules();
    const allNotif = db.getNotifications();
    const est = establishments.find(es => es.id === weeklyForm.establishmentId);
    const newSchedules: Schedule[] = [];
    const newNotifs: Notification[] = [];

    weeklyPreview.forEach((day) => {
      if (!day.enabled) return;
      const id = 's_' + Date.now() + '_' + day.date;
      newSchedules.push({
        id,
        riderId: weeklyForm.riderId,
        establishmentId: weeklyForm.establishmentId,
        date: day.date,
        shift: weeklyForm.shift,
        startTime: weeklyForm.startTime,
        endTime: weeklyForm.endTime,
        createdBy: adminUser?.name || 'Admin',
        createdAt: new Date().toISOString()
      });
      newNotifs.push({
        id: 'n_' + Date.now() + '_' + day.date,
        riderId: weeklyForm.riderId,
        title: '📍 Novo Encaminhamento de Rota',
        message: `Você foi designado para o estabelecimento ${est?.name} no dia ${new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')} no turno da ${getShiftLabel(weeklyForm.shift)} (${weeklyForm.startTime} - ${weeklyForm.endTime}). Por favor, dirija-se ao local.`,
        date: new Date().toISOString(),
        read: false
      });
    });

    db.setSchedules([...allSchedules, ...newSchedules]);
    db.setNotifications([...allNotif, ...newNotifs]);

    setShowWeeklyModal(false);
    setWeeklyStep('form');
    setWeeklyForm({
      riderId: '', establishmentId: '', shift: 'morning',
      startTime: '08:00', endTime: '12:00', weekStart: getThisMonday(),
      days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false }
    });
    setWeeklyPreview([]);
    loadData();
  };

  // --- REGISTRO DE CORRIDAS ---
  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    const activeSchedule = schedules.find(s => 
      s.riderId === deliveryForm.riderId && 
      s.establishmentId === deliveryForm.establishmentId && 
      s.date === deliveryForm.date
    );

    if (editingDelivery) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (editingDelivery.date !== todayStr) {
        alert('Erro: Só é permitido editar corridas lançadas no dia de hoje.');
        return;
      }

      const updated = deliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        riderId: deliveryForm.riderId,
        establishmentId: deliveryForm.establishmentId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: val,
        scheduleId: activeSchedule?.id || d.scheduleId,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined
      } : d);
      db.setDeliveries(updated);
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: deliveryForm.establishmentId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: val,
        status: 'active',
        scheduleId: activeSchedule?.id,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined
      };
      db.setDeliveries([...deliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    setDeliveryForm({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '', notes: '' });
    loadData();
  };

  const handleCancelDelivery = (id: string) => {
    const delivery = deliveries.find(d => d.id === id);
    if (!delivery) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (delivery.date !== todayStr) {
      alert('Erro: Só é permitido cancelar corridas lançadas no dia de hoje.');
      return;
    }

    if (confirm('Deseja realmente cancelar esta corrida? O valor será deduzido do faturamento do motoboy.')) {
      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleApproveDelivery = (id: string) => {
    const delivery = deliveries.find(d => d.id === id);
    if (!delivery) return;

    const updated = deliveries.map(d => d.id === id ? { ...d, status: 'active' as const } : d);
    db.setDeliveries(updated);

    const est = establishments.find(e => e.id === delivery.establishmentId);
    const allNotif = db.getNotifications();
    const newNotif: Notification = {
      id: 'n_' + Date.now(),
      riderId: delivery.riderId,
      title: '✅ Corrida Aprovada!',
      message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi aprovada pelo administrador para o estabelecimento ${est?.name}.`,
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
      const delivery = deliveries.find(d => d.id === id);
      if (!delivery) return;

      const updatedNotes = delivery.notes 
        ? `${delivery.notes} | Rejeitado: ${reason}` 
        : `Motivo da rejeição: ${reason}`;

      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'rejected' as const, notes: updatedNotes } : d);
      db.setDeliveries(updated);

      const est = establishments.find(e => e.id === delivery.establishmentId);
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: delivery.riderId,
        title: '❌ Corrida Rejeitada',
        message: `Sua corrida no valor de R$ ${delivery.value.toFixed(2)} foi rejeitada pelo administrador para o estabelecimento ${est?.name}. Motivo: ${reason || 'Não especificado'}.`,
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);

      loadData();
    }
  };

  // --- GESTÃO DE SOLICITAÇÕES DE PARCERIA ---
  const handleToggleRequestStatus = (id: string) => {
    const updated = partnerRequests.map(r => {
      if (r.id === id) {
        return { ...r, status: r.status === 'pending' ? 'contacted' as const : 'pending' as const };
      }
      return r;
    });
    db.setPartnerRequests(updated);
    loadData();
  };

  const handleDeleteRequest = (id: string) => {
    if (confirm('Deseja realmente excluir esta solicitação?')) {
      const updated = partnerRequests.filter(r => r.id !== id);
      db.setPartnerRequests(updated);
      loadData();
    }
  };

  const handleContactRequest = (request: PartnerRequest) => {
    const cleanPhone = request.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(`Olá ${request.ownerName}! Recebemos sua solicitação de parceria para o estabelecimento ${request.establishmentName} no MotoHub. Gostaria de dar andamento ao seu cadastro?`);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleApproveRequest = (req: PartnerRequest) => {
    const allEsts = db.getEstablishments();
    const allUsers = db.getUsers();

    // Encontrar o estabelecimento pré-criado pelo nome
    const est = allEsts.find(e => e.name.toLowerCase() === req.establishmentName.toLowerCase());
    
    if (est) {
      // Ativar o estabelecimento
      const updatedEsts = allEsts.map(e => e.id === est.id ? { ...e, active: true, updatedAt: new Date().toISOString() } : e);
      db.setEstablishments(updatedEsts);

      // Ativar a conta do gerente vinculada
      const updatedUsers = allUsers.map(u => u.establishmentId === est.id ? { ...u, active: true, updatedAt: new Date().toISOString() } : u);
      db.setUsers(updatedUsers);

      // Marcar solicitação como contatada/aprovada
      const updatedRequests = partnerRequests.map(r => r.id === req.id ? { ...r, status: 'contacted' as const } : r);
      db.setPartnerRequests(updatedRequests);

      loadData();
      alert('Solicitação aprovada! O estabelecimento e a conta do gerente foram ativados com sucesso.');
    } else {
      // Fallback caso o estabelecimento não tenha sido pré-criado (abre o modal)
      setEditingEst(null);
      setEstForm({
        name: req.establishmentName,
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
        phone: req.phone,
        email: '',
        password: ''
      });
      setShowEstModal(true);

      const updated = partnerRequests.map(r => r.id === req.id ? { ...r, status: 'contacted' as const } : r);
      db.setPartnerRequests(updated);
    }
  };

  // --- RELATÓRIOS E EXPORTAÇÃO ---
  const getFilteredReportData = () => {
    let start = new Date();
    let end = new Date();

    if (reportPeriod === 'daily') {
      start.setHours(0,0,0,0);
    } else if (reportPeriod === 'weekly') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      start.setHours(0,0,0,0);
    } else if (reportPeriod === 'monthly') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
    } else if (reportPeriod === 'custom' && customStartDate && customEndDate) {
      start = new Date(customStartDate + 'T00:00:00');
      end = new Date(customEndDate + 'T23:59:59');
    }

    const riders = users.filter(u => u.role === 'rider');

    if (reportType === 'earnings') {
      const summary: { [key: string]: { name: string; total: number; count: number } } = {};
      riders.forEach(r => {
        summary[r.id] = { name: r.name, total: 0, count: 0 };
      });

      deliveries.filter(d => d.status === 'active').forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end) {
          if (summary[d.riderId]) {
            summary[d.riderId].total += d.value;
            summary[d.riderId].count += 1;
          }
        }
      });

      return Object.values(summary);
    } else if (reportType === 'deliveries') {
      const summary: { [key: string]: { name: string; count: number; cancelled: number } } = {};
      riders.forEach(r => {
        summary[r.id] = { name: r.name, count: 0, cancelled: 0 };
      });

      deliveries.forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end) {
          if (summary[d.riderId]) {
            if (d.status === 'active') {
              summary[d.riderId].count += 1;
            } else {
              summary[d.riderId].cancelled += 1;
            }
          }
        }
      });

      return Object.values(summary);
    } else {
      const summary: { [key: string]: { name: string; count: number } } = {};
      establishments.forEach(e => {
        summary[e.id] = { name: e.name, count: 0 };
      });

      schedules.forEach(s => {
        const sDate = new Date(s.date + 'T00:00:00');
        if (sDate >= start && sDate <= end) {
          if (summary[s.establishmentId]) {
            summary[s.establishmentId].count += 1;
          }
        }
      });

      return Object.values(summary);
    }
  };

  const exportToCSV = () => {
    const data = getFilteredReportData();
    let csvContent = "data:text/csv;charset=utf-8,";

    if (reportType === 'earnings') {
      csvContent += "Motoboy,Total Faturado (R$),Quantidade de Corridas\n";
      data.forEach((row: any) => {
        csvContent += `"${row.name}",${row.total.toFixed(2)},${row.count}\n`;
      });
    } else if (reportType === 'deliveries') {
      csvContent += "Motoboy,Corridas Ativas,Corridas Canceladas\n";
      data.forEach((row: any) => {
        csvContent += `"${row.name}",${row.count},${row.cancelled}\n`;
      });
    } else {
      csvContent += "Estabelecimento,Total de Escalas\n";
      data.forEach((row: any) => {
        csvContent += `"${row.name}",${row.count}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${reportType}_${reportPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getShiftLabel = (shift: string) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'night': return 'Noite';
      default: return shift;
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.cpf.includes(searchQuery) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && u.active) || (statusFilter === 'inactive' && !u.active);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const filteredEsts = establishments.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && e.active) || (statusFilter === 'inactive' && !e.active);
    return matchesSearch && matchesStatus;
  });

  const filteredRequests = partnerRequests.filter(r => {
    const matchesSearch = r.establishmentName.toLowerCase().includes(searchQuery.toLowerCase()) || r.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingRequestsCount = partnerRequests.filter(r => r.status === 'pending').length;

  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');
  const processedDeliveries = deliveries.filter(d => d.status !== 'pending');

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
              <h1 className="text-base font-bold leading-tight">Painel Administrativo</h1>
              <p className="text-xs text-slate-400 hidden sm:block">Gestão de Escalas e Entregas</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-300 hidden md:inline">Olá, {adminUser?.name}</span>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-1 text-sm text-red-400"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        {/* Mobile tab bar */}
        <div className="lg:hidden border-t border-slate-700 overflow-x-auto">
          <div className="flex min-w-max">
            {[
              { tab: 'users', icon: <Users className="h-4 w-4" />, label: 'Usuários' },
              { tab: 'establishments', icon: <Store className="h-4 w-4" />, label: 'Estabelec.' },
              { tab: 'requests', icon: <Building2 className="h-4 w-4" />, label: `Solicitações (${pendingRequestsCount})` },
              { tab: 'schedules', icon: <Calendar className="h-4 w-4" />, label: 'Escalas' },
              { tab: 'deliveries', icon: <Bike className="h-4 w-4" />, label: 'Corridas' },
              { tab: 'reports', icon: <BarChart3 className="h-4 w-4" />, label: 'Relatórios' },
            ].map(({ tab, icon, label }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab as any); setSearchQuery(''); if (tab !== 'schedules' && tab !== 'deliveries') setStatusFilter('all'); }}
                className={`flex flex-col items-center gap-0.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab ? 'border-indigo-400 text-indigo-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Sidebar Navigation — desktop only */}
        <div className="hidden lg:block lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit space-y-1">
          <button
            onClick={() => { setActiveTab('users'); setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Usuários</span>
          </button>
          <button
            onClick={() => { setActiveTab('establishments'); setSearchQuery(''); setStatusFilter('all'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'establishments' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Store className="h-5 w-5" />
            <span>Estabelecimentos</span>
          </button>
          <button
            onClick={() => { setActiveTab('requests'); setSearchQuery(''); setRequestStatusFilter('all'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'requests' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Building2 className="h-5 w-5" />
              <span>Solicitações</span>
            </div>
            {pendingRequestsCount > 0 && (
              <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('schedules'); setSearchQuery(''); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Escalas</span>
          </button>
          <button
            onClick={() => { setActiveTab('deliveries'); setSearchQuery(''); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'deliveries' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bike className="h-5 w-5" />
            <span>Registrar Corridas</span>
          </button>
          <button
            onClick={() => { setActiveTab('reports'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'reports' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Relatórios</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          {/* TAB: USUÁRIOS */}
          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserForm({ name: '', cpf: '', phone: '', email: '', role: 'rider', password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '' });
                    setShowUserModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Usuário</span>
                </button>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, e-mail ou CPF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e: any) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todos os Perfis</option>
                  <option value="admin">Administradores</option>
                  <option value="rider">Motoboys</option>
                  <option value="establishment">Gerentes</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos / Pendentes</option>
                </select>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                      <th className="py-3 px-4">Nome / Perfil</th>
                      <th className="py-3 px-4">CPF / Contato</th>
                      <th className="py-3 px-4">Senha Cadastrada</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredUsers.map(user => {
                      const isPassVisible = !!visiblePasswords[user.id];
                      const linkedEst = user.establishmentId ? establishments.find(e => e.id === user.establishmentId) : null;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-800">{user.name}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                user.role === 'establishment' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {user.role === 'admin' ? 'Admin' : user.role === 'establishment' ? 'Gerente' : 'Motoboy'}
                              </span>
                              {linkedEst && <span className="text-slate-500">• {linkedEst.name}</span>}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <p className="font-mono text-xs">{user.role === 'establishment' ? '—' : user.cpf}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                            <p className="text-xs text-slate-400">{user.phone}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                {isPassVisible ? user.passwordHash : '••••••••'}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                                title={isPassVisible ? "Ocultar Senha" : "Ver Senha"}
                              >
                                {isPassVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.active ? 'Ativo' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            {user.active && user.role === 'rider' && (
                              <button
                                onClick={() => {
                                  setScheduleForm({
                                    riderId: user.id,
                                    establishmentId: '',
                                    date: new Date().toISOString().split('T')[0],
                                    shift: 'morning',
                                    startTime: '08:00',
                                    endTime: '12:00'
                                  });
                                  setScheduleConflictWarning('');
                                  setShowScheduleModal(true);
                                }}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                                title="Designar Motoboy"
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Designar</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                const est = user.establishmentId ? establishments.find(e => e.id === user.establishmentId) : null;
                                setUserForm({
                                  name: user.name,
                                  cpf: user.cpf,
                                  phone: user.phone,
                                  email: user.email,
                                  role: user.role,
                                  password: '',
                                  establishmentId: user.establishmentId || '',
                                  establishmentName: est ? est.name : '',
                                  zipCode: est ? est.address.zipCode : '',
                                  street: est ? est.address.street : '',
                                  number: est ? est.address.number : '',
                                  neighborhood: est ? est.address.neighborhood : '',
                                  city: est ? est.address.city : '',
                                  state: est ? est.address.state : ''
                                });
                                setShowUserModal(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {!user.active && (
                              <button
                                onClick={() => handleApproveRider(user.id)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                                title="Aprovar Usuário"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Aprovar</span>
                              </button>
                            )}
                            {user.active && (
                              <button
                                onClick={() => toggleUserStatus(user.id)}
                                className={`p-1.5 rounded transition-colors inline-flex ${
                                  user.active 
                                    ? 'text-red-500 hover:bg-red-50' 
                                    : 'text-emerald-500 hover:bg-emerald-50'
                                }`}
                                title={user.active ? 'Desativar' : 'Ativar'}
                              >
                                {user.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors inline-flex"
                              title="Excluir Usuário Definitivamente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ESTABELECIMENTOS */}
          {activeTab === 'establishments' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Estabelecimentos</h2>
                <button
                  onClick={() => {
                    setEditingEst(null);
                    setEstForm({ name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: '' });
                    setShowEstModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Estabelecimento</span>
                </button>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Endereço</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4">E-mail de Acesso</th>
                      <th className="py-3 px-4">Senha do Gerente</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredEsts.map(est => {
                      const estUser = users.find(u => u.establishmentId === est.id);
                      const isPassVisible = estUser ? !!visiblePasswords[estUser.id] : false;

                      return (
                        <tr key={est.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-medium text-slate-800">{est.name}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {est.address.street}, {est.address.number} - {est.address.neighborhood}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{est.phone}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{estUser?.email || 'Sem conta'}</td>
                          <td className="py-3 px-4">
                            {estUser ? (
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                  {isPassVisible ? estUser.passwordHash : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(estUser.id)}
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                  title={isPassVisible ? "Ocultar Senha" : "Ver Senha"}
                                >
                                  {isPassVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              est.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {est.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingEst(est);
                                setEstForm({
                                  name: est.name,
                                  street: est.address.street,
                                  number: est.address.number,
                                  complement: est.address.complement || '',
                                  neighborhood: est.address.neighborhood,
                                  city: est.address.city,
                                  state: est.address.state,
                                  zipCode: est.address.zipCode,
                                  phone: est.phone || '',
                                  email: estUser ? estUser.email : '',
                                  password: ''
                                });
                                setShowEstModal(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleEstStatus(est.id)}
                              className={`p-1.5 rounded transition-colors inline-flex ${
                                est.active 
                                  ? 'text-red-500 hover:bg-red-50' 
                                  : 'text-emerald-500 hover:bg-emerald-50'
                              }`}
                              title={est.active ? 'Desativar' : 'Ativar'}
                            >
                              {est.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteEst(est.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors inline-flex"
                              title="Excluir Estabelecimento Definitivamente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SOLICITAÇÕES DE PARCERIA */}
          {activeTab === 'requests' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Solicitações de Parceria</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Estabelecimentos que se cadastraram pela Landing Page</p>
                </div>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative col-span-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por estabelecimento ou proprietário..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <select
                    value={requestStatusFilter}
                    onChange={(e: any) => setRequestStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="pending">Pendentes</option>
                    <option value="contacted">Contatados</option>
                  </select>
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                      <th className="py-3 px-4">Estabelecimento</th>
                      <th className="py-3 px-4">Proprietário</th>
                      <th className="py-3 px-4">Contato</th>
                      <th className="py-3 px-4">Endereço</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Nenhuma solicitação encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-800">{req.establishmentName}</td>
                          <td className="py-3 px-4 text-slate-700">{req.ownerName}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono">{req.phone}</td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={req.address}>
                            {req.address}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {req.status === 'pending' ? 'Pendente' : 'Contatado'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleApproveRequest(req)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                              title="Aprovar e Cadastrar Estabelecimento"
                            >
                              <UserCheck className="h-4 w-4" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              onClick={() => handleContactRequest(req)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                              title="Chamar no WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => handleToggleRequestStatus(req.id)}
                              className={`p-1.5 rounded transition-colors inline-flex ${
                                req.status === 'pending' 
                                  ? 'text-emerald-600 hover:bg-emerald-50' 
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={req.status === 'pending' ? 'Marcar como Contatado' : 'Marcar como Pendente'}
                            >
                              {req.status === 'pending' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors inline-flex"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ESCALAS */}
          {activeTab === 'schedules' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Escalas de Trabalho</h2>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => {
                      setWeeklyForm({ riderId: '', establishmentId: '', shift: 'morning', startTime: '08:00', endTime: '12:00', weekStart: getThisMonday(), days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false } });
                      setWeeklyStep('form'); setWeeklyPreview([]); setShowWeeklyModal(true);
                    }}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CalendarDays className="h-4 w-4" /><span>Escala Semanal</span>
                  </button>
                  <button
                    onClick={() => { setScheduleForm({ riderId: '', establishmentId: '', date: '', shift: 'morning', startTime: '08:00', endTime: '12:00' }); setScheduleConflictWarning(''); setShowScheduleModal(true); }}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" /><span>Nova Escala</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={scheduleSearch}
                    onChange={e => setScheduleSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 self-end sm:self-auto">
                  <button onClick={() => setScheduleViewMode('accordion')} title="Lista" className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${scheduleViewMode === 'accordion' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <List className="h-3.5 w-3.5" /><span>Lista</span>
                  </button>
                  <button onClick={() => setScheduleViewMode('grid')} title="Cards" className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${scheduleViewMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <LayoutGrid className="h-3.5 w-3.5" /><span>Cards</span>
                  </button>
                  <button onClick={() => setScheduleViewMode('timeline')} title="Agenda" className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${scheduleViewMode === 'timeline' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Calendar className="h-3.5 w-3.5" /><span>Agenda</span>
                  </button>
                </div>
              </div>

              {(() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const q = scheduleSearch.toLowerCase();
                const riders = users.filter(u => u.role === 'rider');
                const filteredList = riders.filter(r =>
                  r.name.toLowerCase().includes(q) || r.cpf.includes(q) || r.phone.includes(q)
                );
                if (filteredList.length === 0) return (
                  <div className="py-10 text-center text-slate-400">
                    <Search className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p>Nenhum motoboy encontrado.</p>
                  </div>
                );

                if (scheduleViewMode === 'accordion') return (
                  <div className="space-y-2">
                    {filteredList.map(rider => {
                      const rs = schedules.filter(s => s.riderId === rider.id).sort((a,b) => a.date.localeCompare(b.date));
                      const up = rs.filter(s => s.date >= todayStr);
                      const exp = expandedRider === rider.id;
                      return (
                        <div key={rider.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button onClick={() => setExpandedRider(exp ? null : rider.id)} className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${rider.active ? 'bg-indigo-600' : 'bg-slate-400'}`}>{rider.name.charAt(0).toUpperCase()}</div>
                              <div className="text-left">
                                <p className="font-bold text-slate-800 text-sm">{rider.name}</p>
                                <p className="text-xs text-slate-500">{rider.phone} • {rider.cpf}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{rs.length === 0 ? 'Sem escalas' : `${up.length} futura${up.length !== 1 ? 's' : ''} • ${rs.length} total`}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {up.length > 0 && <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{up.length}</span>}
                              {!rider.active && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Inativo</span>}
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${exp ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {exp && (
                            <div className="border-t border-slate-100 bg-slate-50">
                              {rs.length === 0 ? (
                                <div className="px-5 py-6 text-center text-slate-400 text-sm">
                                  <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                  <p>Nenhuma escala cadastrada.</p>
                                  <button onClick={() => { setScheduleForm({ riderId: rider.id, establishmentId: '', date: todayStr, shift: 'morning', startTime: '08:00', endTime: '12:00' }); setScheduleConflictWarning(''); setShowScheduleModal(true); }} className="mt-3 text-indigo-600 hover:underline text-xs font-medium">+ Criar escala agora</button>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100">
                                  {rs.map(sch => {
                                    const est = establishments.find(e => e.id === sch.establishmentId);
                                    const isPast = sch.date < todayStr;
                                    const isTod = sch.date === todayStr;
                                    return (
                                      <div key={sch.id} className={`px-5 py-3 flex items-center justify-between gap-3 ${isPast ? 'opacity-50' : 'bg-white'}`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                            <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                                            <span className="text-slate-300">•</span>
                                            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                              <span className="text-slate-300">•</span>
                                              <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</span>
                                              <span className="text-slate-300">•</span>
                                              <span className="font-mono text-slate-600">{sch.startTime}–{sch.endTime}</span>
                                            </p>
                                          </div>
                                        </div>
                                        <button onClick={() => handleCancelSchedule(sch.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );

                if (scheduleViewMode === 'grid') return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredList.map(rider => {
                      const rs = schedules.filter(s => s.riderId === rider.id).sort((a,b) => a.date.localeCompare(b.date));
                      const up = rs.filter(s => s.date >= todayStr);
                      const next = up[0];
                      const nextEst = next ? establishments.find(e => e.id === next.establishmentId) : null;
                      return (
                        <div key={rider.id} className="border border-slate-200 rounded-xl bg-white p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${rider.active ? 'bg-indigo-600' : 'bg-slate-400'}`}>{rider.name.charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{rider.name}</p>
                              <p className="text-xs text-slate-500 truncate">{rider.phone}</p>
                              <p className="text-xs text-slate-400 truncate">{rider.cpf}</p>
                            </div>
                            {!rider.active && <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">Inativo</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-center">
                              <p className="text-xl font-bold text-indigo-700">{up.length}</p>
                              <p className="text-xs text-indigo-500">Futuras</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                              <p className="text-xl font-bold text-slate-700">{rs.length}</p>
                              <p className="text-xs text-slate-500">Total</p>
                            </div>
                          </div>
                          {next ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Próxima escala</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">{nextEst?.name || 'N/A'}</p>
                              <p className="text-sm font-semibold text-slate-500 mt-0.5">
                                {new Date(next.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                                {' · '}<span className={`font-medium ${next.shift === 'morning' ? 'text-amber-600' : next.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(next.shift)}</span>
                                {' · '}{next.startTime}–{next.endTime}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-center text-xs text-slate-400">Sem escalas futuras</div>
                          )}
                          <div className="flex gap-2 mt-auto">
                            <button onClick={() => { setScheduleForm({ riderId: rider.id, establishmentId: '', date: todayStr, shift: 'morning', startTime: '08:00', endTime: '12:00' }); setScheduleConflictWarning(''); setShowScheduleModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium py-2 rounded-lg transition-colors">
                              <Plus className="h-3.5 w-3.5" />Nova Escala
                            </button>
                            <button onClick={() => setRiderSchedulesModal(rider.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium py-2 rounded-lg transition-colors">
                              <List className="h-3.5 w-3.5" />Ver Todas
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );

                const riderIds = new Set(filteredList.map(r => r.id));
                const allUp = schedules.filter(s => s.date >= todayStr && riderIds.has(s.riderId)).sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
                const byDate: Record<string, typeof allUp> = {};
                allUp.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });

                if (allUp.length === 0) return (
                  <div className="py-10 text-center text-slate-400">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p>Nenhuma escala futura encontrada.</p>
                  </div>
                );

                return (
                  <div className="space-y-6">
                    {Object.entries(byDate).map(([date, daySchs]) => {
                      const isTod = date === todayStr;
                      const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
                      return (
                        <div key={date}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isTod ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{isTod ? 'Hoje' : dateLabel}</div>
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs text-slate-400">{daySchs.length} escala{daySchs.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="space-y-2">
                            {daySchs.map(sch => {
                              const rider = users.find(r => r.id === sch.riderId);
                              const est = establishments.find(e => e.id === sch.establishmentId);
                              return (
                                <div key={sch.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                      <p className="text-sm font-semibold text-slate-800 truncate">{rider?.name || 'N/A'}</p>
                                      <span className="text-slate-300">•</span>
                                      <p className="text-xs text-slate-500 truncate">{est?.name || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                      <p className={`text-xs font-bold ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</p>
                                      <p className="text-xs font-mono text-slate-600">{sch.startTime}–{sch.endTime}</p>
                                    </div>
                                    <button onClick={() => handleCancelSchedule(sch.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: REGISTRO DE CORRIDAS */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              {/* Pending Deliveries Approval Section */}
              {pendingDeliveries.length > 0 && (
                <div className="bg-amber-50/50 p-6 rounded-xl shadow-sm border border-amber-200 space-y-4">
                  <h2 className="text-lg font-bold text-amber-800 flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                    <span>Corridas Pendentes de Aprovação ({pendingDeliveries.length})</span>
                  </h2>

                  <div className="divide-y divide-amber-100">
                    {pendingDeliveries.map(del => {
                      const rider = users.find(r => r.id === del.riderId);
                      const est = establishments.find(e => e.id === del.establishmentId);
                      return (
                        <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                              {del.orderNumber && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                  #{del.orderNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">Estabelecimento: {est?.name}</p>
                            <p className="text-xs text-slate-400 flex items-center space-x-1 mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Lançada em {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}</span>
                            </p>
                            {del.notes && (
                              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 mt-1.5 italic">
                                Obs: {del.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 self-end sm:self-center">
                            <span className="font-bold text-amber-700 text-lg">R$ {del.value.toFixed(2)}</span>
                            <div className="flex items-center space-x-1">
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

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-slate-800">Registro de Corridas</h2>
                  <button
                    onClick={() => {
                      setEditingDelivery(null);
                      setDeliveryForm({ riderId: '', establishmentId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0,5), value: '', orderNumber: '', notes: '' });
                      setShowDeliveryModal(true);
                    }}
                    className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Corrida</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700">Histórico de Lançamentos</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {processedDeliveries.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">Nenhuma corrida registrada.</div>
                    ) : (
                      processedDeliveries.map(del => {
                        const rider = users.find(r => r.id === del.riderId);
                        const est = establishments.find(e => e.id === del.establishmentId);
                        const isToday = del.date === new Date().toISOString().split('T')[0];

                        return (
                          <div key={del.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                                {del.status === 'cancelled' && (
                                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Cancelada</span>
                                )}
                                {del.status === 'rejected' && (
                                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Rejeitada</span>
                                )}
                                {del.orderNumber && (
                                  <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                    #{del.orderNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">Estabelecimento: {est?.name}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                              </p>
                              {del.notes && (
                                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 mt-1.5 italic">
                                  Obs: {del.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 self-end sm:self-center">
                              <span className={`font-bold text-lg ${del.status === 'cancelled' || del.status === 'rejected' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                                R$ {del.value.toFixed(2)}
                              </span>
                              {isToday && del.status === 'active' && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => {
                                      setEditingDelivery(del);
                                      setDeliveryForm({
                                        riderId: del.riderId,
                                        establishmentId: del.establishmentId,
                                        date: del.date,
                                        time: del.time,
                                        value: del.value.toString(),
                                        orderNumber: del.orderNumber || '',
                                        notes: del.notes || ''
                                      });
                                      setShowDeliveryModal(true);
                                    }}
                                    className="text-slate-500 hover:bg-slate-100 p-2 rounded transition-colors"
                                    title="Editar Corrida"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelDelivery(del.id)}
                                    className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                    title="Cancelar Corrida"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RELATÓRIOS */}
          {activeTab === 'reports' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Relatórios Gerenciais</h2>
                <button
                  onClick={exportToCSV}
                  className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Relatório</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="earnings">Faturamento por Motoboy</option>
                    <option value="deliveries">Quantidade de Corridas por Motoboy</option>
                    <option value="schedules">Escalas por Estabelecimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Período</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
                {reportPeriod === 'custom' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Inicial</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Final</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        userForm={userForm}
        setUserForm={setUserForm}
        establishments={establishments}
        onSave={handleSaveUser}
      />

      <EstablishmentModal
        isOpen={showEstModal}
        onClose={() => setShowEstModal(false)}
        editingEst={editingEst}
        estForm={estForm}
        setEstForm={setEstForm}
        onSave={handleSaveEst}
      />

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        scheduleConflictWarning={scheduleConflictWarning}
        setScheduleConflictWarning={setScheduleConflictWarning}
        onSave={handleSaveSchedule}
      />

      <WeeklyScheduleModal
        isOpen={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        weeklyForm={weeklyForm}
        setWeeklyForm={setWeeklyForm}
        weeklyPreview={weeklyPreview}
        setWeeklyPreview={setWeeklyPreview}
        weeklyStep={weeklyStep}
        setWeeklyStep={setWeeklyStep}
        buildWeeklyPreview={buildWeeklyPreview}
        onSave={handleSaveWeeklySchedule}
        getShiftLabel={getShiftLabel}
      />

      <RiderSchedulesModal
        riderId={riderSchedulesModal}
        onClose={() => setRiderSchedulesModal(null)}
        riders={users.filter(u => u.role === 'rider')}
        schedules={schedules}
        establishments={establishments}
        modalHistoryEst={modalHistoryEst}
        setModalHistoryEst={setModalHistoryEst}
        modalHistoryFrom={modalHistoryFrom}
        setModalHistoryFrom={setModalHistoryFrom}
        modalHistoryTo={modalHistoryTo}
        setModalHistoryTo={setModalHistoryTo}
        onCancelSchedule={handleCancelSchedule}
        onNewSchedule={(riderId) => {
          setRiderSchedulesModal(null);
          setScheduleForm({
            riderId,
            establishmentId: '',
            date: new Date().toISOString().split('T')[0],
            shift: 'morning',
            startTime: '08:00',
            endTime: '12:00'
          });
          setScheduleConflictWarning('');
          setShowScheduleModal(true);
        }}
        getShiftLabel={getShiftLabel}
      />

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        editingDelivery={editingDelivery}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        onSave={handleSaveDelivery}
      />
    </div>
  );
}