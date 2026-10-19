/* PureGold analysis engine — rule-based (not an LLM). Runs in the browser and in Node (GitHub Actions).
   Data: Binance PAXGUSDT (XAU proxy) + gold-api.com XAU spot. Analysis only, no execution. */
(function (root) {
const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api1.binance.com', 'https://api3.binance.com'];
const TFS = ['5m', '15m', '1h', '4h'], TF_W = { '5m': .2, '15m': .3, '1h': .3, '4h': .2 }, TF_TH = { '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4' };
const EXPIRE_H = 24;
async function getJson(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' HTTP ' + r.status); return r.json(); }
async function binance(path) { let e; for (const h of HOSTS) { try { return await getJson(h + path); } catch (x) { e = x; } } throw e; }
async function klines(tf, limit = 400, start) {
  let q = `/api/v3/klines?symbol=PAXGUSDT&interval=${tf}&limit=${limit}`; if (start) q += `&startTime=${Math.floor(start)}`;
  return (await binance(q)).map(r => ({ t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5], tb: +r[9], ct: +r[6] }));
}
const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
function ema(a, n) { const k = 2 / (n + 1); let e = null; return a.map((x, i) => (e = e == null ? x : x * k + e * (1 - k), i >= n - 1 ? e : null)); }
function rsi(c, n = 14) { const o = Array(c.length).fill(null); let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l ? 100 - 100 / (1 + g / l) : 100; } }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l ? 100 - 100 / (1 + g / l) : 100; } } return o; }
function atr(k, n = 14) { const o = Array(k.length).fill(null); let a = null; const trs = [];
  for (let i = 0; i < k.length; i++) { const tr = i === 0 ? k[i].h - k[i].l : Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c));
    trs.push(tr); if (i === n - 1) a = trs.reduce((s, x) => s + x, 0) / n; else if (i >= n) a = (a * (n - 1) + tr) / n; o[i] = a; } return o; }
function macd(c) { const e12 = ema(c, 12), e26 = ema(c, 26); const m = e12.map((a, i) => a != null && e26[i] != null ? a - e26[i] : null);
  const vals = m.filter(x => x != null); const sv = ema(vals, 9); const sig = Array(m.length - vals.length).fill(null).concat(sv);
  return m.map((a, i) => a != null && sig[i] != null ? a - sig[i] : null); }
function boll(c, n = 20, k = 2) { const up = Array(c.length).fill(null), mid = up.slice(), lo = up.slice();
  for (let i = n - 1; i < c.length; i++) { const w = c.slice(i - n + 1, i + 1), m = w.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / n);
    up[i] = m + k * sd; mid[i] = m; lo[i] = m - k * sd; } return [up, mid, lo]; }
