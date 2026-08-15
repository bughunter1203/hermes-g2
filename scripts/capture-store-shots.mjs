// Capture store-listing screenshots from the simulator.
//
//   npm run dev                      # app on :5173
//   npm run sim                      # simulator, automation on :9898
//   npm run shots                    # guided (default)
//   npm run shots -- --auto          # drive the gestures automatically
//   npm run shots -- --shot my-name  # grab the current frame once
//
// Point the app at a real bridge before capturing. Submission requires the
// screenshots to match what the app renders on device, so the conversation in
// them should be a real one.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const BASE = process.env.EVEN_SIM_BASE ?? 'http://127.0.0.1:9898'
const OUT_DIR = join(import.meta.dirname, '..', 'store', 'screenshots')
const READY_MARKER = '[glasses] ready'

// A blank or near-blank frame compresses to almost nothing. Real renders of
// this app land around 5 KB. Anything tiny is a black screen, which is a
// rejection on its own.
const MIN_PLAUSIBLE_BYTES = 1500

// The four states the listing should show. `steps` are the taps that get you
// there from the previous shot; `settle` is how long that transition needs.
const SHOTS = [
  {
    name: '01-session-list',
    title: 'Session list',
    manual: 'The boot screen: your sessions, with the ＋New row.',
    steps: [],
    settle: 1_000,
  },
  {
    name: '02-session-idle',
    title: 'Session, idle',
    manual: 'Open a session that already has some conversation in it. Bottom bar reads "ready for input".',
    steps: ['click'],
    settle: 2_000,
  },
  {
    name: '03-recording',
    title: 'Recording',
    manual: 'Tap to start recording. Bottom bar reads "🎤 recording…".',
    steps: ['click'],
    settle: 1_500,
  },
  {
    name: '04-working',
    title: 'Tool running',
    manual: 'Stop, let it transcribe, send it, and wait until a tool line appears — bottom bar reads "working… (<tool>)". Ask for something that uses a tool, e.g. a web search.',
    steps: ['click', 'click'],
    settle: 12_000,
  },
]

async function ping() {
  let res
  try {
    res = await fetch(`${BASE}/api/ping`)
  } catch {
    console.error(
      `No simulator on ${BASE}.\n` +
        `  Start it in two other terminals:\n` +
        `    npm run dev\n` +
        `    npm run sim\n` +
        `  (or set EVEN_SIM_BASE if the automation port differs)`,
    )
    process.exit(1)
  }
  if (!res.ok) throw new Error(`/api/ping returned ${res.status}`)
}

async function waitForReady(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let sinceId = 0

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/api/console?since_id=${sinceId}`)
    if (!res.ok) throw new Error(`/api/console returned ${res.status}`)
    const data = await res.json()

    for (const entry of data.entries ?? []) {
      sinceId = Math.max(sinceId, entry.id)
      if (entry.message?.includes(READY_MARKER)) return
    }

    await sleep(250)
  }

  throw new Error(`App did not log "${READY_MARKER}" within ${timeoutMs}ms`)
}

async function input(action) {
  // Never send double_click: on the root list it opens the system exit dialog,
  // which ends the session and blocks every later action.
  if (action === 'double_click') {
    throw new Error('double_click is the exit gesture — not used for capture')
  }

  const res = await fetch(`${BASE}/api/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error(`/api/input returned ${res.status}`)
}

async function capture(name) {
  const res = await fetch(`${BASE}/api/screenshot/glasses`)
  if (!res.ok) throw new Error(`/api/screenshot/glasses returned ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())

  mkdirSync(OUT_DIR, { recursive: true })
  const path = join(OUT_DIR, `${name}.png`)
  writeFileSync(path, bytes)

  const { width, height } = pngSize(bytes)
  const warning =
    bytes.byteLength < MIN_PLAUSIBLE_BYTES
      ? '  ← looks blank. Is the app connected to a bridge?'
      : ''

  console.log(`  saved ${path}  ${width}×${height}, ${bytes.byteLength} bytes${warning}`)
  return bytes.byteLength >= MIN_PLAUSIBLE_BYTES
}

function pngSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const args = process.argv.slice(2)
  const auto = args.includes('--auto')
  const shotFlag = args.indexOf('--shot')

  await ping()

  if (shotFlag !== -1) {
    const name = args[shotFlag + 1]
    if (!name) throw new Error('--shot needs a name')
    await capture(name)
    return
  }

  await waitForReady()
  console.log(`Simulator ready. Writing to ${OUT_DIR}\n`)

  const rl = auto ? null : createInterface({ input: stdin, output: stdout })
  let blank = 0

  for (const shot of SHOTS) {
    if (auto) {
      for (const step of shot.steps) await input(step)
      await sleep(shot.settle)
      console.log(`${shot.title}`)
    } else {
      await rl.question(`${shot.title}\n  ${shot.manual}\n  Enter when it's on screen: `)
    }

    const ok = await capture(shot.name)
    if (!ok) blank += 1
    console.log()
  }

  rl?.close()

  if (blank > 0) {
    console.log(`${blank} of ${SHOTS.length} look blank. Do not submit those.`)
    process.exitCode = 1
  } else {
    console.log(`${SHOTS.length} screenshots captured.`)
  }
}

await main()
