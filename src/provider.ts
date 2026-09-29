import { invoke } from '@tauri-apps/api/core'
import type { Bar, MarketData } from './market.ts'

export interface MarketDataProvider { fetch(symbols: string[], range?: '1d' | '5d'): Promise<MarketData[]> }

export class YahooFinanceProvider implements MarketDataProvider {
  async fetch(symbols: string[], range: '1d' | '5d' = '1d'): Promise<MarketData[]> {
    if ('__TAURI_INTERNALS__' in window) return invoke<MarketData[]>('get_market_data', { symbols, range })
    if (!import.meta.env.DEV) throw new Error('Run MarketLens as a Tauri app to load quotes')
    return Promise.all(symbols.map(async symbol => {
      try {
        const response = await fetch(`/api/chart/${symbol}?range=${range}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const chart = (await response.json()).chart?.result?.[0]
        if (!chart) throw new Error('No chart data')
        const quote = chart.indicators?.quote?.[0] ?? {}
        const timestamps: number[] = chart.timestamp ?? []
        const bars = timestamps.flatMap((timestamp, index): Bar[] => {
          const values = [quote.open?.[index], quote.high?.[index], quote.low?.[index], quote.close?.[index]]
          if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return []
          return [{ timestamp, open: values[0]!, high: values[1]!, low: values[2]!, close: values[3]!,
            volume: Math.max(0, Number(quote.volume?.[index]) || 0) }]
        })
        return { symbol, price: bars.at(-1)?.close ?? chart.meta?.regularMarketPrice ?? null,
          previousClose: chart.meta?.chartPreviousClose ?? chart.meta?.previousClose ?? null,
          currency: chart.meta?.currency ?? 'USD', bars, error: null } as MarketData
      } catch {
        return { symbol, price: null, previousClose: null, currency: null, bars: [], error: 'Quote unavailable' }
      }
    }))
  }
}

export function mergeMarketData(previous: MarketData | undefined, next: MarketData): MarketData {
  if (!previous || !next.bars.length) return next.bars.length ? next : previous ?? next
  const bars = new Map(previous.bars.map(bar => [bar.timestamp, bar]))
  next.bars.forEach(bar => bars.set(bar.timestamp, bar))
  return { ...next, bars: [...bars.values()].sort((a, b) => a.timestamp - b.timestamp) }
}
