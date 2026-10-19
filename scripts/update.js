// Scheduled job: run engine, resolve open signals on real 1m candles, log new signals, write data/*.json
const fs = require('fs'), path = require('path');
const E = require('../engine.js');
const D = path.join(__dirname, '..', 'data');
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { return d; } };
(async () => {
  const an = await E.analyze();
  const sigs = load('signals.json', []);
  await E.resolveSignals(sigs, an.price);
  const n = E.maybeIssue(sigs, an);
  const hist = load('history.json', []); hist.push({ t: an.t, d: an.decision, c: an.confidence, s: an.score, p: Math.round((an.price + an.basis) * 100) / 100 });
  fs.writeFileSync(path.join(D, 'signals.json'), JSON.stringify(sigs, null, 1));
  fs.writeFileSync(path.join(D, 'history.json'), JSON.stringify(hist.slice(-500)));
  fs.writeFileSync(path.join(D, 'analysis.json'), JSON.stringify(an));
  fs.writeFileSync(path.join(D, 'meta.json'), JSON.stringify({ updated: an.t, decision: an.decision, confidence: an.confidence, new_signal: n ? n.id : null }));
  console.log(new Date(an.t).toISOString(), an.decision, an.confidence, 'price', an.price, 'spot', an.spot, 'signals', sigs.length, n ? 'NEW #' + n.id : '');
})().catch(e => { console.error(e); process.exit(1); });
