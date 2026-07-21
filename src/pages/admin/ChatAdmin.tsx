import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, User, MessageSquare, Search, ChevronRight } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { supabase } from '../../lib/supabase';
import type { CtxLoja } from './AdminLayout';

export default function ChatAdmin() {
  const ctx = useOutletContext<CtxLoja>();
  const { conversations, messages, activeConversationId, setActiveConversationId, sendMessage, markAsRead } = useChat(ctx.lojaId);
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [chatIaAtivo, setChatIaAtivo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carregar configuração inicial da loja
    supabase.from('lojas').select('chat_ia_ativo').eq('id', ctx.lojaId).single().then(({ data }) => {
      if (data) setChatIaAtivo(data.chat_ia_ativo || false);
    });
  }, [ctx.lojaId]);

  const toggleIa = async () => {
    const novoStatus = !chatIaAtivo;
    setChatIaAtivo(novoStatus);
    await supabase.from('lojas').update({ chat_ia_ativo: novoStatus }).eq('id', ctx.lojaId);
  };

  // Marcar como lido ao selecionar
  useEffect(() => {
    if (activeConversationId) {
      markAsRead(activeConversationId, 'LOJA');
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeConversationId, markAsRead, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    await sendMessage(text, 'LOJA');
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const filteredConversations = conversations.filter(c => 
    c.id.includes(searchTerm) || (c.cliente_nome && c.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
      {/* Sidebar de Conversas */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Conversas</h2>
            <button
              onClick={toggleIa}
              title={chatIaAtivo ? 'Desativar Assistente IA' : 'Ativar Assistente IA'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                chatIaAtivo 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' 
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${chatIaAtivo ? 'bg-blue-500' : 'bg-gray-400'}`} />
              IA {chatIaAtivo ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#004198] outline-none transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full flex items-center gap-3 p-4 text-left border-b border-gray-100 dark:border-gray-800/50 transition-colors
                  ${activeConversationId === conv.id ? 'bg-white dark:bg-gray-800 shadow-sm' : 'hover:bg-white dark:hover:bg-gray-900'}
                `}
              >
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {conv.cliente_nome || (conv.cliente_id ? 'Cliente Logado' : 'Visitante Anônimo')}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.id.split('-')[0]}...
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Área Principal de Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        {!activeConversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-50" />
            <p className="font-medium text-lg text-gray-600 dark:text-gray-300">Nenhuma conversa selecionada</p>
            <p className="text-sm mt-2 max-w-sm text-center">Selecione um cliente na lista à esquerda para iniciar o atendimento.</p>
          </div>
        ) : (
          <>
            {/* Header Chat */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 gap-3 shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <User size={20} className="text-gray-500" />
              </div>
              <div>
                <h3 className="font-bold">
                  {conversations.find(c => c.id === activeConversationId)?.cliente_nome || 'Atendimento ao Cliente'}
                </h3>
                <p className="text-xs text-gray-500">Sessão: {activeConversationId}</p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-gray-950/50 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>Inicie a conversa enviando uma mensagem abaixo.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.remetente_tipo === 'LOJA';
                  const isSystem = msg.remetente_tipo === 'SISTEMA';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs px-3 py-1 rounded-full">
                          {msg.conteudo}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {!isMine && (
                         <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 mr-2 mt-auto">
                            <User size={14} className="text-gray-500" />
                         </div>
                      )}
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isMine 
                          ? 'bg-[#004198] text-white rounded-br-sm' 
                          : 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-bl-sm'
                      }`}>
                        <p>{msg.conteudo}</p>
                        <p className={`text-[9px] font-medium text-right mt-1 opacity-70 ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Digite a resposta para o cliente..."
                className="flex-1 max-h-32 min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm focus:ring-2 focus:ring-[#004198] outline-none transition custom-scrollbar resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="h-[44px] px-6 rounded-xl bg-[#004198] text-white font-bold flex items-center gap-2 hover:bg-[#00337A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <span>Enviar</span>
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
