import { marketConfig } from './config.ts'
import type { MarketLensConfig } from './config.ts'
import type { Bar, Candidate, MarketData } from './market.ts'

export type Direction = 'CALL' | 'PUT'
export type SetupState = 'SCANNING' | 'CANDIDATE' | 'BREAKOUT_DETECTED' |
  'BREAKOUT_CONFIRMED' | 'RETEST_WAIT' | 'RETEST_DETECTED' | 'SETUP_READY' |
  'INVALIDATED' | 'EXPIRED' | 'DATA_STALE'
export type LevelType = 'PMH' | 'PML' | 'PDH' | 'PDL' | 'VWAP'
export type MarketLevels = { pmh: number | null; pml: number | null; pdh: number | null; pdl: number | null; vwap: number | null }
export type SetupEvent = { timestamp: number; state: SetupState; message: string }
export type Setup = {
  id: string; symbol: string; direction: Direction; state: SetupState
  levelType: LevelType; levelPrice: number; detectedAt: number; updatedAt: number
  breakoutAt?: number; confirmedAt?: number; retestAt?: number; readyAt?: number
  strengthScore: number; relativePerformance: number; momentum: number; volumeRatio: number | null
  vwap: number | null; reasons: string[]; invalidationReason?: string
  candidateRank: number; candidateLastSeenAt: number; events: SetupEvent[]; resumeState?: SetupState
}
export type MarketContext = {
  now: number; currentBar: Bar | null; completedFiveMinuteBars: Bar[]
  latestBarTimestamp: number | null; candidateActive: boolean; regularSession: boolean
  vwap: number | null
}

export function newYorkParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp * 1000))
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0)
  return { date: `${value('year')}-${String(value('month')).padStart(2, '0')}-${String(value('day')).padStart(2, '0')}`,
    minute: value('hour') * 60 + value('minute') }
}

export function aggregateToFiveMinuteBars(bars: Bar[], now = Date.now() / 1000): Bar[] {
  const groups = new Map<string, Bar[]>()
  for (const bar of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
    const et = newYorkParts(bar.timestamp)
    const key = `${et.date}:${Math.floor(et.minute / 5) * 5}`
    const group = groups.get(key) ?? []
    group.push(bar)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap(group => {
    const first = group[0]
    const bucketStart = first.timestamp - (newYorkParts(first.timestamp).minute % 5) * 60 - (first.timestamp % 60)
    if (bucketStart + 300 > now) return []
    return [{ timestamp: bucketStart, open: first.open,
      high: Math.max(...group.map(bar => bar.high)), low: Math.min(...group.map(bar => bar.low)),
      close: group.at(-1)!.close, volume: group.reduce((sum, bar) => sum + bar.volume, 0) }]
  })
}

export function typicalPriceVwap(bars: Bar[]): number | null {
  const usable = bars.filter(bar => bar.volume > 0)
  const volume = usable.reduce((sum, bar) => sum + bar.volume, 0)
  return volume > 0 ? usable.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * bar.volume, 0) / volume : null
}

export function calculateMarketLevels(data: MarketData, referenceTimestamp = data.bars.at(-1)?.timestamp): MarketLevels {
  if (!referenceTimestamp) return { pmh: null, pml: null, pdh: null, pdl: null, vwap: null }
  const currentDate = newYorkParts(referenceTimestamp).date
  const currentPremarket = data.bars.filter(bar => {
    const et = newYorkParts(bar.timestamp)
    return et.date === currentDate && et.minute >= 240 && et.minute < 570
  })
  const currentRegular = data.bars.filter(bar => {
    const et = newYorkParts(bar.timestamp)
    return et.date === currentDate && et.minute >= 570 && et.minute < 960
  })
  const previousDates = [...new Set(data.bars.map(bar => newYorkParts(bar.timestamp).date))]
    .filter(date => date < currentDate).sort().reverse()
  const previousDate = previousDates.find(date => data.bars.some(bar => {
    const et = newYorkParts(bar.timestamp)
    return et.date === date && et.minute >= 570 && et.minute < 960
  }))
  const previousRegular = previousDate ? data.bars.filter(bar => {
    const et = newYorkParts(bar.timestamp)
    return et.date === previousDate && et.minute >= 570 && et.minute < 960
  }) : []
  return {
    pmh: currentPremarket.length ? Math.max(...currentPremarket.map(bar => bar.high)) : null,
    pml: currentPremarket.length ? Math.min(...currentPremarket.map(bar => bar.low)) : null,
    pdh: previousRegular.length ? Math.max(...previousRegular.map(bar => bar.high)) : null,
    pdl: previousRegular.length ? Math.min(...previousRegular.map(bar => bar.low)) : null,
    vwap: typicalPriceVwap(currentRegular),
  }
}

