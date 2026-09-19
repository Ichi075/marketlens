export const WATCHLIST = [
  'QQQ', 'MSFT', 'AAPL', 'META', 'GOOGL', 'SPY', 'PLTR', 'IWM', 'SBUX', 'SHOP',
  'NFLX', 'SMCI', 'ARM', 'AMD', 'COIN', 'MU', 'HOOD', 'NVDA', 'TSLA', 'AMZN', 'CRWD',
] as const

export type Bar = { timestamp: number; close: number; volume: number }
export type MarketData = {
  symbol: string
  price: number | null
  previousClose: number | null
  currency: string | null
  bars: Bar[]
  error: string | null
}
export type Candidate = {
  symbol: string
  score: number
  relativePerformance: number
  momentum: number
  aboveVwap: boolean | null
  volumeRatio: number | null
}
export type Ranking = {
  strong: Candidate[]
  weak: Candidate[]
  allStrong: Candidate[]
  allWeak: Candidate[]
  stage: 'Premarket' | 'Regular session' | 'Last session' | 'Unavailable'
  updatedAt: number | null
}

export const changePercent = (item: MarketData): number | null =>
  item.price != null && item.previousClose != null && item.previousClose > 0
    ? (item.price / item.previousClose - 1) * 100
    : null

const etParts = (timestamp: number) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp * 1000))
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0)
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minute: value('hour') * 60 + value('minute'),
  }
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))
const pct = (latest: number, base: number) => (latest / base - 1) * 100

function sessionBars(data: MarketData, date: string, regular: boolean): Bar[] {
  return data.bars.filter(bar => {
    const et = etParts(bar.timestamp)
    return et.date === date && (regular ? et.minute >= 570 && et.minute < 960 : et.minute < 570)
  })
}

function atOrBefore(bars: Bar[], timestamp: number): Bar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].timestamp <= timestamp) return bars[i]
  }
  return undefined
}

function vwap(bars: Bar[]): number | null {
  const volume = bars.reduce((sum, bar) => sum + bar.volume, 0)
  return volume > 0 ? bars.reduce((sum, bar) => sum + bar.close * bar.volume, 0) / volume : null
}

function volumeRatio(bars: Bar[]): number | null {
  if (bars.length < 25) return null
  const recent = bars.slice(-5).reduce((sum, bar) => sum + bar.volume, 0)
  const baseline = bars.slice(-25, -5).reduce((sum, bar) => sum + bar.volume, 0) / 4
  return baseline > 0 ? recent / baseline : null
}

