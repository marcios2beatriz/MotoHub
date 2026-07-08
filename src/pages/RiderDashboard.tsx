"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Schedule, Delivery, Notification } from '../utils/db';
import { 
  DollarSign, 
  Calendar, 
  Navigation, 
  Bell, 
  LogOut, 
  TrendingUp, 
  CheckCircle, 
  MapPin, 
  Clock,
  AlertCircle
} from 'lucide-react';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(db.getCurrentUser());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'notifications'>('dashboard');

  useEffect(() => {
    if (!user || user.role !== 'rider') {
      navigate('/login');
      return;
    }

    // Carregar dados
    const allSchedules = db.getSchedules().filter(s => s.riderId === user.id);
    const allDeliveries = db.getDeliveries().filter(d => d.riderId === user.id && d.status === 'active');
    const allNotifications = db.getNotifications().filter(n => n.riderId === user.id);

    setSchedules(allSchedules);
    setDeliveries(allDeliveries);
    setNotifications(allNotifications);
  }, [user, navigate]);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  // Cálculos de faturamento
  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const getStartOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
    const start = new Date(today.setDate(diff));
    start.setHours(0,0,0,0);
    return start;
  };

  const getStartOfMonth = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  };

  const todayStr = getTodayDateString();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  const todayDeliveries = deliveries.filter(d => d.date === todayStr);
  const todayEarnings = todayDeliveries.reduce((sum, d) => sum + d.value, 0);

  const weekEarnings = deliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return dDate >= startOfWeek;
  }).reduce((sum, d) => sum + d.value, 0);

  const monthEarnings = deliveries.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return dDate >= startOfMonth;
  }).reduce((sum, d) => sum + d.value, 0);

  // Escalas dos próximos 30 dias
  const getFutureSchedules = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 30);

    return schedules.filter(s => {
      const sDate = new Date(s.date + 'T00:00:00');
      return sDate >= today && sDate <= limitDate;
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  const futureSchedules = getFutureSchedules();

  const handleOpenGPS = (address: any) => {
    const query = encodeURIComponent(`${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    const allNotif = db.getNotifications();
    const updatedAll = allNotif.map(n => n.id === id ? { ...n, read: true } : n);
    db.setNotifications(updatedAll);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getShiftLabel = (shift: string) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'night': return 'Noite';
      default: return shift;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-200">Olá, bem-vindo!</p>
            <h1 className="text-lg font-bold truncate max-w-[200px] sm:max-w-none">{user?.name}</h1>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-indigo-700 rounded-full transition-colors flex items-center space-x-1 text-sm"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Tabs */}
        <div className="flex bg-white rounded-lg p-1 shadow-sm mb-6 border border-slate-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Ganhos</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Minhas Escalas</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition-colors relative ${
              activeTab === 'notifications' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Avisos</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Cards de Faturamento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {todayEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Esta Semana</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {weekEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Este Mês</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {monthEarnings.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Corridas do Dia */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <span>Corridas de Hoje</span>
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  {todayDeliveries.length} {todayDeliveries.length === 1 ? 'corrida' : 'corridas'}
                </span>
              </div>

              {todayDeliveries.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nenhuma corrida registrada hoje.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayDeliveries.map((delivery) => {
                    const est = db.getEstablishments().find(e => e.id === delivery.establishmentId);
                    return (
                      <div key={delivery.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-700">{est?.name || 'Estabelecimento'}</p>
                          <p className="text-xs text-slate-400 flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{delivery.time}</span>
                          </p>
                        </div>
                        <span className="font-bold text-emerald-600">R$ {delivery.value.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Schedules */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Escalas dos Próximos 30 Dias</h3>
            
            {futureSchedules.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium">Nenhuma escala futura cadastrada.</p>
                <p className="text-sm text-slate-400 mt-1">Fale com o administrador para organizar suas escalas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {futureSchedules.map((schedule) => {
                  const est = db.getEstablishments().find(e => e.id === schedule.establishmentId);
                  const isToday = schedule.date === todayStr;

                  return (
                    <div 
                      key={schedule.id} 
                      className={`bg-white p-5 rounded-xl shadow-sm border transition-all ${
                        isToday ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {isToday && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
                              Hoje
                            </span>
                          )}
                          <h4 className="text-lg font-bold text-slate-800">{est?.name || 'Estabelecimento'}</h4>
                          <p className="text-sm text-slate-500 flex items-center space-x-1 mt-1">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span>{new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span className="mx-1.5">•</span>
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-indigo-600">{getShiftLabel(schedule.shift)}</span>
                          </p>
                        </div>
                      </div>

                      {est && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start space-x-2">
                            <MapPin className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-600">
                              <p className="font-medium">{est.address.street}, {est.address.number}</p>
                              <p>{est.address.neighborhood} - {est.address.city}/{est.address.state}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenGPS(est.address)}
                            className="flex items-center justify-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 px-3 rounded-md transition-colors"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Abrir no GPS</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Histórico de Avisos</h3>

            {notifications.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-400">
                <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p>Nenhum aviso recebido.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      notif.read 
                        ? 'bg-white border-slate-200 opacity-75' 
                        : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full mt-0.5 ${notif.read ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>
                          <Bell className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">
                            {new Date(notif.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      {!notif.read && (
                        <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}