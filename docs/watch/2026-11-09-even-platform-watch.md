---
type: 감시노트
created: 2026-11-09
status: 미읽음
topic: Even G2 플랫폼 주간 변화
previous: 2026-11-02-even-platform-watch.md
tags: [감시, even-g2, hermes]
---
# Even G2 플랫폼 주간 감시 2026-11-09

## 한 줄 요약
확인된 범위에서 변화 없음 (SDK 0.0.16·CLI 0.2.0, 저장소 최신 커밋 cb8321f 2026-10-21 그대로). 이슈·PR 갱신 여부는 4주째 확인 실패.

## 우리 앱에 영향이 있는 것 (있을 때만)
- 새로 확인된 영향 항목 없음. #26(오디오 출력)·PR #43(롱프레스 문서)·#41의 Even 측 답변 여부는 재확인하지 못했다 → 접근 가능한 환경에서 수동 확인 권장.

## (a) SDK·CLI
변화 없음 (확인값: `@evenrealities/even_hub_sdk` 0.0.16 / 2026-09-24T09:12:37Z, `evenhub-cli` 0.2.0). 근거: `npm view`. 새 버전이 없어 changelog·d.ts diff 해당 없음.

## (b) everything-evenhub 이슈·PR·커밋
- 커밋: 변화 없음 (확인값: 최신 cb8321f, 2026-10-21, "Merge pull request #42 from even-realities/skills/cli-changes"; `git clone --depth 30` 으로 확인). 기준선 이후 새 커밋 없음.
- 이슈·PR·코멘트: 확인 실패: `curl -sL` 로 github.com/even-realities/everything-evenhub/issues 와 /pulls 요청 모두 HTTP 403. WebSearch 1회: 해당 저장소 이슈가 검색되지 않음(일반 기사만 나옴). 기준선 이후 이슈·PR 갱신 여부는 미확인.

## (c)(d) 블로그·Even Day·Even App·지원 문서
이 샌드박스에서 닿지 않는 출처. Firecrawl 감시기(월 08:30 KST)가 맡는다.

## 다음 주 기준선
- SDK 0.0.16 (2026-09-24), CLI 0.2.0
- everything-evenhub 마지막 커밋 cb8321f (2026-10-21)
- 이슈·PR: 기준선 유지 (#26 updated 2026-10-23, PR #43 미병합 — 미재확인)
