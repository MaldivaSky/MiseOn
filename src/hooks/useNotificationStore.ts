import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { tocarSom } from '../lib/som';
import { useToast } from '../components/ui/Toast';

export type CategoriaNotificacao = 'TODAS' | 'PEDIDO' | 'CHAT' | 'ESTOQUE' | 'CARDAPIO' | 'IFOOD' | 'GERAL';

export type TipoNotificacao =
  | 'PEDIDO_NOVO'
  | 'PEDIDO_PRONTO'
  | 'CHAT_MENSAGEM'
  | 'CHAT_HANDOFF'
  | 'ESTOQUE_BAIXO'
  | 'CARDAPIO_ESGOTADO'
  | 'IFOOD_PEDIDO'
  | 'ALERTA_FINANCEIRO';

export interface AppNotification {
  id: string;
  lojaId: string;
  tipo: TipoNotificacao;
  categoria: Exclude<CategoriaNotificacao, 'TODAS'>;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadaEm: string;
  acaoUrl?: string;
  acaoRotulo?: string;
  metaData?: Record<string, any>;
}

const MAX_NOTIFICACOES = 100;

export function useNotificationStore(lojaId?: string) {
  const toast = useToast();
  const [notificacoes, setNotificacoes] = useState<AppNotification[]>([]);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [novasContador, setNovasContador] = useState(0);

  // Carregar notificações salvas e lista de excluídos do LocalStorage
  useEffect(() => {
    if (!lojaId) return;
    try {
      const salvoNotifs = localStorage.getItem(`miseon_notifs_${lojaId}`);
      if (salvoNotifs) {
        const parsed = JSON.parse(salvoNotifs) as AppNotification[];
        setNotificacoes(parsed);
      }
      const salvoExcluidos = localStorage.getItem(`miseon_notifs_excluidas_${lojaId}`);
      if (salvoExcluidos) {
        const parsedEx = JSON.parse(salvoExcluidos) as string[];
        setExcluidos(parsedEx);
      }
    } catch (e) {
      console.error('Erro ao carregar notificações do cache:', e);
    }
  }, [lojaId]);

  // Salvar notificações ativas no LocalStorage
  const salvarCache = useCallback(
    (novas: AppNotification[]) => {
      if (!lojaId) return;
      try {
        localStorage.setItem(`miseon_notifs_${lojaId}`, JSON.stringify(novas.slice(0, MAX_NOTIFICACOES)));
      } catch (e) {
        console.error('Erro ao salvar notificações:', e);
      }
    },
    [lojaId]
  );

  // Salvar lista de excluídos (resolvidos) no LocalStorage
  const salvarExcluidos = useCallback(
    (novasExcluidas: string[]) => {
      if (!lojaId) return;
      try {
        localStorage.setItem(`miseon_notifs_excluidas_${lojaId}`, JSON.stringify(novasExcluidas.slice(0, 200)));
      } catch (e) {
        console.error('Erro ao salvar excluídos:', e);
      }
    },
    [lojaId]
  );

  // Adicionar notificação de forma estritamente deduplicada
  const adicionarNotificacao = useCallback(
    (
      n: Omit<AppNotification, 'id' | 'lojaId' | 'lida' | 'criadaEm'> & { id?: string },
      options?: { silencioso?: boolean }
    ) => {
      if (!lojaId) return;

      // Gerar ID determinístico baseado no tipo e entidade (evita IDs randômicos duplicados)
      const idDeterministico =
        n.id ||
        (n.metaData?.insumoId
          ? `notif_ESTOQUE_${n.metaData.insumoId}`
          : n.metaData?.produtoId
          ? `notif_CARDAPIO_${n.metaData.produtoId}`
          : n.metaData?.pedidoId
          ? `notif_${n.tipo}_${n.metaData.pedidoId}`
          : `notif_${n.tipo}_${n.titulo.replace(/\s+/g, '_')}`);

      // Se a notificação já foi excluída pelo usuário (marcada como resolvida), ignora inserção
      if (excluidos.includes(idDeterministico)) {
        return;
      }

      const nova: AppNotification = {
        ...n,
        id: idDeterministico,
        lojaId,
        lida: false,
        criadaEm: (n as any).criadaEm || new Date().toISOString(),
      };

      let foiAdicionada = false;

      setNotificacoes((prev) => {
        // Se já existe (seja lida ou não lida), não re-adiciona nem altera
        const existe = prev.some((p) => p.id === nova.id || (p.titulo === nova.titulo && p.mensagem === nova.mensagem));
        if (existe) return prev;

        foiAdicionada = true;
        const atualizado = [nova, ...prev].slice(0, MAX_NOTIFICACOES);
        salvarCache(atualizado);
        return atualizado;
      });

      // Feedback sonoro + toast APENAS para notificações novas e não-silenciosas
      if (foiAdicionada && !options?.silencioso) {
        tocarSom();
        toast(`${nova.titulo}: ${nova.mensagem}`, n.categoria === 'CHAT' || n.categoria === 'ESTOQUE' ? 'alerta' : 'info');
        setNovasContador((c) => c + 1);
      }
    },
    [lojaId, excluidos, salvarCache, toast]
  );

  // Marcar como lida
  const marcarComoLida = useCallback(
    (id: string) => {
      setNotificacoes((prev) => {
        const atualizado = prev.map((n) => (n.id === id ? { ...n, lida: true } : n));
        salvarCache(atualizado);
        return atualizado;
      });
    },
    [salvarCache]
  );

  // Excluir notificação específica e registrar exclusão permanente no LocalStorage
  const excluirNotificacao = useCallback(
    (id: string) => {
      setNotificacoes((prev) => {
        const alvo = prev.find((n) => n.id === id);
        const atualizado = prev.filter((n) => n.id !== id);
        salvarCache(atualizado);

        // Adiciona à lista de excluídos salvos
        setExcluidos((prevEx) => {
          const chavesParaExcluir = [id];
          if (alvo?.metaData?.insumoId) chavesParaExcluir.push(`notif_ESTOQUE_${alvo.metaData.insumoId}`);
          if (alvo?.metaData?.produtoId) chavesParaExcluir.push(`notif_CARDAPIO_${alvo.metaData.produtoId}`);
          if (alvo?.metaData?.pedidoId) chavesParaExcluir.push(`notif_${alvo.tipo}_${alvo.metaData.pedidoId}`);

          const novoSet = Array.from(new Set([...prevEx, ...chavesParaExcluir]));
          salvarExcluidos(novoSet);
          return novoSet;
        });

        return atualizado;
      });
    },
    [salvarCache, salvarExcluidos]
  );

  // Marcar todas como lidas
  const marcarTodasComoLidas = useCallback(() => {
    setNotificacoes((prev) => {
      const atualizado = prev.map((n) => ({ ...n, lida: true }));
      salvarCache(atualizado);
      return atualizado;
    });
  }, [salvarCache]);

  // Limpar lidas
  const limparLidas = useCallback(() => {
    setNotificacoes((prev) => {
      const lidas = prev.filter((n) => n.lida);
      const atualizado = prev.filter((n) => !n.lida);
      salvarCache(atualizado);

      // Adiciona IDs das lidas limpas ao registro de excluídos
      if (lidas.length > 0) {
        setExcluidos((prevEx) => {
          const lidasIds = lidas.map((n) => n.id);
          const novoSet = Array.from(new Set([...prevEx, ...lidasIds]));
          salvarExcluidos(novoSet);
          return novoSet;
        });
      }

      return atualizado;
    });
  }, [salvarCache, salvarExcluidos]);

  // Total não lidas
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  // Verificação ativa de estoque crítico e produtos indisponíveis no banco de dados (Modo Silencioso no Mount)
  const verificarItensCriticos = useCallback(async () => {
    if (!lojaId) return;
    try {
      // 1. Insumos brutos em estoque crítico
      const { data: insumos } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_atual, estoque_minimo, unidade_medida')
        .eq('loja_id', lojaId)
        .eq('ativo', true);

      if (insumos) {
        const insumosLimposIds: string[] = [];

        insumos.forEach((ins) => {
          const chaveInsumo = `notif_ESTOQUE_${ins.id}`;
          const estaCritico = Number(ins.quantidade_atual) <= Number(ins.estoque_minimo);

          if (estaCritico) {
            adicionarNotificacao(
              {
                id: chaveInsumo,
                tipo: 'ESTOQUE_BAIXO',
                categoria: 'ESTOQUE',
                titulo: `🚨 Insumo Crítico: ${ins.nome}`,
                mensagem: `Estoque crítico: ${ins.quantidade_atual} ${ins.unidade_medida} (mínimo: ${ins.estoque_minimo} ${ins.unidade_medida})`,
                acaoUrl: '/admin/estoque',
                acaoRotulo: 'Repor Estoque',
                metaData: { insumoId: ins.id },
              },
              { silencioso: true } // Não dispara áudio nem toast ao carregar a página
            );
          } else {
            // Se o estoque foi reposto pelo usuário, remove da lista de excluídos
            insumosLimposIds.push(chaveInsumo);
          }
        });

        if (insumosLimposIds.length > 0) {
          setExcluidos((prevEx) => {
            const filtrado = prevEx.filter((key) => !insumosLimposIds.includes(key));
            if (filtrado.length !== prevEx.length) salvarExcluidos(filtrado);
            return filtrado;
          });
        }
      }

      // 2. Produtos do cardápio marcados como esgotados/indisponíveis
      const { data: produtos } = await supabase
        .from('produtos')
        .select('id, nome, disponivel')
        .eq('loja_id', lojaId)
        .eq('disponivel', false);

      if (produtos) {
        const produtosLimposIds: string[] = [];

        produtos.forEach((p) => {
          const chaveProduto = `notif_CARDAPIO_${p.id}`;

          if (!p.disponivel) {
            adicionarNotificacao(
              {
                id: chaveProduto,
                tipo: 'CARDAPIO_ESGOTADO',
                categoria: 'CARDAPIO',
                titulo: `⚠️ Cardápio Esgotado: ${p.nome}`,
                mensagem: `O item está marcado como indisponível no cardápio digital.`,
                acaoUrl: '/admin/cardapio',
                acaoRotulo: 'Gerenciar Cardápio',
                metaData: { produtoId: p.id },
              },
              { silencioso: true }
            );
          } else {
            produtosLimposIds.push(chaveProduto);
          }
        });

        if (produtosLimposIds.length > 0) {
          setExcluidos((prevEx) => {
            const filtrado = prevEx.filter((key) => !produtosLimposIds.includes(key));
            if (filtrado.length !== prevEx.length) salvarExcluidos(filtrado);
            return filtrado;
          });
        }
      }
    } catch (e) {
      console.error('Erro ao verificar estoque/cardápio crítico:', e);
    }
  }, [lojaId, adicionarNotificacao, salvarExcluidos]);

  // Disparar checagem ativa ao inicializar (silenciosamente)
  useEffect(() => {
    if (lojaId) {
      verificarItensCriticos();
    }
  }, [lojaId, verificarItensCriticos]);

  // Escutar eventos Supabase Realtime da loja
  useEffect(() => {
    if (!lojaId) return;

    const canal = supabase
      .channel(`central-notificacoes-${lojaId}`)
      // 1. Novos Pedidos de qualquer origem
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const p = payload.new as any;
          const origemTexto =
            p.origem === 'balcao'
              ? 'Balcão PDV'
              : p.origem === 'garcom'
              ? `Mesa ${p.mesa_numero ?? ''}`
              : p.tipo_pedido === 'DELIVERY'
              ? 'Delivery Online'
              : 'Cardápio Digital';

          adicionarNotificacao({
            id: `notif_PEDIDO_NOVO_${p.id}`,
            tipo: 'PEDIDO_NOVO',
            categoria: 'PEDIDO',
            titulo: `Novo Pedido #${p.numero}`,
            mensagem: `${origemTexto} • ${p.identificador_cliente || 'Cliente'} (R$ ${Number(p.valor_total || 0).toFixed(2)})`,
            acaoUrl: p.requer_cozinha ? '/admin/kds' : '/admin/pedidos',
            acaoRotulo: p.requer_cozinha ? 'Ver no KDS' : 'Ver Pedido',
            metaData: { pedidoId: p.id, numero: p.numero },
          });
        }
      )
      // 2. Pedido Pronto na Cozinha
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const novo = payload.new as any;
          const velho = payload.old as any;
          if (velho.status !== 'PRONTO' && novo.status === 'PRONTO') {
            adicionarNotificacao({
              id: `notif_PEDIDO_PRONTO_${novo.id}`,
              tipo: 'PEDIDO_PRONTO',
              categoria: 'PEDIDO',
              titulo: `Pedido #${novo.numero} PRONTO! 🎉`,
              mensagem:
                novo.tipo_pedido === 'SALAO'
                  ? `Pronto para servir na Mesa ${novo.mesa_numero || '—'}`
                  : `Pronto para expedição/retirada (${novo.identificador_cliente || 'Cliente'})`,
              acaoUrl: '/admin/pedidos',
              acaoRotulo: 'Chamar Cliente / Servir',
              metaData: { pedidoId: novo.id, numero: novo.numero },
            });
          }
        }
      )
      // 3. Mudanças em Insumos (Estoque Crítico em Tempo Real)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insumos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const ins = payload.new as any;
          if (ins && Number(ins.quantidade_atual) <= Number(ins.estoque_minimo)) {
            adicionarNotificacao({
              id: `notif_ESTOQUE_${ins.id}`,
              tipo: 'ESTOQUE_BAIXO',
              categoria: 'ESTOQUE',
              titulo: `🚨 Insumo Crítico: ${ins.nome}`,
              mensagem: `Saldo crítico: ${ins.quantidade_atual} ${ins.unidade_medida} (mínimo: ${ins.estoque_minimo} ${ins.unidade_medida})`,
              acaoUrl: '/admin/estoque',
              acaoRotulo: 'Repor Estoque',
              metaData: { insumoId: ins.id },
            });
          }
        }
      )
      // 4. Broadcasts de Chat & Atendimento Humano
      .on('broadcast', { event: 'new_chat_message' }, (payload) => {
        const clienteNome = payload.payload?.cliente_nome || 'Cliente';
        const msg = payload.payload?.message || 'Nova mensagem recebida';
        adicionarNotificacao({
          tipo: 'CHAT_MENSAGEM',
          categoria: 'CHAT',
          titulo: `Mensagem de ${clienteNome}`,
          mensagem: msg,
          acaoUrl: '/admin/chat',
          acaoRotulo: 'Atender Cliente',
        });
      })
      .on('broadcast', { event: 'chat_handoff' }, (payload) => {
        const msg = payload.payload?.message || '🚨 Cliente solicitou atendimento humano no chat!';
        adicionarNotificacao({
          tipo: 'CHAT_HANDOFF',
          categoria: 'CHAT',
          titulo: '🚨 Atendimento Humano Solicitado',
          mensagem: msg,
          acaoUrl: '/admin/chat',
          acaoRotulo: 'Ir para o Chat Agora',
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [lojaId, adicionarNotificacao]);

  return {
    notificacoes,
    naoLidas,
    novasContador,
    adicionarNotificacao,
    marcarComoLida,
    excluirNotificacao,
    marcarTodasComoLidas,
    limparLidas,
    verificarItensCriticos,
  };
}
