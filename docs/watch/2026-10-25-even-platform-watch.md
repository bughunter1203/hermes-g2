---
type: 감시노트
created: 2026-10-25
status: 미읽음
topic: Even G2 플랫폼 주간 변화
previous: 없음
tags: [감시, even-g2, hermes]
---
# Even G2 플랫폼 주간 감시 2026-10-25

## 한 줄 요약
확인된 범위에서 기준선 대비 새 변화 없음 (SDK 0.0.16·CLI 0.2.0 그대로, 저장소 최신 커밋 2026-10-21 그대로). 단, (c)(d) 4개 출처는 접속 실패로 확인하지 못함.

## 우리 앱에 영향이 있는 것 (있을 때만)
- #26(오디오 출력) 이슈 updated_at 이 2026-10-23 로 갱신(코멘트 2건) → 기준선 이후 활동일 수 있으나 코멘트 작성자·내용은 API 제한으로 확인 못함 → 다음 실행에서 Even 쪽 코멘트 여부를 직접 확인.
- PR #43 "docs: SDK 0.0.14 contextual menu, tap then long press, text brightness"(COLLABORATOR, 2026-10-21 갱신, 미병합) → 롱프레스/입력 동작 문서화이므로 #27·#41 과 관련될 수 있음 → 병합 후 내용 확인.

## (a) SDK·CLI
변화 없음 (확인값: `@evenrealities/even_hub_sdk` 0.0.16 / 2026-09-24T09:12:37Z, `evenhub-cli` 0.2.0). 근거: `npm view` 결과. 새 버전이 없어 changelog·d.ts diff 는 해당 없음.

## (b) everything-evenhub 이슈·커밋
- 커밋: 변화 없음 (확인값: 최신 cb8321f, 2026-10-21, "Merge pull request #42 from even-realities/skills/cli-changes", `git clone` 으로 확인). 
- 열린 이슈/PR: 확인된 항목 18건(WebFetch 로 API 응답 읽음, 직접 curl 은 프록시에서 거부됨). 기준선의 "open 30건"과 달라 보이나 응답 절단·PR 포함 여부를 검증하지 못해 비교 불가.
- 새 PR: #43(위 참고).
- 우리가 보는 이슈 현황 (코멘트 수 / updated_at): #9 3/2026-08-20, #11 1/2026-05-22, #16 3/2026-08-25, #18 6/2026-09-05, #20 0/2026-08-09, #21 0/2026-08-09, #26 2/**2026-10-23**, #27 0/2026-08-11, #36 1/2026-09-16, #41 1/2026-10-05.
- Even 쪽 코멘트 인용: 코멘트 본문·author_association 을 읽지 못해 인용 불가 (확인 실패: GitHub API 접근 제한, WebFetch 는 목록만 반환).
- 참고 이슈 제목(신규 여부 판단 불가, 전체 열람 목록): #28 BLE UART, #29~#35 CLI/문서 오류, #37 비라틴 글꼴, #38 buzzer API, #39·#40 권한 관련.
- 근거: https://github.com/even-realities/everything-evenhub

## (c) 블로그·Even Day
확인 실패: www.evenrealities.com, luma.com 모두 호스트 해석 불가(ENOTFOUND, 샌드박스 네트워크 제한). Even Day SF 2026-11-05 변동 여부 미확인.

## (d) Even App·펌웨어·지원 문서
확인 실패: apps.apple.com, support.evenrealities.com 호스트 해석 불가(ENOTFOUND). Even App 2.3.2, 펌웨어 2.3.0.24, Agent Configuration 문서 변동 여부 미확인.

## 다음 주 기준선
- SDK `@evenrealities/even_hub_sdk` 0.0.16 (2026-09-24), CLI 0.2.0
- everything-evenhub 마지막 커밋 cb8321f (2026-10-21); PR #43 미병합
- 보는 이슈 중 #26 만 updated_at 2026-10-23, 나머지는 위 표와 동일
- Even App 2.3.2 / 펌웨어 2.3.0.24 / Even Day 2026-11-05: 이번 주 미확인(이전 기준선 유지)
