# 전체 작업·완료 기준 장부 v1

기준일: 2026-10-29. 직전 배포 기준 커밋: `dd4c05f17524e5155d7893a0274192925d084644`. 이번 반영: 0.01~0.06 및3.04~3.13의 하위 구현·출처 대조.

**정정: 이전에 보고한 “2~5번 완료”는 잘못된 상위 완료 판정이었다. 아래 2·3·4·5번은 모두 부분 완료다.** 시간순 실험을 실제 관측 완료로, 추가 연구 안내를 전체 튜토리얼 완료로, 이미지 재분류를 미확보 자산 회수 완료로, Lv26 실행을 전체 제작 구간 검증 완료로 취급하면 안 된다.

사용자가 처음 요청한 APK 분석·BM 위키·시각 도감·실제 게임형 웹 시뮬레이션·제작 리소스·향후 Unity 신규 게임을 한 장부로 관리한다. 첨부된 이전 체크리스트의 **1 PC/모바일, 2 BM, 3 웹 시뮬레이션, 4 이미지/영상/위키, 5 성장/경제 번호를 유지**한다. 0은 공통 분석/상태 관리, 6은 제작 리소스/신규 자산, 7은 Unity, 8은 공유/배포다.

## 상태와 판정 규칙

- **완료**: 해당 행에 명시된 산출물과 검증 범위를 충족했다. 상위 분야 전체 완료를 뜻하지 않는다.
- **부분**: 일부 구현·자료만 있다. 남은 세부 내용을 같은 ID에서 계속 처리한다.
- **미완료**: 구현·실행·검수를 마치지 않았다.
- **자료 필요**: 현재 자료로 결과를 확정할 수 없다. 시연·가정 입력으로 대체해 완료 처리하지 않는다.
- **결정 필요**: 제작 범위·수량·목표를 확정해야 종료 기준이 정해진다. 확정하지 않은 상태를 완료로 처리하지 않는다.
- **보류**: 사용자 요청으로 중단한 일이다. 재개 지시 없이 실행하지 않는다.
- **선택 범위**: 원작의 모든 업데이트·운영 서비스까지 만들지 여부 등, 현재 필수 제작 범위로 확정되지 않은 일이다.

상위 분야는 필요한 하위 행이 모두 완료되어야 완료로 표시한다. 사용자 결정으로 범위에서 제외한 행은 이유를 남기고 **제외**로 표시하며 구현 완료로 세지 않는다. 기존 미완료를 새 이름의 “보강”으로 옮기지 않는다. 새 결함은 해당 기능 ID 아래에, 새 요구는 추가 ID와 변경 사유를 기록한다. 현재 알려진 일을 모두 열거한 장부이며, 자료 조사에서 아직 발견하지 못한 내용이 없다고 보증하는 목록은 아니다.

## 상위 상태

| 분야 | 현재 판정 | 상위 완료에 남은 핵심 |
|---|---|---|
| 0 APK/REA·위키·상태 관리 | 부분 | 0.04 실제 활성 UI의 최종 좌표/폰트/컴포넌트/연출 대조 자료 필요. 상태표 동기화는 구현 |
| 1 PC·모바일 직접 검수 | 미완료 | 최신 전체 화면의 렌더·실제 입력·재생·저장 동선 검수 |
| 2 BM 분석·실제 관측 대조 | 부분 | 실제 원인/재등장/만료/경쟁과 운영값, 모델 차이 6건 |
| 3 웹 시뮬레이션 | 부분 | 87안내, 자동 조건/경쟁, 공장 잔여 동작, 회상 책, 맵/Skin/캐릭터/CG/음향, 활동 완성 |
| 4 이미지·영상·위키 | 부분 | 장식12후보·이벤트35타입·후속장면·실제 동작 표본과 음향 대조 |
| 5 난이도·재화·성장 검증 | 부분 | 제작 범위 전체, 병목 해석, 활동 포함 밸런스와 반복 시나리오 검증 |
| 6 제작 리소스·신규 자산 | 부분 | 최종 사양·수량·담당자·실제 제작/검수/납품 |
| 7 Unity 신규 게임 | 부분 | 초기 규칙 패키지 이후의 최신 전체 규칙·화면·자산 이식과 기기 검증 |
| 8 GitHub/Cloudflare 공유 | 현재 버전 완료 | 후속 변경에도 같은 검사·배포 판정을 적용 |

## 0. APK/REA·위키·공통 상태

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 0.01 | 완료 | REA 분석 기반·제공 XAPK/설치 버전·정적 컨테이너/서명/메타데이터·Lua/번들 감사 기록 | 해당 정적 분석 기록과 출처 유지. 원작 전체 런타임 검증으로 확대 해석하지 않음 |
| 0.02 | 완료 | 난이도·기믹·상호작용·퍼즐연출·맵·맵연출·UI·BM·운영·재화의 10개 분석 장, 근거229건·IAP 선언251개 | 현재 조사 범위의 문서·출처 연결 |
| 0.03 | 완료 | 연구 트리·토글, 타입/연출 분리, 퍼즐·UI 하위 페이지, 검색·근거·실험·도감 | 현재 정보 구조 구현. 렌더 검수는 1번 |
| 0.04 | 부분 | 원본 UI 프리팹11종·controller14개·clip26개·글꼴16컴포넌트와 기존5화면29영역의8건 의미 대조·20출처 | 실제 활성 화면의 좌표·레이어·컴포넌트·폰트·상태와 대조하고 차이를 기록. 선정 선언 분석과 전체 UI 재현을 구분 |
| 0.05 | 완료 | 고정100개 ID 장부·웹 전체 작업 페이지·문서 SHA와 빌드 동기화/불일치 검사, 이전 완료 판정 정정 | 현재 상태는 같은 장부에서 생성. 과거 문서의 수치/검사는 이력으로 명시하며 상위 완료로 승격하지 않음 |
| 0.06 | 완료 | 정적 코드·설정·문구·캡처·가정·모델 실행의 출처 구분과 경로/행/해시 보존 | 앞으로도 각 산출물의 근거 종류를 유지. 미확인 항목은 관련 ID에 존치 |

## 1. PC·모바일 직접 검수

과거 버전의 PC/375px 검수와 최신 버전의 자동 검사489개는 있다. **최신 전체 화면의 직접 검수는 미수행**이다. 마지막 도구 연결은 Work 로컬 브라우저 사용 제한으로 실패했으며, 현재 사용자의 설정 상태를 새로 확인했다는 뜻은 아니다.

| ID | 상태 | 전체 검수 항목 | 완료 조건 |
|---|---|---|---|
| 1.01 | 미완료 | 위키·도감·제작 리소스·BM·시뮬레이션의 PC/모바일 배치 | 글자 크기/색/명암·화면 잘림·가로 넘침·반응형·목차/탐색을 실제 렌더로 검사하고 발견 결함 수정 |
| 1.02 | 미완료 | 터치·드래그·드롭·탭·키보드·포커스·팝업 | 성공/거절/취소/스크롤 충돌/창 이탈·초점 복귀를 실제 브라우저에서 확인 |
| 1.03 | 미완료 | 이미지 확대·자동 반복 카드·GIF/영상 재생·정지·페이지 이탈 | 중복 재생·숨긴 카드 재생·메모리/반응 저하를 포함해 확인 |
| 1.04 | 미완료 | 새 게임·이어하기·자동저장·재접속·가져오기/내보내기·백업 | 정상/구버전/손상 저장과 장면 중단·보상 중복 방지를 실제 동선으로 확인 |
| 1.05 | 미완료 | 로딩→타이틀→튜토리얼→맵↔퍼즐→집 변화의 종단 동선 | 상점·보관함·공장·패스·앨범·대표 이벤트·장식 화면의 진입/종료/복귀도 포함 |
| 1.06 | 미완료 | 효과음·음소거·재생 제한·전환 시 정지 | 실제 청취와 브라우저 재생 동작 확인. 현재 파형/정량 검사와 구분 |
| 1.07 | 미완료 | 검수 결과물 | 검수 버전·화면 크기·시나리오·결과·스크린샷·남은 결함을 남기고 관련 1.xx 재검수 |

## 2. BM 분석과 실제 관측 대조 — 최우선

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 2.01 | 완료 | 정적 게이트·상점 경로, 9유형/42관측점, 54셀 대조표, 3시간순 시나리오/27사건 | 현재 근거·모델 비교 자료화. 실제 노출 원인 검증은 아래 별도 |
| 2.02 | 자료 필요 | 상점·오퍼 최초 노출 원인 | 전후 시각·계정/레벨/재화/활동 상태·직전 입력을 확보해 원인과 단순 동시 발생을 구분 |
| 2.03 | 자료 필요 | 닫기·구매 후 재노출 조건과 쿨다운 | 같은 상품/SKU 여부·자동/수동 진입·이전 구매 결과·경과시간을 연결. 기존 UI 재등장2사례만으로 완료 처리 금지 |
| 2.04 | 자료 필요 | 만료·일일 초기화·이벤트 전환의 실제 변화 | 만료 전후·일 경계·활동 종료/시작의 연속 상태와 보유 상품/횟수/가격 비교 |
| 2.05 | 자료 필요 | 여러 오퍼의 동시 적격성과 노출 순서 | 후보를 함께 만족시키는 입력·설정·경쟁 결과 확보. 단순 UI 공존은 순서 검증 아님 |
| 2.06 | 자료 필요 | 계정별 상품·가격·일정·보상표·카드 확률·변형 | 버전/시점/배정이 확인된 자료와 정적 기본값 매핑. 없는 값을 추정해 확정하지 않음 |
| 2.07 | 미완료 | 모델 차이① 상품 만료 동등 시각 | 원작 `< now`와 웹 만료 경계를 정리·수정하고 전/동등/후 시각 회귀 검사 |
| 2.08 | 미완료 | 모델 차이② 일별 횟수 초기화 시점 | 원작 트리거 평가와 웹 조기 초기화 차이 보완·저장/재접속/일 경계 검사 |
| 2.09 | 미완료 | 모델 차이③ config 변경 판정 | groupID/MD5와 전체 입력 signature 차이를 보완하고 무관한 필드 변경의 영향 검사 |
| 2.10 | 미완료 | 모델 차이④ 번들 창 닫기 후속 호출 | 미구매 닫기·닫기 유형별 후속 평가와 경쟁 우선순위를 모델에 반영 |
| 2.11 | 미완료 | 모델 차이⑤ EnergyGift 성공·횟수·재평가·다음 SKU | 필요한 상품 identity/설정 입력을 정의하고 모의 성공/실패/취소·중복 방지·다음 상품 검사. 원작 실제 결제 실행을 요구하지 않음 |
| 2.12 | 미완료 | 모델 차이⑥ 무료 충전과 후속 비용 계산 | 일반 저장 가격과 무료 충전 비용을 구분하고 후속 적격성/무료 횟수 경계 검사 |
| 2.13 | 자료 필요 | 관측 체인80젬 이후 및 실제 구매 후 변화 | 동일 체인의 후속 단계·횟수·가격/기간·종료/다시 시작 근거 확보 |
| 2.14 | 부분 | BM 전체 비교 결과·상점/이벤트 등장 시점 문서 | 2.02~2.13의 결과/미확정/적용 범위와 모델 차이를 한 표로 연결. 단순 시나리오 수 증가로 완료하지 않음 |

