# G2 안경 브리지 VPS 이전 설계

- 작성일: 2026-07-31
- 상태: 구현 완료 및 검증됨 — 성공 기준 1~5 전부 실기기에서 통과
- 관련 노트: `llm-wiki/00_Inbox/2026-07-31-yt-ocuclaw-even-g2-agent-setup.md`

> **표기 규약:** 공개 배포를 위해 실제 호스트·IP·컨테이너명은 `<bridge-host>`,
> `<vps-ip>`, `<agent-container>` 같은 placeholder로 치환했다. 자신의 값으로
> 바꿔 읽으면 된다.

## 배경

Even Realities G2 안경에서 Hermes 에이전트를 음성으로 쓰는 파이프라인이 2026-07-31 맥북에서 관통됐다. 다만 맥 경로는 `ws://<mac-lan-ip>:8766` — 집 LAN 평문 전용이라 네 가지 한계가 있다.

1. 집 밖에서 안경이 붙지 못한다
2. 맥이 깨어 있어야만 동작한다
3. 안경 세션이 운영 Hermes(Slack·Telegram)와 컨텍스트를 공유하지 못한다
4. 맥이 `0.0.0.0` 평문 + root급 토큰으로 열려 있다

같은 날 VPS 경로를 네 번 시도했고 전부 Tailscale 계정 레이어(Error 409)에서 막혀 중단했다. 이 문서는 그 중단을 뒤집는 설계다.

## 중단 판단을 뒤집은 근거

중단 당시 "인터넷 노출을 감수할 이유가 없다"고 판단했다. 그 전제가 틀렸다.

```
$ curl -s -m 15 -i https://<agent-dashboard-host>
HTTP/2 302
location: /login?next=%2F
server: uvicorn
```

VPS Hermes의 웹 대시보드(4860)는 **이미 Traefik 라우터로 인터넷에 공개되어 있다.** 브리지 라우터 추가는 새 경계를 넘는 결정이 아니라, 이미 공개된 호스트에 두 번째 문을 다는 결정이다. 판단의 성격이 다르다.

부수적으로 확인된 사실:

