# G2 안경 브리지 VPS 이전 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **표기 규약:** 공개 배포를 위해 실제 호스트·IP·컨테이너명은 `<bridge-host>`,
> `<vps-ip>`, `<agent-container>` 같은 placeholder로 치환했다. 자신의 값으로
> 바꿔 읽으면 된다.

**Goal:** G2 안경이 집 밖·맥 전원 무관하게 VPS의 운영 Hermes에 붙되, 안경 토큰이 유출돼도 셸·파일·코드 실행을 할 수 없게 만든다.

**Architecture:** 안경→폰→`wss://<bridge-host>`→Traefik(:443, Let's Encrypt)→hermes 컨테이너 8765. 같은 브리지 포트로 `tailscale serve`(8443)도 이미 향하고 있어, Tailscale 409가 풀리면 앱 URL 교체만으로 tailnet 전용으로 전환된다. 권한 격리는 `config.yaml`의 `platform_toolsets.even_g2`로 걸며 Slack·Telegram은 건드리지 않는다.

**Tech Stack:** Docker Compose, Traefik v3 (host 네트워크 모드, Let's Encrypt HTTP 챌린지), Hermes Agent (Python, sophie 프로필), `hermes-evenhub-bridge` v0.3.2 플러그인, Vite + TypeScript (Task 4 Step 0에서 폰에 `.ehpk` 로컬 설치 경로가 없음이 확인되어 Task 3.5부터 VPS 정적 서빙(`npm run build` → `dist/`)으로 전환됐다. `.ehpk`는 죽은 산출물이며 더 이상 배포 경로가 아니다)

## Global Constraints

- **운영 인스턴스다.** `<agent-container>`은 Slack·Telegram이 붙은 프로덕션이다. 모든 재시작은 Slack·Telegram 복구 확인까지가 한 세트다.
- **재시작 횟수를 최소화한다.** 서버 측 변경은 Task 1에 몰아 단일 재시작으로 끝낸다.
- **`data/profiles/sophie/.env`는 볼륨(`./data:/opt/data`) 안에 있어 Hermes가 런타임에 읽는다** → `docker restart`로 충분하다. 반면 **`docker-compose.yml`의 라벨 변경은 컨테이너 재생성이 필요하다** (`docker compose up -d`).
- **compose 변수 출처가 두 개다.** `/docker/<agent-stack>/.env`는 compose 보간용(`TRAEFIK_HOST` 등), `/docker/<agent-stack>/data/profiles/sophie/.env`는 Hermes 프로필 비밀(`EVENHUB_*`). 혼동 금지.
- **Traefik은 host 네트워크 모드다.** 도커 네트워크 공유가 아니라 컨테이너 IP로 직접 라우팅한다. 별도 네트워크 연결 작업이 필요 없다.
- **화이트리스트에 와일드카드 금지.** 정확한 호스트만 나열한다.
- **맥 브리지는 Task 4 전체 통과 전까지 죽이지 않는다.**
- `EVENHUB_BRIDGE_NET=lan`은 유지한다. `public_connect_url()`이 `EVENHUB_BRIDGE_PUBLIC_URL`을 최우선 반환하므로 공개 URL과 충돌하지 않는다.
- SSH 대상: `root@<vps-ip>`. 컨테이너: `<agent-container>`.

---

### Task 1: 서버 잠그기 — 권한 격리 + 토큰 회전 (단일 재시작)

공개 노출 **전에** 권한을 좁히고 토큰을 새로 발급한다. 두 변경 모두 프로필 파일 수정이라 재시작 한 번으로 끝난다.

**Files:**
- Modify: `/docker/<agent-stack>/data/profiles/sophie/config.yaml` (12번 줄 `disabled: []` 뒤에 `platform_toolsets` 추가)
- Modify: `/docker/<agent-stack>/data/profiles/sophie/.env` (`EVENHUB_BRIDGE_TOKEN`, `EVENHUB_BRIDGE_PUBLIC_URL`)
- Create: `/tmp/probe.py` (컨테이너 안, 검증용 — 커밋 대상 아님)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - 새 토큰 문자열 — Task 3에서 폰 앱에 입력, Task 4에서 검증에 사용
  - `EVENHUB_BRIDGE_PUBLIC_URL=wss://<bridge-host>` — Task 2의 Traefik 라우터가 이 호스트를 받게 됨
  - `platform_toolsets.even_g2 = [web, memory, session_search, clarify]` — Task 4의 성공 기준 4가 이걸 검증

- [ ] **Step 1: 검증 스크립트를 작성해 컨테이너에 넣는다**

로컬에서 작성:

```python
# /tmp/probe.py
import sys
sys.path.insert(0, "/opt/hermes")
from hermes_cli.tools_config import _get_platform_tools
from hermes_cli.config import load_config
cfg = load_config()
print("platform_toolsets:", cfg.get("platform_toolsets"))
for p in ["even_g2", "slack", "telegram"]:
    try:
        print(f"{p:10s} ->", sorted(_get_platform_tools(cfg, p)))
    except Exception as e:
        print(f"{p:10s} ERR", type(e).__name__, e)
```

전송:

```bash
scp /tmp/probe.py root@<vps-ip>:/tmp/probe.py
ssh root@<vps-ip> 'docker cp /tmp/probe.py <agent-container>:/tmp/probe.py'
```

- [ ] **Step 2: 변경 전 상태를 찍어 "실패"를 확인한다**

⚠️ **프로필을 반드시 `HERMES_HOME`으로 지정한다.** Hermes의 프로필 기법은 `HERMES_PROFILE`이 아니라 `HERMES_HOME`이 `profiles/<name>`을 직접 가리키는 방식이다 (`hermes_cli/config.py:946`, `home.parent.name == "profiles"`). 지정을 빠뜨리면 루트 프로필(`/opt/data/config.yaml`)을 읽어 **변경이 적용되지 않은 것처럼 보인다.** 실제 실행에서 이 함정에 걸려 오판했다.

```bash
ssh root@<vps-ip> 'docker exec -e HERMES_HOME=/opt/data/profiles/sophie <agent-container> python /tmp/probe.py'
```

또한 이 프로브는 게이트웨이의 sys.path 밖에서 플러그인을 임포트하므로 `Even G2 bridge: dependencies missing` 경고를 **허위로** 출력할 수 있다. 실제 의존성은 `/opt/data/lazy-packages/`에 있다. 브리지 생존 여부는 이 경고가 아니라 포트로 판정한다.

기대 출력 (이게 고쳐야 할 상태다):
```
platform_toolsets: None
even_g2    -> ['hermes-even_g2']        ← 레지스트리에 없는 이름, 사실상 정의되지 않음
slack      -> ['browser', 'clarify', 'code_execution', ...]   (17개)
telegram   -> ['browser', 'clarify', 'code_execution', ...]   (17개)
```

`even_g2`가 `['hermes-even_g2']`가 아니라면 멈추고 보고할 것. 전제가 달라진 것이다.

- [ ] **Step 3: 백업을 뜬다**

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie
TS=$(date +%Y%m%d_%H%M%S)
cp config.yaml config.yaml.bak.$TS
cp .env .env.bak.$TS
ls -la config.yaml.bak.$TS .env.bak.$TS'
```

- [ ] **Step 4: `config.yaml`에 권한 격리를 추가한다**

`plugins:` 블록 바로 뒤(16번 줄 `allow_tool_override: false` 다음, 17번 줄 주석 앞)에 삽입:

```yaml
platform_toolsets:
  even_g2:
    - web
    - memory
    - session_search
    - clarify
```

적용:

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie
python3 - <<'"'"'EOF'"'"'
import re
p = "config.yaml"
s = open(p).read()
anchor = "      allow_tool_override: false\n"
assert anchor in s, "앵커를 찾지 못함 — 수동 확인 필요"
block = anchor + """
platform_toolsets:
  even_g2:
    - web
    - memory
    - session_search
    - clarify
"""
s = s.replace(anchor, block, 1)
open(p, "w").write(s)
print("삽입 완료")
EOF
sed -n "9,25p" config.yaml'
```

- [ ] **Step 5: 새 토큰을 발급하고 `.env`를 갱신한다**

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie
NEW=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
sed -i "s|^EVENHUB_BRIDGE_TOKEN=.*|EVENHUB_BRIDGE_TOKEN=$NEW|" .env
sed -i "s|^EVENHUB_BRIDGE_PUBLIC_URL=.*|EVENHUB_BRIDGE_PUBLIC_URL=wss://<bridge-host>|" .env
echo "=== 새 토큰 (폰 앱에 입력할 값) ==="
echo "$NEW"
echo "=== 반영 확인 ==="
grep -E "^EVENHUB_BRIDGE_(TOKEN|PUBLIC_URL|HOST|PORT|NET)=" .env'
```

출력된 토큰을 안전한 곳에 기록한다. Task 3에서 폰에 입력한다.

- [ ] **Step 6: 게이트웨이를 재시작한다**

```bash
ssh root@<vps-ip> 'docker restart <agent-container> && sleep 25 && docker ps --filter name=<agent-stack> --format "{{.Names}}\t{{.Status}}"'
```

- [ ] **Step 7: 격리가 걸렸고 운영 채널이 살아있는지 확인한다**

```bash
ssh root@<vps-ip> 'docker exec -e HERMES_HOME=/opt/data/profiles/sophie <agent-container> python /tmp/probe.py'
```

기대 출력:
```
platform_toolsets: {'even_g2': ['web', 'memory', 'session_search', 'clarify']}
even_g2    -> ['clarify', 'kanban', 'memory', 'session_search', 'web']   ← 축소됨. kanban 은 비설정형이라 강제 포함(수용)
slack      -> ['browser', 'clarify', 'code_execution', ...]        ← 17개 유지
telegram   -> ['browser', 'clarify', 'code_execution', ...]        ← 17개 유지
```

Slack 또는 Telegram이 17개에서 줄었다면 즉시 Step 3의 백업으로 롤백하고 보고할 것.

브리지가 다시 듣고 있는지:

```bash
ssh root@<vps-ip> 'curl -s -o /dev/null -w "브리지 8765: %{http_code}\n" http://127.0.0.1:8765'
```

기대: `426` (Upgrade Required — WebSocket 엔드포인트의 정상 HTTP 응답)

- [ ] **Step 8: Slack에서 실제 왕복을 확인한다**

Slack의 홈 채널에서 봇에게 아무 메시지나 보내고 응답이 오는지 확인한다. 툴 사용까지 보려면 "지금 디스크 용량 알려줘"를 보낸다 — 정상 실행되어야 한다 (Task 4의 성공 기준 4에서 안경과 대조할 기준선이다).

응답이 없으면 롤백:

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie
ls -t config.yaml.bak.* .env.bak.* | head -2
# 확인 후: cp config.yaml.bak.<TS> config.yaml && cp .env.bak.<TS> .env
# docker restart <agent-container>'
```

---

### Task 2: Traefik 공개 라우터 + rateLimit

`<bridge-host>`로 오는 TLS 트래픽을 컨테이너 8765로 보낸다. DNS와 인증서 발급기는 이미 있으므로 라벨만 추가한다.

**Files:**
- Modify: `/docker/<agent-stack>/docker-compose.yml` (8~13번 줄 `labels:` 블록에 5줄 추가)

**Interfaces:**
- Consumes: Task 1의 `EVENHUB_BRIDGE_PUBLIC_URL=wss://<bridge-host>` — 라우터 호스트가 이 값과 일치해야 한다
- Produces: `wss://<bridge-host>` 공개 엔드포인트 — Task 3의 화이트리스트와 Task 4의 검증이 사용

- [ ] **Step 1: 아직 라우팅되지 않음을 확인한다 (실패 확인)**

```bash
curl -s -o /dev/null -m 15 -w "g2 호스트: %{http_code}\n" https://<bridge-host>
```

기대: `404` 또는 연결 실패 — Traefik에 이 호스트를 받는 라우터가 없다.

DNS는 이미 해석되어야 한다:

```bash
dig +short <bridge-host>
```
기대: `<vps-ip>`

- [ ] **Step 2: 백업을 뜬다**

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack> && cp docker-compose.yml docker-compose.yml.bak.$(date +%Y%m%d_%H%M%S) && ls -t docker-compose.yml.bak.* | head -2'
```

- [ ] **Step 3: 라벨을 추가한다**

`labels:` 블록 끝(13번 줄 `...loadbalancer.server.port=4860` 다음)에 추가:

```yaml
      - traefik.http.routers.hermes-g2.rule=Host(`g2.${TRAEFIK_HOST}`)
      - traefik.http.routers.hermes-g2.entrypoints=websecure
      - traefik.http.routers.hermes-g2.tls.certresolver=letsencrypt
      - traefik.http.routers.hermes-g2.service=hermes-g2
      - traefik.http.routers.hermes-g2.middlewares=g2-ratelimit
      - traefik.http.services.hermes-g2.loadbalancer.server.port=8765
      - traefik.http.middlewares.g2-ratelimit.ratelimit.average=30
      - traefik.http.middlewares.g2-ratelimit.ratelimit.burst=60
```

적용:

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>
python3 - <<'"'"'EOF'"'"'
p = "docker-compose.yml"
s = open(p).read()
anchor = "      - traefik.http.services.${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=4860\n"
assert anchor in s, "앵커를 찾지 못함 — 수동 확인 필요"
add = anchor + """      - traefik.http.routers.hermes-g2.rule=Host(`g2.${TRAEFIK_HOST}`)
      - traefik.http.routers.hermes-g2.entrypoints=websecure
      - traefik.http.routers.hermes-g2.tls.certresolver=letsencrypt
      - traefik.http.routers.hermes-g2.service=hermes-g2
      - traefik.http.routers.hermes-g2.middlewares=g2-ratelimit
      - traefik.http.services.hermes-g2.loadbalancer.server.port=8765
      - traefik.http.middlewares.g2-ratelimit.ratelimit.average=30
      - traefik.http.middlewares.g2-ratelimit.ratelimit.burst=60
"""
s = s.replace(anchor, add, 1)
open(p, "w").write(s)
print("삽입 완료")
EOF
cat -n docker-compose.yml'
```

- [ ] **Step 4: 컨테이너를 재생성해 라벨을 반영한다**

라벨은 컨테이너 메타데이터라 `docker restart`로는 반영되지 않는다.

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack> && docker compose up -d && sleep 25 && docker ps --filter name=<agent-stack> --format "{{.Names}}\t{{.Status}}"'
```

- [ ] **Step 5: 인증서 발급을 기다렸다가 라우팅을 확인한다 (통과 확인)**

Let's Encrypt HTTP 챌린지는 첫 요청 후 수십 초 걸릴 수 있다.

```bash
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" https://<bridge-host>)
  echo "시도 $i: $code"
  [ "$code" = "426" ] && echo "✅ 브리지 도달" && break
  sleep 15
done
```

기대: 최종 `426`. Task 1 Step 7에서 컨테이너 내부로 본 것과 같은 응답이 공개 경로로 나오면 성공이다.

`404`가 계속되면 Traefik 로그를 본다:

```bash
ssh root@<vps-ip> 'docker logs traefik-traefik-1 --tail 50 2>&1 | grep -iE "g2|error|acme" | tail -20'
```

- [ ] **Step 6: TLS 인증서가 진짜인지 확인한다**

```bash
echo | openssl s_client -connect <bridge-host>:443 -servername <bridge-host> 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

기대: `issuer`에 Let's Encrypt, `subject`에 `<bridge-host>`, 유효기간이 현재를 포함.

- [ ] **Step 7: rateLimit이 붙었는지 확인한다**

```bash
for i in $(seq 1 80); do curl -s -o /dev/null -w "%{http_code} " -m 5 https://<bridge-host>; done; echo
```

기대: 초반 `426`이 이어지다 일부가 `429`로 바뀐다. 전부 `426`이면 미들웨어가 라우터에 안 붙은 것이므로 Step 3의 `middlewares=g2-ratelimit` 라벨을 확인한다.

---

### Task 3: 클라이언트 — 화이트리스트 3호스트 + `.ehpk` 재빌드

전환을 재패키징 없이 만드는 장치를 심는다. 두 경로와 롤백용 맥 경로를 함께 넣는다.

**Files:**
- Modify: `<repo-root>/app.json`
- Build: `<repo-root>/hermes-even-hub-app.ehpk`

**Interfaces:**
- Consumes: Task 2의 `wss://<bridge-host>`, Task 1의 새 토큰
- Produces: 세 호스트를 허용하는 `.ehpk` — Task 4가 폰에 설치해 검증, Task 5가 맥 항목을 제거

- [ ] **Step 1: 현재 화이트리스트를 확인한다**

```bash
cd <repo-root>
python3 -c "import json;d=json.load(open('app.json'));print('version:',d['version']);[print(' ',u) for u in d['permissions'][0]['whitelist']]"
```

현재(커밋 92e98b0 기준)는 5개다: `https://*.ts.net`, `wss://*.ts.net`, `https://*.<upstream-tailnet>`, `wss://*.<upstream-tailnet>`, `wss://<upstream-tailnet-host>:8443`. 맥 항목은 없다 — 맥 항목은 이번 Task 3에서 새로 들어간다. `<bridge-host>`가 없어서 지금 `.ehpk`로는 Task 2의 엔드포인트에 붙을 수 없다 — 이게 고쳐야 할 상태다.

- [ ] **Step 2: `app.json`을 갱신한다**

`version`을 `0.3.0`으로 올리고 화이트리스트를 6개 항목으로 교체한다.

```bash
cd <repo-root>
python3 - <<'EOF'
import json, collections
p = "app.json"
d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
d["version"] = "0.3.0"
for perm in d["permissions"]:
    if perm.get("name") == "network":
        perm["desc"] = "Connect to the Hermes bridge"
        perm["whitelist"] = [
            "wss://<bridge-host>",
            "https://<bridge-host>",
            "wss://<tailnet-host>:8443",
            "https://<tailnet-host>:8443",
            "ws://<mac-lan-ip>:8766",
            "http://<mac-lan-ip>:8766",
        ]
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
open(p, "a").write("\n")
print("갱신 완료")
EOF
cat app.json
```

와일드카드(`*.ts.net` 등)가 한 항목도 없는지 눈으로 확인한다.

- [ ] **Step 3: 패키징한다**

```bash
cd <repo-root>
npm run pack
```

- [ ] **Step 4: 산출물을 확인한다**

```bash
cd <repo-root>
ls -la hermes-even-hub-app.ehpk
head -c 4 hermes-even-hub-app.ehpk   # 기대: EHPK
python3 -c "import json;d=json.load(open('app.json'));print('version:',d['version']);[print(' ',u) for u in d['permissions'][0]['whitelist']]"
```

기대: 매직 바이트 `EHPK`, `version: 0.3.0`, 화이트리스트 6개.

⚠️ `.ehpk`는 zip이 아니라 독자 바이너리 포맷이라 **내용물을 열어볼 수 없다.** `evenhub`에 unpack 명령도 없다. 따라서 "패키지가 새 화이트리스트를 담았는가"는 여기서 검증 불가이며, **Task 4 Step 1의 폰 설치·접속이 그 검증을 겸한다.** 소스상 packer는 `app.json`을 디스크에서 그대로 읽어 변환 없이 넣는다.

- [ ] **Step 5: 커밋한다**

```bash
cd <repo-root>
git add app.json
git commit -m "feat: whitelist VPS bridge hosts, bump to 0.3.0

Adds the public Traefik host and keeps the tailnet host so the
Tailscale cutover needs no repack. Mac LAN entry stays until the
end-to-end verification passes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 3.5: 앱 번들을 VPS에서 서빙 (Task 4 Step 0 게이트 실패로 추가)

**추가 경위:** Task 4 Step 0에서 폰 Even Hub의 개발자 섹션에 `.ehpk` 로컬 설치 항목이 **없음**이 확인됐다. 상주 설치는 Beta Testing을 거쳐야 하는데 그것은 스펙 범위 밖이다. 세 선택지(A. Beta Testing 편입 / B. VPS가 앱 서빙 / C. 기준 2 포기)를 제시했고 사용자가 **B**를 선택했다.

**원리:** 지금까지 쓰던 QR 방식은 "URL을 여는" 것이다. `evenhub qr --url`이 임의 HTTPS URL을 받으므로, 그 URL을 맥의 vite가 아니라 VPS가 서빙하면 앱 코드의 맥 의존이 사라진다. 기준 2가 통과 가능해진다.

**남는 한계:** 실행할 때마다 QR을 스캔해야 하는 불편은 그대로다. 그것은 Beta Testing으로만 풀리며 여전히 범위 밖이다.

**미확인 위험:** dev URL 모드에서 `app.json`의 화이트리스트가 강제되는지 확인되지 않았다. `dist/`에는 `app.json`이 포함되지 않으므로 **정적 루트에 함께 올려** 어느 쪽이든 대응되게 한다.

**Files:**
- Create: `/docker/g2app/docker-compose.yml` (VPS)
- Create: `/docker/g2app/html/` (VPS — `dist/` 내용 + `app.json`)

**Interfaces:**
- Consumes: Task 3의 `dist/` 빌드 산출물과 `app.json`
- Produces: `https://<app-host>` — Task 4 Step 1이 이 URL의 QR로 앱을 연다

- [ ] **Step 1: 번들에 비밀이 없는지 확인한다 (공개 전 필수)**

앱 번들이 인터넷에 공개되므로 토큰이 구워져 있으면 안 된다.

```bash
cd <repo-root>
grep -rEo "[A-Za-z0-9_-]{40,}" dist/assets/*.js | sort -u | head -20
grep -rio "token" dist/assets/*.js | wc -l
```

기대: Task 1에서 발급한 토큰 문자열이 **나오지 않아야 한다.** 나오면 즉시 중단하고 보고할 것.

- [ ] **Step 2: 아직 서빙되지 않음을 확인한다 (실패 확인)**

```bash
dig +short <app-host>          # 기대: <vps-ip>
curl -s -o /dev/null -m 15 -w "%{http_code}\n" https://<app-host>   # 기대: 404 또는 실패
```

- [ ] **Step 3: VPS에 정적 서버 compose를 만든다**

hermes와 분리된 독립 프로젝트다. 프로덕션 재시작이 발생하지 않는다.

```yaml
# /docker/g2app/docker-compose.yml
services:
  g2app:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./html:/usr/share/nginx/html:ro
    labels:
      - traefik.enable=true
      - traefik.http.routers.g2app.rule=Host(`<app-host>`)
      - traefik.http.routers.g2app.entrypoints=websecure
      - traefik.http.routers.g2app.tls.certresolver=letsencrypt
      - traefik.http.routers.g2app.service=g2app
      - traefik.http.services.g2app.loadbalancer.server.port=80
```

⚠️ `service=` 라벨을 반드시 명시한다. Task 2에서 이것을 빠뜨려 기존 라우터의 자동 연결이 깨졌다.

- [ ] **Step 4: 번들을 올린다**

```bash
cd <repo-root>
ssh root@<vps-ip> 'mkdir -p /docker/g2app/html'
scp -r dist/* root@<vps-ip>:/docker/g2app/html/
scp app.json root@<vps-ip>:/docker/g2app/html/app.json
ssh root@<vps-ip> 'ls -la /docker/g2app/html/'
```

- [ ] **Step 5: 기동하고 서빙을 확인한다 (통과 확인)**

```bash
ssh root@<vps-ip> 'cd /docker/g2app && docker compose up -d && sleep 30'
curl -s -o /dev/null -m 20 -w "index: %{http_code}\n" https://<app-host>/
curl -s -m 20 https://<app-host>/app.json | python3 -c "import json,sys;d=json.load(sys.stdin);print('version:',d['version'],'/ whitelist:',len(d['permissions'][0]['whitelist']))"
```

기대: `index: 200`, `version: 0.3.0 / whitelist: 6` — 이는 이 시점(Task 3.5)의 기댓값이다. Task 5 완료 후에는 `version: 0.3.1 / whitelist: 4`로 바뀐다.

- [ ] **Step 6: 기존 라우터가 안 깨졌는지 확인한다**

```bash
curl -s -o /dev/null -m 15 -w "  대시보드 : %{http_code}\n" https://<agent-dashboard-host>
curl -s -o /dev/null -m 15 -w "  g2 브리지: %{http_code}\n" https://<bridge-host>
ssh root@<vps-ip> 'docker logs traefik-traefik-1 --since 3m 2>&1 | grep -iE "ERR|cannot be linked" | tail -5'
```

기대: 대시보드 `302`, g2 `426`, Traefik 에러 없음

- [ ] **Step 7: QR을 만든다**

```bash
cd <repo-root>
npx evenhub qr --url https://<app-host>
```

QR은 URL을 인코딩한 이미지일 뿐이므로 **한 번 만들어 저장해두면 맥 없이도 재스캔할 수 있다.**

---

### Task 4: 성공 기준 1~5 종단 검증

스펙의 완료 조건이다. 여기를 통과해야 맥을 철거할 수 있다.

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1의 토큰과 격리 설정, Task 2의 공개 엔드포인트, Task 3의 `.ehpk`
- Produces: 통과/실패 판정 — Task 5의 게이트

- [ ] **Step 0 (게이트): 설치 방식이 맥에 의존하지 않는지 확인한다**

⚠️ **이 태스크에서 가장 깨지기 쉬운 전제다.**

지금까지 안경에 앱을 띄운 방법은 `npm run qr`가 만드는 QR — 맥의 vite 개발서버(`http://<맥IP>:5173`)를 가리킨다. 그 방식이라면 **기준 2(맥 전원 OFF)는 구조적으로 통과할 수 없다.** 브리지가 VPS로 옮겨가도 앱 코드 자체를 맥이 서빙하기 때문이다.

폰의 Even Hub에서 확인한다: `.ehpk` 패키지를 로컬 설치하는 항목이 개발자 섹션에 있는가?

- **있으면** → 그 경로로 설치하고 Step 1로 진행한다.
- **없으면** → 상주 설치는 Even Hub Beta Testing을 거쳐야 하며, 이는 스펙에서 **범위 밖**으로 분류한 항목이다. 여기서 멈추고 보고할 것. 선택지는 두 가지다:
  1. Beta Testing 업로드를 이 계획에 편입한다 (범위 확대 — 사용자 판단 필요)
  2. 기준 2를 이번 범위에서 제외하고 기준 1·3·4·5만으로 완료 판정한다 (목표 2 미달 상태로 종료)

어느 쪽이든 조용히 진행하지 말고 사용자에게 결정을 요청한다.

- [ ] **Step 1: 폰에 새 `.ehpk`를 설치하고 접속 정보를 넣는다**

Step 0에서 확인한 경로로 `hermes-even-hub-app.ehpk`를 설치한 뒤, 앱 설정에 입력한다:

- URL: `wss://<bridge-host>`
- Token: Task 1 Step 5에서 출력된 새 토큰

⚠️ **페어링은 서버별 상태이지 `package_id`에 매이지 않는다.** 실제로 `package_id`도 커밋 ac2b7e0에서 `com.huntsyea.evendev` → `ai.crewnova.hermesg2`로 바뀌었고, 설령 유지됐더라도 무관하다 — VPS는 맥에서 승인된 적이 없으므로 처음 접속 시 "No pairing data found"를 낸다. VPS에 새로 승인해야 한다:

```bash
ssh root@<vps-ip> 'docker exec <agent-container> hermes pairing approve <platform> <code>'
```

⚠️ 인자 순서는 **platform이 먼저, code가 나중**이다 (거꾸로 넣으면 usage error). `hermes pairing list`가 보여주는 코드는 **해시 접두사**이지 입력할 코드가 아니다 — 실제 코드는 안경 화면에 뜬다. 그 코드를 읽어 입력한다.

URL과 토큰도 새로 입력해야 한다 (토큰이 회전됐다).

토큰/인증이 어긋났을 때 서버 로그에서 무엇을 볼 수 있는지는 브리지 버전마다 다르다. **로그가 비어 있어도 그것만으로 정상/비정상을 판정하지 말 것.** 진단은 클라이언트 쪽에서 동일 조건을 재현해서 하는 편이 빠르다.

- [ ] **Step 2: 기준 1 — 집 밖(셀룰러)에서 응답을 받는다**

폰의 Wi-Fi를 끄고 셀룰러만 켠 상태에서 안경으로 말을 걸어 응답을 받는다.

기대: 응답 도착. 실패 시 Traefik 로그와 브리지 로그를 본다:

```bash
ssh root@<vps-ip> 'docker logs traefik-traefik-1 --tail 30 2>&1 | grep -i g2 | tail -10'
ssh root@<vps-ip> 'docker exec <agent-container> sh -lc "tail -30 /opt/data/profiles/sophie/logs/errors.log" 2>/dev/null'
```

- [ ] **Step 3: 기준 2 — 맥 전원 OFF 상태에서 동작한다**

맥을 완전히 종료(절전 아님)한 뒤 Step 2를 반복한다.

기대: 동일하게 응답 도착. 맥과 무관함이 증명된다.

- [ ] **Step 4: 기준 3 — Slack 대화를 안경이 기억한다**

Slack 홈 채널에서 봇에게 기억할 만한 사실을 하나 말한다 (예: "내 프로젝트 코드명은 오션스마트다"). 그 다음 안경으로 "내 프로젝트 코드명이 뭐야?"라고 묻는다.

기대: 안경이 코드명을 답한다. `memory` 툴셋이 안경에 허용돼 있고 같은 프로필이라 컨텍스트가 공유된다.

답하지 못하면 격리 설정에서 `memory`가 빠졌는지 확인한다:
```bash
ssh root@<vps-ip> 'docker exec -e HERMES_HOME=/opt/data/profiles/sophie <agent-container> python /tmp/probe.py'
```

- [ ] **Step 5: 기준 4 — 안경에서 셸이 막히고 Slack에서는 열린다**

안경으로 "지금 디스크 용량 알려줘"라고 말한다.

기대: 에이전트가 **명령을 실행하지 않고** 해당 기능이 없다는 취지로 답한다.

이어서 **같은 요청을 Slack에서** 보낸다.

기대: Slack에서는 정상 실행되어 실제 용량이 나온다.

두 결과가 갈려야 격리가 플랫폼별로 작동한다는 증명이다. 안경에서 명령이 실행됐다면 즉시 중단하고 Task 1로 돌아가 `platform_toolsets`를 확인한다.

- [ ] **Step 6: 기준 5 — 맥 브리지를 정지해도 정상이다**

맥에서 `hermes gateway run` 프로세스를 종료한다:

```bash
pkill -f "hermes gateway run" || echo "이미 정지됨"
curl -s -o /dev/null -m 5 -w "맥 브리지 8766: %{http_code}\n" http://<mac-lan-ip>:8766 || echo "맥 브리지 응답 없음 (기대한 상태)"
```

이 상태에서 안경으로 다시 말을 건다.

기대: 정상 응답. 맥에 대한 의존이 완전히 끊겼다.

- [ ] **Step 7: 결과를 기록한다**

5개 기준의 통과/실패를 적는다. 하나라도 실패하면 Task 5로 진행하지 않는다.

---

### Task 5: 맥 경로 철거

Task 4가 전부 통과했을 때만 실행한다.

**Files:**
- Modify: `<repo-root>/app.json` (맥 LAN 2개 항목 제거)
- Build: `dist/` 재생성 (`npm run build`) — `.ehpk`는 더 이상 배포 경로가 아니므로 대상에서 뺀다
- Deploy: VPS `/docker/g2app/html/`에 `dist/*` + `app.json` 재배포

**Interfaces:**
- Consumes: Task 4의 전체 통과 판정
- Produces: 맥 호스트가 빠진 배포 산출물 (VPS `g2app` 정적 서버가 서빙)

- [ ] **Step 1: 게이트를 확인한다**

Task 4 Step 7의 기록에서 기준 1~5가 모두 통과인지 확인한다. 하나라도 실패면 이 태스크를 실행하지 않는다.

- [ ] **Step 2: 맥 항목을 화이트리스트에서 뺀다**

```bash
cd <repo-root>
python3 - <<'EOF'
import json, collections
p = "app.json"
d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
d["version"] = "0.3.1"
for perm in d["permissions"]:
    if perm.get("name") == "network":
        perm["whitelist"] = [u for u in perm["whitelist"] if "<mac-lan-ip>" not in u]
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
open(p, "a").write("\n")
print("제거 완료")
EOF
python3 -c "import json;d=json.load(open('app.json'));print('version:',d['version']);[print(' ',u) for u in d['permissions'][0]['whitelist']]"
```

기대: 4개 항목 (g2 2개 + tailnet 2개).

- [ ] **Step 3: 빌드한다**

⚠️ **`.ehpk` 재패킹·설치가 아니다.** Task 4 Step 0에서 폰 Even Hub에 `.ehpk` 로컬 설치 경로가 없음이 확인됐고, 그것이 Task 3.5(VPS 정적 서빙)가 존재하는 이유다. 배포 산출물은 `dist/`이고, 설치가 아니라 다음 Step의 VPS 재배포로 이어진다.

```bash
cd <repo-root>
npm run build
```

- [ ] **Step 4: VPS의 배포된 앱을 재배포한다**

⚠️ **이 Step을 빠뜨리면 안 된다.** 안경이 로드하는 것은 `/docker/g2app/html/`의 배포된 산출물이지 이 repo의 `app.json`이 아니다. `app.json`을 repo에서만 바꾸고 VPS에 올리지 않으면, repo는 0.3.1/4개인데 실제 서빙되는 사이트는 여전히 0.3.0/6개(맥 항목 포함)로 남는다.

```bash
cd <repo-root>
scp -r dist/* root@<vps-ip>:/docker/g2app/html/
scp app.json root@<vps-ip>:/docker/g2app/html/app.json
curl -s -m 20 https://<app-host>/app.json | python3 -c "import json,sys;d=json.load(sys.stdin);wl=d['permissions'][0]['whitelist'];print('version:',d['version'],'/ whitelist:',len(wl));print(' 192.168 항목 존재:', any('192.168' in u for u in wl))"
```

기대: `version: 0.3.1 / whitelist: 4`, `192.168 항목 존재: False`.

폰에서 QR을 재스캔한 뒤 안경으로 한 번 말을 걸어 여전히 동작하는지 확인한다.

- [ ] **Step 5: 맥의 자동 시작이 없는지 확인한다**

```bash
launchctl list 2>/dev/null | grep -i hermes || echo "launchd 항목 없음 (기대한 상태)"
pgrep -fl "hermes gateway" || echo "게이트웨이 미실행 (기대한 상태)"
```

`~/.hermes`는 지운다. 프로필과 설정은 보존한다 — 되돌릴 여지를 남긴다.

- [ ] **Step 6: 커밋한다**

```bash
cd <repo-root>
git add app.json
git commit -m "chore: drop Mac LAN host from whitelist

End-to-end verification passed on the VPS path, so the Mac bridge
is no longer a fallback.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git log --oneline -3
```

---

### Task 6: Tailscale 409 지원 티켓 — 2단계 착수

경로 B로 가려면 제3자가 움직여야 한다. 지금 접수해두면 대기 시간이 겹친다.

**Files:** 없음 (외부 커뮤니케이션)

**Interfaces:**
- Consumes: 없음 (Task 1~5와 독립. 언제든 실행 가능)
- Produces: 티켓 번호 — 해소되면 스펙의 "2단계 전환" 절차로 이어진다

- [ ] **Step 1: 사실관계를 모은다**

```bash
ssh root@<vps-ip> 'tailscale status --json 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(\"Tailnet:\", d.get(\"CurrentTailnet\",{}).get(\"Name\"));print(\"Node:\", d.get(\"Self\",{}).get(\"DNSName\"))"'
```

기대: `Tailnet: <org-tailnet>`, `Node: <tailnet-host>.`

- [ ] **Step 2: 티켓을 제출한다**

https://tailscale.com/contact/support 에 제출한다. 요지는 이렇다 — 같은
로그인이 복수 tailnet에 속해 있으면 iOS 앱 로그인이 `Error 409 Multiple users
with login` 으로 막히고, **클라이언트 쪽에서는 우회로가 없다.** 직접 로그인,
개인 계정으로의 노드 공유 초대, 시크릿 창 재수락까지 네 가지를 시도했으나
전부 실패했고, 계정 레이어에서만 풀리는 문제라 지원팀 회신을 기다려야 한다.
(iOS Tailscale은 auth key 로그인을 지원하지 않으므로 그 경로도 없다 —
[tailscale#675](https://github.com/tailscale/tailscale/issues/675).)

- [ ] **Step 3: 티켓 번호를 기록한다**

응답 시 스펙의 "2단계 전환" 5단계를 수행한다. 서버 변경은 없고 앱의 URL을 `wss://<tailnet-host>:8443`으로 바꾼 뒤 Task 4를 재검증하고, Task 2에서 추가한 8줄의 Traefik 라벨을 제거해 공개 노출을 끝낸다.

---

## 유지보수 — 플러그인 업데이트 시 필수

`hermes plugins update`를 실행했다면 `adapter.py`의 호환 패치가 덮였는지 반드시 확인한다. 업스트림에 병합되기 전까지는 자동으로 해결되지 않는다.

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie/plugins/hermes-evenhub-bridge
sed -i "s/async def connect(self) -> bool:/async def connect(self, *, is_reconnect: bool = False) -> bool:/" adapter.py
grep -n "async def connect" adapter.py'
```

기대: `async def connect(self, *, is_reconnect: bool = False) -> bool:`. 멱등하므로 반복 실행해도 안전하다. 적용 후 `docker restart <agent-container>`.

플러그인 디렉터리에 과거 설치 실패가 남긴 `.deps-failed-*` 마커가 남아 있을 수 있다. 실행 중 재시작을 막지 않음은 실증했지만, 다음에 플러그인 실패를 디버깅할 사람을 헷갈리게 하니 발견하면 무시하지 말고 확인할 것.

### ASR 패치 2건 (2026-07-31 추가, **적용 대기 중**)

⚠️ **다음 게이트웨이 재시작 때 자동으로 적용된다.** 파일은 이미 고쳐져 있고 실행 중인 프로세스만 구버전이다. 재시작하는 사람이 ASR 동작 변화에 놀라지 않도록 여기 남긴다.

백업: `asr/__init__.py.bak.20260731_151233`, `asr/whisper.py.bak.20260731_151233`

```bash
ssh root@<vps-ip> 'cd /docker/<agent-stack>/data/profiles/sophie/plugins/hermes-evenhub-bridge/asr
# 1) 레지스트리에 whisper-small 추가 (선택지만 늘림 — 켜려면 EVENHUB_ASR_MODEL 지정 필요)
grep -q "whisper-small" __init__.py || sed -i "/\"whisper-tiny\":/a\\    \"whisper-small\":        ModelSpec(\"whisper\", \"multi\", model_size=\"small\")," __init__.py
# 2) compute_type=int8 (동일 출력에 30% 빠름 — 1.48s → 1.04s 실측)
grep -q compute_type whisper.py || sed -i "s/WhisperModel(self._model_size)/WhisperModel(self._model_size, compute_type=\"int8\")/" whisper.py
grep -n "whisper-small" __init__.py; grep -n "WhisperModel(" whisper.py'
```

**활성 모델은 `whisper-tiny`로 고정돼 있다** (`.env`의 `EVENHUB_ASR_MODEL=whisper-tiny`). `whisper-small`은 레지스트리에만 있고 켜져 있지 않다.

**왜 small을 안 쓰는가** — 이 VPS는 1 vCPU다. 실측으로 1.9초 발화에 small 6.2초 / base 3.0초 / tiny 1.8초가 나왔다. small은 4초 발화면 ASR만 13초라 안경 UX에서 감당이 안 된다. 코어를 늘리면(4 vCPU 실질 최소, 8 vCPU 쾌적, RAM 8GB 권장) `.env` 한 줄로 전환 가능하다.

**한국어 정확도의 실제 쟁점은 정확도가 아니라 실패 방식이다.** 잡음(SNR 5dB)에서 tiny는 언어를 착각해 베트남어로 붕괴하고, base·small은 뭉개져도 한국어를 유지한다. 뒤의 LLM은 뭉개진 한국어는 복원하지만 붕괴는 못 살린다.