## 3. 웹 시뮬레이션 완성도 확장

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 3.01 | 완료 | 초기63칸·기본552타입·생성기163종·선택/이동/합성/거절·봉인·도구·버블의 현재 규칙 구현 | 현재 기본 모델/저장 범위 구현. 실제 연출/입력 일치는 3.23과 1번 |
| 3.02 | 완료 | 고정16/일반랜덤5종 주문·복수 슬롯·해금/필터/보상·보관함/확장·생산 보정 | 현재 지원한 일반 규칙. 실제 계정/특수 creator/서버 변형은 확정 자료 필요 |
| 3.03 | 완료 | 로딩→타이틀→두 안내→맵↔퍼즐→과제 시작/확정/보상/집 복귀와 저장 | 기본 동선의 구현·DOM/모델 검사. 원작 CG와 최신 직접 검수는 미완료 |
| 3.04 | 완료 | 추가 안내10종의 두 연구 묶음, 저장·전환·웹 사건 어댑터 | 명시 연구 조건에서 실행 가능. 자동 발동·경쟁·전체 안내 완료를 뜻하지 않음 |
| 3.05 | 부분 | 남은87종 전부의 소스별 실행 투영·연구 UI, 98출처/669메서드/222콜백/758분기와 Lua 공유변수·다중반환 지원 | 87개 활동의 실제 연결/표현과85개 외부 어댑터 연산이 남음. 소스 투영·독립 실험을87종 자연 플레이 완료로 계산하지 않음 |
| 3.06 | 부분 | 실제 웹의 레벨/과제/기본 안내·창/보드/공장/회상 책 조건을 자동 어댑터로 연결 | 회상 과제 창→안내→책 입구와 실제 공장 탭 통합 검사. 활동 배정·미구현 창/모델·부족 서버값을 임의 예제로 채우지 않으므로 해당 경로는 같은ID에서 자료/구현 필요 |
| 3.07 | 부분 | 실제 UID/보드 위치·드래그 잠금·대상 강조/차단, 모달 내부 원본 콜백·중지,42개 순수 제약과 미연결 생성/비용의 무소모 차단 | 원작 마스크 최종 좌표·클릭 전달·전체 강제 생성/비용 어댑터와85개 외부 동작 중 관련 입력/표현은 미완료. native geometry 일치를 주장하지 않음 |
| 3.08 | 부분 | 전역 등록/시각 종료 분리·재평가→TutorialFinished, 수동 동일ID 중복 방지·경쟁 명시 순서·대기128사건/중복 방지·복귀/중지·공유 제약 | 웹 조정기는 구현/검사. Lua pairs 및 동시각 원작 scheduler 순서는 미확정, 기존 핵심 안내/미지원 활동과 원작 전체의 실제 경쟁 대조는 남음 |
| 3.09 | 완료 | 공장6대상/23조각 실제 보드 탭·UID 입고·점수·임계 보상·닫힘 반환 | 현재 실제 웹의 단일 저장 거래·대상 탭·실패 무소모·중복 방지 검증. 서버 활성/해금은 명시 입력으로 유지 |
| 3.10 | 부분 | 공장 덮개를 새UID로 자동 교체·동봉 위치별 에너지20/30 등 알려진 추가 보상·주문 갱신의 원자적 반영 | RandomRewardContent가 없는 랜덤 상자 보상 위치는 unknown/무변경으로 차단. 해당 서버 표를 확보해 같은ID에서 완료해야 함 |
| 3.11 | 완료 | session-start→LateInit→장면 준비→LoginFinished와 보드 복귀/합성 시 해금·반환을 실제 웹 저장/진입에 연결 | 미확정 gate에서도 준비 플래그만 초기화하고 LateInit 무지급·보존, 조건 적용 후 재시도·보상1회 검증. 네이티브 실행 관측은0.04/1번과 구분 |
| 3.12 | 완료 | 원작 선언 비행0.4초·임계 잠금0.5초·슬라이더/후속콜백과 실제 웹 타이머·점수/보상·이탈 정산 연결 | 모델 경계·실제 웹 동선·닫기/중지/저장/재접속을 검사. 비행 경로·그래픽은 웹 표현이며 원작 프레임/easing/좌표 직접 검수는1번/3.23에 남음 |
| 3.13 | 부분 | 회상5권/22페이지·엄격 과제 해금·NEW/읽음·책장/열람/재열람·페이지 전환/스와이프/저장·실제 과제 창 복귀·삽화11/40 | 새PNG9개를 회수. 본문29키·표지5키 실물 미확보, 원문203블록은 공개 발췌에서 생략, 원작 Spine/소리/실제 화면 연출은 미연결 |
| 3.14 | 부분 | 패스·앨범 연구 플레이 | 실제 설정을 연결하거나 신규 게임용 확정 설정을 별도 표기. 일정·보상·팩 결과·추가 과제·중복/완성 전 과정 구현/검증 |
| 3.15 | 부분 | 대표 이벤트1종의 전용 플레이 | 현재72칸 연구 보드 외 실제/확정 규칙의 시작·진행·해금·먹이·생성·포그/스크롤·종료·교환·상점·보상·복귀와 이미지 연결 |
| 3.16 | 미완료 | 활동 보상과 메인 경제의 출시형 연결 | 연구 장부와 별개로 확정 보상표의 지급 목적지·소비·중복 방지·만료/복귀를 정의하고 같은 경제에서 검증 |
| 3.17 | 완료 | 첫106과제 명령·선정 대사·장식41슬롯/123등록후보와111실물 기술 미리보기 | 원작 명령의 현재 웹 투영 범위. 완성 장면 렌더와 107번째 이후는 별도 |
| 3.18 | 부분 | 로딩·타이틀·오프닝의 원작 같은 표현 | 현재 안내문/자체 전환을 CG·영상·타임라인/해당 신규 콘텐츠로 연결하고 중단/복귀 처리 |
| 3.19 | 부분 | 메인 맵·집 발전·장식의 실제 화면 표현 | 현재 참고 이미지·기술 미리보기 이후, 확정 구역의 완성 맵/레이어/카메라·장식 전후/선택·해금과 상태 반영 |
| 3.20 | 부분 | Skin·연동 슬롯의 실제 화면 표현 | 현재2세트26ID의 소유권/미리보기 연구를 실물 그림·연동 슬롯·취소/확정·저장으로 연결 |
| 3.21 | 미완료 | Skin 획득/상품/구매 결과·소유권 연결 | 실제 근거 또는 신규 게임 확정 사양을 사용. 명시 연구 지급 버튼을 획득 완성으로 계산하지 않음 |
| 3.22 | 미완료 | 캐릭터·고객·스토리 CG 표현 | 초상 대체 이후 전신/표정/이동·대화/장면 동기화와 확정 콘텐츠 적용 |
| 3.23 | 부분 | 원작 조작·전환·보상·연출 타이밍 대조 | 선택·이동·드래그·합성/교환·힌트·봉인·도구·입력 제한·UI·카메라·보상 비행/음향의 근거와 차이 반영 |
| 3.24 | 부분 | 전체 소리·장면 동기화 | 현재 opt-in 발췌 외 확정 BGM/SFX·모션/이벤트 타이밍·중단/재개/음소거 연결과 직접 청취 |
| 3.25 | 완료 | 현재 단일 브라우저 저장·구버전 이전·손상 보존·백업·JSON 이동 | 현재 지원 기능의 모델/DOM 검사. 실제 파일 선택/입출력 동선은 1.04 |
| 3.26 | 결정 필요 | 웹에서 재현할 후반/추가 활동의 종료 범위 | 기본 게임+패스+앨범+대표 이벤트 외 모든 역대 활동/서버 변형을 포함할지 명시. 필요한87안내를 조용히 제외하지 않음 |

## 4. 이미지·영상·위키 자료 보강

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 4.01 | 완료 | 타입/연출/UI/상호작용 도감, 기존 실제 캡처와 규칙 재현 GIF, 공장29PNG/10단계 시연 | 현재 연결한 자료의 출처·종류·재생 조작. 전체 원작 시각 자료 완료를 뜻하지 않음 |
| 4.02 | 완료 | 자산 확보18항목·기존 출처와 회상 책 출처의 가용성 장부 | 등록/실물/선별/투영 구분. 공장 재분류 당시 새 원본0개 이력과 이번 회상 책 실물 PNG9개 회수를 구분 |
| 4.03 | 자료 필요 | Area4 장식12후보 | 12_5/12_8/12_9/12_11 각3후보의 실제 연결 객체/그림과 출처 확보·공개 파생·도감/시뮬레이션 연결 |
| 4.04 | 자료 필요 | 대표 이벤트 전용35타입 이미지 | exact alias/원격 자료/원본 객체로 확인한 실물 확보·파생·해시/도감/플레이 연결. 공용24그림과 구분 |
| 4.05 | 부분 | 기본 독립 이미지 키 미연결8타입의 외곽·내부·선물 매핑 | 부록 C의8타입별 실제 컴포넌트/용도/실물/불필요 판정을 근거로 종결. 전부 새 독립 PNG를 찾는 과제로 취급하지 않음 |
| 4.06 | 자료 필요 | 자동 합성 힌트·메인 봉인 전이의 실제 표본 | 성공 전후 프레임과 시각/입력 상태·버전 불확실성 명시, GIF/영상·주석·도감 연결 |
| 4.07 | 자료 필요 | 가위·모래시계 실제 사용 표본 | 도움말 화면 이후 실제 대상 선택→소비/적용→결과의 연속 구간과 파생 자료 확보 |
| 4.08 | 자료 필요 | 공장 실제 화면/동작 표본 | 기존 전체 녹화의 실제 화면을 재검토하거나 추가 자료 확보. 메타데이터 후보0을 전체 영상에 화면 없음으로 단정하지 않음 |
| 4.09 | 자료 필요 | 107번째 과제 이후 타임라인·대사·장면 | 기본13_1 이후 정확한 분기/명령 자료 확보·최소 투영·출처·시뮬레이션 연결. named/fire 변형으로 임의 대체 금지 |
| 4.10 | 자료 필요 | CG·Skin·캐릭터 모션·3D맵의 최종 표현 자료 | 기술 투영과 최종 렌더를 구분하고 필요한 실물/시연 자료 확보 |
| 4.11 | 부분 | 영상의 입력 방식·시각·잠금·원속도 대조 | 현재110개 시간순 표본/정밀 자료 이후 미확인 중요 동작 구간을 원속도/프레임으로 검수. 모든 프레임을 확인했다고 표시하지 않음 |
| 4.12 | 미완료 | 음향 직접 청취·동작 대응·장면 동기화 자료 | 현재110개 정량 분석/14동봉 발췌 이후 실제 청취와 해당 입력/장면의 대응 검수 |
| 4.13 | 부분 | 각 분석 페이지의 이미지·GIF·차트·출처와 미확인 표시 | 새 자료를 관련 퍼즐/UI/맵/BM/성장 페이지에 연결하고 설명·확대·재생·모바일 가독성 검사 |

