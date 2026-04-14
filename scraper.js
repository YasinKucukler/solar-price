const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Bilgisayardaki Chrome'u bul
function findChrome() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\' + (process.env.USERNAME || '') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Sadece pahalı/değişken ürünler (kablo, bağlantı vb. atlanır)
const TARGETS = [
  // Güneş Paneli
  { id: 'pan400',   query: '400W monokristal güneş paneli' },
  { id: 'pan450',   query: '450W monokristal güneş paneli' },
  { id: 'pan500',   query: '500W monokristal güneş paneli' },
  { id: 'pan550',   query: '550W monokristal güneş paneli' },
  { id: 'pan600',   query: '600W monokristal güneş paneli' },
  { id: 'panb550',  query: '550W bifacial güneş paneli' },
  { id: 'panb600',  query: '600W bifacial güneş paneli' },

  // Hibrit İnverter
  { id: 'inv_h3',   query: 'hibrit inverter 3kW solar' },
  { id: 'inv_h5',   query: 'hibrit inverter 5kW solar' },
  { id: 'inv_h8',   query: 'hibrit inverter 8kW solar' },
  { id: 'inv_h10',  query: 'hibrit inverter 10kW solar' },
  { id: 'inv_h15',  query: 'hibrit inverter 15kW solar' },
  { id: 'inv_h20',  query: 'hibrit inverter 20kW solar' },

  // String İnverter
  { id: 'inv_s3',   query: 'string inverter 3kW solar' },
  { id: 'inv_s5',   query: 'string inverter 5kW solar' },
  { id: 'inv_s8',   query: 'string inverter 8kW solar' },
  { id: 'inv_s10',  query: 'string inverter 10kW solar' },
  { id: 'inv_s15',  query: 'string inverter 15kW solar' },
  { id: 'inv_s20',  query: 'string inverter 20kW solar' },

  // Akü / Batarya
  { id: 'bat_l5',    query: 'lifepo4 5kwh batarya güneş' },
  { id: 'bat_l10',   query: 'lifepo4 10kwh batarya güneş' },
  { id: 'bat_l20',   query: 'lifepo4 20kwh batarya güneş' },
  { id: 'bat_a100',  query: 'agm 100ah 12v akü solar' },
  { id: 'bat_a200',  query: 'agm 200ah 12v akü solar' },
  { id: 'bat_a200g', query: 'gel 200ah 12v akü solar' },
];

// "4.200,00 TL" → 4200
function parsePrice(str) {
  if (!str) return null;
  let s = str.replace(/[^\d.,]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const dotIdx = s.lastIndexOf('.');
    if (dotIdx !== -1 && s.length - dotIdx - 1 === 3) s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) || n < 50 ? null : Math.round(n);
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function robustPrice(prices) {
  if (!prices.length) return { price: null, priceMax: null };
  if (prices.length === 1) return { price: prices[0], priceMax: null };
  const s = [...prices].sort((a, b) => a - b);
  // En ucuz %10 ve en pahalı %10'u at
  const lo = Math.floor(s.length * 0.1);
  const hi = Math.ceil(s.length * 0.9);
  const trimmed = s.slice(lo, hi);
  const arr = trimmed.length >= 2 ? trimmed : s;
  const p75idx = Math.floor(arr.length * 0.75);
  return {
    price: median(arr),
    priceMax: arr[Math.min(p75idx, arr.length - 1)],
  };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fiyat benzeri sayı ara (TL formatı)
function extractPrices(text) {
  const results = [];
  const matches = text.match(/[\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d+)?/g) || [];
  matches.forEach(m => {
    const clean = m.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    if (n >= 500) results.push(n); // güneş ürünleri en az 500 TL
  });
  return results;
}

// ─── Hepsiburada ─────────────────────────────────────────────────────────────
async function scrapeHepsiburada(page, query) {
  try {
    const url = 'https://www.hepsiburada.com/ara?q=' + encodeURIComponent(query);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await delay(2500);
    const prices = await page.evaluate((extractFn) => {
      const results = [];
      const selectors = [
        '[data-test-id="price-current-price"]',
        '[class*="price"]', '[class*="Price"]',
        '[class*="fiyat"]', 'li[class*="product"]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const text = el.innerText || el.textContent || '';
          const ms = text.match(/[\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d+)?/g) || [];
          ms.forEach(m => {
            const n = parseFloat(m.replace(/\./g, '').replace(',', '.'));
            if (n >= 500) results.push(Math.round(n));
          });
        });
      });
      return [...new Set(results)];
    });
    return prices.slice(0, 15);
  } catch (e) { return []; }
}

