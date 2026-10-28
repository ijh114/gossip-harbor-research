using System;
using NUnit.Framework;

namespace Harbor.Research.Rules.Tests
{
    public class BmRulesTests
    {
        // Explicit synthetic fixture from bm-rules.test.mjs; not an observed server record.
        private static EnergyGiftRaw Fixture()
        {
            return new EnergyGiftRaw(60, 240, 30, 20, 2, 1);
        }

        [Test]
        public void NormalizeConvertsMinuteDurationsAndPreservesOtherWireValues()
        {
            var config = BmRules.NormalizeEnergyGift(Fixture());
            Assert.That(config.GroupSeconds, Is.EqualTo(3600));
            Assert.That(config.CooldownSeconds, Is.EqualTo(14400));
            Assert.That(config.GiftSeconds, Is.EqualTo(1800));
            Assert.That(config.TriggerPrice, Is.EqualTo(20));
            Assert.That(config.TriggerLimit, Is.EqualTo(2));
            Assert.That(config.PopType, Is.EqualTo(1));
            Assert.That(BmRules.NormalizeEnergyGift(null), Is.Null);
        }

        [TestCase(-1)]
        [TestCase(double.NaN)]
        [TestCase(double.PositiveInfinity)]
        public void NormalizeRejectsInvalidDuration(double duration)
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => BmRules.NormalizeEnergyGift(new EnergyGiftRaw(duration, 0, 0, 0, 1, 1)));
        }

        [Test]
        public void NormalizeRejectsFractionalTriggerLimit()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => BmRules.NormalizeEnergyGift(new EnergyGiftRaw(1, 1, 1, 1, 1.5, 1)));
        }

        [Test]
        public void ExactPriceThresholdIsEligibleButZeroDailyLimitBlocks()
        {
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), new EnergyGiftState { GemPrice = 20 }).CanCreate, Is.True);
            var zeroLimit = new EnergyGiftRaw(1, 1, 1, 20, 0, 1);
            Assert.That(BmRules.EvaluateEnergyGift(zeroLimit).FirstFailure, Is.EqualTo("daily"));
        }

        [Test]
        public void EnergyEqualsGenerationCostBlocksButBoostedCostCanMakeItInsufficient()
        {
            var state = new EnergyGiftState { Energy = 1, GenerationCost = 1 };
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), state).FirstFailure, Is.EqualTo("energy"));
            state.GenerationCost = 2;
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), state).CanCreate, Is.True);
        }

        [Test]
        public void MissingConfigStopsBeforeDailyAndLaterGatesRemainUnevaluated()
        {
            var result = BmRules.EvaluateEnergyGift(null);
            Assert.That(result.FirstFailure, Is.EqualTo("config"));
            Assert.That(result.Gates[0].Pass, Is.True);
            Assert.That(result.Gates[1].Pass, Is.False);
            Assert.That(result.Gates[2].Evaluated, Is.False);
            Assert.That(result.Gates[2].Pass, Is.Null);
        }

        [TestCase("lateInit")]
        [TestCase("daily")]
        [TestCase("cooldown")]
        [TestCase("free")]
        [TestCase("price")]
        [TestCase("existing")]
        [TestCase("chain")]
        public void IndividualBlockersReportTheirFirstFailure(string key)
        {
            var state = new EnergyGiftState();
            switch (key)
            {
                case "lateInit": state.LateInited = false; break;
                case "daily": state.TriggerCount = 2; break;
                case "cooldown": state.CoolingDown = true; break;
                case "free": state.FreeAvailable = true; break;
                case "price": state.GemPrice = 19; break;
                case "existing": state.ExistingValidBundle = true; break;
                case "chain": state.ChainEnergyOpen = true; break;
            }
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), state).FirstFailure, Is.EqualTo(key));
        }

        [Test]
        public void DayChangeResetsEffectiveCountWithoutMutatingInputOrBypassingCooldown()
        {
            var state = new EnergyGiftState { ServerTime = 172800, RefreshTime = 172799, TriggerCount = 99 };
            var result = BmRules.EvaluateEnergyGift(Fixture(), state);
            Assert.That(result.CanCreate, Is.True);
            Assert.That(result.Refreshed, Is.True);
            Assert.That(result.EffectiveTriggerCount, Is.Zero);
            Assert.That(state.TriggerCount, Is.EqualTo(99));
            Assert.That(state.RefreshTime, Is.EqualTo(172799));
            state.CoolingDown = true;
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), state).FirstFailure, Is.EqualTo("cooldown"));
        }

        [Test]
        public void TriggerPredicateUsesDayInequalityEvenWhenClockMovesBack()
        {
            var state = new EnergyGiftState { ServerTime = 86399, RefreshTime = 86400, TriggerCount = 99 };
            Assert.That(BmRules.EvaluateEnergyGift(Fixture(), state).EffectiveTriggerCount, Is.Zero);
        }

        [Test]
        public void FirstPositiveChainPriceWinsOverLaterMaximumAndUsesZeroBasedIndex()
        {
            var prices = new double[] { 0, 40, 160 };
            Assert.That(BmRules.EnergyCostExcludeFree(20, prices, 0), Is.EqualTo(40));
            Assert.That(BmRules.EnergyCostExcludeFree(80, prices, 0), Is.EqualTo(80));
            Assert.That(BmRules.EnergyCostExcludeFree(20, prices, 2), Is.EqualTo(160));
            Assert.That(BmRules.EnergyCostExcludeFree(20, prices, 3), Is.EqualTo(20));
            Assert.That(prices, Is.EqualTo(new double[] { 0, 40, 160 }));
        }

        [Test]
        public void ChainPriceScanSkipsInvalidOrNonpositiveCandidatesLikeJavaScript()
        {
            Assert.That(BmRules.EnergyCostExcludeFree(20, new[] { double.NaN, double.PositiveInfinity, -1d, 0d, 40d, 160d }), Is.EqualTo(40));
            Assert.That(BmRules.EnergyCostExcludeFree(20, new double[] { 0, 0 }), Is.EqualTo(20));
            Assert.That(BmRules.EnergyCostExcludeFree(20), Is.EqualTo(20));
            Assert.Throws<ArgumentOutOfRangeException>(() => BmRules.EnergyCostExcludeFree(20, new double[0], -1));
        }
    }
}
