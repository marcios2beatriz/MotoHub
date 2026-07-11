"use client";

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
  AlertTriangle,
  Search,
  Clock,
  Navigation,
  Send,
  LayoutGrid,
  List,
  ChevronDown,
  MessageSquare,
  Building2,
  CheckCircle2
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'riders' | 'establishments' | 'schedules' | 'deliveries' | 'reports' | 'requests'>('riders');

  // Listas de dados
  const [riders, setRiders] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);

  // Filtros e buscas
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  // Modais e Formulários
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [editingRider, setEditingRider] = useState<User | null>(null);
  const [riderForm, setRiderForm] = useState({ name: '', cpf: '', phone: '', email: '', password: '' });

  const [showEstModal, setShowEstModal] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [estForm, setEstForm] = useState({
    name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: ''
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ 
    riderId: '', 
    establishmentId: '', 
    date: '', 
    shift: 'morning' as any,
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
  const [weeklyPreview, setWeeklyPreview] = useState<{ date: string; label: string; conflict: boolean }[]>([]);
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
  const [deliveryForm, setDeliveryForm] = useState({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '' });

  // Relatórios
  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const loadData = () => {
    setRiders(db.getUsers().filter(u => u.role === 'rider'));
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

  // --- GESTÃO DE MOTOBOYS ---
  const handleSaveRider = (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();

    const duplicateCpf = allUsers.find(u => u.cpf === riderForm.cpf && (!editingRider || u.id !== editingRider.id));
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === riderForm.email.toLowerCase() && (!editingRider || u.id !== editingRider.id));

    if (duplicateCpf) {
      alert('Erro: CPF já cadastrado no sistema.');
      return;
    }
    if (duplicateEmail) {
      alert('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    if (editingRider) {
      const updated = allUsers.map(u => u.id === editingRider.id ? {
        ...u,
        name: riderForm.name,
        cpf: riderForm.cpf,
        phone: riderForm.phone,
        email: riderForm.email,
        passwordHash: riderForm.password || u.passwordHash,
        mustResetPassword: riderForm.password ? true : u.mustResetPassword
      } : u);
      db.setUsers(updated);
    } else {
      const newRider: User = {
        id: 'u_' + Date.now(),
        name: riderForm.name,
        cpf: riderForm.cpf,
        phone: riderForm.phone,
        email: riderForm.email,
        role: 'rider',
        active: true, // Keep active: true for edited riders (existing functionality)
        passwordHash: riderForm.password || 'moto123'
      };
      db.setUsers([...allUsers, newRider]);
    }

    setShowRiderModal(false);
    setEditingRider(null);
    setRiderForm({ name: '', cpf: '', phone: '', email: '', password: '' });
    loadData();
  };

  const toggleRiderStatus = (id: string) => {
    const allUsers = db.getUsers();
    const updated = allUsers.map(u => u.id === id ? { ...u, active: !u.active } : u);
    db.setUsers(updated);
    loadData();
  };

  // New function to approve a pending rider
  const handleApproveRider = (id: string) => {
    const allUsers = db.getUsers();
    const updated = allUsers.map(u => u.id === id ? { ...u, active: true } : u);
    db.setUsers(updated);
    
    // Create notification for the rider
    const rider = allUsers.find(u => u.id === id);
    if (rider) {
      const allNotif = db.getNotifications();
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        riderId: rider.id,
        title: '🎉 Cadastro Aprovado!',
        message: 'Seu cadastro foi aprovado! Você já pode acessar o sistema com seu e-mail e senha.',
        date: new Date().toISOString(),
        read: false
      };
      db.setNotifications([...allNotif, newNotif]);
    }
    
    loadData();
  };

  // --- GESTÃO DE ESTABELECIMENTOS ---
  const handleSaveEst = (e: React.FormEvent) => {
    e.preventDefault();
    const allEst = db.getEstablishments();

    const duplicateName = allEst.find(es => es.name.toLowerCase() === estForm.name.toLowerCase() && (!editingEst || es.id !== editingEst.id));
    if (duplicateName) {
      alert('Erro: Já existe um estabelecimento com este nome.');
      return;
    }

    if (editingEst) {
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
        }
      } : es);
      db.setEstablishments(updated);
    } else {
      const newEst: Establishment = {
        id: 'e_' + Date.now(),
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
        }
      };
      db.setEstablishments([...allEst, newEst]);
    }

    setShowEstModal(false);
    setEditingEst(null);
    setEstForm({ name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '' });
    loadData();
  };

  const toggleEstStatus = (id: string) => {
    const allEst = db.getEstablishments();
    const updated = allEst.map(es => es.id === id ? { ...es, active: !es.active } : es);
    db.setEstablishments(updated);
    loadData();
  };

  // --- GESTÃO DE ESCALAS ---
  const checkScheduleConflict = (riderId: string, date: string, shift: string) => {
    const conflict = schedules.find(s => s.riderId === riderId && s.date === date && s.shift === shift);
    if (conflict) {
      const rider = riders.find(r => r.id === riderId);
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
  const DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
  const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

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
    setWeeklyPreview(preview as any);
    setWeeklyStep('preview');
  };

  const handleSaveWeeklySchedule = () => {
    const allSchedules = db.getSchedules();
    const allNotif = db.getNotifications();
    const est = establishments.find(es => es.id === weeklyForm.establishmentId);
    const newSchedules: Schedule[] = [];
    const newNotifs: Notification[] = [];

    (weeklyPreview as any[]).forEach((day: any) => {
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
        orderNumber: deliveryForm.orderNumber.trim() || undefined
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
        orderNumber: deliveryForm.orderNumber.trim() || undefined
      };
      db.setDeliveries([...deliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    setDeliveryForm({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '' });
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

  const filteredRiders = riders.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.cpf.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && r.active) || (statusFilter === 'inactive' && !r.active);
    return matchesSearch && matchesStatus;
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
              { tab: 'riders', icon: <Users className="h-4 w-4" />, label: 'Motoboys' },
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
            onClick={() => { setActiveTab('riders'); setSearchQuery(''); setStatusFilter('all'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'riders' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Motoboys</span>
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
              <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
          {/* TAB: MOTOBOYS */}
          {activeTab === 'riders' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Motoboys</h2>
                <button
                  onClick={() => {
                    setEditingRider(null);
                    setRiderForm({ name: '', cpf: '', phone: '', email: '', password: '' });
                    setShowRiderModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Motoboy</span>
                </button>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
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
                <table className="w-full min-w-[580px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">CPF</th>
                      <th className="py-3 px-4">Contato</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRiders.map(rider => (
                      <tr key={rider.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{rider.name}</td>
                        <td className="py-3 px-4 text-slate-600">{rider.cpf}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <p>{rider.email}</p>
                          <p className="text-xs text-slate-400">{rider.phone}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            rider.active ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rider.active ? 'Ativo' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {rider.active && (
                            <button
                              onClick={() => {
                                setScheduleForm({
                                  riderId: rider.id,
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
                              setEditingRider(rider);
                              setRiderForm({
                                name: rider.name,
                                cpf: rider.cpf,
                                phone: rider.phone,
                                email: rider.email,
                                password: ''
                              });
                              setShowRiderModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {!rider.active && (
                            <button
                              onClick={() => handleApproveRider(rider.id)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                              title="Aprovar Motoboy"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Aprovar</span>
                            </button>
                          )}
                          {rider.active && (
                            <button
                              onClick={() => toggleRiderStatus(rider.id)}
                              className={`p-1.5 rounded transition-colors ${
                                rider.active 
                                  ? 'text-red-500 hover:bg-red-50' 
                                  : 'text-emerald-500 hover:bg-emerald-50'
                              }`}
                              title={rider.active ? 'Desativar' : 'Ativar'}
                            >
                              {rider.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
                    setEstForm({ name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '' });
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
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredEsts.map(est => (
                      <tr key={est.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{est.name}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {est.address.street}, {est.address.number} - {est.address.neighborhood}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{est.phone}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            est.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {est.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
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
                                zipCode: est.address.zipCode
                                phone: est.phone
                              });
                              setShowEstModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleEstStatus(est.id)}
                            className={`p-1.5 rounded transition-colors ${
                              est.active 
                                ? 'text-red-500 hover:bg-red-50' 
                                : 'text-emerald-500 hover:bg-emerald-50'
                            }`}
                            title={est.active ? 'Desativar' : 'Ativar'}
                          >
                            {est.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    )}
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
                          <td className="py-3 px-4 text-slate-700>{req.ownerName}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono>{req.phone}</td>
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
                              onClick={() => handleContactRequest(req)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors inline-flex items-center space-x-1 text-xs font-bold"
                              title="Chamar no WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => handleToggleRequestStatus(req.id)}
                              className={`p-1.5 rounded transition-colors ${
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
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
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
                                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isTod ? 'bg-emerald-500' : isPast ? 'bg-slate-300' : 'bg-indigo-400'}`} />
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                              <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                                            </div>
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
                              <p className="text-xl font-bold text-slate-700>{rs.length}</p>
                              <p className="text-xs text-slate-500">Total</p>
                            </div>
                          </div>
                          {next ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Próxima escala</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">{nextEst?.name || 'N/A'}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
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
                              const rider = riders.find(r => r.id === sch.riderId);
                              const est = establishments.find(e => e.id === sch.establishmentId);
                              return (
                                <div key={sch.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                      <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                                      <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                      <span className="text-slate-300">•</span>
                                      <Clock className="h-4 w-4 text-slate-400" />
                                      <span className="font-medium text-indigo-600">{getShiftLabel(sch.shift)}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py=0.5 rounded text-xs">{sch.startTime} - {sch.endTime}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                      <p className={`text-xs font-bold ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</p>
                                      <p className="text-xs font-mono text-slate-600>{sch.startTime}–{sch.endTime}</p>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Registro de Corridas</h2>
                <button
                  onClick={() => {
                    setEditingDelivery(null);
                    setDeliveryForm({ riderId: '', establishmentId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0,5), value: '', orderNumber: '' });
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
                  {deliveries.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhuma corrida registrada.</div>
                  ) : (
                    deliveries.map(del => {
                      const rider = riders.find(r => r.id === del.riderId);
                      const est = establishments.find(e => e.id === del.establishmentId);
                      const isToday = del.date === new Date().toISOString().split('T')[0];

                      return (
                        <div key={del.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-slate-800>{rider?.name || 'Motoboy'}</p>
                              {del.status === 'cancelled' && (
                                <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py=0.5 rounded-full">Cancelada</span>
                              )}
                              {del.orderNumber && (
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py=0.5 rounded-full">
                                  #{del.orderNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">Estabelecimento: {est?.name}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 self-end sm:self-center">
                            <span className={`font-bold text-lg ${del.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
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
                                      orderNumber: del.orderNumber || ''
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Relatório</label>
                  <select
                    value={reportType}
                    onChange={(e: any) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="earnings">Faturamento por Motoboy</option>
                    <option value="deliveries">Quantidade de Corridas</option>
                    <option value="schedules">Escalas por Estabelecimento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período</label>
                  <select
                    value={reportPeriod}
                    onChange={(e: any) => setReportPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="daily">Diário (Hoje)</option>
                    <option value="weekly">Semanal (Segunda a Domingo)</option>
                    <option value="monthly">Mensal (Mês Atual)</option>
                    <option value="custom">Intervalo Personalizado</option>
                  </select>
                </div>

                {reportPeriod === 'custom' && (
                  <div className="sm:col-span-3 grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                        <th className="py-3 px-4">Item / Nome</th>
                        {reportType === 'earnings' && <th className="py-3 px-4">Total Faturado</th>}
                        {reportType === 'earnings' && <th className="py-3 px-4">Corridas Realizadas</th>}
                        {reportType === 'deliveries' && <th className="py-3 px-4">Corridas Ativas</th>}
                        {reportType === 'deliveries' && <th className="py-3 px-4">Corridas Canceladas</th>}
                        {reportType === 'schedules' && <th className="py-3 px-4">Total de Escalas</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {getFilteredReportData().map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-medium text-slate-800>{row.name}</td>
                          {reportType === 'earnings' && <td className="py-3 px-4 text-emerald-600 font-bold>R$ {row.total.toFixed(2)}</td>}
                          {reportType === 'earnings' && <td className="py-3 px-4 text-slate-600>{row.count}</td>}
                          {reportType === 'deliveries' && <td className="py-3 px-4 text-slate-600>{row.count}</td>}
                          {reportType === 'deliveries' && <td className="py-3 px-4 text-red-500>{row.cancelled}</td>}
                          {reportType === 'schedules' && <td className="py-3 px-4 text-slate-600>{row.count}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: MOTOBOY */}
      {showRiderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingRider ? 'Editar Motoboy' : 'Cadastrar Novo Motoboy'}
              </h3>
              <button onClick={() => setShowRiderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveRider} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={riderForm.name}
                  onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={riderForm.cpf}
                  onChange={(e) => setRiderForm({ ...riderForm, cpf: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={riderForm.phone}
                  onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={riderForm.email}
                  onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {editingRider ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial'}
                </label>
                <input
                  type="password"
                  required={!editingRider}
                  value={riderForm.password}
                  onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt<div className="flex justify-end space-x-2 pt-3">
  <button
    type="button"
    onClick={() => setShowRiderModal(false)}
    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
  >
    Cancelar
  </button>
  <button
    type="submit"
    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
  >
    Salvar
  </button>
</div>
</form>
</div>
</div>
)}

/* MODAL: ESTABELECIMENTO */
{showEstModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">
          {editingEst ? 'Editar Estabelecimento' : 'Cadastrar Estabelecimento'}
        </h3>
        <button onClick={() => setShowEstModal(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSaveEst} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Estabelecimento</label>
          <input
            type="text"
            required
            value={estForm.name}
            onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rua / Logradouro</label>
            <input
              type="text"
              required
              value={estForm.street}
              onChange={(e) => setEstForm({ ...estForm, street: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número</label>
            <input
              type="text"
              required
              value={estForm.number}
              onChange={(e) => setEstForm({ ...estForm, number: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label>
            <input
              type="text"
              required
              value={estForm.neighborhood}
              onChange={(e) => setEstForm({ ...estForm, neighborhood: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Complemento</label>
            <input
              type="text"
              value={estForm.complement}
              onChange={(e) => setEstForm({ ...estForm, complement: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label>
            <input
              type="text"
              required
              value={estForm.city}
              onChange={(e) => setEstForm({ ...estForm, city: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
            <input
              type="text"
              required
              maxLength={2}
              placeholder="SP"
              value={estForm.state}
              onChange={(e) => setEstForm({ ...estForm, state: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP</label>
            <input
              type="text"
              required
              placeholder="00000-000"
              value={estForm.zipCode}
              onChange={(e) => setEstForm({ ...estForm, zipCode: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
            <input
              type="text"
              required
              placeholder="(11) 3333-3333"
              value={estForm.phone}
              onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-3">
          <button
            type="button"
            onClick={() => setShowEstModal(false)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  </div>
)}

/* MODAL: ESCALA */
{showScheduleModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Criar Nova Escala</h3>
        <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {scheduleConflictWarning && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">Conflito de Escala</p>
            <p className="text-xs text-amber-700 mt-1">{scheduleConflictWarning}</p>
            <p className="text-xs text-amber-600 mt-2 font-semibold">Deseja confirmar mesmo assim?</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveSchedule} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
          <select
            required
            value={scheduleForm.riderId}
            onChange={(e) => {
              setScheduleForm({ ...scheduleForm, riderId: e.target.value });
              setScheduleConflictWarning('');
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">Selecione um Motoboy</option>
            {riders.filter(r => r.active).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
          <select
            required
            value={scheduleForm.establishmentId}
            onChange={(e) => {
              setScheduleForm({ ...scheduleForm, establishmentId: e.target.value });
              setScheduleConflictWarning('');
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">Selecione um Estabelecimento</option>
            {establishments.filter(e => e.active).map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
            <input
              type="date"
              required
              value={scheduleForm.date}
              onChange={(e) => {
                setScheduleForm({ ...scheduleForm, date: e.target.value });
                setScheduleConflictWarning('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
            <select
              required
              value={scheduleForm.shift}
              onChange={(e: any) => {
                setScheduleForm({ ...scheduleForm, shift: e.target.value });
                setScheduleConflictWarning('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="morning">Manhã</option>
              <option value="afternoon">Tarde</option>
              <option value="night">Noite</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Início</label>
            <input
              type="time"
              required
              value={scheduleForm.startTime}
              onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
              className="w-full px-3 py-2 border border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Término</label>
            <input
              type="time"
              required
              value={scheduleForm.endTime}
              onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-3">
          <button
            type="button"
            onClick={() => setShowScheduleModal(false)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            {scheduleConflictWarning ? 'Confirmar Mesmo Assim' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

/* MODAL: ESCALA SEMANAL AUTOMÁTICA */
{showWeeklyModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            Escala Semanal Automática
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {weeklyStep === 'form' ? 'Configure a escala para a semana' : 'Revise os dias antes de confirmar'}
          </p>
        </div>
        <button onClick={() => setShowWeeklyModal(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {weeklyStep === 'form' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
            <select
              required
              value={weeklyForm.riderId}
              onChange={(e) => setWeeklyForm({ ...weeklyForm, riderId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione um Motoboy</option>
              {riders.filter(r => r.active).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
            <select
              required
              value={weeklyForm.establishmentId}
              onChange={(e) => setWeeklyForm({ ...weeklyForm, establishmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione um Estabelecimento</option>
              {establishments.filter(e => e.active).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semana>Semana (início na segunda-feira)</label>
            <input
              type="date"
              value={weeklyForm.weekStart}
              onChange={(e) => setWeeklyForm({ ...weeklyForm, weekStart: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
              <select
                value={weeklyForm.shift}
                onChange={(e: any) => setWeeklyForm({ ...weeklyForm, shift: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noite</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
              <input
                type="time"
                value={weeklyForm.startTime}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Término</label>
              <input
                type="time"
                value={weeklyForm.endTime}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias que o estabelecimento funciona</label>
            <div className="grid grid-cols-7 gap-1">
              {(['seg','ter','qua','qui','sex','sab','dom'] as const).map((key, idx) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWeeklyForm({ ...weeklyForm, days: { ...weeklyForm.days, [key]: !weeklyForm.days[key] } })}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                    weeklyForm.days[key]
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][idx]}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">Clique para ativar/desativar dias</p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowWeeklyModal(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!weeklyForm.riderId || !weeklyForm.establishmentId || !weeklyForm.weekStart) {
                  alert('Preencha motoboy, estabelecimento e semana.');
                  return;
                }
                if (!Object.values(weeklyForm.days).some(Boolean)) {
                  alert('Selecione pelo menos um dia da semana.');
                  return;
                }
                buildWeeklyPreview(weeklyForm);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
            >
              Pré-visualizar →
            </button>
          </div>
        </div>
      )}

      {weeklyStep === 'preview' && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1 border border-slate-200">
            <p><span className="font-semibold text-slate-600">Motoboy:</span> {riders.find(r => r.id === weeklyForm.riderId)?.name}</p>
            <p><span className="font-semibold text-slate-600">Estabelecimento:</span> {establishments.find(e => e.id === weeklyForm.establishmentId)?.name}</p>
            <p><span className="font-semibold text-slate-600">Turno:</span> {getShiftLabel(weeklyForm.shift)} ({weeklyForm.startTime} - {weeklyForm.endTime})</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias gerados — desmarque se necessário</label>
            <div className="space-y-2">
              {(weeklyPreview as any[]).map((day: any) => (
                <div
                  key={day.date}
                  onClick={() => setWeeklyPreview((prev: any[]) =>
                    prev.map((d: any) => d.date === day.date ? { ...d, enabled: !d.enabled } : d)
                  )}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    !day.enabled
                      ? 'bg-slate-50 border-slate-200 opacity-50'
                      : day.conflict
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      day.enabled ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                    }`}>
                      {day.enabled && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${day.enabled ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                        {day.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {day.conflict && day.enabled && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Conflito
                    </span>
                  )}
                  {!day.enabled && (
                    <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">Ignorado</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Clique em um dia para ativar/desativar</p>
          </div>

          {(weeklyPreview as any[]).some((d: any) => d.conflict && d.enabled) && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded text-sm text-amber-800">
              <strong>Atenção:</strong> Alguns dias marcados já possuem escala para este motoboy e turno. Eles serão criados mesmo assim.
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setWeeklyStep('form')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Voltar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowWeeklyModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveWeeklySchedule}
                disabled={!(weeklyPreview as any[]).some((d: any) => d.enabled)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
              >
                Confirmar {(weeklyPreview as any[]).filter((d: any) => d.enabled).length} dia(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)}

/* MODAL: ESCALAS DO MOTOBOY (Ver Todas) */
{riderSchedulesModal && (() => {
  const rider = riders.find(r => r.id === riderSchedulesModal);
  if (!rider) return null;
  const todayStr = new Date().toISOString().split('T')[0];
  const rs = schedules.filter(s => s.riderId === rider.id).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = rs.filter(s => s.date >= todayStr);
  const past = rs.filter(s => s.date < todayStr);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white ${rider.active ? 'bg-indigo-600' : 'bg-slate-400'}`}>
              {rider.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{rider.name}</h3>
              <p className="text-xs text-slate-500">{rider.phone} • {rider.cpf}</p>
            </div>
          </div>
          <button onClick={() => setRiderSchedulesModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="bg-indigo-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-indigo-700">{upcoming.length}</p>
            <p className="text-xs text-indigo-500">Futuras</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-slate-700">{past.length}</p>
            <p className="text-xs text-slate-500">Passadas</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-slate-700>{rs.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {rs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Próximas escalas</p>
                  <div className="space-y-2">
                    {upcoming.map(sch => {
                      const est = establishments.find(e => e.id === sch.establishmentId);
                      const isToday = sch.date === todayStr;
                      return (
                        <div key={sch.id} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${isToday ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isToday && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                              <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span className="text-slate-300">•</span>
                              <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono">{sch.startTime}–{sch.endTime}</span>
                            </p>
                          </div>
                          <button onClick={() => { handleCancelSchedule(sch.id); }} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase">Histórico de escalas</p>
                      <span className="text-xs text-slate-400">{past.length} registro{past.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Search className="h-3 w-3" />Filtrar histórico
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        <select
                          value={modalHistoryEst}
                          onChange={e => setModalHistoryEst(e.target.value)}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Todos os estabelecimentos</option>
                          {Array.from(new Set(past.map(s => s.establishmentId))).map(eid => {
                            const e = establishments.find(x => x.id === eid);
                            return e ? <option key={e.id} value={e.id}>{e.name}</option> : null;
                          })}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">De</label>
                            <input type="date" value={modalHistoryFrom} onChange={e => setModalHistoryFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Até</label>
                            <input type="date" value={modalHistoryTo} onChange={e => setModalHistoryTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                        </div>
                        {(modalHistoryEst || modalHistoryFrom || modalHistoryTo) && (
                          <button onClick={() => { setModalHistoryEst(''); setModalHistoryFrom(''); setModalHistoryTo(''); }} className="text-xs text-indigo-600 hover:underline text-left font-medium">Limpar filtros</button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 opacity-70">
                      {past
                        .filter(s => (!modalHistoryEst || s.establishmentId === modalHistoryEst) && (!modalHistoryFrom || s.date >= modalHistoryFrom) && (!modalHistoryTo || s.date <= modalHistoryTo))
                        .map(sch => {
                          const est = establishments.find(e => e.id === sch.establishmentId);
                          return (
                            <div key={sch.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{est?.name || 'N/A'}</p>
                                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1">
                                    <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-500' : sch.shift === 'afternoon' ? 'text-orange-500' : 'text-blue-500'}`}>{getShiftLabel(sch.shift)}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-mono">{sch.startTime}–{sch.endTime}</span>
                                  </p>
                                </div>
                                <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py=0.5 rounded-full uppercase flex-shrink-0">Concluída</span>
                              </div>
                            </div>
                          );
                        })}
                      {past.filter(s => (!modalHistoryEst || s.establishmentId === modalHistoryEst) && (!modalHistoryFrom || s.date >= modalHistoryFrom) && (!modalHistoryTo || s.date <= modalHistoryTo)).length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400">Nenhum registro com os filtros selecionados.</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
            <button
              onClick={() => { setScheduleForm({ riderId: rider.id, establishmentId: '', date: new Date().toISOString().split('T')[0], shift: 'morning', startTime: '08:00', endTime: '12:00' }); setScheduleConflictWarning(''); setRiderSchedulesModal(null); setShowScheduleModal(true); }}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Escala
            </button>
            <button onClick={() => setRiderSchedulesModal(null)} className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
})()}

/* MODAL: REGISTRAR CORRIDA */
{showDeliveryModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">
          {editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}
        </h3>
        <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSaveDelivery} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
          <select
            required
            value={deliveryForm.riderId}
            onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">Selecione um Motoboy</option>
            {riders.filter(r => r.active).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
          <select
            required
            value={deliveryForm.establishmentId}
            onChange={(e) => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">Selecione um Estabelecimento</option>
            {establishments.filter(e => e.active).map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
            <input
              type="date"
              required
              value={deliveryForm.date}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
            <input
              type="time"
              required
              value={deliveryForm.time}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              placeholder="0,00"
              value={deliveryForm.value}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº do Pedido (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: 1234"
              value={deliveryForm.orderNumber}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-3">
          <button
            type="button"
            onClick={() => setShowDeliveryModal(false)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  </div>
);
}