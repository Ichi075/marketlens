import test from 'node:test'
import assert from 'node:assert/strict'
import { marketConfig } from '../src/config.ts'
import { advanceSetupState, aggregateToFiveMinuteBars, calculateMarketLevels,
  claimReadyNotification, createSetup, newYorkParts, typicalPriceVwap } from '../src/setup.ts'

const minute = (timestamp, open, high = open, low = open, close = open, volume = 100) =>
  ({ timestamp, open, high, low, close, volume })
const regular = Date.UTC(2026, 8, 17, 13, 30) / 1000
const previous = Date.UTC(2026, 8, 16, 13, 30) / 1000
const premarket = Date.UTC(2026, 8, 17, 12, 0) / 1000
const data = bars => ({ symbol: 'NVDA', price: bars.at(-1)?.close ?? null,
  previousClose: 188, currency: 'USD', bars, error: null })

test('1m bars aggregate into completed 5m OHLCV bars only', () => {
  const bars = [
    minute(regular, 100, 102, 99, 101, 10), minute(regular + 60, 101, 104, 100, 103, 20),
    minute(regular + 240, 103, 105, 98, 104, 30), minute(regular + 300, 104, 106, 103, 105, 40),
  ]
  const result = aggregateToFiveMinuteBars(bars, regular + 360)
  assert.deepEqual(result, [{ timestamp: regular, open: 100, high: 105, low: 98, close: 104, volume: 60 }])
})

const levelBars = [
  minute(previous, 185, 191, 184, 190), minute(previous + 60, 190, 193, 183, 186),
  minute(premarket, 188, 190.2, 187.5, 189), minute(premarket + 60, 189, 189.5, 186.8, 188),
  minute(regular, 189, 190, 188.5, 189.5, 100), minute(regular + 60, 189.5, 191, 189, 190.5, 300),
]
const levels = calculateMarketLevels(data(levelBars), regular + 60)
test('PMH uses current premarket highs', () => assert.equal(levels.pmh, 190.2))
test('PML uses current premarket lows', () => assert.equal(levels.pml, 186.8))
test('PDH uses previous regular-session highs', () => assert.equal(levels.pdh, 193))
test('PDL uses previous regular-session lows', () => assert.equal(levels.pdl, 183))
test('VWAP uses typical price and volume', () => {
  assert.equal(levels.vwap, typicalPriceVwap(levelBars.slice(-2)))
  assert.ok(Math.abs(levels.vwap - 189.95833333333331) < 1e-9)
})

const candidate = { symbol: 'NVDA', score: 88.2, relativePerformance: 2.1,
  momentum: 0.7, aboveVwap: true, volumeRatio: 1.7 }
const baseLevels = { pmh: 190.2, pml: 186.8, pdh: 193, pdl: 183, vwap: 189.9 }
const context = (now, bar, five = [], active = true) => ({ now, currentBar: bar,
  completedFiveMinuteBars: five, latestBarTimestamp: bar.timestamp, candidateActive: active,
  regularSession: true, vwap: 189.9 })

test('CALL advances through breakout, 5m confirmation, retest, and ready', () => {
  let setup = createSetup(candidate, 'CALL', 1, baseLevels, regular)
  assert.ok(setup)
  setup = advanceSetupState(setup, context(regular + 60, minute(regular + 60, 190.1, 190.35, 190, 190.3)))
  assert.equal(setup.state, 'BREAKOUT_DETECTED')
  const five = minute(regular, 189.8, 190.7, 189.7, 190.48, 500)
  setup = advanceSetupState(setup, context(regular + 300, minute(regular + 300, 190.4), [five]))
  assert.equal(setup.state, 'BREAKOUT_CONFIRMED')
  setup = advanceSetupState(setup, context(regular + 320, minute(regular + 300, 190.4), [five]))
  assert.equal(setup.state, 'RETEST_WAIT')
  const retest = minute(regular + 360, 190.22, 190.45, 190.18, 190.41)
  setup = advanceSetupState(setup, context(regular + 380, retest, [five]))
  assert.equal(setup.state, 'RETEST_DETECTED')
  const reaction = minute(regular + 420, 190.3, 190.55, 190.25, 190.5)
  setup = advanceSetupState(setup, context(regular + 440, reaction, [five]))
  assert.equal(setup.state, 'SETUP_READY')
  assert.equal(setup.events.at(-1).message, 'Retest held · Setup ready')
})

test('CALL breakout is detected above PMH', () => {
  const setup = createSetup(candidate, 'CALL', 1, baseLevels, regular)
  const next = advanceSetupState(setup, context(regular + 60, minute(regular + 60, 190, 190.3, 189.9, 190.25)))
  assert.equal(next.state, 'BREAKOUT_DETECTED')
})

