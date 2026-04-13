// Bağımsız fiyat güncelleme scripti
// Windows Görev Zamanlayıcısı tarafından otomatik çalıştırılır
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { scrapeAll } = require('./scraper');

const CONFIG_FILE = path.join(__dirname, 'ges-config.json');
const LOG_FILE = path.join(__dirname, 'update-log.txt');

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function log(msg) {
  const line = `[${new Date().toLocaleString('tr-TR')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function pushToGist(prices, token, gistId) {
  const content = JSON.stringify({ updatedAt: new Date().toISOString(), prices }, null, 2);
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GES-O-App',
  };
  const body = { files: { 'ges-prices.json': { content } } };

  let res;
  if (gistId) {
    res = await axios.patch(`https://api.github.com/gists/${gistId}`, body, { headers });
  } else {
    res = await axios.post('https://api.github.com/gists',
      { ...body, description: 'GES-O Güneş Paneli Fiyat Listesi', public: false },
      { headers }
    );
  }

  const id = res.data.id;
  const username = res.data.owner.login;
  return {
    gistId: id,
    rawUrl: `https://gist.githubusercontent.com/${username}/${id}/raw/ges-prices.json`,
  };
}

async function main() {
  log('=== Otomatik fiyat güncellemesi başladı ===');

  const cfg = getConfig();
  if (!cfg.githubToken) {
    log('HATA: GitHub token bulunamadı. Önce uygulamayı açıp token girin.');
    process.exit(1);
  }

  try {
    const prices = await scrapeAll(log);
    const found = prices.filter(p => p.price !== null).length;
    log(`${found}/${prices.length} ürün için fiyat bulundu`);

    const result = await pushToGist(prices, cfg.githubToken, cfg.gistId || '');
    saveConfig({ ...cfg, gistId: result.gistId, gistRawUrl: result.rawUrl });
    log(`Gist güncellendi: ${result.rawUrl}`);
    log('=== Tamamlandı ===');
  } catch (e) {
    log('HATA: ' + e.message);
    process.exit(1);
  }
}

main();
