import type { EnderecoFormData } from '../components/EnderecoMixin';
import type { LatLng } from './geo';

export interface LocalizacaoClienteSalva extends LatLng {
  origem: 'gps' | 'endereco';
  label?: string;
  atualizadoEm: string;
}

const KEY = 'miseon_localizacao_cliente';

export function carregarLocalizacaoCliente(): LocalizacaoClienteSalva | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalizacaoClienteSalva;
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function salvarLocalizacaoCliente(input: Omit<LocalizacaoClienteSalva, 'atualizadoEm'>) {
  const payload: LocalizacaoClienteSalva = {
    ...input,
    atualizadoEm: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('miseon:localizacao-cliente', { detail: payload }));
  return payload;
}

export function limparLocalizacaoCliente() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent('miseon:localizacao-cliente-limpa'));
}

export function enderecoParaQuery(endereco?: Partial<EnderecoFormData> | null) {
  if (!endereco) return '';
  return [
    endereco.logradouro,
    endereco.numero,
    endereco.bairro,
    endereco.cidade,
    endereco.uf,
    endereco.cep,
    'Brasil',
  ].filter(Boolean).join(', ');
}

export function enderecoParaLabel(endereco?: Partial<EnderecoFormData> | null) {
  if (!endereco) return '';
  return [
    endereco.logradouro ? `${endereco.logradouro}${endereco.numero ? `, ${endereco.numero}` : ''}` : '',
    endereco.bairro,
    endereco.cidade ? `${endereco.cidade}${endereco.uf ? `/${endereco.uf}` : ''}` : '',
  ].filter(Boolean).join(' - ');
}