- Tailscale 409 해소에 **유료 플랜은 무관**하다. [공식 문서](https://tailscale.com/docs/reference/messages/console/multi-user-login)상 해법은 올바른 이메일 사용 또는 Tailscale 지원 문의이며, 플랜 등급 게이팅은 없다.
- iOS Tailscale은 auth key 로그인을 지원하지 않는다 ([tailscale#675](https://github.com/tailscale/tailscale/issues/675), 미구현).

즉 409는 돈으로도 우회로로도 풀 수 없고, 제3자 응답을 기다려야 한다.

## 채택안 — C (공개 WSS 즉시 + Tailscale 병행 전환)

경로 A로 오늘 운용하고, Tailscale 지원 티켓이 풀리면 경로 B로 갈아탄 뒤 A를 철거한다.

| 안 | 오늘 가능 | 노출 | 채택 |
|---|---|---|---|
| A. Traefik 공개 WSS | ✅ | 공개 (TLS+토큰) | 1단계 |
| B. Tailscale tailnet 전용 | ❌ (409) | 없음 | 2단계 목표 |
| C. A 운용 + B 전환 | ✅ | 한시적 공개 | **채택** |

C를 고른 이유는 전환 비용이다. 화이트리스트에 두 URL을 함께 넣어두면 전환이 앱 재패키징 없이 URL 교체 한 번으로 끝난다. B를 포기하지 않으면서 오늘 쓰는 값을 치른다.

## 아키텍처

```
G2 안경 ──BT── iPhone (Even Hub 앱 안의 .ehpk WebView)
                   │
   경로 A (1단계)  │ wss://<bridge-host>
                   │      → Traefik :443 (Let's Encrypt) → hermes:8765
   경로 B (2단계)  │ wss://<tailnet-host>:8443
                   │      → tailscale serve → 127.0.0.1:8765   (이미 가동 중)
                   ▼
        Hermes (sophie 프로필, Docker, 운영 인스턴스)
          ├─ even_g2   ← 제한 툴셋
          ├─ slack     ← 무영향
          └─ telegram  ← 무영향
```

두 경로가 같은 브리지 포트(8765)로 수렴한다. 전환 시 서버 변경은 없고 앱의 URL만 바뀐다. `tailscale serve`는 이미 8443 → 127.0.0.1:8765로 가동 중이므로 경로 B는 폰이 tailnet에 들어오는 즉시 동작한다.

## 권한 격리

### 근거 — 실측

`hermes tools disable --platform even_g2`는 **쓸 수 없다.** CLI가 하드코딩된 빌트인 목록으로 거부한다.

```
✗ Unknown platform 'even_g2'. Valid: cli, telegram, discord, slack, whatsapp, ...
```

그러나 런타임(`hermes_cli/tools_config.py:_get_platform_tools`)은 플러그인 플랫폼을 지원한다.

```python
plat_info = PLATFORMS.get(platform)
if plat_info: default_ts = plat_info["default_toolset"]
else:         default_ts = f"hermes-{platform}"   # 플러그인 플랫폼
toolset_names = [default_ts]
```

해석 대상은 `config["platform_toolsets"][platform]`이므로 `config.yaml`에 직접 쓰면 먹는다. 컨테이너 안에서 실증했다.

```
platform_toolsets: {even_g2: [web, memory, vision, clarify, session_search, todo]}
  → even_g2 : clarify, memory, session_search, todo, vision, web   (6개)
  → slack   : 17개 그대로 (무영향)
```

동시에 확인된 사실: 기본 툴셋 `hermes-even_g2`는 레지스트리에 없어 `[]`로 풀린다. **현재 안경 권한은 정의되지 않은 상태**이며, 명시 설정은 제한인 동시에 정상화다.

### 적용할 툴셋

허용 4종:

| 툴셋 | 이유 |
|---|---|
| `web` | 안경에서 실제로 쓸 검색 |
| `memory` | 목표 3(컨텍스트 통합)의 실체 — Slack·Telegram과 같은 기억 공유 |
| `session_search` | 과거 세션 참조 |
| `clarify` | 음성 대화라 되묻기가 필요 |

차단:

| 툴셋 | 이유 |
|---|---|
| `terminal` `file` `code_execution` `computer_use` | 유출 토큰의 파괴력 제거 — 이 설계의 핵심 |
| `browser` `delegation` `cronjob` `skills` | 안경 화면에서 무의미하고 공격 표면만 큼 |
| `image_gen` `tts` `vision` `todo` | G2에 카메라 없음, 화면이 작음 |

⚠️ `kanban`은 지정하지 않아도 비설정형(non-configurable) 툴셋으로 강제 포함된다 (실행 중 실증). 차단 목록에서 뺀 이유다. 셸·파일·코드 실행 계열이 아니라 위험도는 낮게 평가해 수용했다.

토큰이 유출됐을 때 남는 잔여 권한은 별도로 산정했고, 그 범위를 감수하기로 판단했다. 목표 3이 메모리 공유를 요구하는 이상 잔여 권한을 0으로 만들 수는 없기 때문이다. 구체적인 잔여 범위는 배포마다 다르므로 여기 적지 않는다 — 각자 자기 설정에서 산정할 것.

## 노출과 비밀 관리

### Traefik 라우터

hermes 컨테이너에 라벨을 추가한다.

```
Host(`<bridge-host>`) → hermes:8765
certresolver=letsencrypt
+ rateLimit 미들웨어
```

`<bridge-host>`는 이미 `<vps-ip>`로 해석되고 Traefik의 Let's Encrypt HTTP 챌린지가 가동 중이므로 신규 인프라는 없다.

엣지 하드닝은 rateLimit까지만 하고 멈췄다. WebView가 클라이언트 인증서를 제시할 수 없다는 제약이 선택지를 좁히고, 그 위에 얹을 수 있는 나머지 수단은 실익 대비 복잡도가 컸다. 어디까지 얹을지는 배포마다 다시 판단할 문제라 구체적인 태세는 여기 적지 않는다.

### 토큰 회전

공개 경로 개통 **전에** 한 번 더 회전한다. 현재 값은 tailnet 전용을 전제로 발급됐고 셸 히스토리에 반복 노출됐다.

회전할 때는 토큰 사본이 남아 있는 곳을 빠짐없이 세는 것이 핵심이다. 서버 설정 파일 하나만 갈면 끝나지 않는다 — 클라이언트 쪽 저장소와 셸 히스토리까지가 한 세트다.

### app.json 화이트리스트

전환을 재패키징 없이 만드는 장치다. 세 호스트를 함께 둔다.

```
wss://<bridge-host>          경로 A
wss://<tailnet-host>:8443  경로 B
ws://<mac-lan-ip>:8766                 맥 (검증 기간 롤백용, 철거 시 제거)
```

정확한 호스트만 나열하므로 이전 리뷰에서 지적된 와일드카드(`wss://*.ts.net`) 문제와 무관하다.

> 공개 리포의 `app.json`에는 실제 호스트 대신 **템플릿 값**(`g2.example.com`,
> `your-node.your-tailnet.ts.net:8443`)이 들어 있다. 포크한 뒤 자기 브리지
> 호스트로 바꿔야 동작한다. 와일드카드로 넓히지 말 것 — 그게 아래 절의 요지다.

### 보안 개선 — 와일드카드 제거

이번 작업으로 기존 화이트리스트의 와일드카드 4개(`https://*.ts.net`, `wss://*.ts.net`, `https://*.<upstream-tailnet>`, `wss://*.<upstream-tailnet>`)와 제3자 tailnet 호스트 1개(`wss://<upstream-tailnet-host>:8443` — 업스트림 템플릿 작성자의 tailnet이며 우리 것(`<tailnet-id>`)이 아니다)가 함께 제거됐다. `*.ts.net`은 지구상의 모든 Tailscale 호스트를 허용하는 것과 같았다. 앱이 런타임에 사용자가 입력한 브리지 URL을 그대로 영속화하므로, 오타나 공격자가 심은 `wss://anything.ts.net`도 이 와일드카드 아래서는 그대로 통과됐을 것이다. 이번 화이트리스트 교체는 URL 갱신인 동시에 이 구멍을 막은 조치다.

## 하드패치 방어

`adapter.py`의 `is_reconnect` 한 줄 패치는 Hermes v0.19 호환용이며 `hermes plugins update`가 조용히 덮어쓴다.

업스트림 수정은 기대할 수 없다. 호환 픽스를 담은 PR이 작성 시점 기준 병합되지 않은 채였고, 저장소 활동도 의존성 범프 위주였다. 즉 이 패치는 상당 기간 우리 쪽에서 들고 가야 하는 항목이다.

자동화 대신 재적용 커맨드를 여기 박아두고, 플러그인 업데이트 후 필수 점검 항목으로 둔다. 멱등하므로 반복 실행해도 안전하다.

```sh
# 대상: <profile>/plugins/hermes-evenhub-bridge/adapter.py
sed -i 's/async def connect(self) -> bool:/async def connect(self, *, is_reconnect: bool = False) -> bool:/' adapter.py
grep -n 'async def connect' adapter.py   # is_reconnect 인자 확인
```

`adapter.py.bak`이 이미 존재한다.

## 성공 기준

아래를 모두 통과해야 완료로 본다.

| # | 검증 | 대응 목표 |
|---|---|---|
| 1 | 셀룰러(집 밖)에서 안경 → 응답 수신 | 집 밖 사용 |
| 2 | 맥 전원 OFF 상태에서 동작 | 맥 상시 가동 불필요 |
| 3 | Slack에서 나눈 대화를 안경이 기억 | 컨텍스트 통합 |
| 4 | 안경에 셸 명령 요청 시 에이전트가 **도구 없음을 보고**하고 실행하지 않음 (예: "지금 디스크 용량 알려줘" → 명령 실행 없이 불가 응답). 같은 요청을 Slack에서 하면 정상 실행되어 격리가 플랫폼별임을 확인 | 권한 격리 실증 |
| 5 | 맥 브리지 정지 후에도 정상 | 맥 보안 부담 제거 |

## 롤백

1~5 통과 전까지 맥 브리지를 살려둔다. 백업은 `docker-compose.yml.bak.20260731_023451`, `adapter.py.bak`이 존재한다. Traefik 라우터는 라벨 추가/제거가 대칭이므로 되돌리기는 라벨 삭제 한 번이다.

## 2단계 전환 (경로 A → B)

1. Tailscale 지원에 409 티켓 제출
2. 409 해소 후 폰이 `<org-tailnet>` tailnet 합류
3. 앱 설정에서 URL을 경로 B로 교체 (재패키징 없음)
4. 성공 기준 1~5 재검증
5. Traefik 라우터 라벨 제거, 공개 노출 종료

## 범위 밖

- **Tailscale 유료 전환** — 409와 무관함이 문서로 확인됨
- **별도 저권한 Hermes 프로필** — 플랫폼별 툴셋으로 대체됨
- **Even Hub Beta Testing 업로드** — 상주 설치 과제로, 이번 셋업과 독립
- **맥 방화벽·DHCP 예약** — 맥 경로 철거 후 무의미