function selectLevel(direction: Direction, levels: MarketLevels): { type: LevelType; price: number } | null {
  const choices: [LevelType, number | null][] = direction === 'CALL'
    ? [['PMH', levels.pmh], ['PDH', levels.pdh], ['VWAP', levels.vwap]]
    : [['PML', levels.pml], ['PDL', levels.pdl], ['VWAP', levels.vwap]]
  const selected = choices.find(([, price]) => price != null)
  return selected?.[1] == null ? null : { type: selected[0], price: selected[1] }
}

export function createSetup(candidate: Candidate, direction: Direction, rank: number,
  levels: MarketLevels, now: number): Setup | null {
  const level = selectLevel(direction, levels)
  if (!level) return null
  return {
    id: `${candidate.symbol}:${direction}:${level.type}:${newYorkParts(now).date}`,
    symbol: candidate.symbol, direction, state: 'CANDIDATE', levelType: level.type,
    levelPrice: level.price, detectedAt: now, updatedAt: now, strengthScore: candidate.score,
    relativePerformance: candidate.relativePerformance, momentum: candidate.momentum,
    volumeRatio: candidate.volumeRatio, vwap: levels.vwap, candidateRank: rank,
    candidateLastSeenAt: now, reasons: [`${direction === 'CALL' ? 'Strong' : 'Weak'} #${rank}`],
    events: [{ timestamp: now, state: 'CANDIDATE', message: 'Candidate detected' }],
  }
}

const transition = (setup: Setup, state: SetupState, now: number, message: string,
  extra: Partial<Setup> = {}): Setup => ({ ...setup, ...extra, state, updatedAt: now,
    events: [...setup.events, { timestamp: now, state, message }] })

