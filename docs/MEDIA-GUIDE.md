# 이미지·GIF·영상 연결 안내

`src/data/media.json`에 APK 정적 이미지와 과거 사용자 캡처를 각각 등록했다. `#captures`에서 주제/형식 필터와 실제 화면을 볼 수 있다. 갤러리의 웹 모식도와 독립 시뮬레이션은 원작 영상과 별도로 표시한다. 같은 소스로 GitHub Pages와 Cloudflare Pages에 게시하며 로컬 디스크 경로를 웹 URL에 넣지 않는다.

## 등록 구조

검토한 파일을 `src/assets/media/` 안에 넣고, 파일명은 영문·숫자·하이픈으로 정리한다. 정지 이미지 PNG/JPEG/WebP, GIF, 영상 MP4/WebM을 지원한다. GIF·영상은 사용자가 재생을 요청할 때 연다. 모션이 있는 캡처에는 정지 `poster`를 권장한다.

```json
{
  "key": "effect:merge",
  "kind": "gif",
  "src": "./assets/media/merge-01.gif",
  "poster": "./assets/media/merge-01-poster.webp",
  "alt": "동일 아이템 두 개의 합성과 결과 팝 연출",
  "source": "사용자 제공 플레이 영상 파일명 · 00:12–00:15",
  "capturedAt": "실제 촬영 일시를 아는 경우만 기입",
  "version": "실제 촬영 게임 버전을 아는 경우만 기입",
  "notes": "기기·계정 진행·실험 조건·확인할 내용"
}
```

위 객체를 manifest의 `entries` 배열에 추가한다. 예시 자체는 등록된 캡처가 아니다. 동일 키는 한 번만 등록하고 대표 자료를 지정한다. `alt`와 `source`는 필수이며 시점·버전을 모르면 추정하지 않는다.

## 연결 키

| 대상 | 키 | 찾는 위치 |
|---|---|---|
| 퍼즐 개별 타입 | `item:ItemModelConfig:106` | 타입 카드의 출처·미디어 연결. 변형은 정확한 테이블명 사용 |
| 퍼즐 동작 | `effect:merge`, `generate`, `drag`, `bubble`, `hint`, `cooldown`, `reward`, `unlock` 앞에 `effect:` | 퍼즐 동작 카드 |
| UI 동작 | `effect:window`, `hud`, `queue`, `tutorial`, `mask`, `counter` 앞에 `effect:` | UI 연출 카드 |
| UI 컴포넌트 | `ui:프리팹이름:인덱스` | 화면 카드의 프리팹·캡처 연결에 표시되는 전체 키 |
| 게임 장면 | `screen:loading`, `title`, `tutorial`, `main`, `play`, `home` 앞에 `screen:` | 게임 시뮬레이션의 원작 화면 비교 자료 |
| 독립 관측 자료 | `capture:energy-chain`, `reward-queue`, `boost`, `upgrade` 앞에 `capture:` | 실제 화면 갤러리. 이름이 비슷한 모식도와 자동 연결하지 않음 |

## 조사 연결

이미지에서 실제 배치·색·아이템 외형을 확인하고, 영상에서 상태 전후·입력·연출 시작/끝을 기록한다. 가격·오퍼 노출은 계정 진행, 재화, 결제 이력, 이벤트와 시각에 따라 달라질 수 있으므로 캡처 한 건을 일반 규칙으로 바꾸지 않는다. 연구의 정적 코드/내장 설정/문구/추론 구분도 유지한다.

내장 아이템 도감은 `Type`이 있는 39개 ItemModelConfig 계열 테이블의 4,270개 선언이다. 같은 타입의 변형도 포함하며 유일한 이미지 4,270장을 확보했다는 뜻은 아니다. 생성기 여부는 `Spread_` 필드의 존재로 분류한 탐색용 역할이다. UI 1,644건은 프리팹 연결 선언이며 실제 표시된 화면 수가 아니다.

자료를 연결한 뒤 `npm test`, `npm run build`, `npm run check`를 실행하고, 재생·정지·크게 보기와 휴대폰 크기에서의 화면을 확인한다. 원본 APK·복원 Lua 전체·플레이어 개인정보는 배포 자료에 넣지 않는다.

## APK 정적 이미지

추가된 원본 PNG24개는 `origin: packaged-sprite`로 구분하며 `sha256`과 Sprite객체/번들 출처를 보존합니다. `asset:이름`24개와 명시적인 기본타입20개가 같은 파일을 참조하여 총44키입니다. 이는 화면 캡처나44개 고유 이미지가 아닙니다.

## 사용자 제공 캡처

영상 보류는 해제되었다. `origin: observed-user-capture`, `version: null`, `capturedAt: null`로 과거 화면임을 표시한다. `originalSha256`은 원본, `sha256`은 공개 파생본을 식별한다. 영상의 `sourceRange`는 발췌 시작/종료이며 `transform`은 크롭·크기·24fps·무음·원속도를 기록한다. 정확한 입력 시각이나 원작 프레임 시간을 측정한 값이 아니다.

원본/정리본은 하드링크이므로 직접 편집하지 않는다. 공개용 파생본에서 상단 계정 식별 워터마크와 OS 알림을 제외하고, 결제 화면 전체·개인정보·로컬 경로·검토용 연락 시트를 배포하지 않는다. 보상 대기열은 UI 팝업 FIFO와 다르고 체인의 무료 보상 잠금은 퍼즐 봉인 해제와 다르므로 대응하지 않는 `effect:*`키를 쓰지 않는다.
