"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { Delivery } from '../utils/db';

interface DeliveryNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  userRole: 'admin' | 'rider' | 'establishment';
  userName: string;
  onSaveNotes: (deliveryId: string, updatedNotes: string) => void;
}

export default function DeliveryNotesModal({
  isOpen,
  onClose,
  delivery,
  userRole,
  userName,
  onSaveNotes
}: DeliveryNotesModalProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (isOpen && !delivery?.status?.includes('rejected')) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, delivery?.notes, delivery?.status]);

  if (!isOpen || !delivery) return null;

  // Calcula se o chat já expirou (10 horas desde o lançamento da corrida)
  const deliveryDateTime = new Date(`${delivery.date}T${delivery.time}:00`);
  const timeDifferenceMs = Date.now() - deliveryDateTime.getTime();
  const tenHoursInMs = 10 * 60 * 60 * 1000;
  const isExpired = timeDifferenceMs > tenHoursInMs;
  const isRejected = delivery.status === 'rejected';
  const isBlocked = isExpired || isRejected;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      alert(isRejected ? 'Esta corrida foi rejeitada. O chat está desativado.' : 'Este chat já expirou e não aceita mais novas mensagens.');
      return;
    }
    if (!newMessage.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const senderLabel = userRole === 'establishment' ? 'Estabelecimento' : userRole === 'rider' ? 'Motoboy' : 'Admin';
    const formattedMessage = `[${dateStr} ${timeStr} - ${senderLabel} (${userName})]: ${newMessage.trim()}`;
    
    const updatedNotes = delivery.notes 
      ? `${delivery.notes}\n${formattedMessage}`
      : formattedMessage;

    onSaveNotes(delivery.id, updatedNotes);
    setNewMessage('');
  };

  const messages = delivery.notes ? delivery.notes.split('\n') : [];

  // Extrai a justificativa de rejeição de forma amigável (somente o motivo)
  const getRejectionJustification = () => {
    if (!delivery.notes) return 'Não especificado';
    if (delivery.notes.includes('Rejeitado:')) {
      const parts = delivery.notes.split('Rejeitado:');
      return parts[parts.length - 1].trim() || 'Não especificado';
    }
    if (delivery.notes.includes('Motivo da rejeição:')) {
      const parts = delivery.notes.split('Motivo da rejeição:');
      return parts[parts.length - 1].trim() || 'Não especificado';
    }
    return delivery.notes;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Observações / Chat</h3>
              <p className="text-xs text-slate-500">Pedido #{delivery.orderNumber || delivery.id.slice(-4)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isRejected ? (
          /* Se rejeitado, exibe APENAS a justificativa de rejeição de forma limpa e direta */
          <div className="flex-1 flex flex-col justify-center items-center py-8 px-4 text-center space-y-4">
            <div className="p-4 bg-red-50 rounded-full text-red-600">
              <AlertCircle className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-red-800">Corrida Rejeitada</h4>
              <p className="text-sm text-slate-600 font-medium bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-xs mx-auto shadow-sm">
                "{getRejectionJustification()}"
              </p>
            </div>
            <p className="text-xs text-slate-400">
              O chat e o histórico de observações foram desativados para esta corrida.
            </p>
          </div>
        ) : (
          /* Caso contrário, exibe o histórico completo do chat e campo de envio */
          <>
            {isExpired && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-800 text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Chat Expirado</p>
                  <p className="mt-0.5">Já se passaram mais de 10 horas desde o lançamento desta corrida. Não é mais possível enviar novas mensagens.</p>
                </div>
              </div>
            )}

            {/* Histórico de Mensagens */}
            <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg min-h-[200px] max-h-[400px]">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma observação registrada.
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isSystem = !msg.startsWith('[');
                  if (isSystem) {
                    return (
                      <div key={idx} className="bg-slate-200 text-slate-700 text-[11px] px-2.5 py-1 rounded-md italic text-center">
                        {msg}
                      </div>
                    );
                  }

                  const isMe = msg.includes(`- ${userRole === 'establishment' ? 'Estabelecimento' : userRole === 'rider' ? 'Motoboy' : 'Admin'}`);
                  const senderInfo = msg.substring(msg.indexOf('- ') + 2, msg.indexOf(']:'));

                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="text-[9px] text-slate-500 mb-0.5 font-semibold px-1">
                          {senderInfo}
                        </span>
                      )}
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm ${
                        isMe ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'
                      }`}>
                        <p className="leading-relaxed">{msg.substring(msg.indexOf(']: ') + 3)}</p>
                      </div>
                      <span className="text-[8px] text-slate-400 mt-0.5 px-1">
                        {msg.substring(1, msg.indexOf(']'))}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Envio */}
            <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                disabled={isBlocked}
                placeholder={isExpired ? "Chat bloqueado por expiração" : "Digite uma observação ou aviso..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isBlocked}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}