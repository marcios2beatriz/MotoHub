"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, Notification } from '../utils/db';
import { 
  Users, 
  Store, 
  Calendar, 
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
  Clock
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'riders' | 'establishments' | 'schedules' | 'deliveries' | 'reports'>('riders');

  // Listas de dados
  const [riders, setRiders] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  // Filtros e buscas
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ riderId: '', establishmentId: '', date: '', time: '', value: '' });

  // Relatórios
  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [adminUser, navigate]);

  const loadData = () => {
    setRiders(db.getUsers().filter(u => u.role === 'rider'));
    setEstablishments(db.getEstablishments());
    setSchedules(db.getSchedules());
    setDeliveries(db.getDeliveries());
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  // --- GESTÃO DE MOTOQUEIROS ---
  const handleSaveRider = (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();

    // Validações de CPF e E-mail únicos
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
        active: true,
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
          complement: estForm.complement,
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
          complement: estForm.complement,
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
      return `Aviso: O motoqueiro ${rider?.name} já está escalado no estabelecimento ${est?.name} neste mesmo dia e turno!`;
    }
    return '';
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const conflict = checkScheduleConflict(scheduleForm.riderId, scheduleForm.date, scheduleForm.shift);
    
    if (conflict && !scheduleConflictWarning) {
      setScheduleConflictWarning(conflict);
      return; // Exibe o aviso primeiro
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

    // Criar Notificação para o Motoqueiro
    const est = establishments.find(es => es.id === scheduleForm.establishmentId);
    const allNotif = db.getNotifications();
    const newNotif: Notification = {
      id: 'n_' + Date.now(),
      riderId: scheduleForm.riderId,
      title: 'Nova Escala Cadastrada',
      message: `Você foi escalado no estabelecimento ${est?.name} para o dia ${new Date(scheduleForm.date + 'T00:00:00').toLocaleDateString('pt-BR')} no turno da ${getShiftLabel(scheduleForm.shift)} (${scheduleForm.startTime} - ${scheduleForm.endTime}).`,
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

      // Notificar Motoqueiro
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

  // --- REGISTRO DE CORRIDAS ---
  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    // Tentar associar automaticamente à escala ativa
    const activeSchedule = schedules.find(s => 
      s.riderId === deliveryForm.riderId && 
      s.establishmentId === deliveryForm.establishmentId && 
      s.date === deliveryForm.date
    );

    if (editingDelivery) {
      // Verificar se é do mesmo dia para permitir edição
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
        scheduleId: activeSchedule?.id || d.scheduleId
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
        scheduleId: activeSchedule?.id
      };
      db.setDeliveries([...deliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    setDeliveryForm({ riderId: '', establishmentId: '', date: '', time: '', value: '' });
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

    if (confirm('Deseja realmente cancelar esta corrida? O valor será deduzido do faturamento do motoqueiro.')) {
      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d);
      db.setDeliveries(updated);
      loadData();
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

    if (reportType === 'earnings') {
      // Faturamento por motoqueiro
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
      // Quantidade de corridas por motoqueiro
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
      // Escalas por estabelecimento
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
      csvContent += "Motoqueiro,Total Faturado (R$),Quantidade de Corridas\n";
      data.forEach((row: any) => {
        csvContent += `"${row.name}",${row.total.toFixed(2)},${row.count}\n`;
      });
    } else if (reportType === 'deliveries') {
      csvContent += "Motoqueiro,Corridas Ativas,Corridas Canceladas\n";
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

  // Filtros aplicados na listagem de motoqueiros
  const filteredRiders = riders.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.cpf.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && r.active) || (statusFilter === 'inactive' && !r.active);
    return matchesSearch && matchesStatus;
  });

  // Filtros aplicados na listagem de estabelecimentos
  const filteredEsts = establishments.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && e.active) || (statusFilter === 'inactive' && !e.active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Bike className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Painel Administrativo</h1>
              <p className="text-xs text-slate-400">Gestão de Escalas e Entregas</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
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
      </header>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit space-y-1">
          <button
            onClick={() => { setActiveTab('riders'); setSearchQuery(''); setStatusFilter('all'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'riders' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Motoqueiros</span>
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
        <div className="lg:col-span-4 space-y-6">
          {/* TAB: MOTOQUEIROS */}
          {activeTab === 'riders' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Motoqueiros</h2>
                <button
                  onClick={() => {
                    setEditingRider(null);
                    setRiderForm({ name: '', cpf: '', phone: '', email: '', password: '' });
                    setShowRiderModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Motoqueiro</span>
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
                <table className="w-full text-left border-collapse">
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
                            rider.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rider.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
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
                <table className="w-full text-left border-collapse">
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
                                zipCode: est.address.zipCode,
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
                    ))}
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
                <button
                  onClick={() => {
                    setScheduleForm({ 
                      riderId: '', 
                      establishmentId: '', 
                      date: '', 
                      shift: 'morning',
                      startTime: '08:00',
                      endTime: '12:00'
                    });
                    setScheduleConflictWarning('');
                    setShowScheduleModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Criar Nova Escala</span>
                </button>
              </div>

              {/* Calendário Semanal Simples */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200">
                  <h3 className="font-bold text-slate-700">Escalas Ativas</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {schedules.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhuma escala cadastrada.</div>
                  ) : (
                    schedules.map(sch => {
                      const rider = riders.find(r => r.id === sch.riderId);
                      const est = establishments.find(e => e.id === sch.establishmentId);
                      return (
                        <div key={sch.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                          <div>
                            <p className="font-bold text-slate-800">{rider?.name || 'Motoqueiro Desconhecido'}</p>
                            <p className="text-sm text-slate-600">Estabelecimento: <span className="font-medium">{est?.name || 'N/A'}</span></p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <span>Data: {new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              <span>|</span>
                              <span>Turno: <span className="font-semibold text-indigo-600">{getShiftLabel(sch.shift)}</span></span>
                              <span>|</span>
                              <Clock className="h-3.5 w-3.5 text-slate-400 inline" />
                              <span className="font-semibold text-slate-700">{sch.startTime} - {sch.endTime}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancelSchedule(sch.id)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors self-end sm:self-center"
                            title="Cancelar Escala"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
                    setDeliveryForm({ riderId: '', establishmentId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0,5), value: '' });
                    setShowDeliveryModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Lançar Corrida</span>
                </button>
              </div>

              {/* Histórico de Corridas */}
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
                              <p className="font-bold text-slate-800">{rider?.name || 'Motoqueiro'}</p>
                              {del.status === 'cancelled' && (
                                <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Cancelada</span>
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
                              <button
                                onClick={() => handleCancelDelivery(del.id)}
                                className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                title="Cancelar Corrida"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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

              {/* Filtros de Relatório */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Relatório</label>
                  <select
                    value={reportType}
                    onChange={(e: any) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="earnings">Faturamento por Motoqueiro</option>
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

              {/* Tabela de Resultados */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
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
                        <td className="py-3 px-4 font-medium text-slate-800">{row.name}</td>
                        {reportType === 'earnings' && <td className="py-3 px-4 text-emerald-600 font-bold">R$ {row.total.toFixed(2)}</td>}
                        {reportType === 'earnings' && <td className="py-3 px-4 text-slate-600">{row.count}</td>}
                        {reportType === 'deliveries' && <td className="py-3 px-4 text-slate-600">{row.count}</td>}
                        {reportType === 'deliveries' && <td className="py-3 px-4 text-red-500">{row.cancelled}</td>}
                        {reportType === 'schedules' && <td className="py-3 px-4 text-slate-600">{row.count}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: MOTOQUEIRO */}
      {showRiderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingRider ? 'Editar Motoqueiro' : 'Cadastrar Novo Motoqueiro'}
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
              <div className="flex justify-end space-x-2 pt-3">
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

      {/* MODAL: ESTABELECIMENTO */}
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

      {/* MODAL: ESCALA */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoqueiro</label>
                <select
                  required
                  value={scheduleForm.riderId}
                  onChange={(e) => {
                    setScheduleForm({ ...scheduleForm, riderId: e.target.value });
                    setScheduleConflictWarning('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">Selecione um Motoqueiro</option>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
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

      {/* MODAL: CORRIDA */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Lançar Nova Corrida</h3>
              <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDelivery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoqueiro</label>
                <select
                  required
                  value={deliveryForm.riderId}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">Selecione um Motoqueiro</option>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                  <input
                    type="time"
                    required
                    value={deliveryForm.time}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Corrida (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={deliveryForm.value}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
                />
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
                  Salvar Corrida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}