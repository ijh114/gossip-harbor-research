using System;

namespace Harbor.Research.Rules
{
    public static class EnergyRules
    {
        public const double SecondsPerDay = 86400;

        public static double EnergyCost(EnergyState state)
        {
            Guard.NotNull(state, "state");
            return state.FreeUsed < state.FreeTotal ? 0 : state.Price;
        }

        public static RuleResult AdvanceTime(EnergyState state, double seconds, RuleSettings rules = null)
        {
            Guard.NotNull(state, "state");
            rules = rules ?? new RuleSettings();
            Guard.Number(seconds, "seconds");
            Guard.Number(rules.RecoverySeconds, "RecoverySeconds", 1);
            Guard.Number(rules.MaxEnergy, "MaxEnergy");
            Guard.Number(rules.FirstGemCost, "FirstGemCost");
            Guard.Number(state.Time, "Time");
            Guard.Number(state.Energy, "Energy");
            Guard.Number(state.RecoveryRemainder, "RecoveryRemainder");
            var newTime = Guard.Number(state.Time + seconds, "newTime");
            var available = Guard.Number(state.RecoveryRemainder + seconds, "available");
            var dayReset = Math.Floor(newTime / SecondsPerDay) > Math.Floor(state.Time / SecondsPerDay);
            double gained = 0;
            double remainder = 0;
            if (state.Energy < rules.MaxEnergy)
            {
                gained = Math.Min(rules.MaxEnergy - state.Energy, Math.Floor(available / rules.RecoverySeconds));
                if (state.Energy + gained < rules.MaxEnergy)
                    remainder = available % rules.RecoverySeconds;
            }
            state.Time = newTime;
            if (dayReset) state.Price = rules.FirstGemCost;
            state.Energy += gained;
            state.RecoveryRemainder = remainder;
            return new RuleResult(true, "timeAdvanced", energyDelta: gained, dayReset: dayReset);
        }

        public static RuleResult BuyEnergy(EnergyState state, RuleSettings rules = null)
        {
            Guard.NotNull(state, "state");
            rules = rules ?? new RuleSettings();
            Guard.Number(state.Energy, "Energy");
            Guard.Number(state.Gems, "Gems");
            Guard.Number(state.Price, "Price");
            Guard.Number(rules.RefillEnergy, "RefillEnergy");
            Guard.Number(rules.FirstGemCost, "FirstGemCost");
            Guard.Number(rules.MaxGemCost, "MaxGemCost");
            var free = state.FreeUsed < state.FreeTotal;
            var cost = free ? 0 : state.Price;
            if (state.Gems < cost) return new RuleResult(false, "insufficientGems");
            var newEnergy = Guard.Number(state.Energy + rules.RefillEnergy, "newEnergy");
            var nextPrice = state.Price;
            if (free)
            {
                if (!rules.ConfiguredNewUserFree && state.FreeUsed + 1 >= state.FreeTotal)
                    nextPrice = Guard.Number(rules.FirstGemCost * 2, "nextPrice");
            }
            else
            {
                nextPrice = Math.Min(rules.MaxGemCost, state.Price * 2);
            }
            state.Gems -= cost;
            state.Energy = newEnergy;
            state.EnergyBuys++;
            if (free) state.FreeUsed++;
            state.Price = nextPrice;
            return new RuleResult(true, "energyBought", energyDelta: rules.RefillEnergy, gemCost: cost);
        }
    }
}
