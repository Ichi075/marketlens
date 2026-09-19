import { invoke } from '@tauri-apps/api/core'
import { changePercent, LeaderStability, rankCandidates, WATCHLIST } from './market'
import type { Candidate, MarketData, Ranking } from './market'
import './style.css'

type Pane = 0 | 1
type ChartSettings = { version: number; extendedHours: boolean; studies: string[] }
const STUDIES = [
  { id: 'VWAP@tv-basicstudies', label: 'VWAP' },
  { id: 'MAExp@tv-basicstudies', label: '8 EMA' },
] as const
const DEFAULT_STUDIES = ['VWAP@tv-basicstudies', 'MAExp@tv-basicstudies']
const SETTINGS_KEY = 'marketlens:chart-settings'
const THEME_KEY = 'marketlens:theme'
type Theme = 'dark' | 'light'
let theme: Theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
document.documentElement.dataset.theme = theme
function loadChartSettings(): ChartSettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (saved && typeof saved === 'object') {
      const value = saved as Partial<ChartSettings>
      const savedStudies = Array.isArray(value.studies)
        ? STUDIES.map(option => option.id).filter(id => value.studies?.includes(id))
        : DEFAULT_STUDIES
      return {
        version: 2,
        extendedHours: typeof value.extendedHours === 'boolean' ? value.extendedHours : true,
        studies: value.version === 2 ? savedStudies
          : STUDIES.map(option => option.id).filter(id => [...savedStudies, 'MAExp@tv-basicstudies'].includes(id)),
      }
    }
  } catch { /* Invalid saved settings use defaults. */ }
  return { version: 2, extendedHours: true, studies: DEFAULT_STUDIES }
}
let chartSettings = loadChartSettings()
const app = document.querySelector<HTMLDivElement>('#app')!
const saved = localStorage.getItem('marketlens:tickers')
let parsed: unknown
try { parsed = saved ? JSON.parse(saved) : null } catch { parsed = null }
const validTicker = (value: string) => /^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(value)
const tickers: [string, string] = Array.isArray(parsed) && parsed.length === 2 && parsed.every(
  (value: unknown) => typeof value === 'string' && validTicker(value),
) ? [parsed[0], parsed[1]] : ['SPY', 'QQQ']
let focused: Pane = 0
let quotes = new Map<string, MarketData>()
let ranking: Ranking | null = null
let loading = false
let pendingRefresh = false
let lastFetch: Date | null = null
let fetchError = ''
let strongStability = new LeaderStability()
let weakStability = new LeaderStability()
let rankingSession = ''

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)
const logoDomains: Record<string, string> = {
  QQQ: 'invesco.com', MSFT: 'microsoft.com', AAPL: 'apple.com', META: 'meta.com', GOOGL: 'google.com',
  SPY: 'ssga.com', PLTR: 'palantir.com', IWM: 'ishares.com', SBUX: 'starbucks.com', SHOP: 'shopify.com',
  NFLX: 'netflix.com', SMCI: 'supermicro.com', ARM: 'arm.com', AMD: 'amd.com', COIN: 'coinbase.com',
  MU: 'micron.com', HOOD: 'robinhood.com', NVDA: 'nvidia.com', TSLA: 'tesla.com', AMZN: 'amazon.com',
  CRWD: 'crowdstrike.com',
}
function logoMarkup(ticker: string, className = ''): string {
  const domain = logoDomains[ticker]
  return `<span class="ticker-logo ${className}" aria-hidden="true"><span class="logo-fallback">${escapeHtml(ticker.slice(0, 1))}</span>${domain
    ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : ''}</span>`
}
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && event.target.closest('.ticker-logo')) event.target.remove()
}, true)
const percent = (value: number | null, signed = true) => value == null ? '—'
  : `${signed && value > 0 ? '+' : ''}${value.toFixed(2)}%`
