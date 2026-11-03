# PureGold — XAU/USD AI Analysis Desk

Static dashboard for gold (XAU/USD), styled for Exness **XAUUSDc** (Standard Cent) traders.

- Live data: Binance **PAXGUSDT** (1 PAXG = 1 oz gold, used as XAU proxy) + gold-api.com XAU spot. Prices may differ slightly from Exness XAUUSDc.
- Analysis: rule-based engine (`engine.js`: EMA, RSI, MACD, Bollinger, ATR, taker flow, S/R on M5/M15/H1/H4). **Not an LLM, not financial advice, no order execution.**
- Signal track record: `scripts/update.js` runs the same engine on a schedule, logs BUY/SELL signals and resolves them against real 1m candles into `data/signals.json`.
- Cent-lot calculator: 1.00 lot XAUUSDc = 1 oz, $1 move = 1 USD = 100 USC per lot, min 0.01, step 0.01.

## Enabling the scheduler
The workflow lives in `ci/update-signals.yml`. Move it to `.github/workflows/update-signals.yml` (needs a token with the `workflow` scope, or do it in the GitHub web UI).

---

## 💚 Support PureFxAi / สนับสนุน PureFxAi (USDT)

**Network: Ethereum (ERC20) only / เครือข่าย Ethereum (ERC20) เท่านั้น**

```
0x920deab53daf94ca2030ad5ceec2265bf5686941
```

⚠️ Send **only USDT via ERC20**. Other networks or tokens may be lost permanently.
ส่งเฉพาะ **USDT ผ่าน ERC20** เท่านั้น เครือข่ายหรือเหรียญอื่นอาจสูญหายถาวร

Donations are voluntary support — **not an investment**, with no returns or rewards.
การบริจาคเป็นการสนับสนุนโดยสมัครใจ **ไม่ใช่การลงทุน** และไม่มีผลตอบแทนใด ๆ

Donation page with QR: https://purefxaidev.github.io/driftwatch-video/
