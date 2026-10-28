using System;
using System.Collections.Generic;

namespace Harbor.Research.Rules
{
    public static class BmRules
    {
        public static EnergyGiftConfig NormalizeEnergyGift(EnergyGiftRaw raw)
        {
            if (raw == null) return null;
            Guard.Number(raw.GroupDuration, "groupDuration");
            Guard.Number(raw.GroupCd, "groupCD");
            Guard.Number(raw.GiftDuration, "giftDuration");
            Guard.Number(raw.TriggerEnergyPrice, "triggerEnergyPrice");
            Guard.Number(raw.DailyTriggerUpper, "dailyTriggerUpper");
            Guard.Number(raw.PopType, "poptype");
            if (Math.Floor(raw.DailyTriggerUpper) != raw.DailyTriggerUpper)
                throw new ArgumentOutOfRangeException("dailyTriggerUpper", "An integer is required.");
            return new EnergyGiftConfig(
                Guard.Number(raw.GroupDuration * 60, "groupSeconds"),
                Guard.Number(raw.GroupCd * 60, "cooldownSeconds"),
                Guard.Number(raw.GiftDuration * 60, "giftSeconds"),
                raw.TriggerEnergyPrice, raw.DailyTriggerUpper, raw.PopType);
        }

        public static EnergyGiftEvaluation EvaluateEnergyGift(EnergyGiftRaw raw, EnergyGiftState state = null)
        {
            var config = NormalizeEnergyGift(raw);
            state = state ?? new EnergyGiftState();
            Guard.Number(state.ServerTime, "serverTime");
            Guard.Number(state.RefreshTime, "refreshTime");
            Guard.Number(state.TriggerCount, "triggerCount");
            Guard.Number(state.GemPrice, "gemPrice");
            Guard.Number(state.Energy, "energy");
            Guard.Number(state.GenerationCost, "generationCost", 1);
            // Match the source's day inequality (including a backwards day change).
            var refreshed = Math.Floor(state.ServerTime / EnergyRules.SecondsPerDay)
                != Math.Floor(state.RefreshTime / EnergyRules.SecondsPerDay);
            var count = refreshed ? 0 : state.TriggerCount;
            var gates = new List<GateResult>(9);
            var stopped = false;
            AddGate(gates, ref stopped, "lateInit", "LateInit complete", state.LateInited);
            AddGate(gates, ref stopped, "config", "EnergyGift configuration exists", config != null);
            AddGate(gates, ref stopped, "daily", "Below daily creation limit", config != null && count < config.TriggerLimit);
            AddGate(gates, ref stopped, "cooldown", "Group is not cooling down", !state.CoolingDown);
            AddGate(gates, ref stopped, "free", "No free refill available", !state.FreeAvailable);
            AddGate(gates, ref stopped, "price", "Normal gem price reaches threshold", config != null && state.GemPrice >= config.TriggerPrice);
            AddGate(gates, ref stopped, "existing", "No existing valid bundle", !state.ExistingValidBundle);
            AddGate(gates, ref stopped, "energy", "Energy below current generation cost", state.Energy < state.GenerationCost);
            AddGate(gates, ref stopped, "chain", "ChainEnergy is not open", !state.ChainEnergyOpen);
            string firstFailure = null;
            foreach (var gate in gates)
            {
                if (gate.Evaluated && gate.Pass == false)
                {
                    firstFailure = gate.Id;
                    break;
                }
            }
            return new EnergyGiftEvaluation(!stopped, config, gates.AsReadOnly(), refreshed, count, firstFailure);
        }

        public static double EnergyCostExcludeFree(double normalPrice,
            IReadOnlyList<double> chainPrices = null, int currentIndex = 0)
        {
            Guard.Number(normalPrice, "normalPrice");
            if (currentIndex < 0) throw new ArgumentOutOfRangeException("currentIndex");
            if (chainPrices != null)
            {
                for (var i = currentIndex; i < chainPrices.Count; i++)
                {
                    var price = chainPrices[i];
                    if (!double.IsNaN(price) && !double.IsInfinity(price) && price > 0)
                        return Math.Max(normalPrice, price);
                }
            }
            return normalPrice;
        }

        private static void AddGate(List<GateResult> gates, ref bool stopped, string id, string label, bool pass)
        {
            var evaluated = !stopped;
            gates.Add(new GateResult(id, label, evaluated, evaluated ? (bool?)pass : null));
            if (evaluated && !pass) stopped = true;
        }
    }
}
