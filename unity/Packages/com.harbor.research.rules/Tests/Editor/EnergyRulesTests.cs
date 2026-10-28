using System;
using NUnit.Framework;

namespace Harbor.Research.Rules.Tests
{
    public class EnergyRulesTests
    {
        [Test]
        public void RecoveryUsesRemainderAndDiscardsTimeAtCap()
        {
            var state = new EnergyState { Energy = 99 };
            EnergyRules.AdvanceTime(state, 119);
            Assert.That(state.Energy, Is.EqualTo(99));
            Assert.That(state.RecoveryRemainder, Is.EqualTo(119));
            EnergyRules.AdvanceTime(state, 1);
            Assert.That(state.Energy, Is.EqualTo(100));
            EnergyRules.AdvanceTime(state, 86400);
            state.Energy = 99;
            EnergyRules.AdvanceTime(state, 119);
            Assert.That(state.Energy, Is.EqualTo(99));
            EnergyRules.AdvanceTime(state, 1);
            Assert.That(state.Energy, Is.EqualTo(100));
        }

        [Test]
        public void CrossingCapDropsUnusedRecoveryAndPreservesOverfill()
        {
            var state = new EnergyState { Energy = 99 };
            EnergyRules.AdvanceTime(state, 600);
            Assert.That(state.Energy, Is.EqualTo(100));
            Assert.That(state.RecoveryRemainder, Is.Zero);
            state.Energy = 200;
            EnergyRules.AdvanceTime(state, 600);
            Assert.That(state.Energy, Is.EqualTo(200));
        }

        [Test]
        public void DefaultFreeRefillOverfillsAndIsNotGrantedAgainAtDayBoundary()
        {
            var state = new EnergyState();
            Assert.That(EnergyRules.EnergyCost(state), Is.Zero);
            Assert.That(EnergyRules.BuyEnergy(state).Ok, Is.True);
            Assert.That(state.Energy, Is.EqualTo(200));
            Assert.That(state.Gems, Is.EqualTo(200));
            Assert.That(state.Price, Is.EqualTo(20));
            EnergyRules.BuyEnergy(state);
            Assert.That(state.Gems, Is.EqualTo(180));
            Assert.That(state.Price, Is.EqualTo(40));
            EnergyRules.AdvanceTime(state, 86400);
            Assert.That(state.Price, Is.EqualTo(10));
            Assert.That(state.FreeUsed, Is.EqualTo(1));
            Assert.That(EnergyRules.EnergyCost(state), Is.EqualTo(10));
        }

        [Test]
        public void ConfiguredFreeAllowanceKeepsBasePriceAfterFinalFreeUse()
        {
            var rules = new RuleSettings { ConfiguredNewUserFree = true };
            var state = new EnergyState { FreeTotal = 3 };
            EnergyRules.BuyEnergy(state, rules);
            EnergyRules.BuyEnergy(state, rules);
            EnergyRules.BuyEnergy(state, rules);
            Assert.That(state.FreeUsed, Is.EqualTo(3));
            Assert.That(state.Gems, Is.EqualTo(200));
            Assert.That(state.Price, Is.EqualTo(10));
            EnergyRules.BuyEnergy(state, rules);
            Assert.That(state.Gems, Is.EqualTo(190));
            Assert.That(state.Price, Is.EqualTo(20));
        }

        [Test]
        public void PartialUnconfiguredAllowanceChangesPriceOnlyOnLastFreeUse()
        {
            var state = new EnergyState { FreeTotal = 2 };
            EnergyRules.BuyEnergy(state);
            Assert.That(state.Price, Is.EqualTo(10));
            EnergyRules.BuyEnergy(state);
            Assert.That(state.Price, Is.EqualTo(20));
        }

        [Test]
        public void ConfiguredFreeFlagPreservesCurrentWebModelPrice()
        {
            var state = new EnergyState { Price = 40 };
            EnergyRules.BuyEnergy(state, new RuleSettings { ConfiguredNewUserFree = true });
            Assert.That(state.Price, Is.EqualTo(40));
            Assert.That(state.Gems, Is.EqualTo(200));
        }

        [Test]
        public void FailedPurchasePreservesBalancesPriceAndCounters()
        {
            var state = new EnergyState { Gems = 9, Energy = 1, FreeUsed = 1, Price = 10 };
            Assert.That(EnergyRules.BuyEnergy(state).Ok, Is.False);
            Assert.That(state.Gems, Is.EqualTo(9));
            Assert.That(state.Energy, Is.EqualTo(1));
            Assert.That(state.Price, Is.EqualTo(10));
            Assert.That(state.EnergyBuys, Is.Zero);
            Assert.That(state.FreeUsed, Is.EqualTo(1));
        }

        [Test]
        public void PaidPriceStopsAt160AndExactGemBalanceCanBuy()
        {
            var state = new EnergyState { Gems = 160, FreeUsed = 1, Price = 160 };
            Assert.That(EnergyRules.BuyEnergy(state).Ok, Is.True);
            Assert.That(state.Gems, Is.Zero);
            Assert.That(state.Price, Is.EqualTo(160));
            Assert.That(state.EnergyBuys, Is.EqualTo(1));
        }

        [Test]
        public void ResetOccursAtExactServerDayBoundaryAndCanSkipDays()
        {
            var state = new EnergyState { Time = 86399, Price = 160, FreeUsed = 1 };
            Assert.That(EnergyRules.AdvanceTime(state, 0).DayReset, Is.False);
            Assert.That(state.Price, Is.EqualTo(160));
            Assert.That(EnergyRules.AdvanceTime(state, 1).DayReset, Is.True);
            Assert.That(state.Price, Is.EqualTo(10));
            state.Price = 80;
            EnergyRules.AdvanceTime(state, 172800);
            Assert.That(state.Price, Is.EqualTo(10));
            Assert.That(state.FreeUsed, Is.EqualTo(1));
        }

        [TestCase(-1)]
        [TestCase(double.NaN)]
        [TestCase(double.PositiveInfinity)]
        public void InvalidTimeCannotMutateState(double seconds)
        {
            var state = new EnergyState { Time = 86399, Price = 160 };
            Assert.Throws<ArgumentOutOfRangeException>(() => EnergyRules.AdvanceTime(state, seconds));
            Assert.That(state.Time, Is.EqualTo(86399));
            Assert.That(state.Price, Is.EqualTo(160));
        }

        [Test]
        public void ZeroRecoveryDurationCannotAdvanceClock()
        {
            var state = new EnergyState { Time = 123 };
            Assert.Throws<ArgumentOutOfRangeException>(() => EnergyRules.AdvanceTime(state, 120, new RuleSettings { RecoverySeconds = 0 }));
            Assert.That(state.Time, Is.EqualTo(123));
        }
    }
}
