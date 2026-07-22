import React, { useState, useEffect, useRef } from 'react';
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
  UserPlus,
  Eye,
  EyeOff,
  TrendingUp,
  DollarSign
} from 'lucide-react';

import UserModal from '../components/UserModal';
import EstablishmentModal from '../components/EstablishmentModal';
import ScheduleModal from '../components/ScheduleModal';
import WeeklyScheduleModal from '../components/WeeklyScheduleModal';
import RiderSchedulesModal from '../components/RiderSchedulesModal';
import DeliveryModal from '../components/DeliveryModal';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';

const DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

const getThisMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'establishments' | 'requests' | 'schedules' | 'deliveries' | 'finance' | 'reports'>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);

  const prevNotesRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'rider' | 'establishment'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', cpf: '', phone: '', email: '', role: 'rider' as any, password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: ''
  });

  const [showEstModal, setShowEstModal] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [estForm, setEstForm] = useState({
    name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: ''
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ 
    riderId: '', establishmentId: '', date: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00'
  });
  const [scheduleConflictWarning, setScheduleConflictWarning] = useState('');

  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState({
    riderId: '', establishmentId: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00', weekStart: '',
    days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false }
  });
  const [weeklyPreview, setWeeklyPreview] = useState<any[]>([]);
  const [weeklyStep, setWeeklyStep] = useState<'form' | 'preview'>('form');

  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [scheduleViewMode, setScheduleViewMode] = useState<'accordion' | 'grid' | 'timeline'>('accordion');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [riderSchedulesModal, setRiderSchedulesModal] = useState<string | null>(null);

  const [modalHistoryEst, setModalHistoryEst] = useState('');
  const [modalHistoryFrom, setModalHistoryFrom] = useState('');
  const [modalHistoryTo, setModalHistoryTo] = useState('');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '', notes: '' });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const loadData = () => {
    const currentUsers = db.getUsers();
    const currentEsts = db.getEstablishments();
    const currentSchedules = db.getSchedules();
    const currentDeliveries = db.getDeliveries();
    const rawRequests = db.getPartnerRequests();

    const inactiveEsts = currentEsts.filter(e => !e.active);
    const virtualRequests: PartnerRequest[] = inactiveEsts.map(e => {
      const manager = currentUsers.find(u => u.establishmentId === e.id);
      const street = e.address?.street || 'Endereço não informado';
      const num = e.address?.number || 'S/N';
      const neighborhood = e.address?.neighborhood || '';
      const city = e.address?.city || '';
      
      return {
        id: 'req_virtual_' + e.id,
        establishmentName: e.name,
        ownerName: manager ? manager.name.replace('Gerente ', '') : 'Proprietário',
        phone: e.phone || manager?.phone || 'Sem telefone',
        address: `${street}, ${num} - ${neighborhood} ${city}`.trim(),
        status: 'pending' as const,
        createdAt: e.createdAt || new Date().toISOString()
      };
    });

    const mergedRequests = [...rawRequests];
    virtualRequests.forEach(vr => {
      const exists = mergedRequests.some(r => r.establishmentName.toLowerCase().trim() === vr.establishmentName.toLowerCase().trim());
      if (!exists) {
        mergedRequests.push(vr);
      }
    });

    const sortedUsers = [...currentUsers].sort((a, b) => a.name.localeCompare(b.name));
    const sortedEsts = [...currentEsts].sort((a, b) => a.name.localeCompare(b.name));
    const sortedSchedules = [...currentSchedules].sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
    const sortedDeliveries = [...currentDeliveries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id));
    const sortedRequests = [...mergedRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    setUsers(sortedUsers);
    setEstablishments(sortedEsts);
    setSchedules(sortedSchedules);
    setDeliveries(sortedDeliveries);
    setPartnerRequests(sortedRequests);
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin') {
      navigate('/login');
      return;
    }
    requestNotificationPermission();
    loadData();
  }, [adminUser, navigate, activeTab]);

  // Monitor Delivery Notes for Admin
  useEffect(() => {
    deliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Admin') || line.includes(`(${adminUser?.name})`);
            if (!isMe) {
              const rider = db.resolveUser(d.riderId);
              const est = db.resolveEstablishment(d.establishmentId);
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Estabelecimento';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Mensagem de ${sender} (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `${est?.name || ''} / ${rider?.name || ''}: "${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'admin_notes_' + Date.now(),
                title,
                message: messageText,
                sender,
                onClick: () => setNotesDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [deliveries, adminUser]);

  // Monitor Shift Schedule Chat for Admin
  useEffect(() => {
    schedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Admin') || line.includes(`(${adminUser?.name})`);
            if (!isMe) {
              const rider = db.resolveUser(s.riderId);
              const est = db.resolveEstablishment(s.establishmentId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Aviso no Turno (${est?.name || 'Estabelecimento'} - ${rider?.name || 'Motoboy'})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'admin_sch_' + Date.now(),
                title,
                message: messageText,
                sender: rider?.name || 'Motoboy/Estabelecimento',
                onClick: () => setActiveScheduleChatId(s.id)
              });
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [schedules, adminUser]);

  useEffect(() => {
    const handleSyncComplete = () => loadData();
    window.addEventListener('db-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('db-sync-complete', handleSyncComplete);
  }, []);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();
    const allEsts = db.getEstablishments();
    const userCpf = userForm.role === 'establishment' ? db.generateUniqueDummyCpf() : userForm.cpf;

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

    if (userForm.role === 'establishment' && userForm.establishmentName) {
      const existingEst = allEsts.find(e => e.name.toLowerCase() === userForm.establishmentName.toLowerCase());
      if (existingEst) {
        finalEstId = existingEst.id;
        const updatedEsts = allEsts.map(e => e.id === existingEst.id ? {
          ...e,
          address: {
            street: userForm.street || e.address?.street || '',
            number: userForm.number || e.address?.number || '',
            complement: e.address?.complement || '',
            neighborhood: userForm.neighborhood || e.address?.neighborhood || '',
            city: userForm.city || e.address?.city || '',
            state: userForm.state || e.address?.state || '',
            zipCode: userForm.zipCode || e.address?.zipCode || ''
          },
          updatedAt: nowStr
        } : e);
        db.setEstablishments(updatedEsts);
      } else {
        const newEstId = 'e_' + Date.now();
        const newEst: Establishment = {
          id:<dyad-write path="src/pages/AdminDashboard.tsx" description="Completing AdminDashboard.tsx with chat notifications and modals">
import React, { useState, useEffect, useRef } from 'react';
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
  UserPlus,
  Eye,
  EyeOff,
  TrendingUp,
  DollarSign
} from 'lucide-react';

import UserModal from '../components/UserModal';
import EstablishmentModal from '../components/EstablishmentModal';
import ScheduleModal from '../components/ScheduleModal';
import WeeklyScheduleModal from '../components/WeeklyScheduleModal';
import RiderSchedulesModal from '../components/RiderSchedulesModal';
import DeliveryModal from '../components/DeliveryModal';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';

const DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

const getThisMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'establishments' | 'requests' | 'schedules' | 'deliveries' | 'finance' | 'reports'>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);

  const prevNotesRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'rider' | 'establishment'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', cpf: '', phone: '', email: '', role: 'rider' as any, password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: ''
  });

  const [showEstModal, setShowEstModal] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [estForm, setEstForm] = useState({
    name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: ''
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ 
    riderId: '', establishmentId: '', date: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00'
  });
  const [scheduleConflictWarning, setScheduleConflictWarning] = useState('');

  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState({
    riderId: '', establishmentId: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00', weekStart: '',
    days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false }
  });
  const [weeklyPreview, setWeeklyPreview] = useState<any[]>([]);
  const [weeklyStep, setWeeklyStep] = useState<'form' | 'preview'>('form');

  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [scheduleViewMode, setScheduleViewMode] = useState<'accordion' | 'grid' | 'timeline'>('accordion');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [riderSchedulesModal, setRiderSchedulesModal] = useState<string | null>(null);

  const [modalHistoryEst, setModalHistoryEst] = useState('');
  const [modalHistoryFrom, setModalHistoryFrom] = useState('');
  const [modalHistoryTo, setModalHistoryTo] = useState('');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ riderId: '', establishmentId: '', date: '', time: '', value: '', orderNumber: '', notes: '' });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const loadData = () => {
    const currentUsers = db.getUsers();
    const currentEsts = db.getEstablishments();
    const currentSchedules = db.getSchedules();
    const currentDeliveries = db.getDeliveries();
    const rawRequests = db.getPartnerRequests();

    const inactiveEsts = currentEsts.filter(e => !e.active);
    const virtualRequests: PartnerRequest[] = inactiveEsts.map(e => {
      const manager = currentUsers.find(u => u.establishmentId === e.id);
      const street = e.address?.street || 'Endereço não informado';
      const num = e.address?.number || 'S/N';
      const neighborhood = e.address?.neighborhood || '';
      const city = e.address?.city || '';
      
      return {
        id: 'req_virtual_' + e.id,
        establishmentName: e.name,
        ownerName: manager ? manager.name.replace('Gerente ', '') : 'Proprietário',
        phone: e.phone || manager?.phone || 'Sem telefone',
        address: `${street}, ${num} - ${neighborhood} ${city}`.trim(),
        status: 'pending' as const,
        createdAt: e.createdAt || new Date().toISOString()
      };
    });

    const mergedRequests = [...rawRequests];
    virtualRequests.forEach(vr => {
      const exists = mergedRequests.some(r => r.establishmentName.toLowerCase().trim() === vr.establishmentName.toLowerCase().trim());
      if (!exists) {
        mergedRequests.push(vr);
      }
    });

    const sortedUsers = [...currentUsers].sort((a, b) => a.name.localeCompare(b.name));
    const sortedEsts = [...currentEsts].sort((a, b) => a.name.localeCompare(b.name));
    const sortedSchedules = [...currentSchedules].sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
    const sortedDeliveries = [...currentDeliveries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id));
    const sortedRequests = [...mergedRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    setUsers(sortedUsers);
    setEstablishments(sortedEsts);
    setSchedules(sortedSchedules);
    setDeliveries(sortedDeliveries);
    setPartnerRequests(sortedRequests);
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin') {
      navigate('/login');
      return;
    }
    requestNotificationPermission();
    loadData();
  }, [adminUser, navigate, activeTab]);

  // Monitor Delivery Notes for Admin
  useEffect(() => {
    deliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Admin') || line.includes(`(${adminUser?.name})`);
            if (!isMe) {
              const rider = db.resolveUser(d.riderId);
              const est = db.resolveEstablishment(d.establishmentId);
              const sender = line.includes('- Motoboy') ? 'Motoboy' : 'Estabelecimento';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Mensagem de ${sender} (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `${est?.name || ''} / ${rider?.name || ''}: "${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'admin_notes_' + Date.now(),
                title,
                message: messageText,
                sender,
                onClick: () => setNotesDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [deliveries, adminUser]);

  // Monitor Shift Schedule Chat for Admin
  useEffect(() => {
    schedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Admin') || line.includes(`(${adminUser?.name})`);
            if (!isMe) {
              const rider = db.resolveUser(s.riderId);
              const est = db.resolveEstablishment(s.establishmentId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Aviso no Turno (${est?.name || 'Estabelecimento'} - ${rider?.name || 'Motoboy'})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'admin_sch_' + Date.now(),
                title,
                message: messageText,
                sender: rider?.name || 'Motoboy/Estabelecimento',
                onClick: () => setActiveScheduleChatId(s.id)
              });
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [schedules, adminUser]);

  useEffect(() => {
    const handleSyncComplete = () => loadData();
    window.addEventListener('db-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('db-sync-complete', handleSyncComplete);
  }, []);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();
    const allEsts = db.getEstablishments();
    const userCpf = userForm.role === 'establishment' ? db.generateUniqueDummyCpf() : userForm.cpf;

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

    if (userForm.role === 'establishment' && userForm.establishmentName) {
      const existingEst = allEsts.find(e => e.name.toLowerCase() === userForm.establishmentName.toLowerCase());
      if (existingEst) {
        finalEstId = existingEst.id;
        const updatedEsts = allEsts.map(e => e.id === existingEst.id ? {
          ...e,
          address: {
            street: userForm.street || e.address?.street || '',
            number: userForm.number || e.address?.number || '',
            complement: e.address?.complement || '',
            neighborhood: userForm.neighborhood || e.address?.neighborhood || '',
            city: userForm.city || e.address?.city || '',
            state: userForm.state || e.address?.state || '',
            zipCode: userForm.zipCode || e.address?.zipCode || ''
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
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (id === adminUser?.id) {
      alert('Erro: Você não pode excluir a si mesmo.');
      return;
    }
    if (confirm('Deseja realmente excluir este usuário definitivamente?')) {
      await db.deleteUser(id);
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

    const updatedUsers = allUsers.map(u => u.id === id ? { ...u, active: true, updatedAt: new Date().toISOString() } : u);
    db.setUsers(updatedUsers);

    if (userToApprove.role === 'establishment' && userToApprove.establishmentId) {
      const updatedEsts = allEsts.map(e => e.id === userToApprove.establishmentId ? { ...e, active: true, updatedAt: new Date().toISOString() } : e);
      db.setEstablishments(updatedEsts);
    }
    
    if (userToApprove.role === 'rider') {
      const allNotif = db.getNotifications();
      db.setNotifications([...allNotif, {
        id: 'n_' + Date.now(),
        riderId: userToApprove.id,
        title: '🎉 Cadastro Aprovado!',
        message: 'Seu cadastro foi aprovado! Você já pode acessar o sistema.',
        date: new Date().toISOString(),
        read: false
      }]);
    }
    loadData();
    alert('Usuário aprovado com sucesso!');
  };

  const handleSaveEst = (e: React.FormEvent) => {
    e.preventDefault();
    const allEst = db.getEstablishments();
    const allUsers = db.getUsers();

    const duplicateName = allEst.find(es => es.name.toLowerCase() === estForm.name.toLowerCase() && (!editingEst || es.id !== editingEst.id));
    if (duplicateName) {
      alert('Erro: Já existe um estabelecimento com este nome.');
      return;
    }

    const estId = editingEst ? editingEst.id : 'e_' + Date.now();
    const nowStr = new Date().toISOString();

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
        },
        updatedAt: nowStr
      } : es);
      db.setEstablishments(updated);

      const hasManager = allUsers.some(u => u.establishmentId === editingEst.id);
      if (hasManager) {
        const updatedUsers = allUsers.map(u => u.establishmentId === editingEst.id ? {
          ...u,
          name: 'Gerente ' + estForm.name,
          email: estForm.email,
          passwordHash: estForm.password || u.passwordHash,
          phone: estForm.phone,
          updatedAt: nowStr
        } : u);
        db.setUsers(updatedUsers);
      }
    } else {
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

      const newEstUser: User = {
        id: 'u_' + Date.now(),
        name: 'Gerente ' + estForm.name,
        cpf: db.generateUniqueDummyCpf(),
        phone: estForm.phone,
        email: estForm.email || `${estForm.name.toLowerCase().replace(/\s+/g, '')}@delivery.com`,
        role: 'establishment',
        active: true,
        passwordHash: estForm.password || 'bella123',
        establishmentId: estId,
        updatedAt: nowStr
      };
      db.setUsers([...allUsers, newEstUser]);
    }

    setShowEstModal(false);
    setEditingEst(null);
    loadData();
  };

  const handleDeleteEst = async (id: string) => {
    if (confirm('Deseja realmente excluir este estabelecimento definitivamente?')) {
      await db.deleteEstablishment(id);
      loadData();
    }
  };

  const toggleEstStatus = (id: string) => {
    const allEst = db.getEstablishments();
    const updated = allEst.map(es => es.id === id ? { ...es, active: !es.active, updatedAt: new Date().toISOString() } : es);
    db.setEstablishments(updated);
    loadData();
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    
    const conflict = schedules.find(s => s.riderId === scheduleForm.riderId && s.date === scheduleForm.date && s.shift === scheduleForm.shift);
    if (conflict) {
      const rider = users.find(r => r.id === scheduleForm.riderId);
      const est = establishments.find(es => es.id === conflict.establishmentId);
      alert(`Erro: O motoboy ${rider?.name} já possui uma escala ativa no estabelecimento ${est?.name} neste mesmo dia e turno! Não é possível duplicar a escala.`);
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.setSchedules([...schedules, newSchedule]);

    const est = establishments.find(es => es.id === scheduleForm.establishmentId);
    const allNotif = db.getNotifications();
    db.setNotifications([...allNotif, {
      id: 'n_' + Date.now(),
      riderId: scheduleForm.riderId,
      title: '📍 Novo Encaminhamento de Rota',
      message: `Você foi designado para o estabelecimento ${est?.name} no dia ${new Date(scheduleForm.date + 'T00:00:00').toLocaleDateString('pt-BR')} no turno da ${getShiftLabel(scheduleForm.shift)}.`,
      date: new Date().toISOString(),
      read: false
    }]);

    setShowScheduleModal(false);
    setScheduleConflictWarning('');
    loadData();
  };

  const handleCancelSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;

    if (confirm('Tem certeza que deseja cancelar esta escala?')) {
      await db.deleteSchedule(id);
      const est = establishments.find(es => es.id === schedule.establishmentId);
      const allNotif = db.getNotifications();
      db.setNotifications([...allNotif, {
        id: 'n_' + Date.now(),
        riderId: schedule.riderId,
        title: 'Escala Cancelada',
        message: `Sua escala no estabelecimento ${est?.name} para o dia ${new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')} foi cancelada.`,
        date: new Date().toISOString(),
        read: false
      }]);
      loadData();
    }
  };

  const buildWeeklyPreview = (form: typeof weeklyForm) => {
    if (!form.weekStart || !form.riderId || !form.establishmentId) return;
    const monday = new Date(form.weekStart + 'T00:00:00');
    const allSchedules = db.getSchedules();
    const preview = DAY_KEYS.map((key, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const conflict = !!allSchedules.find(s => s.riderId === form.riderId && s.date === dateStr && s.shift === form.shift);
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

    const validDays = weeklyPreview.filter(day => day.enabled && !day.conflict);
    if (validDays.length === 0) {
      alert('Erro: Todos os dias selecionados possuem conflitos de escala para este motoboy. Nenhuma escala foi criada.');
      return;
    }

    validDays.forEach((day) => {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      newNotifs.push({
        id: 'n_' + Date.now() + '_' + day.date,
        riderId: weeklyForm.riderId,
        title: '📍 Novo Encaminhamento de Rota',
        message: `Você foi designado para o estabelecimento ${est?.name} no dia ${new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')} no turno da ${getShiftLabel(weeklyForm.shift)}.`,
        date: new Date().toISOString(),
        read: false
      });
    });

    db.setSchedules([...allSchedules, ...newSchedules]);
    db.setNotifications([...allNotif, ...newNotifs]);

    setShowWeeklyModal(false);
    setWeeklyStep('form');
    loadData();
    alert(`${newSchedules.length} escala(s) criada(s) com sucesso! Dias com conflito foram ignorados.`);
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    const activeSchedule = schedules.find(s => s.riderId === deliveryForm.riderId && s.establishmentId === deliveryForm.establishmentId && s.date === deliveryForm.date);
    const nowStr = new Date().toISOString();

    if (editingDelivery) {
      const updated = deliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        riderId: deliveryForm.riderId,
        establishmentId: deliveryForm.establishmentId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: val,
        scheduleId: activeSchedule?.id || d.scheduleId,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        updatedAt: nowStr
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
        notes: deliveryForm.notes.trim() || undefined,
        updatedAt: nowStr,
        paid: false
      };
      db.setDeliveries([...deliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    loadData();
  };

  const handleCancelDelivery = (id: string) => {
    if (confirm('Deseja realmente cancelar esta corrida?')) {
      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleApproveDelivery = (id: string) => {
    const updated = deliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: new Date().toISOString() } : d);
    db.setDeliveries(updated);
    loadData();
  };

  const handleRejectDelivery = (id: string) => {
    const reason = prompt('Digite o motivo da rejeição:');
    if (reason !== null) {
      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'rejected' as const, notes: reason, updatedAt: new Date().toISOString() } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleToggleRequestStatus = (id: string) => {
    const updated = partnerRequests.map(r => r.id === id ? { ...r, status: r.status === 'pending' ? 'contacted' as const : 'pending' as const } : r);
    db.setPartnerRequests(updated);
    loadData();
  };

  const handleDeleteRequest = async (id: string) => {
    if (id.startsWith('req_virtual_')) {
      const estId = id.replace('req_virtual_', '');
      if (confirm('Deseja realmente excluir este estabelecimento pendente definitivamente?')) {
        await db.deleteEstablishment(estId);
        loadData();
      }
    } else {
      if (confirm('Deseja realmente excluir esta solicitação?')) {
        await db.deletePartnerRequest(id);
        loadData();
      }
    }
  };

  const handleContactRequest = (request: PartnerRequest) => {
    const cleanPhone = request.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(`Olá ${request.ownerName}! Recebemos sua solicitação de parceria para o estabelecimento ${request.establishmentName} no MotoHub.`);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleApproveRequest = (req: PartnerRequest) => {
    const allEsts = db.getEstablishments();
    const est = allEsts.find(e => e.name.toLowerCase().trim() === req.establishmentName.toLowerCase().trim());
    if (est) {
      const updatedEsts = allEsts.map(e => e.id === est.id ? { ...e, active: true, updatedAt: new Date().toISOString() } : e);
      db.setEstablishments(updatedEsts);
      const updatedUsers = db.getUsers().map(u => u.establishmentId === est.id ? { ...u, active: true, updatedAt: new Date().toISOString() } : u);
      db.setUsers(updatedUsers);
      
      if (!req.id.startsWith('req_virtual_')) {
        const updatedRequests = partnerRequests.map(r => r.id === req.id ? { ...r, status: 'contacted' as const } : r);
        db.setPartnerRequests(updatedRequests);
      }
      
      loadData();
      alert('Solicitação aprovada com sucesso!');
    } else {
      alert('Erro: Estabelecimento correspondente não encontrado.');
    }
  };

  const handleSettleRiderDeliveries = (riderId: string) => {
    if (confirm('Deseja realmente dar baixa e marcar todas as corridas ativas deste motoboy como pagas?')) {
      const updated = deliveries.map(d => d.riderId === riderId && d.status === 'active' ? { ...d, paid: true, updatedAt: new Date().toISOString() } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleSettleEstDeliveries = (estId: string) => {
    if (confirm('Deseja realmente dar baixa e marcar todas as corridas ativas deste estabelecimento como pagas?')) {
      const updated = deliveries.map(d => d.establishmentId === estId && d.status === 'active' ? { ...d, paid: true, updatedAt: new Date().toISOString() } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleSaveNotes = (deliveryId: string, updatedNotes: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === deliveryId ? {
      ...d,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    } : d);
    db.setDeliveries(updated);
    loadData();
  };

  const handleSaveScheduleChat = (scheduleId: string, updatedChat: string) => {
    const allSchedules = db.getSchedules();
    const updated = allSchedules.map(s => s.id === scheduleId ? {
      ...s,
      chat: updatedChat,
      updatedAt: new Date().toISOString()
    } : s);
    db.setSchedules(updated);
    loadData();
  };

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
      const summary: any = {};
      riders.forEach(r => { summary[r.id] = { name: r.name, total: 0, count: 0 }; });
      deliveries.filter(d => d.status === 'active').forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end && summary[d.riderId]) {
          summary[d.riderId].total += d.value;
          summary[d.riderId].count += 1;
        }
      });
      return Object.values(summary);
    } else if (reportType === 'deliveries') {
      const summary: any = {};
      riders.forEach(r => { summary[r.id] = { name: r.name, count: 0, cancelled: 0 }; });
      deliveries.forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end && summary[d.riderId]) {
          if (d.status === 'active') summary[d.riderId].count += 1;
          else summary[d.riderId].cancelled += 1;
        }
      });
      return Object.values(summary);
    } else {
      const summary: any = {};
      establishments.forEach(e => { summary[e.id] = { name: e.name, count: 0 }; });
      schedules.forEach(s => {
        const sDate = new Date(s.date + 'T00:00:00');
        if (sDate >= start && sDate <= end && summary[s.establishmentId]) {
          summary[s.establishmentId].count += 1;
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
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.total.toFixed(2)},${row.count}\n`; });
    } else if (reportType === 'deliveries') {
      csvContent += "Motoboy,Corridas Ativas,Corridas Canceladas\n";
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.count},${row.cancelled}\n`; });
    } else {
      csvContent += "Estabelecimento,Total de Escalas\n";
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.count}\n`; });
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
  const pendingRidersCount = users.filter(u => u.role === 'rider' && !u.active).length;
  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');
  const processedDeliveries = deliveries.filter(d => d.status !== 'pending');

  const todayStr = db.getLocalDateString();
  const activeDeliveriesToday = deliveries.filter(d => d.date === todayStr && d.status === 'active');
  const totalRevenueToday = activeDeliveriesToday.reduce((sum, d) => sum + d.value, 0);
  const activeRidersCount = users.filter(u => u.role === 'rider' && u.active).length;
  const activeEstsCount = establishments.filter(e => e.active).length;

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = schedules.find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <ChatToastBanner toast={activeToast} onClose={() => setActiveToast(null)} />

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
      </header>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Sidebar Navigation */}
        <div className="hidden lg:block lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Visão Geral</span>
          </button>
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
            onClick={() => setActiveTab('finance')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="h-5 w-5" />
            <span>Fechamento</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
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
          {/* VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Faturamento Hoje</p>
                    <p className="text-2xl font-bold text-slate-800">R$ {totalRevenueToday.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Bike className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Corridas Hoje</p>
                    <p className="text-2xl font-bold text-slate-800">{activeDeliveriesToday.length}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Motoboys Ativos</p>
                    <p className="text-2xl font-bold text-slate-800">{activeRidersCount}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Parceiros Ativos</p>
                    <p className="text-2xl font-bold text-slate-800">{activeEstsCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CORRIDAS */}
          {activeTab === 'deliveries' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Registro de Corridas</h2>
                <button
                  onClick={() => {
                    setEditingDelivery(null);
                    setDeliveryForm({ riderId: '', establishmentId: '', date: db.getLocalDateString(), time: new Date().toTimeString().slice(0,5), value: '', orderNumber: '', notes: '' });
                    setShowDeliveryModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Lançar Corrida</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {deliveries.map(del => {
                  const rider = users.find(r => r.id === del.riderId);
                  const est = establishments.find(e => e.id === del.establishmentId);

                  return (
                    <div key={del.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                          <span className="text-xs text-slate-400">• {est?.name}</span>
                          {del.orderNumber && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">
                              #{del.orderNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setNotesDeliveryId(del.id)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>Chat/Obs</span>
                        </button>

                        <span className="font-bold text-emerald-600 text-sm">
                          R$ {del.value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
            date: db.getLocalDateString(),
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

      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="admin"
        userName={adminUser?.name || 'Admin'}
        onSaveNotes={handleSaveNotes}
      />

      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="admin"
        userName={adminUser?.name || 'Admin'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}