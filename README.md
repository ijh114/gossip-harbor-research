# Harbor Research · 가십하버 BM 분석실

Gossip Harbor Android **4.10.5**의 제공 XAPK를 정적으로 조사한 BM 위키와 브라우저 시뮬레이터입니다. 순수 HTML/CSS/ES modules로 작성했으며 같은 `dist/`를 GitHub Pages와 Cloudflare Pages에서 제공합니다. 서버·데이터베이스·외부 API가 필요 없습니다.

## 실행과 검증

Node.js 22 이상에서 실행합니다. 런타임 의존성은 없습니다.

```sh
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
3. Actions의 배포 성공 후 `https://ijh114.github.io/gossip-harbor-research/`에서 확인합니다. 이 주소는 배포 전까지 예정 주소입니다.

### Cloudflare Pages — Git 연동

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
- 70개 분석 항목, BM 노출 규칙 22개, 글로벌 IAP 선언 251개를 근거와 함께 정리.

게임 실행·결제·광고 재생·원작 서버 접속은 수행하지 않았습니다. **내장 USD 기본가격은 현재 실판매가가 아닙니다.** 서버 배정·현행 이벤트 일정·가격·개인화·전환율은 미확정입니다. 코드 존재, 설명문 존재, 실행 관측은 서로 다른 근거입니다.

## 데이터 갱신

`src/data/research.json`에서 `facts`, `products`, `triggers`, `unknowns`를 갱신합니다. 각 fact는 안정적인 `id`, 근거 유형, 해석, 출처 경로·행·짧은 발췌·SHA-256을 보존합니다. `evidence_id`는 실제 REA가 반환한 기록에만 사용합니다. 자체 정적 파생 분석을 REA 관측으로 표시하지 않습니다.

원본 XAPK SHA-256:

`2e19f0e6ead8a37183387d7c1269fc796ed2948c6ab8a0163de3019e0186a6f9`

원본 APK·추출 바이너리·전체 Lua 소스·전체 로컬라이제이션·개인 계정 데이터는 이 저장소와 게시 파일에 포함하지 않습니다. 연구 페이지에는 선택한 근거와 짧은 발췌만 포함합니다.

## 시뮬레이터의 경계와 Unity 이식

에너지 회복/충전/누적 무료 횟수/가격 리셋과 조건부 오퍼 우선순위를 재현합니다. 서버 후보와 임계치는 사용자가 조정하는 **실험 입력**입니다. 6×5 보드·두 아이템 체인·주문 보상은 독립 설계 실험이며 원작의 생성 확률·주문 보정·매출을 재현한 모델이 아닙니다.

`src/engine.mjs`는 UI·네트워크와 분리된 상태/규칙 모듈입니다. 향후 Unity에서는 EconomyState, OfferRule, PopupQueue, ContentCatalog를 분리하고 동일 경계 테스트를 이식합니다. 시뮬레이터의 JSON 내보내기는 테스트 상태와 입력값 전달을 위한 형식이며 Unity 프로젝트나 원작 코드 자동 변환을 뜻하지 않습니다.

배포 설정 근거: [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare Pages CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
