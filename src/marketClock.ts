export type MarketPhase = 'premarket' | 'open' | 'after-hours' | 'closed'

export type MarketClockState = {
  date: string
  time: string
  zone: string
  phase: MarketPhase
  phaseLabel: string
  countdown: string
  targetTimestamp: number
}

type NewYorkParts = {
  year: number
  month: number
  day: number
  weekday: string
  hour: number
  minute: number
  second: number
}

const zone = 'America/New_York'
function partsAt(date: Date): NewYorkParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return {
    year: Number(value('year')), month: Number(value('month')), day: Number(value('day')),
    weekday: value('weekday'), hour: Number(value('hour')), minute: Number(value('minute')),
    second: Number(value('second')),
  }
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function calendarDate(year: number, month: number, day: number, offset = 0) {
  const date = new Date(Date.UTC(year, month - 1, day + offset))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay() }
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return 1 + ((weekday - first + 7) % 7) + (occurrence - 1) * 7
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0))
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)
}

function observedDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay()
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1)
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1)
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function marketHolidays(year: number): Set<string> {
  const holidays = new Set<string>([
    observedDate(year, 1, 1),
    observedDate(year + 1, 1, 1),
    dateKey(year, 1, nthWeekday(year, 1, 1, 3)),
    dateKey(year, 2, nthWeekday(year, 2, 1, 3)),
    dateKey(year, 5, lastWeekday(year, 5, 1)),
    observedDate(year, 6, 19),
    observedDate(year, 7, 4),
    dateKey(year, 9, nthWeekday(year, 9, 1, 1)),
    dateKey(year, 11, nthWeekday(year, 11, 4, 4)),
    observedDate(year, 12, 25),
  ])
  const goodFriday = easterSunday(year)
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2)
  holidays.add(dateKey(goodFriday.getUTCFullYear(), goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()))
  return holidays
}

function isTradingDay(year: number, month: number, day: number): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday !== 0 && weekday !== 6 && !marketHolidays(year).has(dateKey(year, month, day))
}

function zonedTimestamp(year: number, month: number, day: number, hour: number, minute: number): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const represented = partsAt(new Date(guess))
  const representedUtc = Date.UTC(represented.year, represented.month - 1, represented.day, represented.hour, represented.minute)
  return guess + (guess - representedUtc)
}

function nextOpen(parts: NewYorkParts): number {
  if (isTradingDay(parts.year, parts.month, parts.day) && parts.hour * 60 + parts.minute < 570) {
    return zonedTimestamp(parts.year, parts.month, parts.day, 9, 30)
  }
  for (let offset = 1; offset <= 10; offset += 1) {
    const next = calendarDate(parts.year, parts.month, parts.day, offset)
    if (isTradingDay(next.year, next.month, next.day)) return zonedTimestamp(next.year, next.month, next.day, 9, 30)
  }
  return zonedTimestamp(parts.year, parts.month, parts.day + 1, 9, 30)
}

function durationLabel(milliseconds: number, prefix: string): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${prefix} ${hours}h ${minutes}m`
}

function zoneLabel(date: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? 'GMT-4'
  return name.replace('GMT', 'UTC').replace('-', '−')
}

export function getMarketClockState(date = new Date()): MarketClockState {
  const parts = partsAt(date)
  const minute = parts.hour * 60 + parts.minute
  const tradingDay = isTradingDay(parts.year, parts.month, parts.day)
  let phase: MarketPhase = 'closed'
  let phaseLabel = 'Market closed'
  let target = nextOpen(parts)
  let countdownPrefix = 'Next open in'

  if (tradingDay && minute >= 240 && minute < 570) {
    phase = 'premarket'
    phaseLabel = 'Premarket'
    target = zonedTimestamp(parts.year, parts.month, parts.day, 9, 30)
    countdownPrefix = 'Opens in'
  } else if (tradingDay && minute >= 570 && minute < 960) {
    phase = 'open'
    phaseLabel = 'Market open'
    target = zonedTimestamp(parts.year, parts.month, parts.day, 16, 0)
    countdownPrefix = 'Closes in'
  } else if (tradingDay && minute >= 960 && minute < 1200) {
    phase = 'after-hours'
    phaseLabel = 'After hours'
  }

  const displayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', month: 'short', day: 'numeric',
  }).format(date)
  const displayTime = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`
  return {
    date: displayDate, time: displayTime, zone: zoneLabel(date), phase, phaseLabel,
    countdown: durationLabel(target - date.getTime(), countdownPrefix), targetTimestamp: target,
  }
}
