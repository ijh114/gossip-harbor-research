using NUnit.Framework;

namespace Harbor.Research.Rules.Tests
{
    public class BoardRulesTests
    {
        [Test]
        public void DefaultBoardCanGenerateExactly63ItemsWithoutChangingSeedOnFailure()
        {
            var state = new ExperimentState { Energy = 100 };
            for (var i = 0; i < 63; i++)
                Assert.That(BoardRules.GenerateItem(state).Ok, Is.True);
            var seed = state.Seed;
            Assert.That(BoardRules.GenerateItem(state).Code, Is.EqualTo("boardFull"));
            Assert.That(state.Energy, Is.EqualTo(37));
            Assert.That(state.Generated, Is.EqualTo(63));
            Assert.That(state.Seed, Is.EqualTo(seed));
        }

        [Test]
        public void XorShiftSequenceMatchesLiteralJavaScriptReferenceFixture()
        {
            var state = new ExperimentState { Energy = 10 };
            var families = new[] { "bread", "tea", "bread", "tea", "tea", "bread" };
            var seeds = new uint[] { 11355432, 2836018348, 476557059, 3648046016, 3759983556, 1441438134 };
            for (var i = 0; i < 6; i++)
            {
                BoardRules.GenerateItem(state);
                Assert.That(state.Board[i].Family, Is.EqualTo(families[i]));
                Assert.That(state.Seed, Is.EqualTo(seeds[i]));
            }
            Assert.That(state.Energy, Is.EqualTo(4));
        }

        [Test]
        public void InsufficientEnergyDoesNotConsumeEnergyOrRandomness()
        {
            var state = new ExperimentState { Energy = 1 };
            var rules = new RuleSettings { GenerationCost = 2 };
            Assert.That(BoardRules.GenerateItem(state, rules).Ok, Is.False);
            Assert.That(state.Energy, Is.EqualTo(1));
            Assert.That(state.Generated, Is.Zero);
            Assert.That(state.Seed, Is.EqualTo(42u));
            Assert.That(state.Board[0], Is.Null);
        }

        [Test]
        public void ZeroSeedRemainsZeroAsInWebXorShiftRatherThanBeingReseeded()
        {
            var state = new ExperimentState { Seed = 0 };
            BoardRules.GenerateItem(state);
            BoardRules.GenerateItem(state);
            Assert.That(state.Seed, Is.Zero);
            Assert.That(state.Board[0].Family, Is.EqualTo("bread"));
            Assert.That(state.Board[1].Family, Is.EqualTo("bread"));
        }

        [Test]
        public void MovingAndMergingConserveBaseUnitsAndDoNotConsumeEnergy()
        {
            var state = new ExperimentState();
            state.Board[0] = new BoardItem("tea", 3);
            state.Board[1] = new BoardItem("tea", 3);
            Assert.That(BoardRules.MergeItems(state, 0, 62).Ok, Is.True);
            Assert.That(state.Board[0], Is.Null);
            Assert.That(BaseUnits(state), Is.EqualTo(8));
            Assert.That(BoardRules.MergeItems(state, 62, 1).Ok, Is.True);
            Assert.That(state.Board[62], Is.Null);
            Assert.That(state.Board[1].Level, Is.EqualTo(4));
            Assert.That(BaseUnits(state), Is.EqualTo(8));
            Assert.That(state.Energy, Is.EqualTo(100));
        }

        [Test]
        public void InvalidOrIncompatibleMergePreservesBothItems()
        {
            var state = new ExperimentState();
            var a = new BoardItem("tea", 3);
            var b = new BoardItem("bread", 3);
            state.Board[0] = a;
            state.Board[1] = b;
            Assert.That(BoardRules.MergeItems(state, -1, 1).Ok, Is.False);
            Assert.That(BoardRules.MergeItems(state, 0, 63).Ok, Is.False);
            Assert.That(BoardRules.MergeItems(state, 0, 0).Ok, Is.False);
            Assert.That(BoardRules.MergeItems(state, 2, 1).Ok, Is.False);
            Assert.That(BoardRules.MergeItems(state, 0, 1).Ok, Is.False);
            Assert.That(state.Board[0], Is.SameAs(a));
            Assert.That(state.Board[1], Is.SameAs(b));
        }

        [Test]
        public void MaximumLevelCannotMergeButCanMove()
        {
            var state = new ExperimentState();
            state.Board[0] = new BoardItem("tea", 10);
            state.Board[1] = new BoardItem("tea", 10);
            Assert.That(BoardRules.MergeItems(state, 0, 1).Code, Is.EqualTo("maxLevel"));
            Assert.That(BoardRules.MergeItems(state, 0, 62).Ok, Is.True);
            Assert.That(state.Board[62].Level, Is.EqualTo(10));
        }

        [Test]
        public void DeliveryConsumesFirstQualifyingItemOnlyAndAwardsOneOrder()
        {
            var state = new ExperimentState();
            state.Board[0] = new BoardItem("bread", 3);
            state.Board[1] = new BoardItem("tea", 5);
            var later = new BoardItem("bread", 4);
            state.Board[62] = later;
            Assert.That(BoardRules.DeliverOrder(state).Ok, Is.True);
            Assert.That(state.Board[0], Is.Not.Null);
            Assert.That(state.Board[1], Is.Null);
            Assert.That(state.Board[62], Is.SameAs(later));
            Assert.That(state.Coins, Is.EqualTo(40));
            Assert.That(state.Orders, Is.EqualTo(1));
        }

        [Test]
        public void FailedDeliveryDoesNotMintCoins()
        {
            var state = new ExperimentState();
            state.Board[0] = new BoardItem("tea", 3);
            Assert.That(BoardRules.DeliverOrder(state).Ok, Is.False);
            Assert.That(state.Coins, Is.Zero);
            Assert.That(state.Orders, Is.Zero);
            Assert.That(state.Board[0].Level, Is.EqualTo(3));
        }

        private static long BaseUnits(ExperimentState state)
        {
            long total = 0;
            foreach (var item in state.Board)
                if (item != null) total += 1L << (item.Level - 1);
            return total;
        }
    }
}