function median(a) { const s = a.filter(x => x).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function tfScores(k) {
  const c = k.map(x => x.c), e20 = ema(c, 20), e50 = ema(c, 50), e200 = ema(c, 200), r = rsi(c), a = atr(k), hist = macd(c), [bu, bm, bl] = boll(c);
  const keys = ['trend', 'momentum', 'macd', 'band', 'flow'], series = {}; keys.forEach(x => series[x] = []);
  for (let i = 0; i < c.length; i++) {
    if (e50[i] == null || a[i] == null || r[i] == null || hist[i] == null || bu[i] == null) { keys.forEach(x => series[x].push(null)); continue; }
    const t = clamp((e20[i] - e50[i]) / a[i] * 0.6) * 0.7 + (e200[i] ? (c[i] > e200[i] ? 0.3 : -0.3) : 0);
    let m = clamp((r[i] - 50) / 20); if (r[i] > 75 || r[i] < 25) m *= 0.4;
    const mc = clamp(hist[i] / (a[i] * 0.15)); const w = bu[i] - bl[i]; const b = w ? clamp(((c[i] - bl[i]) / w - 0.5) * 2) : 0;
    let vv = 0, tb = 0; for (let j = Math.max(0, i - 13); j <= i; j++) { vv += k[j].v; tb += k[j].tb; }
    const f = vv ? clamp((tb / vv - 0.5) * 4) : 0;
    [t, m, mc, b, f].forEach((v, j) => series[keys[j]].push(r2(v, 3)));
  }
  const L = c.length - 1;
  return { series, info: { close: c[L], ema20: e20[L], ema50: e50[L], ema200: e200[L], rsi: r[L], atr: a[L], macd_hist: hist[L], atr_ratio: a[L] / median(a.slice(-300)) } };
}
function pivots(k, w = 3) { const hi = [], lo = [];
  for (let i = w; i < k.length - w; i++) { let H = true, Lw = true; for (let j = i - w; j <= i + w; j++) { if (k[j].h > k[i].h) H = false; if (k[j].l < k[i].l) Lw = false; }
    if (H) hi.push(k[i].h); if (Lw) lo.push(k[i].l); } return [hi, lo]; }
function cluster(levels, tol) { const out = []; levels.slice().sort((a, b) => a - b).forEach(x => { const o = out[out.length - 1];
  if (o && Math.abs(x - o[0] / o[1]) <= tol) { o[0] += x; o[1]++; } else out.push([x, 1]); }); return out.map(([s, n]) => [s / n, n]); }
function marketOpen(ms) { const t = new Date(ms || Date.now()); const wd = t.getUTCDay(), h = t.getUTCHours(); // Sun=0
  if (wd === 6) return false; if (wd === 5 && h >= 21) return false; if (wd === 0 && h < 22) return false; return true; }
const fmtBkk = ms => new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const f2 = x => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sg = (x, d = 2) => (x >= 0 ? '+' : '') + Number(x).toFixed(d);

async function analyze() {
  const data = {}; await Promise.all(TFS.map(async tf => data[tf] = await klines(tf, 400)));
  const tk = await binance('/api/v3/ticker/24hr?symbol=PAXGUSDT');
  const price = data['5m'][data['5m'].length - 1].c;
  let spot = null; try { spot = +(await getJson('https://api.gold-api.com/price/XAU')).price; } catch (e) { }
  const basis = spot ? r2(spot - price) : 0;
  const per = {}, spectro = [];
  for (const tf of TFS) { per[tf] = tfScores(data[tf]); for (const key in per[tf].series) spectro.push({ name: `${key.toUpperCase()} ${TF_TH[tf]}`, values: per[tf].series[key].slice(-60) }); }
  const comb = key => TFS.reduce((s, tf) => s + TF_W[tf] * (per[tf].series[key].at(-1) || 0), 0);
  const a1h = per['1h'].info.atr; const [hi, lo] = pivots(data['1h'].slice(-200)), [hi4, lo4] = pivots(data['4h'].slice(-150));
  const lv = cluster(hi.concat(lo, hi4, lo4), a1h * 0.5);
  const res = lv.filter(x => x[0] > price).sort((a, b) => a[0] - b[0]).slice(0, 3), sup = lv.filter(x => x[0] < price).sort((a, b) => b[0] - a[0]).slice(0, 3);
  const a15 = per['15m'].info.atr; let lvl = 0;
  if (res.length && sup.length) { const dr = res[0][0] - price, ds = price - sup[0][0]; lvl = clamp((dr - ds) / (dr + ds)); }
  const rr = per['1h'].info.atr_ratio;
  const agents = [
    { key: 'trend', name: 'TREND', th: 'แนวโน้ม EMA', score: comb('trend'), w: .25 },
    { key: 'momentum', name: 'MOMENTUM', th: 'โมเมนตัม RSI', score: comb('momentum'), w: .15 },
    { key: 'macd', name: 'MACD', th: 'MACD histogram', score: comb('macd'), w: .2 },
    { key: 'band', name: 'BAND', th: 'Bollinger %B', score: comb('band'), w: .1 },
    { key: 'flow', name: 'FLOW', th: 'แรงซื้อ-ขาย (taker)', score: comb('flow'), w: .15 },
    { key: 'levels', name: 'LEVELS', th: 'แนวรับ/แนวต้าน', score: lvl, w: .15 }];
  agents.forEach(g => { g.series = per['15m'].series[g.key] ? per['15m'].series[g.key].slice(-40).filter(v => v != null) : []; g.score = r2(g.score, 3);
    g.signal = g.score > .15 ? 'BUY' : g.score < -.15 ? 'SELL' : 'WAIT'; });
  const S = agents.reduce((s, g) => s + g.score * g.w, 0);
  const gate = rr > 1.8 ? .6 : rr > 1.4 ? .85 : 1;
  const agree = agents.filter(g => (g.score > 0) === (S > 0) && Math.abs(g.score) > .15).length;
  const conf = r2(Math.min(95, Math.abs(S) * 100 * 1.6 * gate + agree * 3), 1);
  const decision = S > .22 && conf >= 45 ? 'BUY' : S < -.22 && conf >= 45 ? 'SELL' : 'WAIT';
  agents.push({ key: 'risk', name: 'RISK', th: 'ความผันผวน ATR', score: r2(1 - gate, 3), w: 0, signal: gate < .7 ? 'HIGH' : gate < 1 ? 'ELEVATED' : 'NORMAL', ratio: r2(rr), series: [] });
  const side = decision !== 'WAIT' ? decision : (S >= 0 ? 'BUY' : 'SELL'), sn = side === 'BUY' ? 1 : -1;
  let sl = 1.5 * a15; const ref = side === 'BUY' ? sup : res;
  if (ref.length && Math.abs(price - ref[0][0]) < 2.5 * a15) sl = Math.max(sl, Math.abs(price - ref[0][0]) + .3 * a15);
  sl = Math.min(sl, 3 * a15);
  const L = { side, hypothetical: decision === 'WAIT', atr15: r2(a15), sl_dist: r2(sl), entry_p: price, sl_p: price - sn * sl, tp1_p: price + sn * sl * 1.5, tp2_p: price + sn * sl * 2.5 };
  ['entry', 'sl', 'tp1', 'tp2'].forEach(k => L[k] = r2(L[k + '_p'] + basis));
  const tf = {}; for (const t of TFS) { const i = per[t].info; tf[t] = { trend: r2(per[t].series.trend.at(-1)), rsi: r2(i.rsi, 1), macd: r2(i.macd_hist, 3), atr: r2(i.atr),
    ema20: r2(i.ema20 + basis), ema50: r2(i.ema50 + basis), ema200: r2((i.ema200 || 0) + basis), bbpos: per[t].series.band.at(-1) }; }
  const an = { t: Date.now(), price, spot, basis, score: r2(S, 3), confidence: conf, decision, market_open: marketOpen(), agents, levels: L, risk_gate: gate,
    sr: { res: res.map(x => ({ p: r2(x[0] + basis), n: x[1] })), sup: sup.map(x => ({ p: r2(x[0] + basis), n: x[1] })) }, tf,
    t24: { chg: +tk.priceChangePercent, high: +tk.highPrice, low: +tk.lowPrice, vol: +tk.quoteVolume }, spectro };
  an.article = article(an); an.summary = an.article.verdict; return an;
}
const trendWord = v => v > .5 ? 'ขาขึ้นชัดเจน' : v > .15 ? 'ขาขึ้น' : v < -.5 ? 'ขาลงชัดเจน' : v < -.15 ? 'ขาลง' : 'ไซด์เวย์';
function article(an) {
  const tf = an.tf, L = an.levels, d = an.decision, secs = [];
  const p1 = Object.entries(tf).map(([k, v]) => `${TF_TH[k]}: ${trendWord(v.trend)} (score ${sg(v.trend)}) · RSI ${v.rsi.toFixed(1)} · EMA20 ${f2(v.ema20)} / EMA50 ${f2(v.ema50)}` +
    (v.ema200 > 100 ? ` · ราคา${an.price + an.basis > v.ema200 ? 'เหนือ' : 'ใต้'} EMA200 (${f2(v.ema200)})` : ''));
  const ups = Object.values(tf).filter(v => v.trend > .15).length, dns = Object.values(tf).filter(v => v.trend < -.15).length;
  p1.push('สรุป: ' + (ups === 4 || dns === 4 ? 'ทุกกรอบเวลาไปทางเดียวกัน' : `ขาขึ้น ${ups} กรอบ / ขาลง ${dns} กรอบ — สัญญาณยังไม่สอดคล้องกันทั้งหมด`));
  secs.push({ h: '1) แนวโน้มแต่ละกรอบเวลา', p: p1 });
  const sr = an.sr;
  secs.push({ h: '2) แนวรับ / แนวต้านสำคัญ (XAU spot-adjusted)', p: [
    'แนวต้าน: ' + (sr.res.map(x => `${f2(x.p)} (แตะ ${x.n} ครั้ง)`).join(', ') || 'ไม่พบในช่วงข้อมูล'),
    'แนวรับ: ' + (sr.sup.map(x => `${f2(x.p)} (แตะ ${x.n} ครั้ง)`).join(', ') || 'ไม่พบในช่วงข้อมูล'),
    'คำนวณจาก swing high/low ของกราฟ H1 และ H4 ที่จัดกลุ่มตามระยะ ATR'] });
  const m15 = tf['15m'], h1 = tf['1h'], rg = an.agents.at(-1);
  const mom = m15.macd > 0 && h1.macd > 0 ? 'แรงซื้อนำ' : m15.macd < 0 && h1.macd < 0 ? 'แรงขายนำ' : 'โมเมนตัมขัดกันระหว่าง M15 กับ H1';
  secs.push({ h: '3) โมเมนตัม & ความผันผวน', p: [`MACD histogram M15 ${sg(m15.macd, 3)}, H1 ${sg(h1.macd, 3)} → ${mom}`,
    `RSI M15 ${m15.rsi.toFixed(1)} ` + (m15.rsi > 70 ? '(overbought — ระวังการย่อตัว)' : m15.rsi < 30 ? '(oversold — ระวังการเด้งกลับ)' : '(โซนกลาง)'),
    `ATR M15 = ${m15.atr.toFixed(2)} USD, ATR H1 = ${h1.atr.toFixed(2)} USD · ความผันผวนเทียบค่าปกติ ×${rg.ratio.toFixed(2)} (${rg.signal})`] });
  const why = an.agents.filter(a => a.key !== 'risk').sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).map(a => `${a.name} (${a.th}) ${sg(a.score)} → ${a.signal}`);
  const sideTh = { BUY: 'ซื้อ (BUY)', SELL: 'ขาย (SELL)' };
  const verdict = d === 'WAIT' ? `รอ (WAIT) — คะแนนรวม ${sg(an.score)} ยังไม่ถึงเกณฑ์ ±0.22 / ความมั่นใจ ${an.confidence.toFixed(0)}%. ฝั่งที่ได้เปรียบเล็กน้อย: ${sideTh[L.side]}`
    : `${sideTh[d]} — คะแนนรวม ${sg(an.score)}, ความมั่นใจ ${an.confidence.toFixed(0)}%`;
  const lv = `${L.hypothetical ? '(สมมติ) ' : ''}${L.side} @ ${f2(L.entry)} · SL ${f2(L.sl)} (ห่าง ${L.sl_dist.toFixed(2)}) · TP1 ${f2(L.tp1)} (RR 1:1.5) · TP2 ${f2(L.tp2)} (RR 1:2.5)`;
  secs.push({ h: '4) บทสรุป & เหตุผล', p: [verdict, 'น้ำหนักจากแต่ละตัวชี้วัด: ' + why.join(' · '), 'ระดับราคา: ' + lv] });
  const risk = ['นี่คือผลวิเคราะห์จากอัลกอริทึม (rule-based) ไม่ใช่คำแนะนำการลงทุน และไม่ได้ส่งคำสั่งซื้อขายใดๆ',
    `ราคาอ้างอิงจาก PAXG/USDT (Binance) ปรับด้วยส่วนต่างกับ XAU spot (${sg(an.basis)}) — ราคา XAUUSDc บน Exness อาจต่างเล็กน้อยและมี spread`,
    'ช่วงข่าวสำคัญ (CPI, NFP, FOMC) ราคาทองอาจกระชากเกิน SL — ลดขนาดล็อตหรืองดเทรด', 'ความเสี่ยงต่อไม้ที่แนะนำ: ไม่เกิน 1–2% ของพอร์ต'];
  if (rg.signal !== 'NORMAL') risk.splice(1, 0, 'ตอนนี้ความผันผวนสูงกว่าปกติ ระบบลดความมั่นใจลงอัตโนมัติ');
  secs.push({ h: '5) ข้อควรระวัง', p: risk });
  return { title: `ทองคำ XAU/USD — แนวโน้ม ${trendWord(an.score)} | ${fmtBkk(an.t)} (UTC+7)`, verdict, sections: secs };
}
// ---- signal tracking (used by the scheduled job) ----
async function resolveSignals(sigs, priceNow) {
  const now = Date.now();
  for (const s of sigs) {
    if (s.status !== 'OPEN') continue;
    let ks; try { ks = await klines('1m', 1000, s.t); } catch (e) { continue; }
    const buy = s.side === 'BUY';
    for (const x of ks) { if (x.t < s.t - 60000) continue;
      const hitSl = buy ? x.l <= s.sl : x.h >= s.sl, hitTp = buy ? x.h >= s.tp : x.l <= s.tp;
      if (hitSl) { Object.assign(s, { status: 'SL', exit: s.sl, exit_t: x.ct }); break; }
      if (hitTp) { Object.assign(s, { status: 'TP', exit: s.tp, exit_t: x.ct }); break; } }
    // ks covers at most 1000 minutes; if older, keep scanning next pages
    if (s.status === 'OPEN' && ks.length === 1000 && now - s.t > 1000 * 60000) {
      let start = ks.at(-1).t + 60000;
      while (s.status === 'OPEN' && start < now) { const more = await klines('1m', 1000, start); if (!more.length) break;
        for (const x of more) { const hitSl = buy ? x.l <= s.sl : x.h >= s.sl, hitTp = buy ? x.h >= s.tp : x.l <= s.tp;
          if (hitSl) { Object.assign(s, { status: 'SL', exit: s.sl, exit_t: x.ct }); break; } if (hitTp) { Object.assign(s, { status: 'TP', exit: s.tp, exit_t: x.ct }); break; } }
        start = more.at(-1).t + 60000; }
    }
    if (s.status === 'OPEN' && now - s.t > EXPIRE_H * 3600e3) Object.assign(s, { status: 'EXPIRED', exit: priceNow, exit_t: now });
    if (s.status === 'OPEN') s.float = r2(buy ? priceNow - s.entry : s.entry - priceNow);
    else { s.pnl = r2(buy ? s.exit - s.entry : s.entry - s.exit); delete s.float; }
  }
}
function maybeIssue(sigs, an) {
  const d = an.decision; if (!['BUY', 'SELL'].includes(d) || !an.market_open) return null;
  const open = sigs.filter(s => s.status === 'OPEN');
  if (open.length) { const o = open.at(-1); if (o.side === d) return null;
    const p = an.price, buy = o.side === 'BUY'; Object.assign(o, { status: 'REVERSED', exit: p, exit_t: an.t, pnl: r2(buy ? p - o.entry : o.entry - p) }); delete o.float; }
  const L = an.levels; const s = { id: sigs.length + 1, t: an.t, side: d, entry: r2(an.price), sl: r2(L.sl_p), tp: r2(L.tp1_p), tp2: r2(L.tp2_p), basis: an.basis, conf: an.confidence, status: 'OPEN' };
  sigs.push(s); return s;
}
const API = { analyze, resolveSignals, maybeIssue, klines, binance, marketOpen, HOSTS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PGEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