// ─── Trendyol ─────────────────────────────────────────────────────────────────
async function scrapeTrendyol(page, query) {
  try {
    const url = 'https://www.trendyol.com/sr?q=' + encodeURIComponent(query);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await delay(2500);
    const prices = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '.prc-box-dscntd', '.prc-box-sllng',
        '[class*="price"]', '[class*="Price"]',
        '[class*="prc"]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const text = el.innerText || el.textContent || '';
          const ms = text.match(/[\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d+)?/g) || [];
          ms.forEach(m => {
            const n = parseFloat(m.replace(/\./g, '').replace(',', '.'));
            if (n >= 500) results.push(Math.round(n));
          });
        });
      });
      return [...new Set(results)];
    });
    return prices.slice(0, 15);
  } catch (e) { return []; }
}

// ─── Amazon TR ────────────────────────────────────────────────────────────────
async function scrapeAmazon(page, query) {
  try {
    const url = 'https://www.amazon.com.tr/s?k=' + encodeURIComponent(query);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await delay(2500);
    const prices = await page.evaluate(() => {
      const results = [];
      // .a-offscreen içinde tam fiyat metni bulunur ("10.599,00 TL")
      document.querySelectorAll('.a-offscreen, .a-price').forEach(el => {
        const text = el.innerText || el.textContent || '';
        const ms = text.match(/[\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d+)?/g) || [];
        ms.forEach(m => {
          const n = parseFloat(m.replace(/\./g, '').replace(',', '.'));
          if (n >= 500) results.push(Math.round(n));
        });
      });
      return [...new Set(results)];
    });
    return prices.slice(0, 15);
  } catch (e) { return []; }
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────
async function scrapeAll(log) {
  const logFn = log || console.log;

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome veya Edge bulunamadi. Lutfen Google Chrome yukleyin: https://www.google.com/chrome'
    );
  }
  logFn('Chrome bulundu: ' + chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--lang=tr-TR',
    ],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });

    for (let i = 0; i < TARGETS.length; i++) {
      const t = TARGETS[i];
      logFn(`[${i + 1}/${TARGETS.length}] ${t.query}`);

      // Sırayla çek (paralel yapılırsa bot tespiti artar)
      const hb = await scrapeHepsiburada(page, t.query);
      await delay(1000);
      const ty = await scrapeTrendyol(page, t.query);
      await delay(1000);
      const az = await scrapeAmazon(page, t.query);

      const all = [...hb, ...ty, ...az];
      const { price, priceMax } = robustPrice(all);

      logFn(`  → HB:${hb.length} TY:${ty.length} AZ:${az.length} | Fiyat:${price ? price.toLocaleString('tr-TR') + ' TL' : '-'}`);
      results.push({
        id: t.id, price, priceMax,
        searchUrls: [
          { site: 'Hepsiburada', url: 'https://www.hepsiburada.com/ara?q=' + encodeURIComponent(t.query) },
          { site: 'Trendyol',    url: 'https://www.trendyol.com/sr?q='     + encodeURIComponent(t.query) },
          { site: 'Amazon',      url: 'https://www.amazon.com.tr/s?k='     + encodeURIComponent(t.query) },
        ]
      });

      if (i < TARGETS.length - 1) await delay(1200);
    }
  } finally {
    await browser.close();
  }

  return results;
}

module.exports = { scrapeAll, TARGETS };
