"use client";

import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import RiderDashboard from './pages/RiderDashboard';
import EstablishmentDashboard from './pages/EstablishmentDashboard';
import { db } from './utils/db';

// Componente para gerenciar a inatividade do usuário (30 minutos)
function InactivityHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Puxar dados do Supabase na inicialização
    db.pullFromSupabase();

    const checkInactivity = () => {
      const currentUser = db.getCurrentUser();
      if (currentUser) {
        const lastActivity = localStorage.getItem('dm_last_activity');
        if (lastActivity) {
          const diff = Date.now() - parseInt(lastActivity);
          const thirtyMinutes = 30 * 60 * 1000;
          if (diff > thirtyMinutes) {
            db.setCurrentUser(null);
            alert('Sua sessão expirou por inatividade.');
            navigate('/login');
          }
        }
      }
    };

    const updateActivity = () => {
      const currentUser = db.getCurrentUser();
      if (currentUser) {
        localStorage.setItem('dm_last_activity', Date.now().toString());
      }
    };

    // Verificar a cada 10 segundos
    const interval = setInterval(checkInactivity, 10000);

    // Escutar eventos de interação do usuário
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [navigate]);

  return <>{children}</>;
}

// Rota Protegida para Administrador
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    alert('Acesso negado. Esta área é restrita para administradores.');
    return <Navigate to={user.role === 'establishment' ? '/establishment' : '/rider'} replace />;
  }
  return <>{children}</>;
}

// Rota Protegida para Motoboy
function RiderRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'rider') {
    alert('Acesso negado. Esta área é restrita para motoboys.');
    return <Navigate to={user.role === 'establishment' ? '/establishment' : '/admin'} replace />;
  }
  return <>{children}</>;
}

// Rota Protegida para Estabelecimento
function EstablishmentRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'establishment') {
    alert('Acesso negado. Esta área é restrita para estabelecimentos.');
    return <Navigate to={user.role === 'rider' ? '/rider' : '/admin'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <InactivityHandler>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          
          <Route 
            path="/rider" 
            element={
              <RiderRoute>
                <RiderDashboard />
              </RiderRoute>
            } 
          />

          <Route 
            path="/establishment" 
            element={
              <EstablishmentRoute>
                <EstablishmentDashboard />
              </EstablishmentRoute>
            } 
          />

          {/* Redirecionamento padrão */}
          <Route 
            path="*" 
            element={
              <Navigate 
                to={
                  db.getCurrentUser()?.role === 'admin' 
                    ? '/admin' 
                    : db.getCurrentUser()?.role === 'establishment'
                      ? '/establishment'
                      : '/rider'
                } 
                replace 
              />
            } 
          />
        </Routes>
      </InactivityHandler>
    </Router>
  );
}