export function rankCandidates(items: MarketData[]): Ranking {
  const benchmark = items.find(item => item.symbol === 'QQQ')
  const latest = benchmark?.bars.at(-1)
  if (!benchmark?.previousClose || !latest) {
    return { strong: [], weak: [], allStrong: [], allWeak: [], stage: 'Unavailable', updatedAt: null }
  }

  const et = etParts(latest.timestamp)
  const now = etParts(Date.now() / 1000)
  const regular = et.minute >= 570
  const stage = et.date !== now.date || now.minute >= 960
    ? 'Last session' : !regular ? 'Premarket' : 'Regular session'
  const benchBars = sessionBars(benchmark, et.date, regular)
  const benchLast = benchBars.at(-1)
  if (!benchLast) return { strong: [], weak: [], allStrong: [], allWeak: [], stage: 'Unavailable', updatedAt: latest.timestamp }

  const eligible = items.filter(item =>
    !['QQQ', 'SPY', 'IWM'].includes(item.symbol) && item.previousClose && item.bars.length,
  )
  const features = eligible.flatMap(item => {
    const bars = sessionBars(item, et.date, regular)
    const stockLast = atOrBefore(bars, benchLast.timestamp)
    if (!stockLast || !item.previousClose) return []
    const stockStart = regular ? bars[0]?.close : item.previousClose
    const benchStart = regular ? benchBars[0]?.close : benchmark.previousClose
    if (!stockStart || !benchStart) return []

    const relativePerformance = pct(stockLast.close, stockStart) - pct(benchLast.close, benchStart)
    const stockFive = atOrBefore(bars, stockLast.timestamp - 300)
    const benchFive = atOrBefore(benchBars, benchLast.timestamp - 300)
    const momentum = stockFive && benchFive
      ? pct(stockLast.close, stockFive.close) - pct(benchLast.close, benchFive.close)
      : 0
    const average = regular ? vwap(bars.filter(bar => bar.timestamp <= stockLast.timestamp)) : null
    const ratio = regular ? volumeRatio(bars.filter(bar => bar.timestamp <= stockLast.timestamp)) : null
    const aboveVwap = average == null ? null : stockLast.close >= average
    const relativeScore = clamp(50 + relativePerformance * 12)
    const momentumScore = clamp(50 + momentum * 25)
    const volumeScore = ratio == null ? 50 : clamp(50 + (ratio - 1) * 20)
    const vwapStrong = aboveVwap == null ? 50 : aboveVwap ? 100 : 0
    const vwapWeak = aboveVwap == null ? 50 : aboveVwap ? 0 : 100
    const strongScore = regular
      ? 0.45 * relativeScore + 0.30 * momentumScore + 0.15 * vwapStrong + 0.10 * volumeScore
      : 0.7 * relativeScore + 0.3 * momentumScore
    const weakScore = regular
      ? 0.45 * (100 - relativeScore) + 0.30 * (100 - momentumScore) + 0.15 * vwapWeak + 0.10 * volumeScore
      : 0.7 * (100 - relativeScore) + 0.3 * (100 - momentumScore)
    return [{ symbol: item.symbol, relativePerformance, momentum, aboveVwap, volumeRatio: ratio,
      strongScore, weakScore }]
  })
  const makeCandidate = (feature: typeof features[number], kind: 'strong' | 'weak'): Candidate => ({
    symbol: feature.symbol,
    score: Math.round(feature[kind === 'strong' ? 'strongScore' : 'weakScore'] * 10) / 10,
    relativePerformance: feature.relativePerformance,
    momentum: feature.momentum,
    aboveVwap: feature.aboveVwap,
    volumeRatio: feature.volumeRatio,
  })
  const allStrong = [...features].sort((a, b) => b.strongScore - a.strongScore)
    .map(feature => makeCandidate(feature, 'strong'))
  const allWeak = [...features].sort((a, b) => b.weakScore - a.weakScore)
    .map(feature => makeCandidate(feature, 'weak'))
  return { strong: allStrong.slice(0, 3), weak: allWeak.slice(0, 3), allStrong, allWeak, stage, updatedAt: benchLast.timestamp }
}

export class LeaderStability {
  private previous: Candidate[] = []
  private streaks = new Map<string, number>()

  update(next: Candidate[], all: Candidate[]): Candidate[] {
    if (!this.previous.length) {
      this.previous = next
      return next
    }
    const available = new Map(all.map(item => [item.symbol, item]))
    const leaders = this.previous.map(item => available.get(item.symbol)).filter((item): item is Candidate => !!item)
    for (const challenger of next) {
      if (leaders.some(item => item.symbol === challenger.symbol)) continue
      const weakest = [...leaders].sort((a, b) => a.score - b.score)[0]
      if (!weakest || leaders.length < 3) {
        leaders.push(challenger)
        continue
      }
      const streak = challenger.score >= weakest.score + 5
        ? (this.streaks.get(challenger.symbol) ?? 0) + 1 : 0
      this.streaks.set(challenger.symbol, streak)
      if (streak >= 2) {
        leaders.splice(leaders.indexOf(weakest), 1, challenger)
        this.streaks.delete(challenger.symbol)
      }
    }
    this.previous = leaders.sort((a, b) => b.score - a.score).slice(0, 3)
    return this.previous
  }
}
