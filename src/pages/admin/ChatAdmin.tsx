import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, User, MessageSquare, Search, ChevronRight, Globe } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { supabase } from '../../lib/supabase';
import type { ChatConversation } from '../../types';
import type { CtxLoja } from './AdminLayout';

// ── Apresentação do contato (nome, telefone, canal) ─────────────
function formatarTelefone(tel?: string | null): string {
  if (!tel) return '';
  // 55 11 91988-9233
  if (tel.length === 13 && tel.startsWith('55')) {
    return `+55 ${tel.slice(2, 4)} ${tel.slice(4, 9)}-${tel.slice(9)}`;
  }
  return `+${tel}`;
}

function nomeContato(conv: ChatConversation): string {
  if (conv.cliente_nome) return conv.cliente_nome;
  if (conv.canal === 'WHATSAPP') return formatarTelefone(conv.telefone) || 'Contato WhatsApp';
  return conv.cliente_id ? 'Cliente Logado' : 'Visitante do Site';
}

function BadgeCanal({ canal }: { canal?: string }) {
  if (canal === 'WHATSAPP') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800">
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23m4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28"/></svg>
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
      <Globe className="h-3 w-3" />
      Site
    </span>
  );
}

export default function ChatAdmin() {
  const ctx = useOutletContext<CtxLoja>();
  const { conversations, messages, activeConversationId, setActiveConversationId, sendMessage, markAsRead } = useChat(ctx.lojaId, null, true);
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

  const termo = searchTerm.toLowerCase();
  const filteredConversations = conversations.filter(c =>
    c.id.includes(searchTerm) ||
    (c.cliente_nome && c.cliente_nome.toLowerCase().includes(termo)) ||
    (c.telefone && c.telefone.includes(searchTerm.replace(/\D/g, '')))
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
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  conv.canal === 'WHATSAPP'
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <User size={18} className={conv.canal === 'WHATSAPP' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">
                      {nomeContato(conv)}
                    </p>
                    <BadgeCanal canal={conv.canal} />
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.canal === 'WHATSAPP'
                      ? formatarTelefone(conv.telefone)
                      : `Sessão ${conv.id.split('-')[0]}`}
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
              {(() => {
                const ativa = conversations.find(c => c.id === activeConversationId);
                return (
                  <>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      ativa?.canal === 'WHATSAPP' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <User size={20} className={ativa?.canal === 'WHATSAPP' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate">
                          {ativa ? nomeContato(ativa) : 'Atendimento ao Cliente'}
                        </h3>
                        <BadgeCanal canal={ativa?.canal} />
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {ativa?.canal === 'WHATSAPP'
                          ? formatarTelefone(ativa.telefone)
                          : `Sessão: ${activeConversationId}`}
                      </p>
                    </div>
                  </>
                );
              })()}
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
