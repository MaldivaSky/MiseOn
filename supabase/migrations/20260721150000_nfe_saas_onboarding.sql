-- Add columns for NFe Onboarding on `lojas` table

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS nfe_habilitado boolean DEFAULT false;
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS nfe_regime_tributario text CHECK (nfe_regime_tributario IN ('Simples Nacional', 'Regime Normal', 'Simples Nacional - Excesso de sublimite'));
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS nfe_inscricao_estadual text;
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS nfe_id_csc text;
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS nfe_csc text;

-- Add comments for clarity
COMMENT ON COLUMN lojas.nfe_habilitado IS 'Se true, a loja concluiu o onboarding com sucesso via Focus NFe e seu certificado A1 esta configurado';
COMMENT ON COLUMN lojas.nfe_regime_tributario IS 'Regime tributario informado na Focus NFe';
COMMENT ON COLUMN lojas.nfe_inscricao_estadual IS 'Inscricao Estadual usada na NF-e/NFC-e';
COMMENT ON COLUMN lojas.nfe_id_csc IS 'ID do Codigo de Seguranca do Contribuinte (SEFAZ)';
COMMENT ON COLUMN lojas.nfe_csc IS 'Codigo de Seguranca do Contribuinte (SEFAZ)';
