import https from 'https';

const host = 'miseon.app.br';
const key = '85ab415ae21f43bb8c74ac936ea56de5';
const keyLocation = `https://${host}/${key}.txt`;

const payload = JSON.stringify({
  host,
  key,
  keyLocation,
  urlList: [
    `https://${host}/`,
    `https://${host}/sobre`,
    `https://${host}/contato`,
    `https://${host}/termos`,
    `https://${host}/privacidade`,
  ],
});

console.log('🚀 Enviando URLs para o IndexNow do Bing...');

const req = https.request(
  'https://api.indexnow.org/indexnow',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    console.log(`Status do IndexNow Bing: ${res.statusCode} ${res.statusMessage}`);
    res.on('data', (d) => process.stdout.write(d));
    if (res.statusCode === 200 || res.statusCode === 202) {
      console.log('✅ URLs notificadas com sucesso ao Bingbot via IndexNow!');
    }
  }
);

req.on('error', (e) => {
  console.error('❌ Erro no IndexNow:', e);
});

req.write(payload);
req.end();
