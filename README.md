# Harbor Research · 가십하버 시스템 분석실

현재 전체 작업의 완료/미완료와 종료 기준은 [전체 작업 장부](docs/MASTER-CHECKLIST.md)에 있다. 기존2~5번 전체는 **부분 완료**다.

최근 반영: **0.04·3.05~3.20**의 실제 UI 안내, 설정형 패스·앨범·대표 이벤트와 메인 모의 경제, 공통 지도·CG·native 로딩 자료를 연결했습니다. 외부85연산 중29handler, 공통 맵125/CG22/native4 이미지와 회상 페이지 효과음1개를 확인했습니다. 같은17개 ID 중 기존 완료4개는 유지하며 나머지13개는 부분 완료입니다. [이번 결과와 같은 ID의 잔여 조건](docs/WORK-004-305-320-2026-10-29.md)을 확인하세요. 자동 검사561개·빌드1219파일/91,603KiB·게시 경계를 검사하며 실제 브라우저 직접 검수는 미수행입니다.

Gossip Harbor Android **4.10.5**의 제공 XAPK를 정적으로 조사한 시스템 위키와 브라우저 시뮬레이터입니다. 난이도·퍼즐 기믹·유저 조작·퍼즐 연출·맵·맵 연출·UI·BM·이벤트·재화의 **10개 분석 페이지**를 제공합니다. 순수 HTML/CSS/ES modules로 작성했으며 같은 `dist/`를 GitHub Pages와 Cloudflare Pages에서 제공합니다. 서버·데이터베이스·외부 API가 필요 없습니다.

## 실행과 검증

Node.js 22 이상에서 실행합니다. 런타임 의존성은 없으며 DOM 테스트에 jsdom 개발 의존성을 사용합니다.

```sh
npm ci
npm test
npm run build
npm run check
npm run dev
```

로컬 주소는 `http://127.0.0.1:4173`입니다. 소스는 `src/`, 게시 결과는 `dist/`입니다. URL은 상대 경로와 hash navigation을 사용하므로 `https://계정.github.io/저장소/` 하위에서도 동작합니다.

## 계속 공유하기

### GitHub Pages

