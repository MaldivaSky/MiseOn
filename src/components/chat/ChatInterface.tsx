import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { Loja } from '../../types';
import type { User } from '@supabase/supabase-js';

interface ChatInterfaceProps {
  loja: Loja;
  user: User | null;
}

export default function ChatInterface({ loja, user }: ChatInterfaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // No caso da vitrine, pegamos o user.id para identificar o cliente
  const { messages, sendMessage, activeConversationId, markAsRead } = useChat(loja.id, user?.id);

  // Rolagem automática para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Quando abre o chat, marcamos as mensagens da loja como lidas pelo cliente
      if (activeConversationId) {
        markAsRead(activeConversationId, 'CLIENTE');
      }
    }
  }, [messages, isOpen, activeConversationId, markAsRead]);

  // Se o painel for aberto e houver mensagens não lidas, marcamos
  useEffect(() => {
    if (isOpen && activeConversationId) {
      markAsRead(activeConversationId, 'CLIENTE');
    }
  }, [isOpen, activeConversationId, markAsRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    
    const text = draft;
    setDraft('');
    await sendMessage(text, 'CLIENTE');
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const hasUnread = messages.some(m => !m.lida && m.remetente_tipo === 'LOJA');

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: loja.cor_primaria || '#FC5B24' }}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && hasUnread && (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
            !
          </span>
        )}
      </button>

      {/* Janela do Chat */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-40 flex h-[450px] max-h-[70vh] w-[350px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: loja.cor_primaria || '#FC5B24' }}
          >
            <div>
              <p className="font-bold">Chat com a Loja</p>
              <p className="text-[11px] opacity-90">Respondemos rapidinho!</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition">
              <X size={18} />
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-50">
                <MessageSquare size={48} className="mb-2" />
                <p className="text-sm font-semibold">Nenhuma mensagem ainda.</p>
                <p className="text-xs">Mande sua dúvida ou acompanhe seu pedido por aqui.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.remetente_tipo === 'CLIENTE';
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        isMine 
                          ? 'bg-[var(--cor-primaria)] text-white rounded-br-sm' 
                          : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-sm'
                      }`}
                      style={isMine ? { background: loja.cor_primaria || '#FC5B24' } : undefined}
                    >
                      <p>{msg.conteudo}</p>
                      <p className={`mt-1 text-[9px] font-semibold text-right ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                        {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Envio */}
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 bg-white p-3 dark:bg-gray-900">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ background: loja.cor_primaria || '#FC5B24' }}
            >
              <Send size={16} className="-ml-0.5 mt-0.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
