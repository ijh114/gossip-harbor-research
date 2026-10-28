# JavaScript / C# 규칙 대조

로컬 .NET SDK 9.0.201/10.0.401 환경에서 C# Runtime 소스를 실제 컴파일하고 실행한다. 외부 NuGet 패키지나 Unity API를 사용하지 않는다.

```powershell
node unity/Validation/generate-fixtures.mjs
dotnet run --project unity/Validation/Harbor.Rules.Validation.csproj -- unity/Validation/fixtures.json
```

2026-10-28 결과: 상태 시퀀스 5개·행동 29개, BM 판정 9개, 가격 경계 4개, 총 비교 2,701개 통과. 매 행동 후 에너지·젬·코인·시간·회복잔여·무료누적·가격·구매/생성/주문 횟수·난수 seed·보드63칸을 비교했다. 초기 조건은 실행 전에 복제하여 fixture 입력이 행동에 의해 변하지 않게 보존한다.

검증 범위는 동일한 **독립 실험 모델**의 언어 간 결과 일치다. 원작 게임과의 동등성, Unity Editor import, NUnit Test Runner, 씬 재생, 기기/결제 SDK를 검증한 결과가 아니다. 패키지의 NUnit 테스트는 별도로 제공되며 Editor에서 실행해야 한다. 기존 ProjectAG 프로젝트는 수정하지 않았다.
