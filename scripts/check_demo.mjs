import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'

const html = readFileSync(new URL('../demo.html', import.meta.url), 'utf8')
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1])
if (inlineScripts.length !== 1) throw new Error('Expected one inline demo script')
new Script(inlineScripts[0])
if (html.includes('tv-toggle') || html.includes('sampleChart(')) throw new Error('Sample preview is still present')
if (!html.includes("interval:'5'")) throw new Error('Default five-minute interval is missing')
console.log('demo.html: inline JavaScript syntax and TradingView-only view OK')
