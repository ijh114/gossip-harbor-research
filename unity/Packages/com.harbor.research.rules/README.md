# Harbor Research Rules

Unity 6000.3 계열에서 사용할 독립 실험 규칙 UPM 소스 패키지다. 준비 대상 에디터는 **6000.3.21f1**이다. Runtime은 `System`과 표준 컬렉션만 사용하며 `noEngineReferences: true`로 Unity API 의존을 차단한다. UI·에셋·서버·결제·Editor 자동화는 호출자가 담당한다.

## 원작 근거와 독립 실험의 경계

이 패키지는 저장소의 `src/engine.mjs`와 `src/bm-rules.mjs`를 C#으로 옮긴 것이다. 원작 게임의 실행을 재현하거나 실제 서비스의 서버 구성·코호트·스토어 가격·노출·매출을 관찰한 자료는 포함하지 않는다.

| 영역 | 성격 |
| --- | --- |
| 에너지 자연회복 상한 100, 간격 120초, 충전량 100, 일반 gem 가격 10→20→40→80→160 | 기존 정적 조사에 연결된 출하 기본값을 사용한 웹 실험 규칙 |
| `EnergyGift` 원문 필드 변환과 신규 생성 predicate | 복원 코드의 조건을 입력 기반 판정으로 옮긴 것. 현행 서버값은 호출자가 명시 |
| 63칸, bread/tea 생성, seed 42, 최대 레벨 10, Lv4 이상 한 개로 40코인 주문 | 분석자 실험 설계. 원작 보드·생성확률·주문 경제로 주장하지 않음 |
| `EnergyGiftState`의 초기 시각 86400, gem 가격 20 등 | 웹 판정 모듈의 합성 시나리오 초기값. 서버 레코드가 아님 |
| 테스트의 EnergyGift 60/240/30분, 20gem, 상한 2 | 명시적인 합성 fixture. 실제 운영값이 아님 |

기본 보드는 요청에 따라 **63칸**이다. 현재 웹 `createState()` 기본값 30칸과 의도적으로 다르다. 배열 인덱스는 0–62이며 행·열 배치는 정하지 않는다. `new ExperimentState(30)`으로 웹 기본 크기와 비교할 수 있다.

게임 패키지·복원 Lua 전문·게임 이미지·플레이어 데이터는 포함하지 않는다. `traceOffers`의 전체 화면 체인과 `activityState`, 그룹 생명주기·구매·저장/동기화 계층은 이 패키지의 포팅 범위 밖이다.

## API

| 웹 함수 | C# API |
| --- | --- |
| `createState` | `new EnergyState()` / `new ExperimentState()`와 필드 설정 |
| `energyCost` | `EnergyRules.EnergyCost(state)` |
| `advanceTime` | `EnergyRules.AdvanceTime(state, seconds, rules)` |
| `buyEnergy` | `EnergyRules.BuyEnergy(state, rules)` |
| `generateItem` | `BoardRules.GenerateItem(state, rules)` |
| `mergeItems` | `BoardRules.MergeItems(state, from, to)` |
| `deliverOrder` | `BoardRules.DeliverOrder(state, rules)` |
| `normalizeEnergyGift` | `BmRules.NormalizeEnergyGift(raw)` |
| `evaluateEnergyGift` | `BmRules.EvaluateEnergyGift(raw, scenario)` |
| `energyCostExcludeFree` | `BmRules.EnergyCostExcludeFree(normalPrice, chainPrices, currentIndex)` |

```csharp
using Harbor.Research.Rules;

var state = new ExperimentState { Energy = 1, Gems = 200, Seed = 42 };
var rules = new RuleSettings { GenerationCost = 1 };
RuleResult result = BoardRules.GenerateItem(state, rules);
EnergyRules.AdvanceTime(state, 120, rules);
```

상태 변경 함수는 입력 상태를 직접 갱신하고 안정된 `RuleResult.Code`를 반환한다. UI 문구와 로그는 호출자가 구성한다. `Ok == false`인 구매·생성·이동/합성·주문은 재화·아이템·난수 seed·성공 카운터를 변경하지 않는다. 규칙 설정을 바꿔도 이미 만든 상태의 잔고·무료 누적 횟수·배열 크기가 자동 변경되지는 않는다.

## 에너지·보존 경계

- 시간은 외부에서 전달한 누적 초다. OS 시계·타임존을 읽지 않는다. 가격 리셋은 `floor(time / 86400)`가 증가할 때이며 한국 자정으로 정의하지 않는다.
- 자연회복은 정수 개수로 누적하고 남은 초를 보존한다. 상한에 닿으면 잔여 초를 버리고, 상한에서 대기한 시간을 다음 소비 뒤에 사용하지 않는다.
- 충전은 100을 더하므로 100을 초과할 수 있다. 이후 자연회복도 기존 과충전 잔고를 깎지 않는다.
- `FreeTotal`과 `FreeUsed`는 누적 무료충전 실험 상태다. 일별 가격 리셋은 무료 횟수를 되돌리지 않는다.
- `ConfiguredNewUserFree == false`이면 마지막 무료 사용 뒤 다음 가격을 `FirstGemCost * 2`로 바꾼다. `true`이면 웹 모듈처럼 현재 가격을 유지한다. 이는 원작의 모든 무료 정책을 포팅했다는 뜻이 아니다.
- 유료 충전 성공 시 현재 가격을 두 배로 하되 `MaxGemCost`로 제한한다. Gem 부족 시 가격·보유량·횟수를 보존한다.
- 생성은 첫 빈 칸을 쓰고 성공할 때만 xorshift32 난수를 한 번 진행한다. unsigned 32비트 seed를 저장하면 동일 입력 순서가 같은 결과를 만든다. seed 0도 웹처럼 0으로 유지된다.
- 동일 family/level 두 개의 합성은 기초 단위 `2^(level-1)`를 보존한다. 빈 칸 이동도 단위를 보존한다. 주문은 배열의 첫 `level >= OrderLevel` 아이템 한 개만 소비한다. family나 주문 보상은 실험 규칙이다.

