import test from 'node:test'
import assert from 'node:assert/strict'
import { getMarketClockState } from '../src/marketClock.ts'

test('reports premarket and counts down to the regular open', () => {
  const state = getMarketClockState(new Date('2026-09-29T12:00:00Z'))
  assert.equal(state.phase, 'premarket')
  assert.equal(state.time, '08:00:00')
  assert.equal(state.zone, 'UTC−4')
  assert.equal(state.countdown, 'Opens in 1h 30m')
})

test('reports the regular session and its closing countdown', () => {
  const state = getMarketClockState(new Date('2026-09-29T17:15:00Z'))
  assert.equal(state.phase, 'open')
  assert.equal(state.countdown, 'Closes in 2h 45m')
})

test('uses the New York daylight-saving offset', () => {
  assert.equal(getMarketClockState(new Date('2026-09-29T12:00:00Z')).zone, 'UTC−4')
  assert.equal(getMarketClockState(new Date('2026-12-01T14:00:00Z')).zone, 'UTC−5')
})

test('skips weekends and US market holidays for the next open', () => {
  const weekend = getMarketClockState(new Date('2026-10-03T16:00:00Z'))
  assert.equal(weekend.phase, 'closed')
  assert.equal(weekend.countdown, 'Next open in 45h 30m')

  const thanksgiving = getMarketClockState(new Date('2026-11-26T15:00:00Z'))
  assert.equal(thanksgiving.phase, 'closed')
  assert.equal(thanksgiving.countdown, 'Next open in 23h 30m')
})
