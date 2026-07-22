"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { Schedule } from '../utils/db';

interface ScheduleChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  userRole: 'admin' | 'rider' | 'establishment';
  userName: string;
  onSaveChat: (scheduleId: string, updatedChat: string) => void;
}

export default function ScheduleChatModal({
  isOpen,
  onClose,
  schedule,
  userRole,
  userName,
  onSaveChat
}: ScheduleChatModalProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, schedule?.chat]);

  if (!isOpen || !schedule) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const senderLabel = userRole === 'establishment' ? 'Estabelecimento' : userRole === 'rider' ? 'Motoboy' : 'Admin';
    const formattedMessage = `[${dateStr} ${timeStr} - ${senderLabel} (${userName})]: ${newMessage.trim()}`;
    
    const updatedChat = schedule.chat 
      ? `${schedule.chat}\n${formattedMessage}`
      : formattedMessage;

    onSaveChat(schedule.id, updatedChat);
    setNewMessage('');
  };

  const messages = schedule.chat ? schedule.chat.split('\n') : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Chat de Turno</h3>
              <p className="text-xs text-slate-500">Escala do dia {new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg min-h-[200px] max-h-[400px]">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma mensagem enviada neste turno. Comece a conversar!
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

        <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="Digite um aviso ou mensagem para o turno..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}