const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/master.m3u8', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('❌ استخدم ?id=2w04v9rsfhs3');

  const embedUrl = `https://cdnplus.org/${id}.html`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://w.shadwo.pro/'
    });

    await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: 45000 });

    // انتظر فك الـ packer + تحميل المشغل (مثل كودك)
    await page.waitForTimeout(12000);

    // صيد الـ master من طلبات الشبكة (نفس طريقة Colab)
    const masterUrl = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      for (let entry of entries) {
        if (entry.name.includes('.m3u8') && 
            (entry.name.includes('master') || entry.name.includes('urlset') || entry.name.includes('hls'))) {
          return entry.name;
        }
      }
      return null;
    });

    await browser.close();

    if (!masterUrl) throw new Error('Master not found');

    // جلب المحتوى وإعادة كتابة الروابط
    let content = await (await fetch(masterUrl)).text();
    const base = `${req.protocol}://${req.get('host')}`;

    content = content.replace(/(https?:\/\/[^\s\n"']+)/gi, 
      m => `${base}/proxy?url=${encodeURIComponent(m)}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-cache');
    res.send(content);

  } catch (e) {
    console.error(e);
    res.status(500).send(`❌ خطأ: ${e.message}`);
  }
});

// ====================== Proxy للـ segments ======================
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url');

  try {
    const response = await fetch(target);
    const contentType = response.headers.get('Content-Type') || 
                       (target.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T');

    let body = await response.text();
    if (target.includes('.m3u8')) {
      const base = `${req.protocol}://${req.get('host')}`;
      body = body.replace(/(https?:\/\/[^\s\n"']+)/gi, 
        m => `${base}/proxy?url=${encodeURIComponent(m)}`);
    }

    res.set('Content-Type', contentType);
    res.send(body);
  } catch (e) {
    res.status(502).send('Proxy error');
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
