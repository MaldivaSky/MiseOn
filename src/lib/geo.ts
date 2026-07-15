// Geolocalização e cálculo de taxa de entrega por distância.
// Tudo é tolerante a falha: geocoding externo pode cair, então quem chama
// deve ter fallback (bairro → taxa padrão). Nada aqui lança exceção pra fora.

export interface LatLng { lat: number; lng: number; }

const RAD = Math.PI / 180;

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Geocodifica um endereço (Brasil) via Nominatim/OpenStreetMap.
 * Retorna null em qualquer falha (timeout, sem resultado, rede).
 */
export async function geocode(query: string): Promise<LatLng | null> {
  if (!query || query.trim().length < 5) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' +
      encodeURIComponent(query);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept-Language': 'pt-BR' } });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Normaliza texto (sem acento/caixa) para comparar bairros com robustez. */
export const normaliza = (s?: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface ConfigEntrega {
  entrega_modo?: string | null;
  lat?: number | null;
  lng?: number | null;
  entrega_taxa_base?: number | null;
  entrega_taxa_km?: number | null;
  entrega_raio_km?: number | null;
  entrega_taxa_padrao?: number | null;
}

export interface ResultadoEntrega {
  taxa: number;
  distanciaKm: number | null;
  foraDeArea: boolean;
  origem: 'DISTANCIA' | 'BAIRRO' | 'PADRAO' | 'NENHUM';
  geo: LatLng | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa a partir da distância: base + (km × por_km); bloqueia acima do raio. */
export function taxaDaDistancia(loja: ConfigEntrega, distanciaKm: number): { taxa: number; fora: boolean } {
  const base = Number(loja.entrega_taxa_base ?? 0);
  const perKm = Number(loja.entrega_taxa_km ?? 0);
  const raio = loja.entrega_raio_km != null ? Number(loja.entrega_raio_km) : null;
  const fora = raio != null && distanciaKm > raio;
  return { taxa: r2(base + perKm * distanciaKm), fora };
}

/**
 * Calcula a entrega com fallback em cascata:
 *   1. DISTANCIA  — se a loja tem origem e o endereço do cliente geocodifica
 *   2. BAIRRO     — taxa cadastrada por bairro (match sem acento/caixa)
 *   3. PADRAO     — taxa padrão configurada quando nada acima resolve
 * `geoCliente` opcional evita geocodificar de novo (quem chama pode cachear).
 */
export async function calcularEntrega(
  loja: ConfigEntrega,
  params: {
    enderecoQuery?: string;
    geoCliente?: LatLng | null;
    bairro?: string;
    taxasBairro?: { bairro: string; valor: number | string }[];
  },
): Promise<ResultadoEntrega> {
  const { enderecoQuery, bairro, taxasBairro = [] } = params;

  // 1) Distância
  if (loja.entrega_modo === 'DISTANCIA' && loja.lat != null && loja.lng != null) {
    const geo = params.geoCliente ?? (enderecoQuery ? await geocode(enderecoQuery) : null);
    if (geo) {
      const distanciaKm = r2(haversineKm({ lat: Number(loja.lat), lng: Number(loja.lng) }, geo));
      const { taxa, fora } = taxaDaDistancia(loja, distanciaKm);
      return { taxa, distanciaKm, foraDeArea: fora, origem: 'DISTANCIA', geo };
    }
  }

  // 2) Bairro
  if (bairro && taxasBairro.length > 0) {
    const hit = taxasBairro.find((t) => normaliza(t.bairro) === normaliza(bairro));
    if (hit) return { taxa: Number(hit.valor), distanciaKm: null, foraDeArea: false, origem: 'BAIRRO', geo: null };
  }

  // 3) Padrão
  const padrao = Number(loja.entrega_taxa_padrao ?? 0);
  return { taxa: padrao, distanciaKm: null, foraDeArea: false, origem: padrao > 0 ? 'PADRAO' : 'NENHUM', geo: null };
}