## 5. 난이도·재화·성장 검증

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 5.01 | 완료 | 기본4,277과제/300레벨행의 비용/EXP/보상 투영 | 데이터 연결 완료. 300레벨 실행 검증을 뜻하지 않음 |
| 5.02 | 완료 | Lv5/Lv12/Lv21 기록 보존, seed42 이어 Lv26/210과제/714주문 | 무보충·무직접편집·무안내건너뛰기·무유료충전 실행 및 출처 해시/수지 대조 |
| 5.03 | 완료 | 동일 Lv21/150과제의 seed42/7/83 비교와 그래프 | 주문·생성·수지·빈칸 표본·정체·모델 대기를 비교. 실제 유저 시간/확률/매출 자료로 쓰지 않음 |
| 5.04 | 결정 필요 | 제작 범위의 최종 레벨·과제·체인·이벤트 종료점 | MVP/출시형 목표 분량을 정해 이 행의 종료 지점을 수치로 고정 |
| 5.05 | 부분 | 에너지 소모·보드 압박·대기·성장 병목 해석 | 현재 표본 지표 외 구간별 주문 구성/생성 수요·에너지/재화 소모·보드 포화·대기의 원인과 완화안 분석 |
| 5.06 | 미완료 | 제작 범위 전체의 밸런스 검증 | 5.04 구간을 주문→재화→과제→해금→상점→패스/앨범/대표 이벤트까지 연결해 소득/지출·막힘·과잉 보상 확인 |
| 5.07 | 부분 | 반복 시나리오·복수 시드와 경계 실행 | 확정 범위를 기본/저에너지/포화 보드/장기 복귀 조건에서 비교하고 실패/정체·분산을 기록. 세 시드 실행만으로 전 구간 완료 금지 |
| 5.08 | 자료 필요 | 원작 분포·체류·전환·매출 효과 대조 | 실제 자료 확보 시 분석. 웹 모델 결과로 원작 매출 효과를 단정하지 않음 |
| 5.09 | 선택 범위 | 원작 전체300레벨·모든 업데이트의 자연 진행 검증 | 신규 게임 제작 범위를 넘어 전부 검증할지 결정. 현재 미검증으로 명시하며 기본 필수 범위로 임의 추가하지 않음 |

## 6. 제작 리소스 페이지·신규 게임 자산

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 6.01 | 완료 | MVP27/출시형40/전체43 발주 항목·수량/규격/메모·포함 여부 편집/저장·MD/CSV/JSON 내보내기 | 페이지 기능의 현재 구현/자동 검사. 43은 이미지 장수가 아닌 발주 항목 수 |
| 6.02 | 완료 | 실제 픽셀/피벗/9-slice 예시9개·영상 관측8개를20발주 행에 연결 | 원작 측정과 신규 제안 규격을 구분 |
| 6.03 | 결정 필요 | MVP부터 패스·앨범·대표 이벤트까지의 최종 수량 | 체인/단계·생성기·맵/장식·캐릭터·패스 시즌·앨범 장수·이벤트 종류/콘텐츠 수 확정 |
| 6.04 | 결정 필요 | 새 테마·아트 방향·캐릭터·스토리·연출 방향 | 원작 참고 범위와 신규 제작 기준판 확정 |
| 6.05 | 결정 필요 | 원화/출력 해상도·레이어·피벗·9-slice·프레임/루프/종료 상태·폰트/다국어 | 부록 B의 각 행별 사양·필수 상태·납품 형식 확정 |
| 6.06 | 결정 필요 | 파일명·ID·아틀라스·압축·용량/메모리·재사용 기준 | Unity 대상 해상도와 기기에서 측정 가능한 납품/성능 예산 확정 |
| 6.07 | 결정 필요 | 담당자·검수자·우선순위·일정·의존 관계·요청서 버전 | 확정된 범위의 그래픽/모션/오디오 요청서 발행. 페이지 예시 수량을 승인 수량으로 취급하지 않음 |
| 6.08 | 미완료 | 신규 자산 실제 제작 | 부록 B의 선택한 모든 행에 대해 원본·출력·상태/모션/음향 제작. 기존 APK 그림은 신규 제작 실적으로 세지 않음 |
| 6.09 | 미완료 | 납품·실화면·Unity 적용 검수 | 파일/명명/투명여백/피벗/작은 크기 식별/루프·종료·음향·메모리 검사, 반려 수정과 최종 납품 |
| 6.10 | 선택 범위 | 확장3항목 | 추가 시즌/행사 스킨·추가 구역/캐릭터/스토리·다른 미니게임은 출시 범위와 별도 결정. 부록 B에 존치 |

## 7. Unity 신규 게임

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 7.01 | 완료 | 초기 C# UPM 규칙 패키지·컴파일·기존 에너지/BM 등 JS/C#2,701개 대조 | 해당 초기 규칙 범위. 최신 웹 전체 이식 완료를 뜻하지 않음 |
| 7.02 | 부분 | 최신 보드/생성/합성/입력/도구/버블/보정 이식 | 확정 웹 모델과 같은 입력→상태/실패/저장 결과의 C# 구현 |
| 7.03 | 미완료 | 주문·보관함·과제/성장·상점/BM·공장 이식 | 복수/랜덤 주문·원자적 납품/거래·타이머/일 경계·보상 중복 방지까지 이식 |
| 7.04 | 미완료 | 튜토리얼·패스·앨범·대표 이벤트·장식/Skin 이식 | 확정 제작 범위의 조건·화면·입력 잠금·활동/보상·중단/복귀 구현 |
| 7.05 | 미완료 | Unity 씬·UI·입력·카메라·장면 동선 | 로딩→타이틀→안내→맵↔퍼즐→집 변화, 팝업/뒤로가기·터치/해상도 대응 |
| 7.06 | 미완료 | 신규 이미지·애니메이션·VFX·SFX/BGM·서사 적용 | 6번 승인 자산으로 게임 화면/연출을 구성하고 원본 참고 자산 교체 |
| 7.07 | 미완료 | 저장/불러오기·오프라인·중단/재개·이전/손상 처리 | 기기/앱 생명주기에서 보상 중복·재화 손실·진행 손상 없이 복구 |
| 7.08 | 미완료 | 최신 JS/C# 대조·Unity Editor import/NUnit·플레이 검사 | 초기2,701개 외 신규 이식 규칙·통합 동선과 확정 시나리오 검증 |
| 7.09 | 미완료 | 목표 기기 빌드·성능·메모리·용량 검수 | 확정 대상 플랫폼/기기의 해상도·입력·저장·백그라운드 복귀·프레임/메모리/오디오 확인 |

## 8. 공유·배포·운영 경계

| ID | 상태 | 작업물과 현재 범위 | 완료 조건 / 남은 내용 |
|---|---|---|---|
| 8.01 | 완료 | 같은 소스의 상대 경로/hash 구조, GitHub Pages/Cloudflare Git 자동 배포 | 현재 커밋의 두 호스트 배포 성공 |
| 8.02 | 완료 | 자동 검사489개·정적 빌드1050파일·게시 경계 검사. 호스트별 공개 파일 해시는 커밋별 재대조 | 직전 `dd4c05f`의227파일 대조 기록을 보존하고 이번 변경 파일을 포함한 두 호스트의 동일 커밋 배포/해시를 확인 |
| 8.03 | 완료 | 원본 APK/전체Lua/번들/geometry/원본 영상/개인정보 게시 제외 | 기존 게시 경계 유지. 필요한 공개 파생만 사용 |
| 8.04 | 선택 범위 | 호스트/기기 간 저장 동기화·여러 탭 동시 편집·협업 발주/JSON 재가져오기 | 현재 localStorage/파일 공유 방식. 별도 서비스로 구현할지 선택하며 원래 배포 완료의 필수 조건으로 추가하지 않음 |
| 8.05 | 선택 범위 | 신규 게임 실결제/광고·원격 운영·분석 서비스·앱스토어 배포 | Unity 신규 게임의 운영 범위로 별도 확정할 사안. 연구 사이트나 원작 계정에 자동 연결하지 않음 |
| 8.06 | 보류 | LDPlayer 원작 분석 | 검은 화면 이후 사용자 요청으로 LDPlayer 중단 유지. 재개 지시가 없으면 작업하지 않음. 기존 영상 검토와 웹 모의 사건은 별도 |

## 작업 종료 기준

**위키/웹 종료**: 0~5번에서 합의한 대상이 모두 완료되거나 자료 미확보/사용자 제외로 명시되고, 1번 검수와 8번 게시 검사가 통과해야 한다. 자료 미확보가 남으면 “구현 완료·원작 대조 미완료”처럼 실제 상태를 보고하며 원작 동일성 전체 완료로 표시하지 않는다.

