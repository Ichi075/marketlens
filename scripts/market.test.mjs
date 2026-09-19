import test from 'node:test'
import assert from 'node:assert/strict'
import { changePercent, LeaderStability, rankCandidates } from '../src/market.ts'

const start = Date.UTC(2026, 8, 17, 13, 30) / 1000
const quote = (symbol, values, previousClose = 100) => ({
  symbol, previousClose, price: values.at(-1), currency: 'USD', error: null,
  bars: values.map((close, index) => ({ timestamp: start + index * 60, close, volume: 1000 })),
})

test('change percentage is measured against previous close', () => {
  assert.equal(changePercent(quote('AAPL', [101, 102])), 2.0000000000000018)
  assert.equal(changePercent({ ...quote('AAPL', [101]), previousClose: null }), null)
})

test('strong and weak candidates rank against QQQ', () => {
  const flat = Array.from({ length: 7 }, () => 100)
  const rising = [100, 100, 100, 100, 100, 101, 102]
  const falling = [100, 100, 100, 100, 100, 99, 98]
  const result = rankCandidates([
    quote('QQQ', flat), quote('AAPL', rising), quote('AMD', falling),
    quote('NVDA', flat), quote('SPY', rising),
  ])
  assert.equal(result.strong[0].symbol, 'AAPL')
  assert.equal(result.weak[0].symbol, 'AMD')
  assert.ok(!result.allStrong.some(item => item.symbol === 'SPY'))
  assert.ok(result.strong[0].relativePerformance > 0)
  assert.ok(result.weak[0].relativePerformance < 0)
})

test('leader changes only after two qualifying refreshes', () => {
  const stability = new LeaderStability()
  const candidate = (symbol, score) => ({ symbol, score, relativePerformance: 0,
    momentum: 0, aboveVwap: null, volumeRatio: null })
  const initial = [candidate('A', 80), candidate('B', 70), candidate('C', 60)]
  assert.deepEqual(stability.update(initial, initial).map(item => item.symbol), ['A', 'B', 'C'])
  const next = [candidate('A', 80), candidate('B', 70), candidate('D', 66), candidate('C', 60)]
  assert.deepEqual(stability.update(next.slice(0, 3), next).map(item => item.symbol), ['A', 'B', 'C'])
  assert.deepEqual(stability.update(next.slice(0, 3), next).map(item => item.symbol), ['A', 'B', 'D'])
})
