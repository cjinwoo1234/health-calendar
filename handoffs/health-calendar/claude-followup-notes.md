# Claude 후속 작업 노트 (Codex 확인용)

`codex-verification-result.md` 이후 사용자 요청으로 아래 기획/구현이 추가됐다. `docs/health-calendar/01-prd.md`에도 동일 내용을 반영해뒀다.

## 1. "몸 상태" 증상 체크 항목 추가

- 기존 4개 체크리스트(수면/수분/식사/운동)와 별도로 "손 저림 또는 힘 빠짐" 체크 항목을 추가.
- 완료율 계산(`completionRate`)은 여전히 `CHECK_KEYS` 4개 기준 그대로 — 증상 항목은 의도적으로 제외(체크될수록 나쁜 신호라 "달성률"과 의미가 반대이기 때문).
- `hasContent`(기록 존재 여부/캘린더 점 표시 판정)에는 포함.
- 진단처럼 보이지 않도록 힌트 문구 추가: "참고 기록용이며 진단이 아니에요. 증상이 심하거나 갑자기 나타났다면 병원 진료를 받아보세요."

## 2. 증상 체크 시 발생 시각 / 지속 시간 입력 추가

- 체크박스가 체크된 경우에만 `#numbness-detail` 블록이 나타나며 다음을 입력받는다.
  - 발생 시각: `<input type="time" id="numbness-time">` → `record.numbnessTime` ("HH:MM")
  - 지속 시간: `<select id="numbness-duration">` → `record.numbnessDuration` (`under5`/`5to30`/`30to60`/`over60`/`ongoing`)
- 체크 해제 시 두 값은 빈 문자열로 저장해 이전 값이 남지 않게 처리(`onFormSubmit`).
- 저장/새로고침 복원 및 체크 해제 시 필드 숨김 동작을 Chrome에서 직접 검증함.

## 3. 버그 수정 — CSS `[hidden]` 무력화

- `.symptom-detail { display: grid; }`가 브라우저 기본 `[hidden] { display: none; }` 규칙을 덮어써서, 체크 해제 상태에서도 발생 시각/지속 시간 블록이 계속 보이는 버그가 있었다.
- `.symptom-detail[hidden] { display: none; }`를 추가해 수정. (author-origin 규칙이 UA 기본 규칙보다 우선하는 CSS 캐스케이드 특성 때문에 발생한 전형적인 실수라 다른 `hidden` 토글 요소를 새로 추가할 때도 같은 패턴 주의할 것.)

## 4. 모바일 320px 반응형 버그 수정

- 사용자가 실제 폰에서 "달력 날짜가 밀린다"고 리포트.
- 원인 1: `.weekday-row`(요일 헤더)에는 `gap`이 없고 `.calendar-grid`(날짜)만 `gap:4px`라 두 그리드의 컬럼 폭이 달라, 화면이 좁을수록 날짜가 요일 아래에서 오른쪽으로 밀려 보임 → `.weekday-row`에도 `gap:4px` 적용해 정렬 일치시킴 (픽셀 단위로 drift 0 확인).
- 원인 2(추정, 실제 기기 재현은 도구 제약으로 직접 재현은 못 했음): 모바일 브라우저의 자동 텍스트 크기 확대(`text-size-adjust`)로 좁은 셀 안 텍스트가 커져 깨져 보일 가능성 → `html { -webkit-text-size-adjust:100%; text-size-adjust:100%; }` 추가.
- `@media (max-width: 359px)` 블록 신설: `.app` 패딩/`.card` 패딩/`.calendar-grid` gap/`.day-cell` 최소높이·폰트를 더 촘촘하게 줄여 320px 기기에서 여유 확보.
- 참고: 이 세션에서 사용한 브라우저 자동화 도구(`resize_window`)가 실제 뷰포트(`window.innerWidth`)를 바꾸지 못해 `min-width:640px` 미디어쿼리 이하 구간을 라이브로 완전히 재현·검증하지 못했다. 사용자가 실제 폰에서 재확인 예정이며, 여전히 문제가 있으면 스크린샷과 함께 다시 리포트받아 추가 조치 필요.

## 배포 상태

- GitHub 리포지토리: https://github.com/cjinwoo1234/health-calendar (public)
- GitHub Pages: https://cjinwoo1234.github.io/health-calendar/ (위 변경사항 모두 push 및 배포 완료)
