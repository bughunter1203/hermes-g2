// Package a build against your real bridge host without committing it.
//
// The tracked app.json carries template hosts on purpose, so the repo can stay
// public. This swaps in the whitelist from app.local.json — which is gitignored
// — writes the merged manifest under .pack/, and packs from there. The tracked
// manifest is never touched.
//
//   cp app.local.example.json app.local.json   # then put your host in it
//   npm run pack:local

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = join(import.meta.dirname, '..')
const LOCAL = join(ROOT, 'app.local.json')
const OUT_DIR = join(ROOT, '.pack')
const OUT_MANIFEST = join(OUT_DIR, 'app.json')
const OUT_PACKAGE = join(ROOT, 'hermes-g2.ehpk')

if (!existsSync(LOCAL)) {
  console.error(
    `Missing app.local.json.\n` +
      `  cp app.local.example.json app.local.json\n` +
      `  then put your real bridge host in it. It is gitignored.`,
  )
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'))
const local = JSON.parse(readFileSync(LOCAL, 'utf8'))

const whitelist = local.networkWhitelist
if (!Array.isArray(whitelist) || whitelist.length === 0) {
  console.error('app.local.json needs a non-empty "networkWhitelist" array.')
  process.exit(1)
}

// Wildcards are the hole this app's design closed: the app persists whatever
// bridge URL is entered at runtime, so a wildcard would admit any host under
// the matched domain.
const wild = whitelist.filter((h) => h.includes('*'))
if (wild.length > 0) {
  console.error(`Wildcard hosts are not allowed:\n  ${wild.join('\n  ')}`)
  process.exit(1)
}

const network = manifest.permissions.find((p) => p.name === 'network')
if (!network) {
  console.error('app.json has no "network" permission to override.')
  process.exit(1)
}
network.whitelist = whitelist

const leftovers = whitelist.filter((h) => h.includes('example.com') || h.includes('your-'))
if (leftovers.length > 0) {
  console.error(`Still template values — edit app.local.json:\n  ${leftovers.join('\n  ')}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`${manifest.name} ${manifest.version} (${manifest.package_id})`)
console.log('whitelist:')
for (const host of whitelist) console.log(`  ${host}`)

execFileSync('npx', ['evenhub', 'pack', OUT_MANIFEST, 'dist', '-o', OUT_PACKAGE], {
  cwd: ROOT,
  stdio: 'inherit',
})

console.log(`\npacked ${OUT_PACKAGE}`)
console.log('The tracked app.json still carries template hosts — leave it that way.')
