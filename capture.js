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
  
  try {
    await page.waitForSelector('button');
    const produtos = await page.$$('div > h3');
    if (produtos.length > 0) {
      await produtos[0].click();
      await new Promise(r => setTimeout(r, 1000));
      
      const btns = await page.$$('button');
      for (const b of btns) {
        const text = await b.evaluate(el => el.textContent);
        if (text && (text.includes('Adicionar ao Carrinho') || text.includes('Adicionar '))) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1000));
      
      for (const b of await page.$$('button')) {
        const text = await b.evaluate(el => el.textContent);
        if (text && text.toLowerCase().includes('carrinho')) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1000));

      for (const b of await page.$$('button')) {
        const text = await b.evaluate(el => el.textContent);
        if (text && text.includes('Avançar')) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1000));

      await page.evaluate(() => {
         const inputs = document.querySelectorAll('input');
         inputs.forEach(i => {
            if (i.placeholder.toLowerCase().includes('nome')) i.value = 'Cliente Teste VIP';
            if (i.placeholder.toLowerCase().includes('celular') || i.type === 'tel') i.value = '11999999999';
         });
      });

      for (const b of await page.$$('button')) {
        const text = await b.evaluate(el => el.textContent);
        if (text && text.includes('Continuar')) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: './public/screenshots/pagamento.png' });
    }
  } catch (e) {
    console.error('Erro no checkout:', e);
  }

  // 2. FOTO: LOGIN NO ADMIN PARA KDS E COMPRAS
  console.log('Logando no Admin...');
  await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'admin@natureba.local');
  await page.type('input[type="password"]', 'natureba123');
  
  const btnsLogin = await page.$$('button');
  for (const b of btnsLogin) {
    const text = await b.evaluate(el => el.textContent);
    if (text && text.includes('Entrar no Painel')) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        b.click()
      ]);
      break;
    }
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
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: './public/screenshots/entregas.png' });

  await browser.close();
  console.log('Pronto!');
})();
