# 이미지·GIF·영상 연결 안내

현재 `src/data/media.json`의 실제 캡처 항목은 비어 있다. 갤러리의 웹 모식도와 연결 시뮬레이션은 원작 영상이 아니다. 제공될 파일을 검토한 뒤 이 manifest에 연결하면 같은 소스로 GitHub Pages와 Cloudflare Pages에 게시된다. 로컬 디스크 경로를 웹 URL에 그대로 넣지 않는다.

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

## 조사 연결

이미지에서 실제 배치·색·아이템 외형을 확인하고, 영상에서 상태 전후·입력·연출 시작/끝을 기록한다. 가격·오퍼 노출은 계정 진행, 재화, 결제 이력, 이벤트와 시각에 따라 달라질 수 있으므로 캡처 한 건을 일반 규칙으로 바꾸지 않는다. 연구의 정적 코드/내장 설정/문구/추론 구분도 유지한다.

내장 아이템 도감은 `Type`이 있는 39개 ItemModelConfig 계열 테이블의 4,270개 선언이다. 같은 타입의 변형도 포함하며 유일한 이미지 4,270장을 확보했다는 뜻은 아니다. 생성기 여부는 `Spread_` 필드의 존재로 분류한 탐색용 역할이다. UI 1,644건은 프리팹 연결 선언이며 실제 표시된 화면 수가 아니다.

자료를 연결한 뒤 `npm test`, `npm run build`, `npm run check`를 실행하고, 재생·정지·크게 보기와 휴대폰 크기에서의 화면을 확인한다. 원본 APK·복원 Lua 전체·플레이어 개인정보는 배포 자료에 넣지 않는다.
