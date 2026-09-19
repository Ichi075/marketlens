![MarketLens workspace with SPY and QQQ charts](assets/marketlens-workspace.png)

# MarketLens

**English** | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

MarketLens is a Tauri 2 stock watch app for Windows, macOS, and Android. It displays two TradingView charts side by side, with SPY and QQQ and five-minute candles as the defaults. The drawing toolbar supports horizontal lines and other annotations. Open the watchlist with the hamburger menu, then change either chart by entering a ticker above it or selecting a symbol from the list.

## HTML demo

Open [demo.html](demo.html) in a browser to explore the interface without a build. You can try watchlist sorting, candidate cards, ticker inputs, the watchlist drawer, and theme switching. Prices and candidate scores in the demo are illustrative. TradingView charts require an internet connection and may be restricted by some browser environments.

## Features

- The 21 symbols in the supplied screenshots, sorted by percentage change from the previous close.
- Ticker, current price, and percentage change in the watchlist.
- Three strong and three weak candidates based on the supplied PBInvesting logic brief.
- Two independent TradingView charts, saved ticker choices, manual refresh, and automatic quote refresh every two minutes.
- Dark theme by default, with a saved light/dark preference.
- Chart settings for extended hours, VWAP, and 8 EMA, reapplied when a ticker changes.

## Run locally

Install [Rust](https://www.rust-lang.org/tools/install), the [Tauri prerequisites](https://tauri.app/start/prerequisites/), and [pnpm](https://pnpm.io/installation). Then run these commands from the project root:

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

Platform-specific prerequisites, build commands, and output locations are documented in the [build guide](BUILDING.md). `pnpm dev` opens the frontend in a browser. In development, a Vite proxy fetches quotes; the packaged Tauri app fetches them through Rust.

## Quotes and candidate ranking

TradingView supplies the embedded charts. The sidebar separately requests one-minute data, including extended hours, from the public Yahoo Finance chart endpoint. This endpoint is unofficial; quotes may be delayed, rate limited, or unavailable. When a price cannot be fetched, the app shows it as unavailable rather than substituting a fabricated value. Quotes and candidate calculations may use different session prices outside regular trading hours.

The provisional candidate score uses QQQ as a benchmark and excludes QQQ, SPY, and IWM from candidate rankings. During regular trading it combines relative return from the session's first bar (45%), relative five-minute return (30%), position against an approximate close-price VWAP (15%), and recent volume compared with the preceding 20 bars (10%). In premarket it uses the previous close, relative gap (70%), and recent relative momentum (30%). A challenger must exceed an incumbent's score by at least five points on two consecutive refreshes before replacing it. These are implementation estimates, not price predictions or trading signals.

PMH/PML, a more rigorous relative-volume measure, and liquidity filters from the brief are not implemented in this MVP. Production use would require a dependable intraday data provider.

## TradingView widget limitations

The free embedded widget does not expose its complete layout to MarketLens. Drawings and indicator changes made inside TradingView cannot be saved or restored by this app. Switching themes or tickers reloads a chart, so those changes are lost. Full layout persistence would require access to the TradingView Advanced Charts library, plus a separate datafeed and storage integration.

The 8 EMA length setting is applied, but the free widget does not reliably honor per-indicator color overrides. MarketLens therefore cannot guarantee a yellow VWAP by default. TradingView's internal symbol picker also does not control the MarketLens sidebar.

## Project layout

- `src/main.ts`: UI, charts, and quote refresh
- `src/market.ts`: percentage change, VWAP, and candidate scoring
- `src-tauri/src/lib.rs`: quote retrieval and normalization
- `src/style.css`: desktop and mobile layout
- `demo.html`: standalone HTML demo
- `BUILDING.md`: platform-specific build guide
