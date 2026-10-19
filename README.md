# PureGold — XAU/USD AI Analysis Desk

Static dashboard for gold (XAU/USD), styled for Exness **XAUUSDc** (Standard Cent) traders.

- Live data: Binance **PAXGUSDT** (1 PAXG = 1 oz gold, used as XAU proxy) + gold-api.com XAU spot. Prices may differ slightly from Exness XAUUSDc.
- Analysis: rule-based engine (`engine.js`: EMA, RSI, MACD, Bollinger, ATR, taker flow, S/R on M5/M15/H1/H4). **Not an LLM, not financial advice, no order execution.**
- Signal track record: `scripts/update.js` runs the same engine on a schedule, logs BUY/SELL signals and resolves them against real 1m candles into `data/signals.json`.
- Cent-lot calculator: 1.00 lot XAUUSDc = 1 oz, $1 move = 1 USD = 100 USC per lot, min 0.01, step 0.01.

## Enabling the scheduler
The workflow lives in `ci/update-signals.yml`. Move it to `.github/workflows/update-signals.yml` (needs a token with the `workflow` scope, or do it in the GitHub web UI).
