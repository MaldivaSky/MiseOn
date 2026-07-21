-- Migração para a Engine 3D de Mesas e Gestão de Assentos do Salão
ALTER TABLE public.mesas
  ADD COLUMN IF NOT EXISTS pos_x double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_z double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rotacao double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS formato text DEFAULT 'QUADRADA',
  ADD COLUMN IF NOT EXISTS setor text DEFAULT 'Principal';

-- Adiciona coluna de assento individualizado em itens_pedido
ALTER TABLE public.itens_pedido
  ADD COLUMN IF NOT EXISTS assento_numero integer DEFAULT NULL;

COMMENT ON COLUMN public.mesas.pos_x IS 'Posição X da mesa no ambiente 3D do salão';
COMMENT ON COLUMN public.mesas.pos_z IS 'Posição Z da mesa no ambiente 3D do salão';
COMMENT ON COLUMN public.mesas.rotacao IS 'Ângulo de rotação da mesa em graus';
COMMENT ON COLUMN public.mesas.formato IS 'Formato geométrico da mesa: REDONDA, QUADRADA, RETANGULAR, BOOTH';
COMMENT ON COLUMN public.mesas.setor IS 'Setor do salão: Principal, Varanda, Rooftop, VIP, Externo';

COMMENT ON COLUMN public.itens_pedido.assento_numero IS 'Número da cadeira / assento associado ao item para divisão individual de conta';