const price = (item?: MarketData) => item?.price == null ? '—'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price)
const timeEt = (timestamp: number) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  hour12: false,
}).format(new Date(timestamp * 1000)) + ' ET'

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark"><span></span><span></span><span></span></div><div><strong>MarketLens</strong><small>Your market workspace</small></div></div>
      <div class="side-head"><div><span class="eyebrow">Live monitor</span><h1>Watchlist</h1></div><button id="close-sidebar" class="icon-button" aria-label="Close watchlist">✕</button></div>
      <div class="market-status" id="market-status"><span class="status-dot"></span><span>Loading market data…</span></div>
      <div id="candidate-sections"></div>
      <div class="list-title"><div><span class="eyebrow">Tracking</span><h2>All symbols <span>${WATCHLIST.length}</span></h2></div><span class="sort-label">Change % ↓</span></div>
      <div id="watchlist" class="watchlist" aria-live="polite"></div>
      <div class="side-footer">Quotes: Yahoo Finance chart endpoint<br>Charts: TradingView · Data may be delayed</div>
    </aside>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <main class="workspace">
      <header class="topbar"><div class="topbar-left"><button id="open-sidebar" class="icon-button" aria-label="Open watchlist" aria-expanded="false" aria-controls="sidebar">☰</button><div><span class="eyebrow">Dual chart workspace</span><h2>MarketLens</h2></div></div><div class="topbar-right"><span id="updated-at">Waiting for quotes</span><button id="theme-toggle" class="refresh-button" type="button" aria-pressed="false"><span class="theme-icon" aria-hidden="true"></span><span class="theme-label"></span></button><button id="chart-settings-button" class="refresh-button" type="button">⚙ <span>Chart settings</span></button><button id="refresh" class="refresh-button" type="button" aria-label="Refresh quotes"><span class="refresh-icon">↻</span><span>Refresh</span></button></div></header>
      <div class="charts">
        ${[0, 1].map(index => `<section class="chart-panel" id="pane-${index}" aria-label="Chart ${index + 1}"><div class="chart-header"><div class="chart-identity">${logoMarkup(tickers[index], 'chart-number')}<div><span class="eyebrow">${index === 0 ? 'Left chart' : 'Right chart'}</span><div class="chart-heading"><strong id="title-${index}"></strong><span id="change-${index}" class="chart-change"></span></div></div></div><form class="symbol-form" data-pane="${index}"><label class="sr-only" for="ticker-${index}">Ticker for chart ${index + 1}</label><span class="search-glyph">⌕</span><input id="ticker-${index}" name="ticker" autocomplete="off" spellcheck="false" maxlength="15" placeholder="Ticker" value="${tickers[index]}" /><button type="submit">Show ↗</button></form></div><div class="chart-body" id="chart-${index}"></div></section>`).join('')}
      </div>
    </main>
    <dialog id="chart-settings-dialog" class="chart-settings-dialog" aria-labelledby="chart-settings-title">
      <form id="chart-settings-form" method="dialog">
        <div class="settings-head"><div><span class="eyebrow">TradingView defaults</span><h2 id="chart-settings-title">Chart settings</h2></div><button type="button" id="close-chart-settings" class="icon-button" aria-label="Close chart settings">✕</button></div>
        <label class="settings-option"><input type="checkbox" name="extendedHours"><span><strong>Extended hours</strong><small>Request premarket and after-hours bars when available.</small></span></label>
        <div class="settings-label">Indicators to add to each new chart</div>
        ${STUDIES.map(option => `<label class="settings-option"><input type="checkbox" name="study" value="${option.id}"><span><strong>${option.label}</strong>${option.id === 'MAExp@tv-basicstudies' ? '<small><i class="study-swatch ema"></i>Blue · length 8</small>' : ''}</span></label>`).join('')}
        <p class="settings-note">These defaults are reapplied when you switch tickers. Drawings and changes made inside TradingView cannot be saved here.</p>
        <div class="settings-actions"><button type="submit" class="settings-save">Save defaults</button></div>
      </form>
    </dialog>
  </div>`

function tradingViewSymbol(ticker: string): string {
  const exchanges: Record<string, string> = {
    SPY: 'AMEX', QQQ: 'NASDAQ', IWM: 'AMEX',
    MSFT: 'NASDAQ', AAPL: 'NASDAQ', META: 'NASDAQ', GOOGL: 'NASDAQ',
    PLTR: 'NASDAQ', SBUX: 'NASDAQ', SHOP: 'NASDAQ', NFLX: 'NASDAQ',
    SMCI: 'NASDAQ', ARM: 'NASDAQ', AMD: 'NASDAQ', COIN: 'NASDAQ',
    MU: 'NASDAQ', HOOD: 'NASDAQ', NVDA: 'NASDAQ', TSLA: 'NASDAQ',
    AMZN: 'NASDAQ', CRWD: 'NASDAQ',
  }
  return `${exchanges[ticker] ? exchanges[ticker] + ':' : ''}${ticker}`
}

function mountChart(pane: Pane) {
  const ticker = tickers[pane]
  const host = document.querySelector<HTMLDivElement>(`#chart-${pane}`)!
  host.replaceChildren()
  const widget = document.createElement('div')
  widget.className = 'tradingview-widget-container'
  const inner = document.createElement('div')
  inner.className = 'tradingview-widget-container__widget'
  const attribution = document.createElement('div')
  attribution.className = 'tradingview-widget-copyright'
  const link = document.createElement('a')
  link.href = `https://www.tradingview.com/symbols/${encodeURIComponent(ticker)}/`
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = `Open ${ticker} on TradingView ↗`
  attribution.append(link)
  widget.append(inner, attribution)
  host.append(widget)
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.async = true
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
  script.textContent = JSON.stringify({
    autosize: true, symbol: tradingViewSymbol(ticker), interval: '5', timezone: 'exchange',
    theme, style: '1', locale: 'en', backgroundColor: theme === 'dark' ? '#171D27' : '#FFFFFF',
    gridColor: theme === 'dark' ? 'rgba(160,180,205,0.07)' : 'rgba(30,42,64,0.055)', hide_side_toolbar: false, hide_top_toolbar: false,
    allow_symbol_change: true, withdateranges: false, save_image: false,
    extended_hours: chartSettings.extendedHours,
    studies: chartSettings.studies.map(id => id === 'VWAP@tv-basicstudies'
      ? { id }
      : id === 'MAExp@tv-basicstudies'
      ? { id, inputs: { length: 8 }, styles: { plot: { color: '#3488F6', linewidth: 2 } } }
      : id),
    calendar: false, support_host: 'https://www.tradingview.com',
  })
  widget.append(script)
  document.querySelector<HTMLElement>(`#pane-${pane} .chart-number`)!.outerHTML = logoMarkup(ticker, 'chart-number')
  document.querySelector<HTMLElement>(`#title-${pane}`)!.textContent = ticker
  document.querySelector<HTMLInputElement>(`#ticker-${pane}`)!.value = ticker
  updateChartQuote(pane)
}

