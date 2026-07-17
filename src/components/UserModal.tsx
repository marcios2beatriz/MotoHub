"use client";

import React, { useState } from 'react';
import { X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  userForm: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    role: 'admin' | 'rider' | 'establishment';
    password: string;
    establishmentId?: string;
  };
  setUserForm: React.Dispatch<React.SetStateAction<{
    name: string;
    cpf: string;
    phone: string;
    email: string;
    role: 'admin' | 'rider' | 'establishment';
    password: string;
    establishmentId?: string;
  }>>;
  establishments: Establishment[];
  onSave: (e: React.FormEvent) => void;
}

export default function UserModal({
  isOpen,
  onClose,
  editingUser,
  userForm,
  setUserForm,
  establishments,
  onSave
}: UserModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setUserForm(prev => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
              <input
                type="text"
                required
                placeholder="000.000.000-00"
                value={userForm.cpf}
                onChange={(e) => setUserForm({ ...userForm, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
              <input
                type="text"
                required
                placeholder="(83) 99999-9999"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Perfil / Função</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="rider">Motoboy (Entregador)</option>
              <option value="establishment">Gerente de Estabelecimento</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {userForm.role === 'establishment' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vincular ao Estabelecimento</label>
              <select
                required
                value={userForm.establishmentId || ''}
                onChange={(e) => setUserForm({ ...userForm, establishmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione um Estabelecimento</option>
                {establishments.map(est => (
                  <option key={est.id} value={est.id}>{est.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha de Acesso'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full pl-3 pr-20 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder={editingUser ? '••••••••' : 'Digite ou gere uma senha'}
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-indigo-600 hover:text-indigo-800 p-1 flex items-center gap-0.5 text-xs font-bold"
                  title="Gerar Senha"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Gerar</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
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
  );
}