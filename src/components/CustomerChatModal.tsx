"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { Delivery } from '../utils/db';

interface CustomerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  onSendMessage: (text: string) => void;
  viewerRole?: 'customer' | 'rider';
}

export default function CustomerChatModal({
  isOpen,
  onClose,
  delivery,
  onSendMessage,
  viewerRole = 'customer'
}: CustomerChatModalProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, delivery?.customerChat]);

  if (!isOpen || !delivery) return null;

  // Calcula se o chat já expirou (2 horas desde o lançamento da corrida)
  const deliveryDateTime = new Date(`${delivery.date}T${delivery.time}:00`);
  const timeDifferenceMs = Date.now() - deliveryDateTime.getTime();
  const twoHoursInMs = 120 * 60 * 1000; // 2h
  const isExpired = timeDifferenceMs > twoHoursInMs;

  const isRejected = delivery.status === 'rejected';
  const isCancelled = delivery.status === 'cancelled';
  const isDisabled = isExpired || isRejected || isCancelled;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) {
      alert('Este chat está bloqueado e não aceita mais novas mensagens.');
      return;
    }
    if (!newMessage.trim()) return;

    onSendMessage(newMessage.trim());
    setNewMessage('');
  };

  const messages = delivery.customerChat ? delivery.customerChat.split('\n') : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl flex flex-col h-[80vh] sm:h-[600px]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {viewerRole === 'rider' ? 'Chat com o Cliente' : 'Chat com o Entregador'}
              </h3>
              <p className="text-[10px] text-slate-500">Pedido #{delivery.orderNumber || delivery.id.slice(-4)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerta de Expiração ou Rejeição */}
        {isExpired && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-800 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Chat Expirado</p>
              <p className="mt-0.5">Este chat foi encerrado por limite de tempo (limite de 2 horas).</p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-800 text-xs">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Corrida Rejeitada</p>
              <p className="mt-0.5">Esta corrida foi rejeitada. O chat está bloqueado para novas mensagens.</p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-start gap-2 text-slate-800 text-xs">
            <AlertCircle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Corrida Cancelada</p>
              <p className="mt-0.5">Esta corrida foi cancelada. O chat está bloqueado para novas mensagens.</p>
            </div>
          </div>
        )}

        {/* Histórico de Mensagens */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Envie uma mensagem para combinar a entrega!
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isSystem = !msg.startsWith('[');
              if (isSystem) {
                return (
                  <div key={idx} className="bg-slate-200 text-slate-700 text-[10px] px-2.5 py-1 rounded-md italic text-center">
                    {msg}
                  </div>
                );
              }

              const isMe = viewerRole === 'rider' ? msg.includes('- Motoboy') : msg.includes('- Cliente');
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
            disabled={isDisabled}
            placeholder={
              isExpired ? "Chat encerrado" :
              isRejected ? "Chat bloqueado por rejeição" :
              isCancelled ? "Chat bloqueado por cancelamento" :
              "Digite sua mensagem..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg transition-colors flex items-center justify-center disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}