function updateChartQuote(pane: Pane) {
  const item = quotes.get(tickers[pane])
  const value = changePercent(item ?? { price: null, previousClose: null } as MarketData)
  const node = document.querySelector<HTMLElement>(`#change-${pane}`)!
  node.className = `chart-change ${value == null ? '' : value >= 0 ? 'positive' : 'negative'}`
  node.textContent = item?.price == null ? 'Quote unavailable' : `${price(item)}  ${percent(value)}`
}

function candidateCard(candidate: Candidate, kind: 'strong' | 'weak', rank: number): string {
  const item = quotes.get(candidate.symbol)
  const reason = `${candidate.symbol}: score ${candidate.score.toFixed(1)}, QQQ relative ${percent(candidate.relativePerformance)}, 5 min ${percent(candidate.momentum)}, VWAP ${candidate.aboveVwap == null ? 'unavailable' : candidate.aboveVwap ? 'above' : 'below'}`
  return `<button class="candidate-card ${kind}" data-symbol="${candidate.symbol}" type="button" title="${escapeHtml(reason)}"><span class="candidate-mark">${logoMarkup(candidate.symbol)}<span class="rank">0${rank}</span></span><span class="candidate-name">${candidate.symbol}<small>${kind === 'strong' ? 'Relative strength' : 'Relative weakness'}</small></span><span class="candidate-values"><strong>${percent(item ? changePercent(item) : null)}</strong><small>Score ${candidate.score.toFixed(1)}</small></span></button>`
}

function renderCandidates() {
  const host = document.querySelector<HTMLElement>('#candidate-sections')!
  const sections = [
    { kind: 'strong' as const, title: 'Strong', items: ranking?.strong ?? [] },
    { kind: 'weak' as const, title: 'Weak', items: ranking?.weak ?? [] },
  ]
  host.innerHTML = sections.map(section => `<section class="candidate-section"><div class="section-title"><div><span class="eyebrow">Top 3 candidates</span><h2><span class="section-spark ${section.kind}">●</span>${section.title}</h2></div><span class="section-count">${section.items.length}/3</span></div><div class="candidate-list">${section.items.length
    ? section.items.map((item, index) => candidateCard(item, section.kind, index + 1)).join('')
    : `<div class="empty-candidates">${loading ? 'Calculating candidates…' : 'Waiting for intraday data'}</div>`}</div></section>`).join('')
}