**그래픽 발주 종료**: 6.03~6.07의 최종 사양과 선택한 부록 B 항목별 요청서가 확정되어 담당자가 제작 가능한 상태. 이것과 6.08~6.09 실제 제작/납품 완료는 별도다.

**Unity 제작 종료**: 6번 승인 자산과 7.02~7.09가 완료되고 목표 기기에서 확정 콘텐츠를 끝까지 플레이할 수 있는 상태. 미확정 플랫폼·운영 서비스까지 완료했다고 보고하지 않는다.

## 기준 자료

- 현재 구현: [2–5번 실제 변경](FOLLOWUP-2-5-2026-10-29.md), [현재 상태](FOLLOWUP-STATUS.md).
- 기존 요구 대조: [화면/동선](SCREEN-FLOW.md), [게임형 대응표](GAMEPLAY-PARITY-VALIDATION.md), [1–14 이력](GOAL-1-14.md), 사용자 첨부 기존1~5 체크리스트.
- 개별 목록: `src/data/play-progress.json`, `tutorial-extension.json`, `tutorial-more.json`, `production-assets.json`, `artifact-availability.json`, `bm-lifecycle.json`.
- 배포 증거: `analysis/simulation/qa/followup-2-5-deployment.json`(비공개 작업 기록), GitHub Actions run40837674058, 두 호스트 각227파일 일치.


## 부록 A. 3.05의 남은 튜토리얼87종 — 개별 장부

각 행의 실제 활동/전체 표현 연결은 **미완료**다. 이번에는 아래87개 전부에 소스별 실행 투영과 별도 연구 UI를 추가했으나85개 외부 연산과 실제 활동 맥락은 남았다. ID별 조건·필요 시스템을 아래에 고정한다. 공통 완료 조건은 조건 판정 → 대상 창/보드 진입 → 강제/일반 입력·지연·콜백 → 완료/조기 종료 → 경쟁/이탈/저장/재접속 검사이며, 필요한 활동이 미구현이거나 자료가 없으면 같은 행에 남긴다. 구현할 때 ID를 새 “보강” 목록으로 옮기지 않는다.

