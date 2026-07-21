import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatConversation, ChatMessage } from '../types';

export function useChat(lojaId: string | null, clienteId?: string | null) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Recupera ou cria um session_id anônimo no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let stored = localStorage.getItem('miseon_chat_session');
      if (!stored) {
        stored = 'sess_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('miseon_chat_session', stored);
      }
      sessionIdRef.current = stored;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!lojaId) return;
    
    // Se não tiver clienteId, carrega por sessionId
    let query = supabase.from('chat_conversations').select('*').eq('loja_id', lojaId);
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else if (sessionIdRef.current) {
      query = query.eq('session_id', sessionIdRef.current);
    } else {
      return;
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setConversations(data as ChatConversation[]);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    }
  }, [lojaId, clienteId, activeConversationId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('criado_em', { ascending: true });
      
    if (!error && data) {
      setMessages(prev => ({ ...prev, [conversationId]: data as ChatMessage[] }));
    }
  }, []);

  // Inicializa conversas
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Inicializa mensagens da conversa ativa e assina o Realtime
  useEffect(() => {
    if (!activeConversationId) return;
    // Previne warning de chamadas de estado síncronas no effect
    setTimeout(() => {
      loadMessages(activeConversationId);
    }, 0);
    
    const channel = supabase.channel(`chat_${activeConversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `conversation_id=eq.${activeConversationId}` 
      }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages(prev => {
          const current = prev[activeConversationId] || [];
          // Previne duplicatas
          if (current.find(m => m.id === newMessage.id)) return prev;
          return { ...prev, [activeConversationId]: [...current, newMessage] };
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, loadMessages]);

  const sendMessage = async (content: string, remetenteTipo: 'CLIENTE' | 'LOJA' = 'CLIENTE') => {
    if (!lojaId) return null;
    
    let convId = activeConversationId;
    
    // Se não tiver conversa ativa, cria uma nova
    if (!convId) {
      const { data: convData, error: convError } = await supabase.from('chat_conversations').insert({
        loja_id: lojaId,
        cliente_id: clienteId || null,
        session_id: clienteId ? null : sessionIdRef.current
      }).select().single();
      
      if (convError || !convData) return null;
      
      convId = convData.id;
      setConversations(prev => [...prev, convData as ChatConversation]);
      setActiveConversationId(convId);
    }
    
    const { data, error } = await supabase.from('chat_messages').insert({
      conversation_id: convId,
      remetente_tipo: remetenteTipo,
      conteudo: content
    }).select().single();
    
    if (error || !data) return null;
    
    // Otimistic UI
    setMessages(prev => {
      const current = prev[convId as string] || [];
      if (current.find(m => m.id === data.id)) return prev;
      return { ...prev, [convId as string]: [...current, data as ChatMessage] };
    });
    
    // Dispara a triagem da IA (Groq) no backend se o remetente for o CLIENTE
    if (remetenteTipo === 'CLIENTE') {
      supabase.functions.invoke('chat-ai-reception', {
        body: { conversation_id: convId }
      }).catch(err => console.error('Falha ao acionar IA de triagem:', err));
    }
    
    return data;
  };
  
  const markAsRead = async (conversationId: string, tipoIgnorado: 'CLIENTE' | 'LOJA') => {
    // Marca como lida as mensagens que NÃO são do tipoIgnorado
    await supabase.from('chat_messages')
      .update({ lida: true })
      .eq('conversation_id', conversationId)
      .neq('remetente_tipo', tipoIgnorado)
      .eq('lida', false);
  };

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    messages: activeConversationId ? (messages[activeConversationId] || []) : [],
    sendMessage,
    markAsRead
  };
}