function renderWatchlist() {
  const sorted = [...WATCHLIST].sort((a, b) => {
    const left = changePercent(quotes.get(a) ?? { price: null, previousClose: null } as MarketData)
    const right = changePercent(quotes.get(b) ?? { price: null, previousClose: null } as MarketData)
    return left == null ? 1 : right == null ? -1 : right - left
  })
  const strong = new Set(ranking?.strong.map(item => item.symbol) ?? [])
  const weak = new Set(ranking?.weak.map(item => item.symbol) ?? [])
  document.querySelector<HTMLElement>('#watchlist')!.innerHTML = sorted.map(symbol => {
    const item = quotes.get(symbol)
    const change = item ? changePercent(item) : null
    const tone = change == null ? 'muted' : change >= 0 ? 'positive' : 'negative'
    const badge = strong.has(symbol) ? '<span class="row-badge strong">S</span>'
      : weak.has(symbol) ? '<span class="row-badge weak">W</span>' : ''
    return `<button class="stock-row ${tickers.includes(symbol) ? 'on-chart' : ''}" data-symbol="${symbol}" type="button" title="Show ${symbol} in selected chart"><span class="stock-symbol">${logoMarkup(symbol, 'symbol-dot')}<strong>${symbol}</strong>${badge}</span><span class="stock-values"><strong>${price(item)}</strong><small class="${tone}">${percent(change)}</small></span></button>`
  }).join('')
}

function renderStatus() {
  const count = [...quotes.values()].filter(item => item.price != null).length
  const status = document.querySelector<HTMLElement>('#market-status')!
  status.className = `market-status ${fetchError || count === 0 ? 'status-error' : ''}`
  status.innerHTML = `<span class="status-dot"></span><span>${escapeHtml(loading ? 'Updating quotes…'
    : fetchError ? fetchError : count ? `${ranking?.stage ?? 'Quotes'} · ${count}/${WATCHLIST.length} symbols` : 'Quotes unavailable')}</span>`
  document.querySelector<HTMLElement>('#updated-at')!.textContent = ranking?.updatedAt
    ? `Market as of ${timeEt(ranking.updatedAt)}`
    : lastFetch
    ? `Checked ${lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : 'Waiting for quotes'
  document.querySelector<HTMLButtonElement>('#refresh')!.disabled = loading
}

function setSidebarOpen(open: boolean) {
  document.querySelector('.shell')?.classList.toggle('sidebar-open', open)
  document.querySelector<HTMLButtonElement>('#open-sidebar')!.setAttribute('aria-expanded', String(open))
  document.querySelector<HTMLElement>('#sidebar')!.inert = !open
  if (open) document.querySelector<HTMLButtonElement>('#close-sidebar')?.focus()
  else document.querySelector<HTMLButtonElement>('#open-sidebar')?.focus()
}

function setTicker(pane: Pane, raw: string) {
  const ticker = raw.trim().toUpperCase()
  if (!validTicker(ticker)) {
    const input = document.querySelector<HTMLInputElement>(`#ticker-${pane}`)!
    input.setCustomValidity('Use a ticker with letters, numbers, dots, or hyphens.')
    input.reportValidity()
    return
  }
  document.querySelector<HTMLInputElement>(`#ticker-${pane}`)!.setCustomValidity('')
  focused = pane
  tickers[pane] = ticker
  localStorage.setItem('marketlens:tickers', JSON.stringify(tickers))
  mountChart(pane)
  renderWatchlist()
  if (document.querySelector('.shell')?.classList.contains('sidebar-open')) setSidebarOpen(false)
  if (!quotes.has(ticker)) {
    if (loading) pendingRefresh = true
    else void refreshQuotes()
  }
}