test('CALL confirmation ignores a five-minute candle completed before breakout', () => {
  const setup = { ...createSetup(candidate, 'CALL', 1, baseLevels, regular),
    state: 'BREAKOUT_DETECTED', breakoutAt: regular + 301 }
  const oldFive = minute(regular, 189, 191, 188, 190.5, 500)
  const next = advanceSetupState(setup, context(regular + 320, minute(regular + 300, 190.4), [oldFive]))
  assert.equal(next.state, 'BREAKOUT_DETECTED')
})

test('CALL retest is detected when the level is touched and held', () => {
  const setup = { ...createSetup(candidate, 'CALL', 1, baseLevels, regular),
    state: 'RETEST_WAIT', breakoutAt: regular, confirmedAt: regular + 300 }
  const bar = minute(regular + 360, 190.1, 190.4, 190.18, 190.3)
  assert.equal(advanceSetupState(setup, context(regular + 380, bar)).state, 'RETEST_DETECTED')
})

test('PUT breakdown is detected below PML', () => {
  const setup = createSetup(candidate, 'PUT', 1, baseLevels, regular)
  const bar = minute(regular + 60, 187, 187.1, 186.6, 186.7)
  assert.equal(advanceSetupState(setup, context(regular + 80, bar)).state, 'BREAKOUT_DETECTED')
})

test('PUT advances through breakdown and retest', () => {
  let setup = createSetup({ ...candidate, symbol: 'TSLA', aboveVwap: false }, 'PUT', 1, baseLevels, regular)
  setup = advanceSetupState(setup, context(regular + 60, minute(regular + 60, 187, 187.1, 186.6, 186.7)))
  assert.equal(setup.state, 'BREAKOUT_DETECTED')
  const five = minute(regular, 187.5, 188, 186.1, 186.5, 500)
  const putContext = (now, bar) => ({ ...context(now, bar, [five]), vwap: 187.2 })
  setup = advanceSetupState(setup, putContext(regular + 300, minute(regular + 300, 186.5)))
  assert.equal(setup.state, 'BREAKOUT_CONFIRMED')
  setup = advanceSetupState(setup, putContext(regular + 320, minute(regular + 300, 186.5)))
  assert.equal(setup.state, 'RETEST_WAIT')
  const retest = minute(regular + 360, 186.9, 186.95, 186.5, 186.6)
  setup = advanceSetupState(setup, putContext(regular + 380, retest))
  assert.equal(setup.state, 'RETEST_DETECTED')
  const reaction = minute(regular + 420, 186.7, 186.8, 186.3, 186.4)
  setup = advanceSetupState(setup, putContext(regular + 440, reaction))
  assert.equal(setup.state, 'SETUP_READY')
})

test('a failed level invalidates a detected setup', () => {
  let setup = createSetup(candidate, 'CALL', 1, baseLevels, regular)
  setup = advanceSetupState(setup, context(regular + 60, minute(regular + 60, 190, 190.4, 190, 190.3)))
  setup = advanceSetupState(setup, context(regular + 120, minute(regular + 120, 189.4, 189.5, 189.3, 189.4)))
  assert.equal(setup.state, 'INVALIDATED')
})

test('a setup expires after its configured retest window', () => {
  let setup = createSetup(candidate, 'CALL', 1, baseLevels, regular)
  setup = advanceSetupState(setup, context(regular + 60, minute(regular + 60, 190, 190.4, 190, 190.3)))
  const now = regular + marketConfig.setupExpirationMinutes * 60 + 61
  setup = advanceSetupState(setup, context(now, minute(now, 190.3)))
  assert.equal(setup.state, 'EXPIRED')
})

test('ready notification can be claimed only once', () => {
  const setup = { ...createSetup(candidate, 'CALL', 1, baseLevels, regular), state: 'SETUP_READY' }
  const ids = new Set()
  assert.equal(claimReadyNotification(setup, ids), true)
  assert.equal(claimReadyNotification(setup, ids), false)
})

test('stale regular-session data blocks setup progress', () => {
  const setup = createSetup(candidate, 'CALL', 1, baseLevels, regular)
  const bar = minute(regular, 190, 191, 189, 190.5)
  const result = advanceSetupState(setup, { ...context(regular + 181, bar), latestBarTimestamp: regular })
  assert.equal(result.state, 'DATA_STALE')
})

test('New York session boundaries remain correct across DST', () => {
  const beforeDst = Date.UTC(2026, 2, 6, 14, 30) / 1000
  const afterDst = Date.UTC(2026, 2, 9, 13, 30) / 1000
  assert.equal(newYorkParts(beforeDst).minute, 570)
  assert.equal(newYorkParts(afterDst).minute, 570)
  assert.equal(aggregateToFiveMinuteBars([minute(afterDst, 100)], afterDst + 300)[0].timestamp, afterDst)
})
