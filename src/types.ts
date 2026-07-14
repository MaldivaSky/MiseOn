// ── Tipos espelhando o schema Supabase ──────────────────────

export type TipoPedido = 'DELIVERY' | 'SALAO' | 'RETIRADA_BALCAO';
export type StatusPedido = 'NOVO' | 'ACEITO' | 'PREPARANDO' | 'PRONTO' | 'EM_ROTA' | 'FINALIZADO' | 'CANCELADO';
export type MetodoPgto = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO';
export type TipoRemetente = 'CLIENTE' | 'LOJA' | 'ENTREGADOR';
export type TipoRemuneracao = 'FIXO' | 'POR_ENTREGA' | 'DESLIGADO';
export type StatusRota = 'PENDENTE' | 'EM_ANDAMENTO' | 'FINALIZADA';

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
  telefone?: string;
  endereco?: string;
  cnpj?: string;
  razao_social?: string;
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

export interface ProdutoCusto {
  produto_id: string;
  nome: string;
  preco_venda: number;
  custo_insumos: number;
  taxa_rateio: number;
  lucro_bruto: number;
  lucro_liquido: number;
  margem_pct: number;
}

export interface InsumoRendimentoJSON {
  regras: {
    de_qtd: number;
    de_unidade: string;
    para_qtd: number;
    para_unidade: string;
  }[];
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
  galeria?: string[];
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

export interface ItemPedido {
  id: string;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  observacao?: string;
  itens_pedido_opcoes?: { nome_opcao: string; preco_adicional: number }[];
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
  cep?: string;
  logradouro?: string;
  numero_endereco?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  ponto_referencia?: string;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  valor_total: number;
  troco_para?: number;
  observacao?: string;
  criado_em: string;
  cliente_user_id?: string | null;
  entregador_id?: string | null;
  rota_id?: string | null;
  ordem_entrega?: number | null;
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
  enderecos?: EnderecoCliente[];
  favoritos?: FavoritoCliente[];
}

export interface EnderecoCliente {
  id: string;
  cliente_id: string;
  cep: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  ponto_referencia?: string;
  padrao: boolean;
}

export interface FavoritoCliente {
  id: string;
  cliente_id: string;
  produto_id: string;
  produto?: Produto;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  preco_embalagem: number;
  qtd_embalagem: number;
  detalhes_rendimento?: InsumoRendimentoJSON | null;
  ativo: boolean;
  is_preparo?: boolean;
  categoria_insumo?: string;
  rendimento_porcoes?: number;
  pessoas_servidas?: number;
  fichas_preparo?: FichaPreparo[];
  criado_em?: string;
}

export interface FichaPreparo {
  id: string;
  loja_id: string;
  preparo_id: string;
  insumo_id: string;
  quantidade: number;
  insumo?: Insumo;
}

// ── Logistics ────────────────────────────────────────────────

export interface Entregador {
  id: string;
  loja_id: string;
  user_id?: string | null;
  nome: string;
  telefone: string;
  veiculo?: string | null;
  placa?: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface RotaEntrega {
  id: string;
  loja_id: string;
  entregador_id: string;
  status: StatusRota;
  criado_em: string;
  finalizado_em?: string | null;
  entregador?: Entregador;
  pedidos?: Pedido[];
}

export interface MensagemPedido {
  id: string;
  pedido_id: string;
  remetente_tipo: TipoRemetente;
  mensagem: string;
  lida: boolean;
  criado_em: string;
}

// ── Configurações ─────────────────────────────────────────────

export interface ConfiguracoesCusto {
  loja_id: string;
  custo_aluguel: number;
  custo_energia: number;
  custo_agua: number;
  custo_internet: number;
  custo_gas: number;
  outros_custos_fixos: number;
  expectativa_vendas_mes: number;
  tipo_remuneracao_entregador?: TipoRemuneracao;
  valor_remuneracao_entregador?: number;
  criado_em?: string;
  atualizado_em?: string;
}

// ── Utilitários ───────────────────────────────────────────────

export const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const precoItem = (i: ItemCarrinho) =>
  (Number(i.produto.preco) + i.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0)) * i.quantidade;
