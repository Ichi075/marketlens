import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { claimReadyNotification } from './setup.ts'
import type { Setup } from './setup.ts'

const KEY = 'marketlens:notified-setups:v1'
let savedIds: string[] = []
try { savedIds = JSON.parse(localStorage.getItem(KEY) || '[]') as string[] } catch { /* Ignore damaged local data. */ }
const notified = new Set<string>(savedIds)
export function shouldNotifySetup(setup: Setup): boolean {
  return setup.state === 'SETUP_READY' && !notified.has(setup.id)
}
export async function notifySetupReady(setup: Setup): Promise<boolean> {
  if (!shouldNotifySetup(setup) || !('__TAURI_INTERNALS__' in window)) return false
  let granted = await isPermissionGranted()
  if (!granted) granted = await requestPermission() === 'granted'
  if (!granted) return false
  sendNotification({ title: `MarketLens · ${setup.symbol} ${setup.direction}`,
    body: `${setup.levelType} retest confirmed\n${setup.reasons[0]} · ${setup.vwap == null ? 'VWAP unavailable' : setup.direction === 'CALL' ? 'Above VWAP' : 'Below VWAP'}` })
  claimReadyNotification(setup, notified)
  localStorage.setItem(KEY, JSON.stringify([...notified].slice(-200)))
  return true
}
