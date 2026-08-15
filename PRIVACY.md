# Privacy Policy — Hermes G2

_Last updated: 2026-08-16_
_Applies to: `ai.crewnova.hermesg2` ("Hermes G2"), an Even Hub app for Even Realities G2 glasses._

Hermes G2 is a client application. It does not operate a backend service. Every
byte it sends goes to a Hermes bridge that **you** deploy and control. There is
no Hermes G2 account, no sign-up, and no server operated by us.

## Permissions this app requests

### `network` — connect to your Hermes bridge

Used solely to open a WebSocket connection to the bridge address you enter
during setup.

The app **sends**: your typed or spoken input, session commands (list, switch,
create), and — while you are recording — audio data.
The app **receives**: session lists, transcripts, assistant replies, and tool
status.

The app connects only to hosts permitted by its manifest whitelist
(`app.json`), and within that, only to the address you configure. The published
manifest ships **template hosts** (`g2.example.com`,
`your-node.your-tailnet.ts.net:8443`); if you build from this repository you are
expected to replace them with your own bridge host. The whitelist deliberately
contains no wildcards, so the app cannot be pointed at an arbitrary host under a
matched domain.

**Backend service domain:** the bridge host you supply. There is no other
network destination. The app contacts no analytics, advertising, telemetry, or
crash-reporting service.

### `g2-microphone` — voice input

The microphone is active **only** between the moment you tap to start recording
and the moment you tap to stop. It is not open at any other time, and the app
does not listen for a wake word.

While recording, raw audio (16 kHz, 16-bit, mono PCM) is streamed to your
bridge. Your bridge transcribes it — in the reference setup, locally via
`faster-whisper` — and returns text, which you review before anything is sent to
the agent. The app does not store audio on the glasses or the phone, and does
not transmit audio to any destination other than your configured bridge.

## What is stored on your device

A single connection profile, held in app storage under the key
`hermes.connectionProfile.v1`:

| Field | Purpose |
|---|---|
| `url` | your bridge address |
| `token` | the shared secret your bridge expects |
| `activeSession` | the session you had open |
| `updatedAt` | timestamp of the last change |

This never leaves the device except as the credential used to authenticate to
your own bridge. Removing the app removes it.

## What happens after your bridge receives the data

Beyond the bridge, handling is governed by how you configured your own Hermes
agent. If your agent is set up to call third-party model providers or external
tools, your input reaches those providers under their terms and privacy
policies. That configuration is yours, and this app can neither see nor control
it. If you are unsure what your agent forwards, inspect its configuration before
speaking anything sensitive into the glasses.

## Data we collect

None. We operate no server and receive no data from this app.

## Children

This app is not directed at children under 13.

## Changes

Material changes will appear in this document with an updated date, and will be
noted in the app's release notes.

## Contact

jwkim@crewnova.ai