| 상태 | 원본 ID | 시스템 | 조건 | 필요한 맥락/구현 |
|---|---|---|---|---|
| 미완료 | `tutorial_bakeout_1` | 라이브 활동·이벤트 | BakeOutStart | ActivityManager · BakeOut · BakeOutMainWindow |
| 미완료 | `tutorial_bakeout_2` | 라이브 활동·이벤트 | BakeOutStart,TutorialFinished-tutorial_bakeout_1 | ActivityManager · BakeOut · BakeOutCoinExchangeWindow · BakeOutMainWindow |
| 미완료 | `tutorial_battlepass_loop_2` | 라이브 활동·이벤트 | TutorialFinished-tutorial_battlepass | ActivityManager · PassActivityTicketWindow · PassActivityTicketWindowSVip |
| 미완료 | `tutorial_character_intimacy_entry` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | CharacterIntimacyModel · TimelineModel · BaseSceneView · CharacterIntimacyDetailWindow · CharacterIntimacyListWindow · CharacterIntimacyScreenTransition |
| 미완료 | `tutorial_coin_race_first_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · CoinRace · CoinRaceMainWindow |
| 미완료 | `tutorial_coin_race_second_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · CoinRace · CoinRaceMainWindow |
| 미완료 | `tutorial_wipeout_first_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · CoinRace · WipeOut · WipeOutMainWindow |
| 미완료 | `tutorial_wipeout_second_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · WipeOut · WipeOutMainWindow |
| 미완료 | `tutorial_energy_boost` | 퍼즐·에너지 부스트 | (empty: executer starts, internal activation still applies) | EnergyBoostModel · EnergyBoostLevel · BaseSceneView · EnergyBoostReadyWindow · EnergyBoostSettingWindow |
| 미완료 | `tutorial_triggerplane` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · TriggerPlane · TriggerPlaneMainWindow |
| 미완료 | `tutorial_intimacy_order` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | TimelineModel |
| 미완료 | `tutorial_energy_boost_super` | 퍼즐·에너지 부스트 | TutorialFinished-tutorial_energy_boost | EnergyBoostModel · EnergyBoostLevel · EnergyBoostSettingWindow |
| 미완료 | `tutorial_checkin_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · CheckIn · CheckInMainWindow |
| 미완료 | `tutorial_generator_factory` | 보관함·생성기 보관소 | (empty: executer starts, internal activation still applies) | MainBoardModel · InventoryWindow |
| 미완료 | `tutorial_hitbricks_west` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MiscModel · WestSearch |
| 미완료 | `tutorial_hitbricks_crystal2search` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MiscModel · Crystal2Search |
| 미완료 | `tutorial_album_moon_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MiscModel · Album_moon · AlbumHelpWindow |
| 미완료 | `tutorial_album_halloween_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MiscModel · Album_halloween · AlbumHelpWindow |
| 미완료 | `tutorial_adventure_activity` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | 선언 condition만으로 시작을 단정할 수 없다. 아래 executer/template의 활동·기능·창 이벤트와 내부 guard를 충족해야 하며 현재 웹 가이드 dispatcher에는 없다. 래퍼/전용 UI 이벤트 기반 실행이며 원본 프레젠테이션 상태가 추가로 필요하다. |
| 미완료 | `tutorial_adventure_activity_board` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · ItemDataModel |
| 미완료 | `tutorial_adventure_activity_fog` | 라이브 활동·이벤트 | TutorialFinished-tutorial_adventure_activity | ActivityManager |
| 미완료 | `tutorial_temp` | 퍼즐·한시 아이템 | (empty: executer starts, internal activation still applies) | ActivityManager · MainBoardModel · TempItem · ItemDetailWindow |
| 미완료 | `tutorial_bingo_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · Bingo · BingoActivityHelpWindow · BingoActivityMainWindow · BingoActivityStartWindow |
| 미완료 | `tutorial_album_upgrade_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · AlbumJokerExchangeWindow · AlbumRemindUseJokerWindow |
| 미완료 | `tutorial_order_boost_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · OrderBoost · BaseSceneView · OrderBoostMainWindow |
| 미완료 | `tutorial_order_boost_end` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · OrderBoost · BaseSceneView |
| 미완료 | `tutorial_order_boost_end_23` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · LevelModel · OrderBoost · BaseSceneView |
| 미완료 | `tutorial_order_boost_pro` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · OrderBoost · BaseSceneView · OrderBoostProMainWindow |
| 미완료 | `tutorial_dig` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_dig_collect` | 라이브 활동·이벤트 | TutorialFinished-tutorial_dig | ActivityManager |
| 미완료 | `tutorial_multiboards_activity` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | 선언 condition만으로 시작을 단정할 수 없다. 아래 executer/template의 활동·기능·창 이벤트와 내부 guard를 충족해야 하며 현재 웹 가이드 dispatcher에는 없다. 래퍼/전용 UI 이벤트 기반 실행이며 원본 프레젠테이션 상태가 추가로 필요하다. |
| 미완료 | `tutorial_multiboards_activity_portal` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_mission_open` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_mission_entry` | 라이브 활동·이벤트 | TutorialFinished-tutorial_mission_open | ActivityManager |
| 미완료 | `tutorial_puzzle` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · Puzzle · PuzzleMainWindow |
| 미완료 | `tutorial_cookingfrenzy_start` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | BaseSceneView · CookingFrenzyMainWindow |
| 미완료 | `tutorial_farmboard` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_farmboard_animal_spread` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | 선언 condition만으로 시작을 단정할 수 없다. 아래 executer/template의 활동·기능·창 이벤트와 내부 guard를 충족해야 하며 현재 웹 가이드 dispatcher에는 없다. 래퍼/전용 UI 이벤트 기반 실행이며 원본 프레젠테이션 상태가 추가로 필요하다. |
| 미완료 | `tutorial_farmboard_unlock_block` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_farmboard_block_multiple` | 라이브 활동·이벤트 | TutorialFinished-tutorial_farmboard_unlock_block | ActivityManager |
| 미완료 | `tutorial_acquire_avatar` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | UserProfileModel · SettingUserInfoWindow |
| 미완료 | `tutorial_wheel` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | MiscModel · RewardWindow |
| 미완료 | `tutorial_flowerpairwork_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · FlowerPairwork |
| 미완료 | `tutorial_flowerpairwork_invite` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · FlowerPairwork |
| 미완료 | `tutorial_flowerpairwork_game` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · FlowerPairwork |
| 미완료 | `tutorial_floatrace_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · FloatRace · FloatRaceMainWindow |
| 미완료 | `tutorial_floatrace_entry` | 라이브 활동·이벤트 | TutorialFinished-tutorial_floatrace_start | ActivityManager · FloatRace · FloatRaceMainWindow |
| 미완료 | `tutorial_upward_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_upward_entry` | 라이브 활동·이벤트 | TutorialFinished-tutorial_upward_start | ActivityManager |
| 미완료 | `tutorial_gomeroom_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · GnomeRoom |
| 미완료 | `tutorial_gomeroom_joinlock` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · GnomeRoom |
| 미완료 | `tutorial_gomeroom_game` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · GnomeRoom |
| 미완료 | `tutorial_gomeroom_firstReward` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · GnomeRoom |
| 미완료 | `tutorial_weekly_quest_star_reward` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_weekly_quest_star_info` | 후속 기능·원본 창 | TutorialFinished-tutorial_weekly_quest_star_reward | 선언 condition만으로 시작을 단정할 수 없다. 아래 executer/template의 활동·기능·창 이벤트와 내부 guard를 충족해야 하며 현재 웹 가이드 dispatcher에는 없다. 래퍼/전용 UI 이벤트 기반 실행이며 원본 프레젠테이션 상태가 추가로 필요하다. |
| 미완료 | `tutorial_chest_custom_order_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MainBoardModel · ChestCustomer · ChestCustomStartTutorialWindow |
| 미완료 | `tutorial_reviewRace_start` | 라이브 활동·이벤트 | TutorialFinished-tutorial_order_boost_end | ActivityManager · OrderBoost · ReviewRace · ReviewRaceMainWindow |
| 미완료 | `tutorial_stickerboard_open` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_stickerboard_normal_tool` | 라이브 활동·이벤트 | TutorialFinished-tutorial_stickerboard_open | ActivityManager |
| 미완료 | `tutorial_stickerboard_special_tool` | 라이브 활동·이벤트 | TutorialFinished-tutorial_stickerboard_open | ActivityManager |
| 미완료 | `tutorial_stickerboard_remove_obstacle` | 라이브 활동·이벤트 | TutorialFinished-tutorial_stickerboard_open | ActivityManager |
| 미완료 | `tutorial_stickerboard_portal` | 라이브 활동·이벤트 | TutorialFinished-tutorial_stickerboard_open | ActivityManager |
| 미완료 | `tutorial_acquire_avatar_frame` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | UserProfileModel · AvatarFrameRewardWindow · SettingUserInfoWindow |
| 미완료 | `tutorial_xmas_pairup_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · XmasPairup |
| 미완료 | `tutorial_seafood_tutorial_order` | 주문·신규 합성선 | (empty: executer starts, internal activation still applies) | ItemDataModel · MainBoardModel · TutorialSeafoodOrderStartWindow |
| 미완료 | `tutorial_seafood_tutorial_order_2` | 주문·신규 합성선 | (empty: executer starts, internal activation still applies) | MainBoardModel · TutorialSeafoodOrderStart2Window |
| 미완료 | `tutorial_combo_first_open_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_combo_first_upgrade_main_window` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_generator_boost_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · GeneratorBoost |
| 미완료 | `tutorial_album_royal` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · BaseSceneView · RoyalActivityHelpWindow |
| 미완료 | `tutorial_midfallMapExplore_map` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · midfallMapExplore |
| 미완료 | `tutorial_midfallMapExplore_board` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · midfallMapExplore |
| 미완료 | `tutorial_halloweenMapExplore_map` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · halloweenMapExplore |
| 미완료 | `tutorial_halloweenMapExplore_board` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · halloweenMapExplore |
| 미완료 | `tutorial_team_signin` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_team_window` | 라이브 활동·이벤트 | TutorialFinished-tutorial_team_signin | ActivityManager |
| 미완료 | `tutorial_stagecha_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_boostChargedisco_start` | 후속 기능·원본 창 | (empty: executer starts, internal activation still applies) | BoostChargeManager · TriggerBoostDiscoEmptyView |
| 미완료 | `tutorial_taskLimitTimeReward_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · TimelineModel · TaskLimitTimeReward · BaseSceneView · TaskWindow |
| 미완료 | `tutorial_boostCannon_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · OrderBoost · BaseSceneView · OrderBoostMainWindow · OrderBoostProMainWindow |
| 미완료 | `tutorial_exped_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_exped_entry` | 라이브 활동·이벤트 | TutorialFinished-tutorial_exped_start | ActivityManager |
| 미완료 | `tutorail_event_wheelpack_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager |
| 미완료 | `tutorial_extra_customer` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MainBoardModel · ExtraCustomer · ExtraCustomerActivityMainWindow · ExtraCustomerBannerWindow |
| 미완료 | `tutorial_cardItem_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MainBoardModel · CardItem · ItemDetailWindow · TutorialCardItemFirstWindow |
| 미완료 | `tutorial_cardItem_max` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · MainBoardModel · CardItem · CardItemTriggerWindow · CardItemUseConfirmWindow |
| 미완료 | `tutorial_dailyRating_piggyBank_start` | 라이브 활동·이벤트 | (empty: executer starts, internal activation still applies) | ActivityManager · DailyRating · BaseSceneView · PiggyMainWindow |

이미 연구 구현/플레이 어댑터가 있는 추가10종은 다음과 같다. 이들의 **자동 플레이 조건·경쟁·원작 마스크/연출 완료는 3.06~3.08과3.23에서 계속 미완료/부분으로 관리**한다.

- 패스 메인·수령권 안내 — `tutorial_battlepass`
- 간단 에너지 부스트 안내 — `tutorial_event_energyboost_simple`
- 생성기 공장 획득 안내 — `tutorial_generator_factory_Acquire`
- 스토리 회상 입구 안내 — `tutorial_story_recap`
- 장식 변경 안내 — `tutorial_change_decoration`
- 패스 추가 과제 안내 — `tutorial_battlepass_bonus_task`
- 8배 부스트 시작 창 이후 안내 — `tutorial_energyBoosteight_start`
- 주간 과제 추가 별 영역 안내 — `tutorial_weekly_quest_bonus_star`
- 과제 추가 보상 입구 안내 — `tutorial_event_task_extra_reward_entry`
- 생성기 부스트 활성 영역 안내 — `tutorial_generator_boost_active`

원래16개 조건부 웹 논리와 시작2개는 이87행에 포함하지 않는다. 시작2개의 원작 CG/동작은 3.18, 전체 안내 연출·실제 검수는 3.07/3.23/1번에 남긴다.

## 부록 B. 제작 리소스43개 발주 항목 — 실제 제작/납품 장부

페이지의 편집/내보내기 기능은 완료다. **아래 모든 수량은 승인 전 제안값**이며 원작 그림 수가 아니다. 각 행은 사양 확정(6.03~6.07) → 신규 제작(6.08) → 납품/적용 검수(6.09)의 세 단계가 남아 있다. 원작 추출 이미지를 신규 제작 완료로 표시하지 않는다. MVP는 core27개, 출시형은 core+launch40개, expansion3개는 선택 범위다. 상세 픽셀/포맷/제안 메모는 해당 ID의 `production-assets.json`에 보존한다.

| ID / 항목 | 범위 | 제안 수량 | 필수 상태/구성 | 납품물 | 현재 |
|---|---|---|---|---|---|
| `art-direction` · 아트 방향·크기 기준판 | MVP | 1 문서 | 아이템 실루엣 · 광원·명암 · 색·희귀도 · 재질·외곽 · 작게 표시한 비교 | 스타일 가이드 원본 · 보드 1화면 목업 · 아이템·캐릭터·UI 기준판 | 사양 미확정 / 제작·납품 미완료 |
| `item-chains` · 일반 합성 아이템 체인 | MVP | 48 아이콘 | 단계별 독립 실루엣 · 다음 단계 연결 · 작은 크기 식별 · 상위단계 강조 | 체인별 레이어 원본 · 단계별 RGBA PNG · 아이템ID·파일명 매핑 | 사양 미확정 / 제작·납품 미완료 |
| `generator-icons` · 생성기 단계·상태 이미지 | MVP | 12 아이콘 | 기본 · 선택 · 소진·회복 · 미개방 | 단계별 생성기 PNG · 산출 체인 연결표 · 시각 상태 분리 명세 | 사양 미확정 / 제작·납품 미완료 |
| `board-surface` · 보드·빈칸·선택·목표 표시 | MVP | 1 세트 | 기본 칸 · 선택 · 드래그 목표 · 가능 합성 · 거절 | 타일·선택 프레임 PNG · UI 스케일링/마진 명세 · 색상 토큰 | 사양 미확정 / 제작·납품 미완료 |
| `covers` · 상자·거미줄·잠금 오버레이 | MVP | 3 오버레이 | 상자 · 거미줄 · 잠금 · 해제 전후 | 분리된 투명 오버레이 · 상자 파편 소스 · 전이 참조 GIF | 사양 미확정 / 제작·납품 미완료 |
| `currency-items` · 수집 재화·보상 조각 | MVP | 14 아이콘 | 획득 · 합성 단계 · 수집 · 수량 차이 | 재화별 단계 PNG · HUD 아이콘 대응표 | 사양 미확정 / 제작·납품 미완료 |
| `special-tools` · 만능 젬·가위·모래시계 도구 | MVP | 7 아이콘 | 기본 · 선택 · 사용 확인 · 잔여 횟수 | 도구 PNG · 적용 대상 표시 가이드 · 효과별 레이어 | 사양 미확정 / 제작·납품 미완료 |
| `reward-containers` · 상자·선택 상자·보상 포장 | MVP | 6 아이콘 | 닫힘 · 열기 대기 · 열림 · 선택 후보 · 소진 | 닫힘·열림 원화 · 보상 슬롯 프레임 · 오픈 연출 분리 레이어 | 사양 미확정 / 제작·납품 미완료 |
| `bubble-visual` · 버블·가격 태그·할인 상태 | MVP | 1 세트 | 등장 · 유지 · 가격 · 할인 · 구매 · 만료 | 버블 텍스처 · 가격 프레임 · 할인 태그 · 파열 소스 | 사양 미확정 / 제작·납품 미완료 |
| `hud-components` · HUD·공용 버튼·재화·내비게이션 | MVP | 1 세트 | 기본 · 누름 · 비활성 · 배지 · 잠금 · 플러스 | 버튼·프레임 원본 · 재화/진입 아이콘 · 9-slice 표 · 컴포넌트 목업 | 사양 미확정 / 제작·납품 미완료 |
| `orders-inventory` · 주문 트레이·보관함·아이템 정보 | MVP | 3 화면 세트 | 요구 미충족 · 준비 완료 · 납품 · 보관함 빈칸/가득참 · 확장/잠금 | 화면 목업 · 공용 패널·슬롯 · 주문 체크/잠금 마크 | 사양 미확정 / 제작·납품 미완료 |
| `common-dialogs` · 공용 모달·확인·보상·충전 UI | MVP | 5 화면 세트 | 열기 · 닫기 · 확인/취소 · 지급 · 부족 · 일시 입력 제한 | 공용 배경/헤더/닫기 · 5개 템플릿 목업 · 스케일링·레이어 명세 | 사양 미확정 / 제작·납품 미완료 |
| `tutorial-ui` · 튜토리얼 손·화살표·마스크 | MVP | 1 세트 | 탭 · 드래그 · 허용 영역 · 대화 · 완료 | 손/화살표 원화 · 설명창 · 마스크 구현용 경계 정의 | 사양 미확정 / 제작·납품 미완료 |
| `basic-shop` · 일반·일일·한정 상점 UI | MVP | 3 화면 세트 | 무료 · 보석 가격 · 실결제 가격 자리 · 품절 · 갱신 · 잠금 | 상품 카드 템플릿 · 탭/리스트 · 재고·할인·타이머 프레임 | 사양 미확정 / 제작·납품 미완료 |
| `bm-offers` · 상황형 오퍼·번들·단계형 판매 | 출시형 추가 | 3 화면 세트 | 노출 · 유료 단계 · 무료 해금 · 구매 완료 · 품절 · 기간 종료 | 배너 키아트3종 · 상품/보상 슬롯 공통 UI · 가격·타이머·체크 표기 | 사양 미확정 / 제작·납품 미완료 |
| `customer-portraits` · 고객 초상·주문 감정 표현 | MVP | 3 캐릭터 세트 | 기본 · 요청 · 만족 · 잠금 초상 | 캐릭터별 레이어 PSD · 표정 파생 PNG · 초상 크롭 영역 | 사양 미확정 / 제작·납품 미완료 |
| `world-map` · 첫 구역 맵·배경·진입점 | MVP | 1 구역 세트 | 변경 전 · 진행 중 · 영역 잠금 · 카메라 여백 | 배경 분리 레이어 · 가림/앞뒤 레이어 · 카메라 기준 목업 · 이동/상호작용 영역표 | 사양 미확정 / 제작·납품 미완료 |
| `renovation-slots` · 집 발전 슬롯·전후·장식 선택 | MVP | 6 슬롯 세트 | 변경 전 · 공사/먼지 · 변경 후 · 선택 강조 | 슬롯별 전후 레이어 · 공통 기준점/가림 레이어 · 설치 위치표 | 사양 미확정 / 제작·납품 미완료 |
| `story-ui` · 대사창·초상·초반 스토리 컷 | MVP | 1 화면 세트 | 좌/우 화자 · 표정 · 다음 · 스킵 · 선택지 | 대사 프레임 · 화자명/텍스트 영역 · 초반 컷 구성표 | 사양 미확정 / 제작·납품 미완료 |
| `title-loading` · 로딩·타이틀·앱 아이콘 | MVP | 2 화면 세트 | 시작 · 로딩 진행 · 재시도 · 점검 | 키아트 · 로고 · 앱아이콘 마스터 · 로딩 UI 분리 | 사양 미확정 / 제작·납품 미완료 |
| `board-animations` · 선택·이동·합성·생성·거절 모션 | MVP | 6 모션 | 시작 · 완료 · 중단 · 재실행 · 입력 제한 복원 | 동작별 타이밍시트 · 시작/중간/끝 기준 · 엔진용 커브 또는 타임라인 · 검수용 GIF | 사양 미확정 / 제작·납품 미완료 |
| `board-vfx` · 합성 등급·착지·봉인·버블 이펙트 | MVP | 8 이펙트 | 재생 · 루프 여부 · 등급/색 파생 · 중단/정리 | 파티클 텍스처 · 머티리얼 · Prefab/설정 · 알파 소스 · 재생 참조 | 사양 미확정 / 제작·납품 미완료 |
| `reward-ui-motion` · 주문 완료·재화 비행·UI 전환 | MVP | 5 모션 | 준비 완료 · 비행 · 도착 · 정리 · 중단/스킵 | 이동경로·도착 이벤트 · HUD 반영 타이밍 · 열기/닫기 커브 · 화면 전환 참조 | 사양 미확정 / 제작·납품 미완료 |
| `map-renovation-motion` · 집 발전·먼지·등장·카메라 전환 | MVP | 4 모션 | 시작 · 작업중 · 확정 · 스킵/복원 | 먼지/반짝임 소스 · 설치 타이밍시트 · 카메라 경로/범위 · 스킵 후 최종 상태 | 사양 미확정 / 제작·납품 미완료 |
| `core-sfx` · 입력·합성·생성·보상·실패 SFX | MVP | 16 효과음 | 단발 · 연속입력 제한 · 볼륨/피치 파생 · 동시재생 | 무가공 WAV 원본 · 최종 WAV · 재생 이벤트표 · 러드니스 기준 메모 | 사양 미확정 / 제작·납품 미완료 |
| `bgm` · 메인·보드 BGM | MVP | 2 곡 | 인트로 · 완전루프 · 페이드아웃 · 전환 | 스테레오 WAV 마스터 · 루프 시작/끝 샘플 · 스템 선택납품 · 권리/원본 정보 | 사양 미확정 / 제작·납품 미완료 |
| `asset-pipeline` · 파일명·피벗·아틀라스·원본 납품 | MVP | 1 문서 | 원본 · 파생 · 임포트 · 검수 · 수정 이력 | ID_manifest.csv · 원본PSD/벡터 · 분리 PNG · pivot/border · 텍스처 설정 · 버전/변경 목록 | 사양 미확정 / 제작·납품 미완료 |
| `font-localization` · 폰트·숫자·다국어 레이아웃 | MVP | 1 문서 | 한글 · 숫자 · 가격 · 긴 제목 · 폴백 | 폰트 파일/정보 · 텍스트 스타일표 · 문자 범위 · 번역 키 · 길이별 UI 검수표 | 사양 미확정 / 제작·납품 미완료 |
| `launch-item-expansion` · 출시용 추가 체인·생성기 | 출시형 추가 | 28 아이콘 | 단계별 성장 · 해금 · 신규 체인 발견 | 추가 체인/생성기 PNG · ID/체인 연결 · MVP와 일관된 기준판 | 사양 미확정 / 제작·납품 미완료 |
| `pass-ui` · 시즌 패스 트랙·보상·수령권 | 출시형 추가 | 1 화면 세트 | 잠금 · 달성 · 무료 수령 · 프리미엄 권한 · 수령 완료 · 종료 후 수령 | 패스 타이틀/키아트 · 트랙·노드·두 보상열 · 권한/체크/잠금 · 시즌 교체 슬롯 | 사양 미확정 / 제작·납품 미완료 |
| `pass-season-art` · 패스 시즌 키아트·배지·토큰 | 출시형 추가 | 1 세트 | 진행 · 잠금 · 완료 · 기수령 | 시즌 원화 · 토큰/배지 PNG · 교체영역 가이드 | 사양 미확정 / 제작·납품 미완료 |
| `album-ui` · 앨범·세트·카드 소유 UI | 출시형 추가 | 1 화면 세트 | 미소유 · 소유 · 중복 · 세트완성 · 앨범완성 · 기간 종료 | 앨범 목록 · 카드 슬롯 · 미소유 실루엣 · 중복표시 · 완성보상 UI | 사양 미확정 / 제작·납품 미완료 |
| `album-card-art` · 앨범 카드 일러스트 | 출시형 추가 | 24 일러스트 | 원화 · 미소유 파생 · NEW · 중복 수량 · 희귀도 프레임 | 카드 원화24개 · 세트명/ID목록 · 크롭 안전영역 | 사양 미확정 / 제작·납품 미완료 |
| `pack-opening` · 카드팩·개봉·NEW·중복 연출 | 출시형 추가 | 1 세트 | 봉인 · 개봉 · 카드뒤집기 · NEW · 중복 · 보상정리 | 팩 레이어3종 · 카드뒷면 · 찢김/빛소스 · 개봉 타이밍시트 | 사양 미확정 / 제작·납품 미완료 |
| `event-board` · 대표 이벤트1종 · 전용 보드 스킨 | 출시형 추가 | 1 세트 | 준비 · 진행 · 잠김 · 완료 · 종료 | 보드배경/테두리 · 진입아이콘 · 테마 헤더 · 레이어 분리 | 사양 미확정 / 제작·납품 미완료 |
| `event-items` · 대표 이벤트1종 · 아이템·토큰 | 출시형 추가 | 10 아이콘 | 합성단계 · 이벤트토큰 · 생성기 · 완료 | 이벤트체인 PNG · 토큰/생성기 · ID 매핑 | 사양 미확정 / 제작·납품 미완료 |
| `event-progression-ui` · 대표 이벤트1종 · 진행·교환·보상 UI | 출시형 추가 | 3 화면 세트 | 예고 · 시작 · 진행 · 보상준비 · 수령완료 · 종료/정산 | 3화면목업 · 진행바·보상노드 · 교환/수령·종료상태 | 사양 미확정 / 제작·납품 미완료 |
| `event-shop-motion` · 대표 이벤트1종 · 판매·수령·피버 연출 | 출시형 추가 | 3 모션 | 시작 · 수령 · 완료 · 종료시취소 | 이벤트오픈/수령동작 · 테마효과소스 · 사운드이벤트표 | 사양 미확정 / 제작·납품 미완료 |
| `launch-audio` · 패스·앨범·이벤트 효과음 | 출시형 추가 | 8 효과음 | 단발 · 반복제한 · 동시재생 · 스킵 | WAV 원본8종 · 이벤트명·볼륨표 · 재사용매핑 | 사양 미확정 / 제작·납품 미완료 |
| `world-options` · 출시 구역 장식 선택지 | 출시형 추가 | 6 슬롯 세트 | 미선택 · 선택미리보기 · 확정 · 교체 | 추가장식원화12개 · 선택썸네일 · 동일피벗·가림표 | 사양 미확정 / 제작·납품 미완료 |
| `seasonal-reskins` · 추가 시즌·행사 테마 스킨 | 선택 확장 | 1 테마 세트 | 신규키아트 · 시즌배지 · 이벤트토큰 · 상점장식 | 시즌별교체PNG · 공용자산재사용목록 · 신규/파생구분 | 선택 여부 결정 |
| `extra-areas-story` · 추가 구역·캐릭터·스토리 챕터 | 선택 확장 | 1 챕터 세트 | 잠금 · 해금 · 변경전후 · 스토리분기 | 챕터별배경/장식/캐릭터 · 대사·컷목록 · 씬전환기준 | 선택 여부 결정 |
| `new-minigames` · 다른 규칙의 추가 이벤트·미니게임 | 선택 확장 | 1 이벤트 세트 | 별도입력 · 튜토리얼 · 보드 · 결과 · 종료 | 새게임전용자산명세 · 입력/결과연출 · 전용UI · 별도테스트 | 선택 여부 결정 |

## 부록 C. 기본 미연결8타입 — 그림 회수와 표현 종결을 구분

| 타입 | 현재 근거 | 남은 완료 조건 |
|---|---|---|
| `3401` | 일반 Bubble 외곽 실물+내부 아이템 합성 규칙 확인 | 독립 그림 회수를 필수로 두지 않음. 실제 플레이 합성 표현·프레임 대조는3.23/4.11에 존치 |
| `md_hw_gift_1` | EventActivityGift2/3 등록, 실물 Sprite/텍스처 미확보 | 실제 원본 그림과 해당 타입 매핑 확보 |
| `md_hw_gift_2` | EventActivityGift2/3 등록, 실물 Sprite/텍스처 미확보 | 실제 원본 그림과 해당 타입 매핑 확보 |
| `deco_event_gift_s_1` | EventActivityGift2/3 등록, 실물 Sprite/텍스처 미확보 | 실제 원본 그림과 해당 타입 매핑 확보 |
| `deco_event_gift_b_1` | EventActivityGift2/3 등록, 실물 Sprite/텍스처 미확보 | 실제 원본 그림과 해당 타입 매핑 확보 |
| `temp_1` | item_temp 외곽 등록/내부 아이템 합성 규칙, 외곽 실물 미확보 | 외곽 실물/실제 용도를 확인하고 컴포넌트 표현 연결 |
| `property_bubble_1` | 빈 모델 선언 외 용도·전용 표현 미확정 | 실제 사용 코드/설정 또는 동작 화면과 명시 이미지/컴포넌트 연결 확보 |
| `locked_1` | ItemView 직접 Sprite 요청 없는 분기 확인 | 독립 그림 회수를 필수로 두지 않음. 실제 사용 상태/봉인 전이 대조는4.06에 존치 |

## 부록 D. 현재 자산 가용성18항목의 근거 장부

등록/투영/선별 자료가 있다는 상태는 해당 원작 화면 완성이나 실기 관측 완료가 아니다. 다음 표의 미확보 내용은4번과3번에서 빠짐없이 추적한다.

| 원본 항목 ID | 대상 | 현재 자료 상태 | 추가로 필요한 근거 |
|---|---|---|---|
| `scene-next-timeline` | 13_1 이후 기본 과제 타임라인 | 자료 미확보 | 동일 버전의 Timeline_13 실제 TextAsset과 객체·번들 식별 정보 · 이후 범위의 실제 화면이 제공되면 입력 순서·연출과 별도로 대조 |
| `decor-12_11` | Area4 장식 선택 12_11 | 등록만 확인 | 등록된 정확한 Area4 프리팹과 의존 메시·재질·텍스처 |
| `decor-12_5` | Area4 장식 선택 12_5 | 등록만 확인 | 등록된 정확한 Area4 프리팹과 의존 메시·재질·텍스처 |
| `decor-12_8` | Area4 장식 선택 12_8 | 등록만 확인 | 등록된 정확한 Area4 프리팹과 의존 메시·재질·텍스처 |
| `decor-12_9` | Area4 장식 선택 12_9 | 등록만 확인 | 등록된 정확한 Area4 프리팹과 의존 메시·재질·텍스처 |
| `event-35-images` | 대표 탐험 이벤트 전용 아이템 | 자료 미확보 | 동일 테마의 ItemViewConfig 또는 명시적 이미지 키 매핑 · 그 키에 대응하는 실제 Sprite·텍스처/아틀라스 객체 또는 검증 가능한 해당 화면 |
| `base-gift-images` | 기본 도감의 이벤트 선물 상자 | 등록만 확인 | EventActivityGift2/3의 실제 Sprite와 텍스처 |
| `base-property-bubble` | property_bubble_1의 용도·표현 | 자료 미확보 | 이 타입을 사용하는 실제 코드·설정과 명시적 이미지 연결 또는 해당 동작 화면 |
| `base-temp-component` | temp_1 · 외곽과 내부 아이템 합성 | 등록만 확인 | TempItem/item_temp.png의 실제 Sprite·텍스처와 원래 합성 화면 |
| `base-bubble-component` | 3401 · 일반 버블 합성 규칙 | 연구용 투영 | 원작 합성 화면·연출 대조 · BubbleInstant 참조의 정확한 설정·실물 연결 |
| `base-locked-component` | locked_1 · 직접 Sprite 요청 없는 분기 | 연구용 투영 | 잠금 레이어·배경·내부 아이템이 함께 보이는 원작 화면 대조 |
| `scene-projection` | 동봉 기본 과제의 장면 순서 | 연구용 투영 | 원작 실행의 병렬 명령·카메라·페이드·음향 타이밍은 화면·오디오 자료와 별도로 대조 |
| `decor-technical-previews` | 실물 장식 후보의 기술 미리보기 | 연구용 투영 | 원작 장식 완성 화면과 카메라·라이팅·재질 효과 대조 |
| `scene-curated-art` | 선별한 CG 레이어·스토리 삽화 | 선별 자료 있음 | 전체 CG 합성·표정·음향·전환은 원작 화면과 별도로 대조 |
| `base-curated-images` | 기본 타입 도감의 선별 이미지 | 선별 자료 있음 | 현재 선별/투영 범위는 확보. 최종 화면·런타임 일치 검수는 해당3/4/1번 항목 |
| `event-shared-curated` | 이벤트에서 쓰는 공용 재화 그림 | 선별 자료 있음 | 현재 선별/투영 범위는 확보. 최종 화면·런타임 일치 검수는 해당3/4/1번 항목 |
| `factory-curated-types` | 생성기 공장6종·조각23종 이미지 재분류 | 선별 자료 있음 | 원작 공장 보관·합산·획득·반환의 성공 영상 표본 · 원작 비행·슬라이더·입력 잠금 시간 |
| `story-recap-book-art` | 회상 책 본문/표지 | 본문11/40 선별(새PNG9), 표지0/5 | 본문29키·표지5키 실물·Spine/음향·원작 실행 대조 |

## 부록 E. 3.05~3.08의 미연결 외부 연산85곳

이 목록은 같은 ID에 남은 구현/자료 범위를 열거한다. 전부 자료 부족이라는 뜻은 아니며, UI·활동 모델·애니메이션 후속·경제 변경을 실제 웹에 적용하는 어댑터 구현도 필요하다. 기존 제어 흐름 투영은 이를 `requiredEffect`로 멈추며, 적용하지 않은 연산에 성공 응답을 만들어 진행하지 않는다. 같은 메서드라도 원본 호출 위치가 다르면 별도 항목이다.

실행 투영 revision: `84356cac6cc5ef375682fb0b8e86331f3e8cc85c613ae2aa01dbfe3003986501`. 분류별 입력/상태36곳 · 보드/경제 변경1곳 · UI 표현14곳 · viewport8곳 · 활동/영구 안내 플래그20곳 · 창 생명주기2곳 · 애니메이션 후속4곳.

| 원본 위치별 항목 | 안내ID | 외부 연산 | 분류 | 원본 근거 |
|---|---|---|---|---|
| `effect@TC-S009:50:8` | `tutorial_bakeout_2` | `self.m_highlightOrderCell:SetOrderIconClickEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterBakeOut2.lua:50` (TC-S009) |
| `effect@TC-S009:53:8` | `tutorial_bakeout_2` | `self.m_highlightOrderCell:SetGoButtonEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterBakeOut2.lua:53` (TC-S009) |
| `effect@TC-S009:181:4` | `tutorial_bakeout_2` | `GM.ActivityManager:GetModel():SetExchangeCoinFree` | 보드/경제 변경 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterBakeOut2.lua:181` (TC-S009) |
| `effect@TC-S009:182:4` | `tutorial_bakeout_2` | `exchangeWindow:UpdateContent` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterBakeOut2.lua:182` (TC-S009) |
| `effect@TC-S011:138:2` | `tutorial_character_intimacy_entry` | `window:JumpToCell` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterCharacterIntimacyEntry.lua:138` (TC-S011) |
| `effect@TC-S011:139:2` | `tutorial_character_intimacy_entry` | `window:SetScrollEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterCharacterIntimacyEntry.lua:139` (TC-S011) |
| `effect@TC-S011:151:2` | `tutorial_character_intimacy_entry` | `window:SetScrollEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterCharacterIntimacyEntry.lua:151` (TC-S011) |
| `effect@TC-S014:78:4` | `tutorial_wipeout_first_main_window` | `window:ShowHarrison` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWipeOut2.lua:78` (TC-S014) |
| `effect@TC-S015:54:4` | `tutorial_wipeout_second_main_window` | `window:ShowHarrison` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWipeOut3.lua:54` (TC-S015) |
| `effect@TC-S017:43:2` | `tutorial_triggerplane` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTriggerPlane.lua:43` (TC-S017) |
| `effect@TC-S017:79:2` | `tutorial_triggerplane` | `mainwindow:SetTutorialMaskStatus` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTriggerPlane.lua:79` (TC-S017) |
| `effect@TC-S017:92:2` | `tutorial_triggerplane` | `mainwindow:SetTutorialMaskStatus` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTriggerPlane.lua:92` (TC-S017) |
| `effect@TC-S020:75:2` | `tutorial_checkin_start` | `window:SetEffectVisible` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterCheckInStart.lua:75` (TC-S020) |
| `effect@TC-S020:91:2` | `tutorial_checkin_start` | `window:SetEffectVisible` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterCheckInStart.lua:91` (TC-S020) |
| `effect@TC-S021:102:2` | `tutorial_generator_factory` | `inventoryBtn:SetClickActive` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterInventoryGeneratorFactory.lua:102` (TC-S021) |
| `effect@TC-S021:121:2` | `tutorial_generator_factory` | `window:StopPrompt` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterInventoryGeneratorFactory.lua:121` (TC-S021) |
| `effect@TC-S021:141:4` | `tutorial_generator_factory` | `window:RestartPrompt` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterInventoryGeneratorFactory.lua:141` (TC-S021) |
| `effect@TC-S021:142:4` | `tutorial_generator_factory` | `window:StartPrompt` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterInventoryGeneratorFactory.lua:142` (TC-S021) |
| `effect@TC-S023:73:8` | `tutorial_hitbricks_west` | `self.m_mainWindow:SetSliderBtnEnable` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:73` (TC-S023) |
| `effect@TC-S023:103:4` | `tutorial_hitbricks_west` | `GM.MiscModel:SetHitBricksTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:103` (TC-S023) |
| `effect@TC-S023:136:6` | `tutorial_hitbricks_west` | `topView:SetSliderBtnEnable` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:136` (TC-S023) |
| `effect@TC-S023:150:6` | `tutorial_hitbricks_west` | `GM.MiscModel:SetHitBricksTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:150` (TC-S023) |
| `effect@TC-S023:152:6` | `tutorial_hitbricks_west` | `GM.UIManager:OpenView` | 창 생명주기 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:152` (TC-S023) |
| `effect@TC-S023:167:6` | `tutorial_hitbricks_west` | `mainWindow:GetFireworksAni():Play` | 애니메이션 후속 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:167` (TC-S023) |
| `effect@TC-S023:168:6` | `tutorial_hitbricks_west` | `mainWindow:FireworksTipShow` | 애니메이션 후속 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:168` (TC-S023) |
| `effect@TC-S023:73:8` | `tutorial_hitbricks_crystal2search` | `self.m_mainWindow:SetSliderBtnEnable` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:73` (TC-S023) |
| `effect@TC-S023:103:4` | `tutorial_hitbricks_crystal2search` | `GM.MiscModel:SetHitBricksTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:103` (TC-S023) |
| `effect@TC-S023:136:6` | `tutorial_hitbricks_crystal2search` | `topView:SetSliderBtnEnable` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:136` (TC-S023) |
| `effect@TC-S023:150:6` | `tutorial_hitbricks_crystal2search` | `GM.MiscModel:SetHitBricksTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:150` (TC-S023) |
| `effect@TC-S023:152:6` | `tutorial_hitbricks_crystal2search` | `GM.UIManager:OpenView` | 창 생명주기 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:152` (TC-S023) |
| `effect@TC-S023:167:6` | `tutorial_hitbricks_crystal2search` | `mainWindow:GetFireworksAni():Play` | 애니메이션 후속 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:167` (TC-S023) |
| `effect@TC-S023:168:6` | `tutorial_hitbricks_crystal2search` | `mainWindow:FireworksTipShow` | 애니메이션 후속 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterHitBricks.lua:168` (TC-S023) |
| `effect@TC-S026:29:8` | `tutorial_album_moon_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:29` (TC-S026) |
| `effect@TC-S026:43:8` | `tutorial_album_moon_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:43` (TC-S026) |
| `effect@TC-S026:79:6` | `tutorial_album_moon_start` | `GM.MiscModel:SetAlbumActivityTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:79` (TC-S026) |
| `effect@TC-S026:82:6` | `tutorial_album_moon_start` | `GM.MiscModel:SetAlbumActivityTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:82` (TC-S026) |
| `effect@TC-S026:120:8` | `tutorial_album_moon_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:120` (TC-S026) |
| `effect@TC-S026:232:6` | `tutorial_album_moon_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:232` (TC-S026) |
| `effect@TC-S026:242:4` | `tutorial_album_moon_start` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:242` (TC-S026) |
| `effect@TC-S026:29:8` | `tutorial_album_halloween_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:29` (TC-S026) |
| `effect@TC-S026:43:8` | `tutorial_album_halloween_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:43` (TC-S026) |
| `effect@TC-S026:79:6` | `tutorial_album_halloween_start` | `GM.MiscModel:SetAlbumActivityTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:79` (TC-S026) |
| `effect@TC-S026:82:6` | `tutorial_album_halloween_start` | `GM.MiscModel:SetAlbumActivityTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:82` (TC-S026) |
| `effect@TC-S026:120:8` | `tutorial_album_halloween_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:120` (TC-S026) |
| `effect@TC-S026:232:6` | `tutorial_album_halloween_start` | `self.m_packWindow:SetDragEnableOnTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:232` (TC-S026) |
| `effect@TC-S026:242:4` | `tutorial_album_halloween_start` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAlbumBase.lua:242` (TC-S026) |
| `effect@TC-S031:89:2` | `tutorial_temp` | `self.m_boardInfoBar:SetTransformButtonEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTemp.lua:89` (TC-S031) |
| `effect@TC-S031:102:4` | `tutorial_temp` | `self.m_boardInfoBar:SetTransformButtonEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTemp.lua:102` (TC-S031) |
| `effect@TC-S032:47:2` | `tutorial_bingo_start` | `view:OpenHelpWindw` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterBingoStart.lua:47` (TC-S032) |
| `effect@TC-S039:99:2` | `tutorial_dig_collect` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterDigCollect.lua:99` (TC-S039) |
| `effect@TC-S042:62:2` | `tutorial_mission_open` | `window:SetScrollRectEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMissionOpen.lua:62` (TC-S042) |
| `effect@TC-S042:77:2` | `tutorial_mission_open` | `window:SetScrollRectEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMissionOpen.lua:77` (TC-S042) |
| `effect@TC-S042:103:4` | `tutorial_mission_open` | `window:SetScrollRectEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMissionOpen.lua:103` (TC-S042) |
| `effect@TC-S044:55:2` | `tutorial_puzzle` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterPuzzle.lua:55` (TC-S044) |
| `effect@TC-S044:87:2` | `tutorial_puzzle` | `rightTopPiece:SetGlow` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterPuzzle.lua:87` (TC-S044) |
| `effect@TC-S051:47:4` | `tutorial_wheel` | `window:SetBtnEnabledForTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWheel.lua:47` (TC-S051) |
| `effect@TC-S051:53:2` | `tutorial_wheel` | `GM.MiscModel:SetWheelTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWheel.lua:53` (TC-S051) |
| `effect@TC-S051:59:2` | `tutorial_wheel` | `window:SetBtnEnabledForTutorial` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWheel.lua:59` (TC-S051) |
| `effect@TC-S056:74:6` | `tutorial_floatrace_entry` | `MainBoardView.GetInstance():GetOrderArea():ScrollToFloatRaceBoardEntry` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterFloatRaceEntry.lua:74` (TC-S056) |
| `effect@TC-S058:96:8` | `tutorial_upward_entry` | `MainBoardView.GetInstance():GetOrderArea():ScrollToUpwardBoardEntry` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterUpwardEntry.lua:96` (TC-S058) |
| `effect@TC-S061:47:2` | `tutorial_gomeroom_game` | `self.m_activityModel:SetGameTutorial` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterGnomeRoomGame.lua:47` (TC-S061) |
| `effect@TC-S061:73:4` | `tutorial_gomeroom_game` | `openView:ShowTimeView` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterGnomeRoomGame.lua:73` (TC-S061) |
| `effect@TC-S063:53:6` | `tutorial_weekly_quest_star_reward` | `self.m_randomRewardTip:SetCanTouchClose` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWeeklyActiveQuestStarReward.lua:53` (TC-S063) |
| `effect@TC-S063:107:2` | `tutorial_weekly_quest_star_reward` | `randomRewardTip:SetCanTouchClose` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWeeklyActiveQuestStarReward.lua:107` (TC-S063) |
| `effect@TC-S063:115:6` | `tutorial_weekly_quest_star_reward` | `randomRewardTip:SetCanTouchClose` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWeeklyActiveQuestStarReward.lua:115` (TC-S063) |
| `effect@TC-S063:120:6` | `tutorial_weekly_quest_star_reward` | `randomRewardTip:SetCanTouchClose` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterWeeklyActiveQuestStarReward.lua:120` (TC-S063) |
| `effect@TC-S065:46:2` | `tutorial_chest_custom_order_start` | `MainBoardView.GetInstance():GetOrderArea():ScrollToMiddle` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterChestCustomOrderStart.lua:46` (TC-S065) |
| `effect@TC-S072:45:4` | `tutorial_acquire_avatar_frame` | `window:ChangeToAvatarFrameTap` | UI 표현 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAcquireAvatarFrame.lua:45` (TC-S072) |
| `effect@TC-S072:50:8` | `tutorial_acquire_avatar_frame` | `window:SkipToNewAvatarFrame` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAcquireAvatarFrame.lua:50` (TC-S072) |
| `effect@TC-S072:51:8` | `tutorial_acquire_avatar_frame` | `window:ScrollViewEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAcquireAvatarFrame.lua:51` (TC-S072) |
| `effect@TC-S072:73:2` | `tutorial_acquire_avatar_frame` | `window:ScrollViewEnabled` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterAcquireAvatarFrame.lua:73` (TC-S072) |
| `effect@TC-S074:33:2` | `tutorial_seafood_tutorial_order` | `MainBoardView.GetInstance():GetOrderArea():ScrollToMiddle` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterSeafoodTutorialOrder.lua:33` (TC-S074) |
| `effect@TC-S081:65:4` | `tutorial_midfallMapExplore_map` | `self.m_activityModel:SetPlayFirstShowBubble` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_mapNewBase.lua:65` (TC-S081) |
| `effect@TC-S081:70:6` | `tutorial_midfallMapExplore_map` | `model:SetTutorialStartFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_mapNewBase.lua:70` (TC-S081) |
| `effect@TC-S083:35:8` | `tutorial_midfallMapExplore_board` | `model:SetTutorialBoardFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_boardbase.lua:35` (TC-S083) |
| `effect@TC-S083:66:4` | `tutorial_midfallMapExplore_board` | `model:SetTutorialBoardFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_boardbase.lua:66` (TC-S083) |
| `effect@TC-S081:65:4` | `tutorial_halloweenMapExplore_map` | `self.m_activityModel:SetPlayFirstShowBubble` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_mapNewBase.lua:65` (TC-S081) |
| `effect@TC-S081:70:6` | `tutorial_halloweenMapExplore_map` | `model:SetTutorialStartFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_mapNewBase.lua:70` (TC-S081) |
| `effect@TC-S083:35:8` | `tutorial_halloweenMapExplore_board` | `model:SetTutorialBoardFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_boardbase.lua:35` (TC-S083) |
| `effect@TC-S083:66:4` | `tutorial_halloweenMapExplore_board` | `model:SetTutorialBoardFinish` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterMapExplore_boardbase.lua:66` (TC-S083) |
| `effect@TC-S087:100:4` | `tutorial_team_window` | `teamModel:SetCurState` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTeamWindow.lua:100` (TC-S087) |
| `effect@TC-S090:101:2` | `tutorial_taskLimitTimeReward_start` | `GM.UIManager:RemoveAllEventLocks` | 입력/상태 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterTaskLimitTimeStart.lua:101` (TC-S090) |
| `effect@TC-S093:96:8` | `tutorial_exped_entry` | `MainBoardView.GetInstance():GetOrderArea():ScrollToExpedBoardEntry` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterExpedEntry.lua:96` (TC-S093) |
| `effect@TC-S095:82:6` | `tutorial_extra_customer` | `self.m_cell:ScrollToOrder` | viewport | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterExtraCustomer.lua:82` (TC-S095) |
| `effect@TC-S098:64:4` | `tutorial_dailyRating_piggyBank_start` | `self.m_activityModel:SetPiggyTutorialStart` | 활동/영구 안내 플래그 | `analysis/lua/Lua_Core/Model/Tutorial/Executer/TutorialExecuterPiggyBankStart.lua:64` (TC-S098) |
