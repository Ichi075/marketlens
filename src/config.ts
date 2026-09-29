export const marketConfig = {
  benchmark: 'QQQ',
  fullWatchlistRefreshMs: 90_000,
  activeSetupRefreshMs: 20_000,
  retestTolerance: 0.0015,
  invalidationTolerance: 0.003,
  setupExpirationMinutes: 45,
  candidateGraceMinutes: 10,
  staleThresholdSeconds: 180,
  requireVwapForCall: true,
  requireVwapForPut: true,
  candidateReplacementMargin: 5,
  candidateReplacementConfirmations: 2,
  strongThreshold: 0,
  weakThreshold: 0,
  regularWeights: {
    relativePerformance: 0.45,
    momentum: 0.30,
    vwap: 0.15,
    volume: 0.10,
  },
  premarketWeights: { relativePerformance: 0.70, momentum: 0.30 },
} as const

export type MarketLensConfig = {
  benchmark: string; fullWatchlistRefreshMs: number; activeSetupRefreshMs: number
  retestTolerance: number; invalidationTolerance: number; setupExpirationMinutes: number
  candidateGraceMinutes: number; staleThresholdSeconds: number
  requireVwapForCall: boolean; requireVwapForPut: boolean
  candidateReplacementMargin: number; candidateReplacementConfirmations: number
  strongThreshold: number; weakThreshold: number
  regularWeights: { relativePerformance: number; momentum: number; vwap: number; volume: number }
  premarketWeights: { relativePerformance: number; momentum: number }
}
