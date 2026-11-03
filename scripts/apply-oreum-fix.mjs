// 이미 만들어진 server/data/oreum.js 에 수정표(oreum-fix.mjs)를 적용 (전체를 다시 만들지 않고 빠르게): node scripts/apply-oreum-fix.mjs
import { readFile, writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'
import { applyFix } from './oreum-fix.mjs'

const done = applyFix(data.items)
const text = await readFile('server/data/oreum.js', 'utf8')
const head = text.slice(0, text.indexOf('export default'))
await writeFile('server/data/oreum.js', `${head}export default ${JSON.stringify(data)}\n`)
console.log(`수정 ${done.length}곳: ${done.join(', ')}`)