async function fetchMarketData(symbols: string[]): Promise<MarketData[]> {
  if ('__TAURI_INTERNALS__' in window) return invoke<MarketData[]>('get_market_data', { symbols })
  if (import.meta.env.DEV) {
    const result = await Promise.all(symbols.map(async symbol => {
      try {
        const response = await fetch(`/api/chart/${symbol}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const chart = payload.chart?.result?.[0]
        if (!chart) throw new Error('No chart data')
        const timestamps: number[] = chart.timestamp ?? []
        const closes: (number | null)[] = chart.indicators?.quote?.[0]?.close ?? []
        const volumes: (number | null)[] = chart.indicators?.quote?.[0]?.volume ?? []
        const bars = timestamps.flatMap((timestamp, index) => closes[index] == null ? []
          : [{ timestamp, close: closes[index]!, volume: volumes[index] ?? 0 }])
        return { symbol, price: bars.at(-1)?.close ?? chart.meta?.regularMarketPrice ?? null,
          previousClose: chart.meta?.chartPreviousClose ?? chart.meta?.previousClose ?? null,
          currency: chart.meta?.currency ?? 'USD', bars, error: null } as MarketData
      } catch {
        return { symbol, price: null, previousClose: null, currency: null, bars: [],
          error: 'Quote unavailable' } as MarketData
      }
    }))
    return result
  }
  throw new Error('Run MarketLens as a Tauri app to load quotes')
}

async function refreshQuotes() {
  if (loading) return
  loading = true
  fetchError = ''
  renderStatus()
  const symbols = [...new Set([...WATCHLIST, ...tickers])]
  try {
    const result = await fetchMarketData(symbols)
    quotes = new Map(result.map(item => [item.symbol, item]))
    const failed = result.filter(item => item.price == null).length
    if (failed === result.length) fetchError = 'Quote service unavailable · Retry'
    ranking = rankCandidates(result)
    const session = ranking.updatedAt == null ? '' : new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ranking.updatedAt * 1000))
    if (session !== rankingSession) {
      rankingSession = session
      strongStability = new LeaderStability()
      weakStability = new LeaderStability()
    }
    if (ranking.strong.length) ranking.strong = strongStability.update(ranking.strong, ranking.allStrong)
    if (ranking.weak.length) ranking.weak = weakStability.update(ranking.weak, ranking.allWeak)
    lastFetch = new Date()
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Could not load quotes'
  } finally {
    loading = false
    renderStatus()
    renderCandidates()
    renderWatchlist()
    updateChartQuote(0)
    updateChartQuote(1)
    if (pendingRefresh) {
      pendingRefresh = false
      queueMicrotask(() => void refreshQuotes())
    }
  }
}

document.querySelectorAll<HTMLFormElement>('.symbol-form').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault()
    const pane = Number(form.dataset.pane) as Pane
    setTicker(pane, (form.elements.namedItem('ticker') as HTMLInputElement).value)
  })
  form.querySelector('input')?.addEventListener('focus', () => { focused = Number(form.dataset.pane) as Pane })
})
document.querySelector('#sidebar')?.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-symbol]')
  if (button?.dataset.symbol) setTicker(focused, button.dataset.symbol)
})
document.querySelector('#refresh')?.addEventListener('click', () => void refreshQuotes())
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!
function updateThemeToggle() {
  const light = theme === 'light'
  themeToggle.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode')
  themeToggle.setAttribute('aria-pressed', String(light))
  themeToggle.querySelector<HTMLElement>('.theme-icon')!.textContent = light ? '☾' : '☀'
  themeToggle.querySelector<HTMLElement>('.theme-label')!.textContent = light ? 'Dark mode' : 'Light mode'
}
updateThemeToggle()
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark'
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.dataset.theme = theme
  updateThemeToggle()
  mountChart(0)
  mountChart(1)
})
const settingsDialog = document.querySelector<HTMLDialogElement>('#chart-settings-dialog')!
const settingsForm = document.querySelector<HTMLFormElement>('#chart-settings-form')!
document.querySelector('#chart-settings-button')?.addEventListener('click', () => {
  (settingsForm.elements.namedItem('extendedHours') as HTMLInputElement).checked = chartSettings.extendedHours
  settingsForm.querySelectorAll<HTMLInputElement>('input[name="study"]').forEach(input => {
    input.checked = chartSettings.studies.includes(input.value)
  })
  settingsDialog.showModal()
})
document.querySelector('#close-chart-settings')?.addEventListener('click', () => settingsDialog.close())
settingsForm.addEventListener('submit', event => {
  event.preventDefault()
  const next: ChartSettings = {
    version: 2,
    extendedHours: (settingsForm.elements.namedItem('extendedHours') as HTMLInputElement).checked,
    studies: [...settingsForm.querySelectorAll<HTMLInputElement>('input[name="study"]:checked')].map(input => input.value),
  }
  if (JSON.stringify(next) !== JSON.stringify(chartSettings)) {
    chartSettings = next
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    mountChart(0)
    mountChart(1)
  }
  settingsDialog.close()
})
document.querySelector('#open-sidebar')?.addEventListener('click', () => setSidebarOpen(true))
document.querySelector('#close-sidebar')?.addEventListener('click', () => setSidebarOpen(false))
document.querySelector('#sidebar-backdrop')?.addEventListener('click', () => setSidebarOpen(false))
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('.shell')?.classList.contains('sidebar-open')) {
    setSidebarOpen(false)
  }
})
document.querySelectorAll<HTMLElement>('.chart-panel').forEach((panel, index) => {
  panel.addEventListener('pointerdown', () => { focused = index as Pane })
})

mountChart(0)
mountChart(1)
document.querySelector<HTMLElement>('#sidebar')!.inert = true
renderCandidates()
renderWatchlist()
void refreshQuotes()
window.setInterval(() => void refreshQuotes(), 120_000)
