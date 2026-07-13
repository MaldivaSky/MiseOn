// ── Tipos espelhando o schema Supabase ──────────────────────

export type TipoPedido = 'DELIVERY' | 'SALAO' | 'RETIRADA_BALCAO';
export type StatusPedido = 'NOVO' | 'ACEITO' | 'PREPARANDO' | 'PRONTO' | 'EM_ROTA' | 'FINALIZADO' | 'CANCELADO';
export type MetodoPgto = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO';

export interface LeadCadastro {
  id: string;
  nome_responsavel: string;
  nome_loja: string;
  tipo_negocio?: string | null;
  cidade?: string | null;
  whatsapp: string;
  email?: string | null;
  observacao?: string | null;
  status: 'novo' | 'contatado' | 'convertido' | 'descartado';
  criado_em: string;
}

export interface Loja {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  banner_url?: string;
  cor_primaria: string;
  cor_secundaria: string;
  fonte?: string;
  cor_texto?: string;
  whatsapp: string;
  endereco?: string;
  pedido_minimo: number;
  aberto_manual?: boolean | null;
  pix_chave?: string;
  efi_payee_code?: string; // habilita cartão de crédito online (Efí)
}

export interface HorarioFuncionamento {
  id?: string;
  dia_semana: number; // 0=domingo
  abre: string;
  fecha: string;
}

export interface Banner {
  id: string;
  imagem_url: string;
  titulo?: string;
  link_redirecionamento?: string;
  ordem_exibicao: number;
  is_ativo?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  ativo?: boolean;
}

export interface Opcao {
  id: string;
  grupo_id: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  insumo_id?: string | null;
  quantidade_insumo?: number | null;
}

export interface GrupoOpcoes {
  id: string;
  produto_id: string;
  nome: string;
  min_escolhas: number;
  max_escolhas: number;
  ordem?: number;
  opcoes: Opcao[];
}

export interface FichaTecnica {
  produto_id: string;
  insumo_id: string;
  quantidade_consumida: number;
}

export interface Produto {
  id: string;
  categoria_id?: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  is_combo: boolean;
  destaque: boolean;
  disponivel: boolean;
  controla_estoque?: boolean;
  ordem?: number;
  vendidos: number;
  grupos_opcoes?: GrupoOpcoes[];
  fichas_tecnicas?: FichaTecnica[];
  tem_estoque?: boolean; // calculado no client via fn_produtos_com_estoque — não existe como coluna
}

export interface Cupom {
  id: string;
  codigo: string;
  descricao?: string;
  tipo: 'PERCENTUAL' | 'FIXO';
  valor: number;
  pedido_minimo: number;
  apenas_primeiro_pedido: boolean;
  metodo_exigido?: MetodoPgto;
  validade?: string | null;
  limite_usos?: number | null;
  usos?: number;
  ativo?: boolean;
}

export interface TaxaEntrega {
  id: string;
  bairro: string;
  valor: number;
  ativo?: boolean;
}

export interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
  observacao?: string;
  opcoesSelecionadas: Opcao[];
}

export interface Pedido {
  id: string;
  numero: number;
  tipo_pedido: TipoPedido;
  status: StatusPedido;
  identificador_cliente: string;
  telefone_contato?: string;
  endereco_entrega?: string;
  bairro?: string;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  valor_total: number;
  troco_para?: number;
  observacao?: string;
  criado_em: string;
  cliente_user_id?: string | null;
  itens_pedido?: ItemPedido[];
  pagamentos?: { metodo: MetodoPgto; status: string; valor_pago: number }[];
}

export interface Cliente {
  id: string;
  user_id?: string | null;
  telefone: string;
  nome?: string;
  email?: string | null;
  endereco?: string;
  bairro?: string;
  forma_pagamento_preferida?: MetodoPgto | null;
  total_pedidos: number;
  ultimo_pedido?: string | null;
  criado_em: string;
}

export interface ItemPedido {
  id: string;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  observacao?: string;
  itens_pedido_opcoes?: { nome_opcao: string; preco_adicional: number }[];
}

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  preco_embalagem: number;
  qtd_embalagem: number;
  ativo: boolean;
}

export const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const precoItem = (i: ItemCarrinho) =>
  (Number(i.produto.preco) + i.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0)) * i.quantidade;
