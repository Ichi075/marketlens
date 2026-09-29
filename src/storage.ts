import type { Direction, LevelType, Setup } from './setup.ts'

export type PaperTrade = { symbol: string; direction: Direction; setupReadyAt: number; entryPrice: number
  levelType: LevelType; levelPrice: number; strengthScore: number; relativePerformance: number
  momentum: number; volumeRatio: number | null }
const SETUPS_KEY = 'marketlens:setups:v1'
const PAPER_KEY = 'marketlens:paper-trades:v1'

const read = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}
export const loadSetups = () => read<Setup[]>(SETUPS_KEY, [])
export const saveSetups = (setups: Setup[]) => localStorage.setItem(SETUPS_KEY, JSON.stringify(setups.slice(-40)))
export const loadPaperTrades = () => read<PaperTrade[]>(PAPER_KEY, [])
export function recordPaperTrade(setup: Setup, entryPrice: number) {
  const trades = loadPaperTrades()
  if (trades.some(trade => trade.symbol === setup.symbol && trade.setupReadyAt === setup.readyAt)) return
  trades.push({ symbol: setup.symbol, direction: setup.direction, setupReadyAt: setup.readyAt!, entryPrice,
    levelType: setup.levelType, levelPrice: setup.levelPrice, strengthScore: setup.strengthScore,
    relativePerformance: setup.relativePerformance, momentum: setup.momentum, volumeRatio: setup.volumeRatio })
  localStorage.setItem(PAPER_KEY, JSON.stringify(trades.slice(-200)))
}