수치는 JavaScript의 number와 비교하기 위해 `double`을 사용한다. 인덱스·레벨·무료 횟수는 C# 정수, 난수 seed는 `uint`다. 유효한 실험 상태는 유한한 비음수 수치를 사용한다. 수치 검사가 있는 API 경계는 NaN·Infinity·음수를 거절하며, C# 포트는 시간·기간·잔고 합산에서 유한 범위를 넘는 결과도 예외로 거절한다. 공개 상태 필드는 호출자가 유효하게 유지해야 한다. JavaScript의 동적 타입 강제 변환은 포팅하지 않는다. 상태 객체는 저장·직렬화 스키마를 정의하지 않으므로 저장 어댑터는 호출자가 별도로 구현한다.

## BM 원문 필드와 판정

`EnergyGiftRaw`의 6개 생성자 인수는 모두 명시해야 한다. 패키지에 실제 오퍼 기본 설정은 없다. JSON 파싱과 서버 전송은 수행하지 않는다.

| 원문 필드 | 생성자 인수 / C# 필드 | 정규화 |
| --- | --- | --- |
| `groupDuration` | `groupDuration` / `GroupDuration` | ×60 → `GroupSeconds` |
| `groupCD` | `groupCd` / `GroupCd` | ×60 → `CooldownSeconds` |
| `giftDuration` | `giftDuration` / `GiftDuration` | ×60 → `GiftSeconds` |
| `triggerEnergyPrice` | `triggerEnergyPrice` / `TriggerEnergyPrice` | `TriggerPrice` |
| `dailyTriggerUpper` | `dailyTriggerUpper` / `DailyTriggerUpper` | 비음수 정수 확인 → `TriggerLimit` |
| `poptype` | `popType` / `PopType` | `PopType` |

`raw == null`이면 정규화 결과도 null이다. 판정은 LateInit → 구성 → 일별 생성 상한 → 그룹 쿨다운 → 무료 차례 → 가격 임계 → 기존 유효 상품 → 현재 생성비용 부족 → ChainEnergy 순서로 멈춘다. 이후 gate는 `Evaluated=false`, `Pass=null`이다.

`EnergyGiftEvaluation`은 읽기 전용 판정 결과다. 일 번호가 다르면 `EffectiveTriggerCount=0`으로 계산하지만 입력 카운트·refreshTime을 바꾸거나 새 번들을 생성하지 않는다. 웹 predicate처럼 과거 일로 시각이 바뀌어도 일 번호의 **불일치**를 사용한다. 일반 에너지 시간 전진의 일 번호 **증가** 조건과 구분해야 한다. 그룹 쿨다운은 날짜 변경으로 우회하지 않는다.

`GenerationCost`는 부스트를 반영한 현재 비용을 입력한다. `ExistingValidBundle`은 새 생성 차단 조건이며 기존 상품의 화면 노출 판정으로 사용하면 안 된다. Main·IAP 스위치·강제 튜토리얼·UI 안전 시점 등 상위 조건은 별도다.

`EnergyCostExcludeFree`는 `currentIndex`부터 **첫 유한한 양수 가격**을 찾고 일반 가격과 큰 쪽을 반환한다. 뒤의 모든 단계 중 최대값을 고르지 않는다. 인덱스는 웹과 같은 **0 기반**이다. ChainEnergy가 닫혔으면 호출자가 빈 가격 목록을 전달한다. 이 함수의 가격은 gem이며 후속 IAP ChainBundle의 실화폐 가격 비교와 다르다.

## 검증 인계

`Tests/Editor`에 NUnit 테스트와 Editor 전용 asmdef를 제공한다. 호스트에 Unity Test Framework가 준비되어 있고 패키지를 테스트 대상으로 노출한 상태에서 EditMode 테스트를 실행할 수 있다. 필요한 경우 호스트 manifest의 `testables`에 `com.harbor.research.rules`를 추가하는 방식은 호스트 담당자가 결정한다. 이 작업에서 프로젝트 생성·패키지 설치·manifest 수정·Unity 빌드·Editor 실행은 하지 않았다.

테스트는 경계 회복·초과 보유·무료 누적/가격·정확한 일 경계·구매 실패 보존, 63칸 포화·난수 literal fixture·합성 단위 보존·첫 주문 소비, BM gate 순서·일별 상한/쿨다운 독립·분→초·첫 유료 단계 가격을 다룬다. 테스트 소스를 먼저 작성했으며 Unity Test Runner 실행과 C# 컴파일은 검증 담당자에게 인계한다. 실행 통과를 주장하지 않는다.

이식 기준 파일 SHA-256:

- `src/engine.mjs`: `a12b859b61e544cceb41ff7985d57c912d55c897f9b2bd6d39fb6fb36f41ae19`
- `src/bm-rules.mjs`: `29937573b8bd526d298445582c720fb23b16701b5d8fe53189abaa55eeec05fe`

원작 정적 근거와 미확정 사항은 기존 BM 조사·gate 후속 보고서를 따른다. 위 hash는 **웹 실험 소스의 이식 시점**을 식별하며 원작 바이너리나 실행 동등성 인증이 아니다.
