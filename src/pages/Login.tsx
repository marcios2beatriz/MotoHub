"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../utils/db';
import { Lock, Mail, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [blockedTimeLeft, setBlockedTimeLeft] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se a conta está bloqueada temporariamente
    const checkBlock = () => {
      const attempts = db.getLoginAttempts();
      if (attempts.blockedUntil && attempts.blockedUntil > Date.now()) {
        const timeLeft = Math.ceil((attempts.blockedUntil - Date.now()) / 1000);
        setBlockedTimeLeft(timeLeft);
      } else if (attempts.blockedUntil && attempts.blockedUntil <= Date.now()) {
        db.setLoginAttempts({ count: 0, blockedUntil: null });
        setBlockedTimeLeft(null);
      }
    };

    checkBlock();
    const interval = setInterval(checkBlock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const attempts = db.getLoginAttempts();
    if (attempts.blockedUntil && attempts.blockedUntil > Date.now()) {
      setError('Sua conta está temporariamente bloqueada devido a múltiplas tentativas malsucedidas.');
      return;
    }

    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);

    if (user) {
      if (!user.active) {
        setError('Esta conta foi desativada pelo administrador.');
        return;
      }

      // Resetar tentativas de login
      db.setLoginAttempts({ count: 0, blockedUntil: null });
      db.setCurrentUser(user);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/rider');
      }
    } else {
      const newCount = attempts.count + 1;
      if (newCount >= 5) {
        const blockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutos
        db.setLoginAttempts({ count: newCount, blockedUntil });
        setError('Conta bloqueada por 15 minutos após 5 tentativas incorretas.');
      } else {
        db.setLoginAttempts({ count: newCount, blockedUntil: null });
        setError(`E-mail ou senha incorretos. Tentativa ${newCount} de 5.`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="MotoHub Delivery Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">MotoHub Delivery</h2>
          <p className="mt-2 text-sm text-slate-600">Faça login para acessar sua conta</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {blockedTimeLeft !== null && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded flex items-start space-x-2">
            <Lock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-700">
              Acesso bloqueado. Tente novamente em {Math.floor(blockedTimeLeft / 60)}m {blockedTimeLeft % 60}s.
            </span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  disabled={blockedTimeLeft !== null}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="exemplo@delivery.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Senha</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  disabled={blockedTimeLeft !== null}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={blockedTimeLeft !== null}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Entrar no Sistema
            </button>
          </div>
        </form>

        <div className="mt-4 text-center text-xs text-slate-400">
          <p>Acesso de teste:</p>
          <p>Admin: admin@delivery.com / admin123</p>
          <p>Motoboy: carlos@delivery.com / moto123</p>
        </div>
      </div>
    </div>
  );
}