/**
 * Validação de ponta a ponta do Rastreio 3D (aba em /admin/estoque).
 *
 * Roteiro: login admin → Estoque → aba "Rastreio 3D" → aguarda a cena WebGL
 * → troca de setor → seleciona um item (clique no cartão) → seleciona uma
 * receita → captura 4 screenshots. QUALQUER erro de console/pageerror falha
 * o script (exit 1) — foi um erro assim que derrubou a tela azul.
 *
 * Uso: node validacao/validar-rastreio3d.mjs [porta]   (padrão 5199)
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const PORTA = process.argv[2] ?? '5199';
const BASE = `http://localhost:${PORTA}`;
const EMAIL = 'admin@lanchepaulista.com';
const SENHA = 'Paulista@2026';
const PASTA = 'validacao';

const erros = [];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(PASTA, { recursive: true });

const navegador = await puppeteer.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader', // WebGL por software no headless
    '--use-gl=angle',
    '--window-size=1440,960',
    '--lang=pt-BR',
  ],
  defaultViewport: { width: 1440, height: 960 },
});

try {
  const pagina = await navegador.newPage();
  pagina.on('console', (msg) => {
    if (msg.type() === 'error') erros.push(`[console.error] ${msg.text()}`);
  });
  pagina.on('pageerror', (err) => erros.push(`[pageerror] ${err.message}`));
  pagina.on('requestfailed', (req) => {
    // Ignora falhas de fontes/analytics externas; foca em app e dados.
    const url = req.url();
    if (url.includes(BASE) || url.includes('supabase.co')) {
      erros.push(`[requestfailed] ${url} — ${req.failure()?.errorText}`);
    }
  });

  // ── Login ──────────────────────────────────────────────────────────────
  await pagina.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle2', timeout: 45000 });
  await pagina.waitForSelector('input[type="email"]', { timeout: 15000 });
  await pagina.type('input[type="email"]', EMAIL);
  await pagina.type('input[type="password"]', SENHA);
  await pagina.keyboard.press('Enter');
  await pagina.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 20000 });
  console.log('✓ login admin');

  // ── Estoque → aba Rastreio 3D ──────────────────────────────────────────
  await pagina.goto(`${BASE}/admin/estoque`, { waitUntil: 'networkidle2', timeout: 45000 });
  const aba = await pagina.waitForFunction(() => {
    const botoes = [...document.querySelectorAll('button')];
    const alvo = botoes.find((b) => b.textContent?.includes('Rastreio 3D'));
    if (alvo) { alvo.click(); return true; }
    return false;
  }, { timeout: 20000, polling: 500 });
  if (!aba) throw new Error('Aba "Rastreio 3D" não encontrada');
  console.log('✓ aba Rastreio 3D clicada');

  // Cena: canvas WebGL + chips de setor renderizados.
  await pagina.waitForSelector('.mo-r3d-canvas canvas', { timeout: 30000 });
  await pagina.waitForSelector('.mo-r3d-setor', { timeout: 30000 });
  await dormir(4000); // dados + primeiros frames estáveis
  await pagina.screenshot({ path: `${PASTA}/rastreio3d-01-visao-geral.png` });
  console.log('✓ cena renderizada (screenshot 01)');

  // Falha elegante de WebGL não pode ter aparecido.
  const falha3d = await pagina.$('.mo-r3d-falha');
  if (falha3d) throw new Error('Caiu no fallback de falha da engine (WebGL indisponível?)');

  // ── Troca de setor (último chip — dispensa/armário) ────────────────────
  const chips = await pagina.$$('.mo-r3d-setor');
  if (chips.length > 1) {
    await chips[chips.length - 1].click();
    await dormir(1800);
    await pagina.screenshot({ path: `${PASTA}/rastreio3d-02-outro-setor.png` });
    console.log(`✓ setor trocado (${chips.length} setores — screenshot 02)`);
  }

  // ── Detalhe do item (clique no primeiro cartão) ────────────────────────
  await pagina.waitForSelector('.mo-r3d-cartao', { timeout: 15000 });
  await pagina.click('.mo-r3d-cartao');
  await pagina.waitForSelector('.mo-r3d-painel', { timeout: 8000 });
  await dormir(600);
  await pagina.screenshot({ path: `${PASTA}/rastreio3d-03-detalhe-item.png` });
  console.log('✓ painel de detalhe do item (screenshot 03)');

  // Fecha o detalhe para não sobrepor o painel de receita.
  await pagina.click('.mo-r3d-painel header button');
  await dormir(300);

  // ── Checagem de receita (prefere uma COM ficha técnica, para evidenciar ──
  // o veredito "rende N porções" e o destaque ✅/❌ na cena) ───────────────
  const temSelect = await pagina.$('.mo-r3d-receita-sel select');
  if (temSelect) {
    const valor = await pagina.evaluate(async () => {
      const sel = document.querySelector('.mo-r3d-receita-sel select');
      const opcoes = [...sel.options].filter((o) => o.value);
      const escolher = (o) => {
        sel.value = o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      };
      // 1ª passagem: receita com veredito (ficha cadastrada).
      for (const o of opcoes) {
        escolher(o);
        await new Promise((r) => setTimeout(r, 350));
        if (document.querySelector('.mo-r3d-rec-veredito')) return o.textContent;
      }
      // 2ª: nenhuma com ficha — vale a primeira (mostra o estado vazio honesto).
      if (opcoes[0]) { escolher(opcoes[0]); return opcoes[0].textContent; }
      return null;
    });
    if (valor) {
      await pagina.waitForSelector('.mo-r3d-recpanel', { timeout: 8000 });
      await dormir(1500); // destaque ✅/❌ aplicado na cena
      await pagina.screenshot({ path: `${PASTA}/rastreio3d-04-receita.png` });
      console.log(`✓ receita checada: ${valor.trim()} (screenshot 04)`);
    }
  } else {
    console.log('· sem receitas cadastradas — etapa de receita pulada');
  }

  // ── Campo Setor no cadastro de insumo ──────────────────────────────────
  await pagina.evaluate(() => {
    const botoes = [...document.querySelectorAll('button')];
    botoes.find((b) => b.textContent?.includes('Matérias-Primas'))?.click();
  });
  await pagina.waitForSelector('#form-novo-insumo', { timeout: 15000 });
  await dormir(700);
  const temSetor = await pagina.evaluate(() =>
    [...document.querySelectorAll('#form-novo-insumo option')].some((o) => o.textContent?.includes('Geladeira')));
  if (!temSetor) throw new Error('Select de Setor não encontrado no formulário de cadastro');
  const form = await pagina.$('#form-novo-insumo');
  await form.screenshot({ path: `${PASTA}/rastreio3d-05-campo-setor.png` });
  console.log('✓ campo Setor no formulário de cadastro (screenshot 05)');

  // ── Resultado ──────────────────────────────────────────────────────────
  if (erros.length > 0) {
    console.error(`\n✗ ${erros.length} erro(s) capturado(s):`);
    for (const e of erros) console.error('  ' + e);
    process.exit(1);
  }
  console.log('\n✓ VALIDAÇÃO OK — zero erros de console/página');
} finally {
  await navegador.close();
}
