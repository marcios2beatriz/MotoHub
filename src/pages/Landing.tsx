"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, PartnerRequest } from '../utils/db';
import { 
  Bike, 
  Shield, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  LogIn, 
  UserPlus, 
  X, 
  Store, 
  MapPin,
  MessageSquare,
  Building2,
  UserCheck
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEstModal, setShowEstModal] = useState(false);
  
  // Form de Motoboy
  const [form, setForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    password: ''
  });

  // Form de Estabelecimento
  const [estForm, setEstForm] = useState({
    establishmentName: '',
    ownerName: '',
    phone: '',
    address: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const allUsers = db.getUsers();

    const duplicateCpf = allUsers.find(u => u.cpf === form.cpf);
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === form.email.toLowerCase());

    if (duplicateCpf) {
      setError('Erro: CPF já cadastrado no sistema.');
      return;
    }
    if (duplicateEmail) {
      setError('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    const newRider: User = {
      id: 'u_' + Date.now(),
      name: form.name,
      cpf: form.cpf,
      phone: form.phone,
      email: form.email,
      role: 'rider',
      active: false, // Changed to false - pending approval
      passwordHash: form.password
    };

    db.setUsers([...allUsers, newRider]);
    setSuccess(true);
    setForm({ name: '', cpf: '', phone: '', email: '', password: '' });
    
    setTimeout(() => {
      setShowRegisterModal(false);
      setSuccess(false);
      // Do not redirect to login - user must wait for approval
    }, 2000);
  };

  const handleEstRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const newRequest: PartnerRequest = {
      id: 'req_' + Date.now(),
      establishmentName: estForm.establishmentName,
      ownerName: estForm.ownerName,
      phone: estForm.phone,
      address: estForm.address,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const allRequests = db.getPartnerRequests();
    db.setPartnerRequests([...allRequests, newRequest]);

    setSuccess(true);
    setEstForm({ establishmentName: '', ownerName: '', phone: '', address: '' });

    setTimeout(() => {
      setShowEstModal(false);
      setSuccess(false);
    }, 2500);
  };

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent("Olá! Gostaria de fechar parceria com o MotoHub para o meu estabelecimento.");
    window.open(`https://wa.me/5583988623431?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header / Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Bike className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">MotoHub</span>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center space-x-1.5 text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </button>
            <button 
              onClick={() => setShowEstModal(true)}
              className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-emerald-200"
            >
              <Building2 className="h-4 w-4" />
              <span>Seja Parceiro</span>
            </button>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Quero ser Entregador</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-indigo-50/50 to-white py-16 sm:py-24 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              🚀 Gestão Inteligente de Delivery
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-none">
              Conectando <span className="text-indigo-600">Entregadores</span> e <span className="text-indigo-600">Estabelecimentos</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0">
              O MotoHub é a plataforma definitiva para gerenciar escalas de motoqueiros, acompanhar faturamentos em tempo real e otimizar as entregas do seu negócio.
            </p>
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-2">
              <button 
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
              >
                <span>Cadastrar como Entregador</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setShowEstModal(true)}
                className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
              >
                <Building2 className="h-5 w-5" />
                <span>Cadastrar Estabelecimento</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20"></div>
              <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-900">Como funciona o MotoHub?</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 mt-0.5">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Parcerias Sólidas</h4>
                      <p className="text-xs text-slate-500">Estabelecimentos cadastram suas demandas e turnos de entrega.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mt-0.5">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Escalas Inteligentes</h4>
                      <p className="text-xs text-slate-500">Entregadores são escalados de forma justa e organizada por turnos.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-0.5">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Ganhos Transparentes</h4>
                      <p className="text-xs text-slate-500">Acompanhamento de faturamento diário, semanal e mensal em tempo real.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Tudo o que você precisa em um só lugar</h2>
            <p className="text-lg text-slate-500">Desenvolvido para facilitar a rotina de administradores e motoboys parceiros.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-4">
              <div className="bg-indigo-600 text-white p-3 rounded-xl w-fit">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Segurança e Controle</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Controle de acesso rígido por perfil. Bloqueio automático de contas após tentativas malsucedidas e expiração de sessão por inatividade.
              </p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-4">
              <div className="bg-indigo-600 text-white p-3 rounded-xl w-fit">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Navegação Integrada</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                O entregador visualiza o endereço completo do estabelecimento escalado e pode abrir a rota diretamente no GPS padrão do celular com um clique.
              </p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-4">
              <div className="bg-indigo-600 text-white p-3 rounded-xl w-fit">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Notificações Instantâneas</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Avisos em tempo real no aplicativo sempre que uma escala for criada, alterada ou cancelada pelo administrador.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="bg-emerald-600 text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Quer fechar negócio agora mesmo?</h2>
          <p className="text-emerald-100 max-w-xl mx-auto text-sm sm:text-base">
            Fale diretamente com o nosso administrador no WhatsApp para tirar dúvidas, fechar parcerias e começar a usar o MotoHub hoje mesmo!
          </p>
          <button
            onClick={handleWhatsAppContact}
            className="inline-flex items-center space-x-2 bg-white text-emerald-700 hover:bg-emerald-50 px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
          >
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            <span>Falar com Administrador no WhatsApp</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">MotoHub Delivery</span>
          </div>
          
          {/* Informações do Desenvolvedor */}
          <div className="text-center md:text-right space-y-1">
            <p className="text-xs text-slate-300 font-medium">
              Desenvolvido por <span className="text-indigo-400 font-semibold">Juveniciu's Tech Soluções Automatizada</span>
            </p>
          </div>

          <p className="text-xs">
            &copy; {new Date().getFullYear()} MotoHub Delivery. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      <button
        onClick={handleWhatsAppContact}
        className="fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 z-50 flex items-center justify-center"
        title="Fale Conosco no WhatsApp"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* MODAL DE CADASTRO DE MOTOBOY */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                Cadastrar Novo Motoboy
              </h3>
              <button 
                onClick={() => {
                  setShowRegisterModal(false);
                  setError('');
                  setSuccess(false);
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-700 font-medium">
                Cadastro realizado com sucesso! Seu cadastro está pendente de aprovação do administrador. Você será notificado quando for aprovado.
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CPF</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefone</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha Inicial</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false);
                    setError('');
                    setSuccess(false);
                  }}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE ESTABELECIMENTO */}
      {showEstModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Seja um Estabelecimento Parceiro
              </h3>
              <button 
                onClick={() => {
                  setShowEstModal(false);
                  setError('');
                  setSuccess(false);
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-3">
                <UserCheck className="h-12 w-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-800">Solicitação Enviada!</h4>
                <p className="text-xs text-emerald-700">
                  Seus dados foram enviados com sucesso para o nosso painel administrativo. Entraremos em contato em breve!
                </p>
              </div>
            ) : (
              <form onSubmit={handleEstRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Estabelecimento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pizzaria Bella Italia"
                    value={estForm.establishmentName}
                    onChange={(e) => setEstForm({ ...estForm, establishmentName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Proprietário</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João Silva"
                    value={estForm.ownerName}
                    onChange={(e) => setEstForm({ ...estForm, ownerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefone para Contato</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: (83) 99999-9999"
                    value={estForm.phone}
                    onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Endereço do Estabelecimento</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Rua, número, bairro, cidade..."
                    value={estForm.address}
                    onChange={(e) => setEstForm({ ...estForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowEstModal(false)}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  >
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}