1. 저장소 Settings → Pages → Build and deployment의 Source를 **GitHub Actions**로 선택합니다.
2. `main`에 push하면 `.github/workflows/github-pages.yml`이 테스트 → 빌드 → 데이터 검사 → 게시를 수행합니다.
3. 배포 주소는 [가십하버 BM 분석실](https://ijh114.github.io/gossip-harbor-research/)입니다. 첫 배포와 페이지·데이터 정상 응답을 확인했습니다.

### Cloudflare Pages — Git 연동

공유 주소: [Cloudflare 분석실](https://gossip-harbor-research.pages.dev/). 첫 배포와 분석 데이터 정상 응답을 확인했습니다.

Workers & Pages → Create application → Pages → Connect to Git에서 같은 저장소를 연결합니다.

| 설정 | 값 |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 저장소 루트 |
| NODE_VERSION (선택) | `24` |

이후 같은 `main` push로 두 서비스가 갱신됩니다. Cloudflare Git 연동을 쓰면 별도 Cloudflare API 토큰은 필요 없습니다.

### Cloudflare Pages — 선택적 CI 직접 업로드

Git 연동 대신 직접 업로드를 쓰는 경우 `.github/workflows/cloudflare-pages.yml`을 사용할 수 있습니다. Pages 프로젝트를 생성한 뒤 Repository Variables에 `CLOUDFLARE_PROJECT_NAME`, Secrets에 `CLOUDFLARE_API_TOKEN`(해당 계정 Pages Edit), `CLOUDFLARE_ACCOUNT_ID`를 설정합니다. 프로젝트 변수가 비어 있으면 이 workflow는 게시를 건너뜁니다. Git 연동과 직접 업로드 중 한 방식을 선택하세요.

## 분석 범위

- REA: XAPK 컨테이너·APK 서명 레코드·IL2CPP v31 메타데이터 정적 검사.
- UnityPy: Addressables 번들·TextAsset·설정 리소스 해석.
- Lua: 패키지 프레이밍 분리, 2,494개 모듈 경계·해시 검증, 정적 디컴파일. 복원 키는 REA 메타데이터 문자열과 교차 확인.
- 출처를 연결한 분석 229건과 글로벌 IAP 기본 선언 251개. 정적 코드·내장 설정·문구·과거 캡처·웹 모델 실행을 구분합니다.
- 내장 초기7×9/63칸, 주문필터, 스토리292개 day/48종 영역ID와 비용 집계, 타임라인·연출 수치, UI상태·레이어·표시 게이트를 각 페이지에 연결.
- BM 노출 규칙22개, 글로벌 IAP 선언251개를 근거와 함께 정리.
- 최신 영상·이미지·위키 보강의 자동 검사 **261개**, 빌드/게시 경계 검사가 통과했습니다. 실제 브라우저 제어가 비활성화되어 신규 화면 시각 검수는 미완료입니다. 이전244/254개 검사와 Chrome375px/데스크톱 검수는 당시 기록입니다. [정밀 보강 결과](docs/MEDIA-REFINEMENT.md), [후속 상태](docs/FOLLOWUP-STATUS.md)를 참고합니다.

LDPlayer에서 설치 버전과 시작 뒤 검은 화면만 확인했고 사용자 요청으로 분석을 중단했습니다. 이후 실플레이·실제 결제·광고 재생·원작 서버 접속은 수행하지 않았습니다. **내장 USD 기본가격은 현재 실판매가가 아닙니다.** 서버 배정·현행 이벤트 일정·가격·개인화·전환율은 미확정입니다. 코드 존재, 설명문 존재, 실행 관측은 서로 다른 근거입니다.

## 데이터 갱신

`src/data/research.json`은 기존 BM 근거·상품·트리거를, `src/data/domains.json`은 확장 조사103개·페이지 구성·구조도·집계를 담습니다. `domain-model.mjs`가 둘의 버전·ID를 확인해 합칩니다. 각 fact는 안정적인 `id`, 근거 유형, 해석, 출처 경로·행·짧은 발췌·SHA-256을 보존합니다. `evidence_id`는 실제 REA가 반환한 기록에만 사용합니다. PZ/FX/UI/MAP 식별자는 자체 조사 항목 ID입니다.

새 페이지는 `domain-model.mjs`의 정의와 `domains.json`의 섹션·시각화에서 관리합니다. 데이터/표시 로직은 `domain-pages.mjs`, 추가 스타일은 `domains.css`입니다. 기존 `#wiki`, `#catalog`, `#triggers`, `#simulator` 링크는 유지됩니다.

원본 XAPK SHA-256:

`2e19f0e6ead8a37183387d7c1269fc796ed2948c6ab8a0163de3019e0186a6f9`

원본 APK·추출 바이너리·전체 Lua 소스·전체 로컬라이제이션·개인 계정 데이터는 이 저장소와 게시 파일에 포함하지 않습니다. 연구 페이지에는 선택한 근거와 짧은 발췌만 포함합니다.

## 페이지 바로가기

| 영역 | 페이지 |
| --- | --- |
| 난이도 설계 | [주문 필터·점수·시간/공간 압력](https://gossip-harbor-research.pages.dev/#difficulty) |
| 퍼즐 기믹 | [63칸 초기 보드·생성기·봉인·도구](https://gossip-harbor-research.pages.dev/#mechanics) |
| 유저 상호작용 | [탭·드래그·드롭·힌트·복구](https://gossip-harbor-research.pages.dev/#interaction) |
| 퍼즐 연출 | [합성/생성 시간표·보상 피드백](https://gossip-harbor-research.pages.dev/#puzzle-fx) |
| 인게임 맵 | [스토리 순번·퀘스트·슬롯·골드](https://gossip-harbor-research.pages.dev/#map) |
| 맵 연출 | [타임라인·대사·카메라·스킵](https://gossip-harbor-research.pages.dev/#map-fx) |
| UI 구조 | [창 수명·정렬·입력 잠금·표시 게이트](https://gossip-harbor-research.pages.dev/#ui) |
| BM 종합 | [전환 구조·상점·오퍼·패스](https://gossip-harbor-research.pages.dev/#bm) |
| 이벤트·운영 | [해금·시간·구매 연동](https://gossip-harbor-research.pages.dev/#events) |
| 재화·성장 | [에너지·젬·골드·창고 경제](https://gossip-harbor-research.pages.dev/#economy) |
| 제작 리소스 | [MVP·출시형 범위 비교와 그래픽 요청서](https://gossip-harbor-research.pages.dev/#production-assets) |
| 영상 검토 장부 | [원본별 시간 구간·관측·검토 범위](https://gossip-harbor-research.pages.dev/#media-audit) |

## 시뮬레이터의 경계와 Unity 이식

`#experience`의 현재 게임형 플레이와 별도로, `#simulator`에는 초기 독립 규칙 실험을 유지합니다. 이 실험은 에너지 회복/충전/누적 무료 횟수/가격 리셋과 조건부 오퍼 우선순위를 다룹니다. 서버 후보와 임계치는 사용자가 조정하는 **실험 입력**입니다. 실험용 6×5 보드·두 체인·주문 보상은 독립 설계 가정입니다. 현재 게임형 플레이의 기본 552타입·63칸·주문/성장 투영 범위와 구분합니다.

`src/engine.mjs`는 UI·네트워크와 분리된 상태/규칙 모듈입니다. 향후 Unity에서는 EconomyState, OfferRule, PopupQueue, ContentCatalog를 분리하고 동일 경계 테스트를 이식합니다. 시뮬레이터의 JSON 내보내기는 테스트 상태와 입력값 전달을 위한 형식이며 Unity 프로젝트나 원작 코드 자동 변환을 뜻하지 않습니다.

배포 설정 근거: [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare Pages CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

## 읽기와 탐색

본문 17px의 한글 Pretendard 서체, 큰 글씨 설정, 페이지 목차, 분석 상세 펼치기와 항목별 공유 링크를 제공합니다. 상단 검색에서 분석 페이지·규칙·상품을 함께 찾습니다. `/` 또는 Ctrl/Cmd+K로 검색, ↓로 결과 선택, Enter로 이동, Escape로 닫습니다.

디자인 기준은 [DESIGN.md](DESIGN.md), 점검 범위와 화면 검증 제한은 [가독성 점검](docs/READABILITY-REVIEW.md)에 기록했습니다. 폰트 라이선스는 `src/assets/fonts/OFL.txt`입니다.

## 시각 탐색과 플레이

- **퍼즐**: [타입 도감](https://gossip-harbor-research.pages.dev/#puzzle), [연출 도감](https://gossip-harbor-research.pages.dev/#puzzle-motion), [상호작용](https://gossip-harbor-research.pages.dev/#puzzle-interaction), 난이도 페이지를 분리했습니다. 퍼즐 상단 중복 탭은 제거했고 상호작용12GIF는 실제 영상1개와 APK 규칙 재현11개를 구분합니다.
- **UI**: 화면 도감·구조·연출. 프리팹 연결1,644건은 실제 화면1,644개나 고유 이미지 수가 아닙니다.
- **연구**: 10개 시스템 분석·전체 근거·상품·규칙 실험·BM 관측 타임라인과 조건식을 접이식 트리에서 탐색합니다.
- **게임 시뮬레이션**: 기본552타입·생성기163종, 복수슬롯·고정16주문/일반랜덤5종, 보관함, 생성 보정·자연 버블·특수도구, 기본4,277과제/300레벨행, 플레이 재화와 상점/오퍼/이벤트를 연결합니다. 원작 전체 화면·성장·현행 서버와 동일 검증을 마친 결과는 아닙니다.

연구 보충·직접 재화 편집·안내 건너뛰기·유료 충전 없이30주문→15과제→레벨5를 웹 모델로 실행했습니다. 별도 경로에서 고정16주문을 모두 완료했습니다. 이는 원작 실기·최적 효율·실제 소요시간 측정이 아닙니다. 튜토리얼은16개 웹 논리와2개 시작 논리 진입을 연결했으며97개 ID는 활동·원작 장면 등 추가 근거가 필요합니다.

## 자산·관측·제작 범위

기본 타입 이미지544/552개·별도6변형·미확보8사유를 제공하고 패키지 이미지 참조599키를 보존합니다. 과거 캡처 파생42키(정지30·영상11·GIF1)와 규칙 재현GIF11키는 별도입니다. 같은 PNG의 여러 키 참조를 고유 이미지 수로 세지 않습니다. 공개 파생본의 원본 ID·해시·구간·크롭은 [미디어 manifest](src/data/media.json)에 있으며 [연결 안내](docs/MEDIA-GUIDE.md)와 [도감 검수](docs/PUZZLE-GALLERIES.md)를 따릅니다.

BM9유형·42관측점은 버전 미확인 과거 영상의 선택 구간입니다. 별도 [영상 검토 장부](https://gossip-harbor-research.pages.dev/#media-audit)는 전체113개·95분5초의 원본 해시/디코드와 가십하버110개·94분17초의 시간순 표본 1차 검토를 기록합니다. 약0.5초 목표 표본의 실제 최대 간격은1.493112초이며, 원속도 전체 재생·전프레임 육안 검수·오디오 청취 완료를 뜻하지 않습니다. 현행 상품/가격/일정/개인화·원작 전체 집/장면/소리·모든 활동 플레이·원작 실기 일치성은 미확인 또는 미완성입니다.

## Unity 이식

초기 C# UPM 규칙 패키지는 `unity/Packages/com.harbor.research.rules`, JS/C# 대조 검증은 `unity/Validation`에 있습니다. 기존 에너지/BM·독립 규칙의 컴파일과2,701개 대조를 통과했으나 최신 웹 보드·주문·보관함·생성 보정·성장·상점 전체의 이식 검증은 아닙니다. Unity Editor/NUnit·씬·새 자산/연출/콘텐츠·플랫폼 빌드가 남아 있습니다.

현재 구현과 남은 작업은 [게임형 대응표](docs/GAMEPLAY-PARITY-VALIDATION.md), [후속 상태](docs/FOLLOWUP-STATUS.md), 이전 확장 시점의 [1–14 장부](docs/GOAL-1-14.md)를 참고합니다. 과거 수치가 있는 구현 계획/검증 이력은 해당 시점의 기록으로 표시합니다.

## 신규 게임 발주 범위

[제작 리소스](https://gossip-harbor-research.pages.dev/#production-assets)는 MVP 27개·출시형 40개·장기 확장 포함 43개 항목을 비교합니다. 기본 선택은 사용자가 요청한 MVP부터 패스·앨범·대표 이벤트까지의 출시형입니다. 패스 시즌 수·앨범 장수·이벤트 종류 수·출력 규격은 편집 가능한 제안이며 실제 제작 완료나 확정 견적을 뜻하지 않습니다.

수량·규격·메모와 프로젝트 공통 요청을 현재 브라우저에 저장하고 Markdown/CSV/JSON 요청서로 내보냅니다. 잘못된 수량이 있는 선택 항목은 내보내기를 막습니다. 자산 객체 수·타입 수·고유 PNG 수와 신규 제작 계획을 구분하며 실제 픽셀·피벗·9-slice 예시를 제공합니다. 상세는 [제작 리소스 안내](docs/PRODUCTION-RESOURCES.md)를 참고합니다.

## 원본 프레임·실제 화면 주석·음향 보강

[실제 화면·관측 자료](https://gossip-harbor-research.pages.dev/#captures)에서 정밀 자료25건을 선택하고 원본PTS 프레임·UI 영역57개·맵 전후3쌍·영상/GIF를 비교합니다. 신규 시각 파생은 정지60·MP4 14·GIF 12참조이며 기존 선정42개와 규칙 재현GIF11개는 별도입니다. 도움말2건은 실제 도구 사용으로 표시하지 않습니다.

녹화110개의 정량 음향 시간축과 APK 동봉 효과음12개·BGM2발췌를 제공합니다. 직접 청취는 미지원으로0초이며, 세 녹화의 신호 유사도 대표 후보5개도 확정 식별과 구분합니다. 기존 관측의 정정·추가 확인3건을 보존했습니다. [방법·검수·미확보 범위](docs/MEDIA-REFINEMENT.md)를 참고합니다.

## 2026-10-30 자료 확장

- [컬렉션 · 카드 앨범](https://gossip-harbor-research.pages.dev/#collection): 핵심 설명, 흐름 탐색, 자산564행 검색/CSV, BM 조건과 출처.
- [APK 자료 보강](https://gossip-harbor-research.pages.dev/#apk-media): 역할888모션·CG41클립 전체 source-time 파생, Area4/Skin/후속 장면 실물, 실제 녹화5관측.
- [전체 작업과 종료 조건](https://gossip-harbor-research.pages.dev/#checklist): 고정100개 ID. 4.03·4.09·4.13은 해당 자산/최소 투영/페이지 검사 조건을 충족했고, 실제 전이·입력·청취·최종 원작 렌더의 미확인 조건은 같은 ID에서 유지한다.

원본 APK·번들·복원 코드·스켈레톤/아틀라스·전체 대사는 공개하지 않습니다. 정적 원격 배포 자산은 정확한 APK catalog와 코드로 추적한 출하 기본 URL/파일 크기/객체/해시를 대조하며 현재 계정의 서버 배정이나 원작 실행으로 표시하지 않습니다.