export function advanceSetupState(setup: Setup, context: MarketContext,
  config: MarketLensConfig = marketConfig): Setup {
  if (['SETUP_READY', 'INVALIDATED', 'EXPIRED'].includes(setup.state)) return setup
  const latest = context.currentBar
  if (!latest || context.latestBarTimestamp == null) return setup
  if (context.regularSession && context.now - context.latestBarTimestamp > config.staleThresholdSeconds) {
    return setup.state === 'DATA_STALE' ? setup : transition(setup, 'DATA_STALE', context.now,
      'Market data is stale', { resumeState: setup.state })
  }
  if (setup.state === 'DATA_STALE') {
    return transition(setup, setup.resumeState ?? 'CANDIDATE', context.now, 'Market data resumed', { resumeState: undefined })
  }
  if (!context.regularSession) return setup
  const candidateLastSeenAt = context.candidateActive ? context.now : setup.candidateLastSeenAt
  const current = { ...setup, candidateLastSeenAt, vwap: context.vwap }
  if (!context.candidateActive && context.now - candidateLastSeenAt > config.candidateGraceMinutes * 60) {
    return transition(current, 'INVALIDATED', context.now, 'Candidate left the monitored leaders',
      { invalidationReason: 'Candidate ranking expired' })
  }
  if (setup.breakoutAt && context.now - setup.breakoutAt > config.setupExpirationMinutes * 60) {
    return transition(current, 'EXPIRED', context.now, 'Retest window expired', { invalidationReason: 'Setup expired' })
  }
  const call = setup.direction === 'CALL'
  const invalidLevel = call
    ? latest.close < setup.levelPrice * (1 - config.invalidationTolerance)
    : latest.close > setup.levelPrice * (1 + config.invalidationTolerance)
  const requiresVwap = call ? config.requireVwapForCall : config.requireVwapForPut
  const invalidVwap = requiresVwap && context.vwap != null && (call ? latest.close < context.vwap * (1 - config.invalidationTolerance) : latest.close > context.vwap * (1 + config.invalidationTolerance))
  if (setup.breakoutAt && (invalidLevel || invalidVwap)) {
    return transition(current, 'INVALIDATED', context.now, invalidLevel ? 'Important level failed' : 'VWAP filter failed',
      { invalidationReason: invalidLevel ? 'Level invalidated' : 'VWAP invalidated' })
  }
  if (setup.state === 'CANDIDATE') {
    const crossed = call ? latest.high > setup.levelPrice : latest.low < setup.levelPrice
    return crossed ? transition(current, 'BREAKOUT_DETECTED', context.now,
      `${setup.levelType} ${call ? 'breakout' : 'breakdown'} detected`, { breakoutAt: context.now }) : current
  }
  if (setup.state === 'BREAKOUT_DETECTED') {
    const five = context.completedFiveMinuteBars.at(-1)
    const confirmed = !!five && five.timestamp + 300 > (setup.breakoutAt ?? 0) &&
      (call ? five.close > setup.levelPrice : five.close < setup.levelPrice)
    const vwapHeld = !!five && (!requiresVwap || context.vwap == null || (call ? five.close > context.vwap : five.close < context.vwap))
    return confirmed && vwapHeld ? transition(current, 'BREAKOUT_CONFIRMED', context.now,
      `5m ${call ? 'breakout' : 'breakdown'} confirmed`, { confirmedAt: five!.timestamp + 300 }) : current
  }
  if (setup.state === 'BREAKOUT_CONFIRMED') {
    return transition(current, 'RETEST_WAIT', context.now, 'Waiting for retest')
  }
  if (setup.state === 'RETEST_WAIT') {
    const afterConfirmation = latest.timestamp >= (setup.confirmedAt ?? 0)
    const touched = afterConfirmation && (call ? latest.low <= setup.levelPrice * (1 + config.retestTolerance)
      : latest.high >= setup.levelPrice * (1 - config.retestTolerance)
    )
    const held = call ? latest.close >= setup.levelPrice : latest.close <= setup.levelPrice
    return touched && held ? transition(current, 'RETEST_DETECTED', context.now, 'Retest detected',
      { retestAt: latest.timestamp }) : current
  }
  if (setup.state === 'RETEST_DETECTED') {
    const reactionBar = latest.timestamp > (setup.retestAt ?? 0)
    const reaction = reactionBar && (call ? latest.close >= setup.levelPrice && latest.close > latest.open
      : latest.close <= setup.levelPrice && latest.close < latest.open
    )
    const vwapHeld = !requiresVwap || context.vwap == null || (call ? latest.close > context.vwap : latest.close < context.vwap)
    return reaction && vwapHeld ? transition(current, 'SETUP_READY', context.now, 'Retest held · Setup ready',
      { readyAt: context.now, reasons: [...current.reasons, '5m breakout confirmed', 'Retest confirmed', ...(requiresVwap ? ['VWAP held'] : [])] }) : current
  }
  return current
}

export function setupContext(data: MarketData, now: number, candidateActive: boolean): MarketContext {
  const levels = calculateMarketLevels(data)
  const et = newYorkParts(now)
  return { now, currentBar: data.bars.at(-1) ?? null,
    completedFiveMinuteBars: aggregateToFiveMinuteBars(data.bars, now),
    latestBarTimestamp: data.bars.at(-1)?.timestamp ?? null, candidateActive,
    regularSession: et.minute >= 570 && et.minute < 960, vwap: levels.vwap }
}

export function claimReadyNotification(setup: Setup, notifiedIds: Set<string>): boolean {
  if (setup.state !== 'SETUP_READY' || notifiedIds.has(setup.id)) return false
  notifiedIds.add(setup.id)
  return true
}
