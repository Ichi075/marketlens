![MarketLens workspace with SPY and QQQ charts](assets/marketlens-workspace.png)

# MarketLens

**English** | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

MarketLens is a Tauri 2 stock watch app for Windows, macOS, and Android. It displays two TradingView charts side by side, with SPY and QQQ and five-minute candles as the defaults. The drawing toolbar supports horizontal lines and other annotations. Open the watchlist with the hamburger menu, then change either chart by entering a ticker above it or selecting a symbol from the list.

## HTML demo

Open [demo.html](demo.html) in a browser to explore the interface without a build. You can try watchlist sorting, candidate cards, illustrative Active Setups and timelines, ticker inputs, the watchlist drawer, and theme switching. Prices, candidate scores, and setup states in the demo are illustrative. TradingView charts require an internet connection and may be restricted by some browser environments.

## Features

- The 21 symbols in the supplied screenshots, sorted by percentage change from the previous close.
- Ticker, current price, and percentage change in the watchlist.
- Three strong and three weak candidates based on the supplied PB Investing logic brief.
- Automatic CALL/PUT setup monitoring through level break, completed five-minute confirmation, retest, and reaction.
- Active Setup cards with a state timeline, one-time OS notification at `SETUP_READY`, and a local Paper Mode entry record.
- Two independent TradingView charts, saved ticker choices, manual refresh, and tiered quote refresh.
- Mobile charts use a compact top/bottom layout; Android uses immersive full screen with transient system bars.
- Dark theme by default, with a saved light/dark preference.
- Chart settings for extended hours, VWAP, and 8 EMA, reapplied when a ticker changes.

## Run locally

Install [Rust](https://www.rust-lang.org/tools/install), the [Tauri prerequisites](https://tauri.app/start/prerequisites/), and [pnpm](https://pnpm.io/installation). Then run these commands from the project root:

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

Platform-specific prerequisites, build commands, output locations, and the Docker-only Android workflow are documented in the [build guide](BUILDING.md). `pnpm dev` opens the frontend in a browser. In development, a Vite proxy fetches quotes; the packaged Tauri app fetches them through Rust.

## Setup monitoring

The existing Strong/Weak ranking remains the first filter. During the regular session, Strong Top 3 symbols become CALL candidates and Weak Top 3 symbols become PUT candidates. MarketLens calculates PMH/PML from 04:00–09:30 ET, PDH/PDL from the previous regular session, and regular-session VWAP from OHLC typical price and volume. Missing OHLC bars are discarded rather than reconstructed from close prices.

The state machine is `CANDIDATE → BREAKOUT_DETECTED → BREAKOUT_CONFIRMED → RETEST_WAIT → RETEST_DETECTED → SETUP_READY`. CALL setups prefer PMH, then PDH and VWAP; PUT setups prefer PML, then PDL and VWAP. Confirmation uses only a completed five-minute candle after the initial break. A retest must hold the level, and a later one-minute candle must react in the setup direction. Stale data blocks new ready notifications. `INVALIDATED`, `EXPIRED`, and `DATA_STALE` states explain why monitoring stopped or paused.

The supplied PB Investing material provides the qualitative workflow: relative strength or weakness, important levels, a completed five-minute break, and a retest. The score weights, tolerances, VWAP filters, candidate replacement rule, stale-data threshold, and expiration period are MarketLens rules used to make that workflow deterministic and testable. `SETUP READY` means the configured conditions matched; it is not a buy or sell instruction.

Default MarketLens rules are configured in `src/config.ts`: full-watchlist refresh every 90 seconds, active-symbol refresh every 20 seconds, 0.15% retest tolerance, 0.30% invalidation tolerance, a 45-minute setup window, a 10-minute candidate grace period, and a 180-second stale-data threshold. VWAP confirmation is enabled for CALL and PUT setups. Ranking uses 45% relative performance, 30% relative five-minute momentum, 15% VWAP position, and 10% relative volume during the regular session; premarket uses 70% relative performance and 30% momentum. Candidate replacement requires a five-point lead on two consecutive ranking updates.

## Quotes and candidate ranking

TradingView supplies the embedded charts. The sidebar separately requests one-minute data, including extended hours, from the public Yahoo Finance chart endpoint. This endpoint is unofficial; quotes may be delayed, rate limited, or unavailable. When a price cannot be fetched, the app shows it as unavailable rather than substituting a fabricated value. Quotes and candidate calculations may use different session prices outside regular trading hours.

The provisional candidate score uses QQQ as a benchmark and excludes QQQ, SPY, and IWM from candidate rankings. All numerical weights and ranking thresholds are MarketLens implementation choices, not values published by PB Investing.

The app loads five days once at startup to establish previous-session levels. It then refreshes the full watchlist with one day of data every 90 seconds and active candidates, setups, SPY, QQQ, and displayed tickers every 20 seconds. `MarketDataProvider` isolates this source-specific code so a future Polygon, Alpaca, or Finnhub provider can replace `YahooFinanceProvider` without changing the ranking or setup state machine. Yahoo Finance's chart endpoint is unofficial and does not guarantee real-time delivery, completeness, or availability. Production alerts require a dependable licensed market-data provider.

MarketLens VWAP uses `(high + low + close) / 3 × volume` over the regular session. TradingView can apply its own session and data rules, so the value shown by its embedded VWAP may differ slightly.

## TradingView widget limitations

The free embedded widget does not expose its complete layout to MarketLens. Drawings and indicator changes made inside TradingView cannot be saved or restored by this app. Switching themes or tickers reloads a chart, so those changes are lost. Full layout persistence would require access to the TradingView Advanced Charts library, plus a separate datafeed and storage integration.

The 8 EMA length setting is applied, but the free widget does not reliably honor per-indicator color overrides. MarketLens therefore cannot guarantee a yellow VWAP by default. TradingView's internal symbol picker also does not control the MarketLens sidebar.

## Project layout

- `src/main.ts`: UI integration, charts, and two-tier refresh scheduling
- `src/market.ts`: percentage change and candidate scoring
- `src/setup.ts`: market levels, five-minute aggregation, and the pure setup state machine
- `src/config.ts`: MarketLens ranking and setup thresholds
- `src/provider.ts`: replaceable market-data provider and Yahoo Finance implementation
- `src/notifications.ts`: permission-aware, deduplicated Tauri notifications
- `src/storage.ts`: persisted setup history and Paper Mode entries
- `src-tauri/src/lib.rs`: quote retrieval and normalization
- `src/style.css`: desktop and mobile layout
- `demo.html`: standalone HTML demo
- `BUILDING.md`: platform-specific build guide
- `Dockerfile.android` and `scripts/build-android-docker.sh`: reproducible Android build environment
