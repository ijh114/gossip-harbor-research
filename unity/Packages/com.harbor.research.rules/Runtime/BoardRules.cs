using System;

namespace Harbor.Research.Rules
{
    // This tiny board/order model is an analyst experiment, not a recovered board.
    public static class BoardRules
    {
        public static RuleResult GenerateItem(ExperimentState state, RuleSettings rules = null)
        {
            Guard.NotNull(state, "state");
            rules = rules ?? new RuleSettings();
            Guard.Number(rules.GenerationCost, "GenerationCost");
            Guard.Number(state.Energy, "Energy");
            if (state.Energy < rules.GenerationCost)
                return new RuleResult(false, "insufficientEnergy");
            var slot = Array.FindIndex(state.Board, item => item == null);
            if (slot < 0) return new RuleResult(false, "boardFull");
            state.Energy -= rules.GenerationCost;
            state.Board[slot] = new BoardItem(Random(state) < 0.5 ? "bread" : "tea", 1);
            state.Generated++;
            return new RuleResult(true, "generated", energyDelta: -rules.GenerationCost);
        }

        public static RuleResult MergeItems(ExperimentState state, int from, int to)
        {
            Guard.NotNull(state, "state");
            if (from < 0 || to < 0 || from >= state.Board.Length || to >= state.Board.Length || from == to)
                return new RuleResult(false, "invalidSelection");
            var a = state.Board[from];
            var b = state.Board[to];
            if (a == null) return new RuleResult(false, "emptySource");
            if (b == null)
            {
                state.Board[to] = a;
                state.Board[from] = null;
                return new RuleResult(true, "moved");
            }
            if (a.Family != b.Family || a.Level != b.Level)
                return new RuleResult(false, "incompatible");
            if (a.Level >= 10) return new RuleResult(false, "maxLevel");
            state.Board[to] = new BoardItem(a.Family, a.Level + 1);
            state.Board[from] = null;
            return new RuleResult(true, "merged");
        }

        public static RuleResult DeliverOrder(ExperimentState state, RuleSettings rules = null)
        {
            Guard.NotNull(state, "state");
            rules = rules ?? new RuleSettings();
            if (rules.OrderLevel < 1) throw new ArgumentOutOfRangeException("OrderLevel");
            Guard.Number(rules.OrderCoins, "OrderCoins");
            var slot = Array.FindIndex(state.Board, item => item != null && item.Level >= rules.OrderLevel);
            if (slot < 0) return new RuleResult(false, "missingOrder");
            var coins = Guard.Number(state.Coins + rules.OrderCoins, "newCoins");
            state.Board[slot] = null;
            state.Coins = coins;
            state.Orders++;
            return new RuleResult(true, "delivered", coinDelta: rules.OrderCoins);
        }

        private static double Random(ExperimentState state)
        {
            // uint shifts preserve JS bitwise xorshift32, including its seed-0 state.
            unchecked
            {
                var x = state.Seed;
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                state.Seed = x;
                return x / 4294967296.0;
            }
        }
    }
}
