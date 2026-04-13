const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { scrapeAll, TARGETS } = require('./scraper');

const app = express();
const PORT = 3131;
const CONFIG_FILE = path.join(__dirname, 'ges-config.json');

app.use(express.json());
app.use(express.static(__dirname));

// ─── Config ──────────────────────────────────────────────────────────────────
function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ─── GitHub Gist ─────────────────────────────────────────────────────────────
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
  const rawUrl = `https://gist.githubusercontent.com/${username}/${id}/raw/ges-prices.json`;
  return { gistId: id, rawUrl };
}

// ─── API: Config oku ─────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const cfg = getConfig();
  res.json({
    hasToken: !!cfg.githubToken,
    gistId: cfg.gistId || '',
    gistRawUrl: cfg.gistRawUrl || '',
  });
});

// ─── API: Config kaydet ───────────────────────────────────────────────────────
app.post('/api/config', (req, res) => {
  const cfg = getConfig();
  const { githubToken, gistId } = req.body;
  if (githubToken) cfg.githubToken = githubToken;
  if (gistId !== undefined) cfg.gistId = gistId;
  saveConfig(cfg);
  res.json({ success: true });
});

// ─── API: Fiyat güncelle ──────────────────────────────────────────────────────
// SSE (Server-Sent Events) ile gerçek zamanlı ilerleme gönderir
app.get('/api/fiyat-guncelle', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const cfg = getConfig();
  send('start', { total: TARGETS.length });

  try {
    let done = 0;
    const prices = await scrapeAll((msg) => {
      if (msg.startsWith('[')) {
        done++;
        send('progress', { msg, done, total: TARGETS.length });
      } else {
        send('log', { msg });
      }
    });

    const found = prices.filter(p => p.price !== null).length;
    let gistRawUrl = cfg.gistRawUrl || '';

    if (cfg.githubToken) {
      try {
        const result = await pushToGist(prices, cfg.githubToken, cfg.gistId || '');
        gistRawUrl = result.rawUrl;
        saveConfig({ ...cfg, gistId: result.gistId, gistRawUrl });
        send('gist', { gistRawUrl });
      } catch (e) {
        send('gist_error', { msg: 'Gist güncellenemedi: ' + e.message });
      }
    }

    send('done', { prices, found, total: TARGETS.length, gistRawUrl, updatedAt: new Date().toISOString() });
  } catch (e) {
    send('error', { msg: e.message });
  }

  res.end();
});

// ─── Sunucu başlat ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ☀  GES-O sunucu hazır');
  console.log(`  →  http://localhost:${PORT}`);
  console.log('');
  const { exec } = require('child_process');
  setTimeout(() => exec(`start http://localhost:${PORT}`), 600);
});
