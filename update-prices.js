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

function fmt(n) { return n ? n.toLocaleString('tr-TR') : '—'; }

function updateRapor(prices) {
  const MARKUP = 1.14;
  const tarih = new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const saat  = new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });

  const map = {};
  prices.forEach(p => { if (p.price) map[p.id] = p; });

  const satirlar = (items) => items.map(({ id, name, eskiMin, eskiMax }) => {
    const scraped = map[id];
    let yeniFiyat = null;
    if (scraped && scraped.price) {
      const rawMax = scraped.priceMax || scraped.price;
      const avg = (scraped.price + rawMax) / 2;
      yeniFiyat = Math.round(avg * MARKUP);
    }
    return `| ${name} | ${fmt(eskiMin)} | ${fmt(eskiMax)} | ${fmt(yeniFiyat)} |`;
  }).join('\n');

  const webUrunler = [
    { id:'pan400',   name:'400W Monokristal (adet)',  eskiMin:4200,   eskiMax:5000   },
    { id:'pan450',   name:'450W Monokristal (adet)',  eskiMin:4800,   eskiMax:5800   },
    { id:'pan500',   name:'500W Monokristal (adet)',  eskiMin:5400,   eskiMax:6500   },
    { id:'pan550',   name:'550W Monokristal (adet)',  eskiMin:6000,   eskiMax:7200   },
    { id:'pan600',   name:'600W Monokristal (adet)',  eskiMin:6800,   eskiMax:8000   },
    { id:'panb550',  name:'550W Bifacial (adet)',     eskiMin:7000,   eskiMax:8500   },
    { id:'panb600',  name:'600W Bifacial (adet)',     eskiMin:7800,   eskiMax:9200   },
    { id:'inv_h3',   name:'Hibrit Inverter 3kW',      eskiMin:22000,  eskiMax:28000  },
    { id:'inv_h5',   name:'Hibrit Inverter 5kW',      eskiMin:30000,  eskiMax:38000  },
    { id:'inv_h8',   name:'Hibrit Inverter 8kW',      eskiMin:42000,  eskiMax:52000  },
    { id:'inv_h10',  name:'Hibrit Inverter 10kW',     eskiMin:50000,  eskiMax:62000  },
    { id:'inv_h15',  name:'Hibrit Inverter 15kW',     eskiMin:72000,  eskiMax:88000  },
    { id:'inv_h20',  name:'Hibrit Inverter 20kW',     eskiMin:92000,  eskiMax:115000 },
    { id:'inv_s3',   name:'String Inverter 3kW',      eskiMin:12000,  eskiMax:16000  },
    { id:'inv_s5',   name:'String Inverter 5kW',      eskiMin:16000,  eskiMax:22000  },
    { id:'inv_s8',   name:'String Inverter 8kW',      eskiMin:22000,  eskiMax:30000  },
    { id:'inv_s10',  name:'String Inverter 10kW',     eskiMin:27000,  eskiMax:36000  },
    { id:'inv_s15',  name:'String Inverter 15kW',     eskiMin:38000,  eskiMax:50000  },
    { id:'inv_s20',  name:'String Inverter 20kW',     eskiMin:48000,  eskiMax:65000  },
    { id:'bat_l5',   name:'LiFePO4 5kWh',             eskiMin:55000,  eskiMax:70000  },
    { id:'bat_l10',  name:'LiFePO4 10kWh',            eskiMin:100000, eskiMax:130000 },
    { id:'bat_l20',  name:'LiFePO4 20kWh',            eskiMin:190000, eskiMax:240000 },
    { id:'bat_a100', name:'AGM 100Ah 12V',             eskiMin:5500,   eskiMax:7000   },
    { id:'bat_a200', name:'AGM 200Ah 12V',             eskiMin:10000,  eskiMax:13000  },
    { id:'bat_a200g',name:'Gel 200Ah 12V',             eskiMin:12000,  eskiMax:15000  },
  ];

  const icerik = `# GES-O Fiyat Raporu

> **Son güncelleme:** ${tarih} ${saat}
> **Eski fiyat:** Katalog başlangıç değeri
> **Yeni fiyat:** ort(web min, web max) × (1 + %14 komisyon)

---

## Web'den Güncellenen Ürünler

| Ürün | Eski Min | Eski Max | Yeni Fiyat |
|---|---:|---:|---:|
${satirlar(webUrunler)}

---

## Manuel Fiyatlı Ürünler (web güncellenmez)

Montaj sistemi, kablo, koruma, topraklama, sarf malzeme fiyatları
değişmeden kalır. Fiyat Listesi sekmesinden düzenleyebilirsiniz.

---

> Rapor otomatik oluşturulmuştur — GES-O update-prices.js
`;

  fs.writeFileSync(path.join(__dirname, 'rapor.md'), icerik);
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

    updateRapor(prices);
    log('=== Tamamlandı ===');
  } catch (e) {
    log('HATA: ' + e.message);
    process.exit(1);
  }
}

main();
