import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

(async () => {
  mkdirSync('./public/screenshots', { recursive: true });
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1. FOTO: VITRINE / PAGAMENTO (Checkout)
  console.log('Capturando Tela de Pagamento...');
  await page.goto('http://localhost:5173/natureba', { waitUntil: 'networkidle0' });
  // Esperar o cardápio carregar e ter produtos
  await page.waitForSelector('button');
  // Clica no primeiro produto (abrir modal)
  const produtos = await page.$$('div > h3');
  if (produtos.length > 0) {
    await produtos[0].click();
    await new Promise(r => setTimeout(r, 1000));
    // Adicionar ao carrinho
    const btnAdicionar = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Adicionar ao Carrinho') || b.textContent.includes('Adicionar'));
    });
    if (btnAdicionar) {
       await btnAdicionar.click();
       await new Promise(r => setTimeout(r, 1000));
    }
    
    // Clicar no botão Flutuante do Carrinho
    const btnVerCarrinho = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Ver carrinho') || b.textContent.includes('carrinho'));
    });
    if (btnVerCarrinho) await btnVerCarrinho.click();
    await new Promise(r => setTimeout(r, 1000));

    // Clicar Avançar
    const btnAvancar = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Avançar'));
    });
    if (btnAvancar) await btnAvancar.click();
    await new Promise(r => setTimeout(r, 1000));

    // Preencher forms (Mock)
    await page.evaluate(() => {
       const inputs = document.querySelectorAll('input');
       inputs.forEach(i => {
          if (i.placeholder.toLowerCase().includes('nome')) i.value = 'João da Silva';
          if (i.placeholder.toLowerCase().includes('celular') || i.type === 'tel') i.value = '11999999999';
       });
    });

    const btnContinuar = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continuar'));
    });
    if (btnContinuar) await btnContinuar.click();
    await new Promise(r => setTimeout(r, 2000));

    // Tira print do checkout!
    await page.screenshot({ path: './public/screenshots/pagamento.png' });
  }

  // 2. FOTO: LOGIN NO ADMIN PARA KDS E COMPRAS
  console.log('Logando no Admin...');
  await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'admin@natureba.local');
  await page.type('input[type="password"]', 'natureba123');
  
  const btnEntrar = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Entrar') || b.textContent.includes('Login'));
  });
  if (btnEntrar) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      btnEntrar.click()
    ]);
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturando Painel de Pedidos (KDS)...');
  await page.screenshot({ path: './public/screenshots/pedidos.png' });

  // 3. FOTO: COMPRAS
  console.log('Capturando Compras...');
  await page.goto('http://localhost:5173/admin/compras', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: './public/screenshots/compras.png' });

  // 4. FOTO: ENTREGAS E MAPA
  console.log('Capturando Mapa do Entregador...');
  await page.goto('http://localhost:5173/admin/entregas', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: './public/screenshots/entregas.png' });

  await browser.close();
  console.log('Pronto!');
})();
