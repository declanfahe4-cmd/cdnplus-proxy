const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================== استخراج master ======================
app.get('/master.m3u8', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('❌ استخدم ?id=xxxxx');

  const embedUrl = `https://cdnplus.org/${id}.html`;

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://w.shadwo.pro/'
    });

    await page.goto(embedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // تقليل الانتظار لتفادي crash
    await page.waitForTimeout(7000);

    const masterUrl = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      for (let entry of entries) {
        if (
          entry.name.includes('.m3u8') &&
          (entry.name.includes('master') ||
            entry.name.includes('urlset') ||
            entry.name.includes('hls'))
        ) {
          return entry.name;
        }
      }
      return null;
    });

    if (!masterUrl) throw new Error('Master not found');

    let content = await (await fetch(masterUrl)).text();

    const base = `${req.protocol}://${req.get('host')}`;

    content = content.replace(
      /(https?:\/\/[^\s\n"']+)/gi,
      (m) => `${base}/proxy?url=${encodeURIComponent(m)}`
    );

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-cache');
    res.send(content);

  } catch (e) {
    console.error(e);
    res.status(500).send(`❌ خطأ: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }
});

// ====================== Proxy ======================
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url');

  try {
    const response = await fetch(target);

    const contentType =
      response.headers.get('Content-Type') ||
      (target.includes('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/MP2T');

    let body;

    if (target.includes('.m3u8')) {
      body = await response.text();

      const base = `${req.protocol}://${req.get('host')}`;

      body = body.replace(
        /(https?:\/\/[^\s\n"']+)/gi,
        (m) => `${base}/proxy?url=${encodeURIComponent(m)}`
      );
    } else {
      body = await response.arrayBuffer();
    }

    res.set('Content-Type', contentType);
    res.send(body);

  } catch (e) {
    console.error(e);
    res.status(502).send('Proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
