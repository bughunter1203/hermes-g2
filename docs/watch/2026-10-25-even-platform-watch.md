---
type: 감시노트
created: 2026-10-25
status: 미읽음
topic: Even G2 플랫폼 주간 변화
previous: 2026-10-25-even-platform-watch.md (같은 날 이전 실행분, 덮어씀)
tags: [감시, even-g2, hermes]
---
# Even G2 플랫폼 주간 감시 2026-10-25

## 한 줄 요약
확인된 범위에서 새 변화 없음 (SDK 0.0.16·CLI 0.2.0, 저장소 최신 커밋 cb8321f 2026-10-21 그대로). 확인 실패: GitHub API 이슈/PR(WebFetch 403), 블로그·Luma·App Store·지원 문서·hub 문서(WebFetch ENOTFOUND).

## 우리 앱에 영향이 있는 것 (있을 때만)
- 이번 실행에서 새로 확인된 영향 항목 없음. 직전 노트가 짚은 #26(updated 2026-10-23)·PR #43(롱프레스 문서)은 이번에 API 403 으로 재확인하지 못함 → 다음 실행에서 Even 측 코멘트 여부와 #43 병합 여부 확인.

## (a) SDK·CLI
변화 없음 (확인값: `@evenrealities/even_hub_sdk` 0.0.16 / 2026-09-24T09:12:37Z, `evenhub-cli` 0.2.0). 근거: `npm view`. 새 버전이 없어 changelog·d.ts diff 해당 없음.

## (b) everything-evenhub 이슈·커밋
- 커밋: 변화 없음 (확인값: 최신 cb8321f, 2026-10-21, "Merge pull request #42 from even-realities/skills/cli-changes"; `git clone` 으로 확인. 그 아래 f10f12f·367cc51·215d6a2·7e41333·e212257 은 모두 CLI 0.2.0 문서 정리, 10-13~10-21). 근거: https://github.com/even-realities/everything-evenhub
- 이슈·PR·코멘트: 확인 실패: WebFetch 로 api.github.com 요청이 HTTP 403. GitHub MCP 는 세션 범위 밖 저장소라 사용하지 않음. 직전 노트 값(open 이슈 #26 만 updated 2026-10-23, PR #43 미병합)이 기준선으로 남음.

## (c) 블로그·Even Day
- 블로그(evenrealities.com/blogs/even-insider): 확인 실패: WebFetch ENOTFOUND.
- Even Day SF(luma.com/jvcxz1he): 확인 실패: WebFetch ENOTFOUND. WebSearch "Even Day SF Even Realities November 2026" 에서는 SF 행사 정보 못 찾음(검색 결과는 Even Day Japan 2026, 2026-07-17 도쿄만 나옴). 변동 여부 미확인, 2026-11-05 기준선 유지.

## (d) Even App·펌웨어·지원 문서
- App Store, support.evenrealities.com(홈·두 문서): 확인 실패: WebFetch ENOTFOUND.
- WebSearch "Even Realities app release notes": 앱 릴리스 노트 못 찾음. 검색 요약에 따르면 개발자 changelog(https://hub.evenrealities.com/docs/reference/changelog)는 2026-08-25 갱신본에 SDK 0.0.14 / CLI 0.1.14 / simulator 0.9.3 으로 표시(이미 오래된 정보, 직접 열람은 ENOTFOUND). 강제 업그레이드 지원 글은 앱 V2.2.5 이상 요구.

## 다음 주 기준선
- SDK 0.0.16 (2026-09-24), CLI 0.2.0
- everything-evenhub 마지막 커밋 cb8321f (2026-10-21); PR #43 미병합(직전 노트 기준, 이번 미재확인); #26 updated 2026-10-23
- Even App 2.3.2 / 펌웨어 2.3.0.24 / Even Day SF 2026-11-05: 2주 연속 미확인(기준선 유지)
