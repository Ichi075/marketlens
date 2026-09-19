# MarketLens

A Tauri 2 stock workspace for Windows, macOS, and Android. It shows two side-by-side TradingView Advanced Chart widgets, starting with SPY and QQQ on five-minute bars. The TradingView drawing toolbar is visible for horizontal lines and other annotations. Open the watchlist with the hamburger menu, enter a ticker above either chart, or tap a watchlist row to replace the selected chart.

## Standalone HTML demo

Open `demo.html` directly in a browser. It shows two TradingView widgets immediately, each starting on five-minute bars with the drawing toolbar. The watchlist, sorting, candidate badges, ticker inputs, drawer, and filter work without a build step. Sidebar prices and candidate scores are illustrative. Chart loading requires internet access, and embedded widgets may be restricted by some browser environments.

## Features

- 21 symbols from the supplied screenshots, sorted by percentage change from the previous close.
- Current quoted price, ticker, and change percentage in the sidebar.
- Strong Top 3 and Weak Top 3 badges and cards based on the supplied PBInvesting logic brief.
- Two independent TradingView charts, saved ticker choices, manual refresh, and automatic quote refresh every two minutes.
- Dark theme by default, with a saved light/dark toggle for the app and TradingView charts.
- Chart settings saved on this device: extended-hours request and VWAP and 8 EMA toggles. These defaults are reapplied when the app changes a ticker.
- A compact watchlist drawer on narrow screens.

## Run

Platform-specific commands and prerequisites are in [BUILDING.md](BUILDING.md).

Install [Rust](https://www.rust-lang.org/tools/install), the [Tauri prerequisites](https://tauri.app/start/prerequisites/), and [pnpm](https://pnpm.io/installation). Then:

```sh
pnpm install
pnpm tauri dev
```

For Android, install Android Studio, its SDK/NDK, and Java as described in the Tauri prerequisites, then run `pnpm tauri android init` once and `pnpm android`. On macOS, run the same desktop command on a Mac with Xcode Command Line Tools. Builds for each platform must be produced on a suitably configured host.

`pnpm dev` opens the UI in a browser for development. Its local Vite proxy supplies quotes. The packaged app fetches quotes from the Rust side.

## Data and ranking

TradingView supplies the chart widgets. The sidebar independently requests one-minute chart data from the public Yahoo Finance chart endpoint, including extended hours. This endpoint is unofficial and can be delayed, rate limited, or unavailable. A missing price stays blank; the app does not substitute a fabricated quote. The UI shows the market timestamp and last-session status. An internet connection is required for charts and quotes.

The MVP ranking uses QQQ as the benchmark and excludes QQQ, SPY, and IWM from candidate badges. During regular trading it scores relative return from the first regular-session bar (45%), relative five-minute return (30%), position against an approximate close-price VWAP (15%), and recent volume versus the preceding twenty bars (10%). Premarket uses the previous close, relative gap (70%), and recent relative momentum (30%). The quote and ranking may use different session prices outside regular hours. The score is an implementation estimate, not a prediction or trading signal. A challenger needs to beat the incumbent by five points for two consecutive refreshes before replacing a Top 3 member.

The PDF also discusses PMH/PML, a fuller relative-volume measure, and liquidity filters. Those require a dependable licensed intraday feed for production use; they are not claimed in this MVP. TradingView widgets are separate embedded iframes, so their internal symbol picker does not control the MarketLens sidebar.

The free embedded widget does not expose its complete layout to MarketLens. Drawings and indicator changes made inside the iframe cannot be saved or restored by this app. Full layout persistence would require TradingView Advanced Charts library access plus an independent market datafeed and storage integration.
The widget applies the 8 EMA length setting. Its free embed does not reliably honor per-indicator color overrides, so the requested yellow VWAP is currently a TradingView-side customization rather than an app-enforced default.

## Project layout

- `src/main.ts`: UI, charts, and quote refresh
- `src/market.ts`: return, VWAP, and candidate calculations
- `src-tauri/src/lib.rs`: quote transport and response normalization
- `src/style.css`: desktop and mobile layout
