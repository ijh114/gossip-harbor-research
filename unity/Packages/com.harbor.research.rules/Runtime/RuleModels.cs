using System;
using System.Collections.Generic;

namespace Harbor.Research.Rules
{
    // Shipped energy defaults plus explicit analyst experiment settings.
    // These fields are not live server configuration or store prices.
    public sealed class RuleSettings
    {
        public double MaxEnergy = 100;
        public double RecoverySeconds = 120;
        public double RefillEnergy = 100;
        public double FirstGemCost = 10;
        public double MaxGemCost = 160;
        public bool ConfiguredNewUserFree;
        public double GenerationCost = 1;
        public int OrderLevel = 4;
        public double OrderCoins = 40;
    }

    public class EnergyState
    {
        public double Energy = 100;
        public double Gems = 200;
        public double Coins;
        public int Level = 3;
        public double Time;
        public double RecoveryRemainder;
        public long EnergyBuys;
        public int FreeUsed;
        public int FreeTotal = 1;
        public double Price = 10;
    }

    public sealed class BoardItem
    {
        public string Family { get; private set; }
        public int Level { get; private set; }

        public BoardItem(string family, int level)
        {
            if (string.IsNullOrEmpty(family)) throw new ArgumentException("A family is required.", "family");
            if (level < 1 || level > 10) throw new ArgumentOutOfRangeException("level");
            Family = family;
            Level = level;
        }
    }

    public sealed class ExperimentState : EnergyState
    {
        // Explicit requested research layout; engine.mjs currently defaults to 30.
        public const int DefaultBoardSize = 63;
        public readonly BoardItem[] Board;
        public uint Seed = 42;
        public long Generated;
        public long Orders;

        public ExperimentState(int boardSize = DefaultBoardSize)
        {
            if (boardSize < 1) throw new ArgumentOutOfRangeException("boardSize");
            Board = new BoardItem[boardSize];
        }
    }

    // Stable result codes are intentionally separate from UI localization and logs.
    public sealed class RuleResult
    {
        public bool Ok { get; private set; }
        public string Code { get; private set; }
        public double EnergyDelta { get; private set; }
        public double GemCost { get; private set; }
        public double CoinDelta { get; private set; }
        public bool DayReset { get; private set; }

        internal RuleResult(bool ok, string code, double energyDelta = 0,
            double gemCost = 0, double coinDelta = 0, bool dayReset = false)
        {
            Ok = ok;
            Code = code;
            EnergyDelta = energyDelta;
            GemCost = gemCost;
            CoinDelta = coinDelta;
            DayReset = dayReset;
        }
    }

    // Required constructor arguments map to the actual EnergyGift wire fields.
    // No default offer configuration is supplied by this package.
    public sealed class EnergyGiftRaw
    {
        public readonly double GroupDuration;
        public readonly double GroupCd;
        public readonly double GiftDuration;
        public readonly double TriggerEnergyPrice;
        public readonly double DailyTriggerUpper;
        public readonly double PopType;

        public EnergyGiftRaw(double groupDuration, double groupCd, double giftDuration,
            double triggerEnergyPrice, double dailyTriggerUpper, double popType)
        {
            GroupDuration = groupDuration;
            GroupCd = groupCd;
            GiftDuration = giftDuration;
            TriggerEnergyPrice = triggerEnergyPrice;
            DailyTriggerUpper = dailyTriggerUpper;
            PopType = popType;
        }
    }

    public sealed class EnergyGiftConfig
    {
        public readonly double GroupSeconds;
        public readonly double CooldownSeconds;
        public readonly double GiftSeconds;
        public readonly double TriggerPrice;
        public readonly double TriggerLimit;
        public readonly double PopType;

        internal EnergyGiftConfig(double groupSeconds, double cooldownSeconds,
            double giftSeconds, double triggerPrice, double triggerLimit, double popType)
        {
            GroupSeconds = groupSeconds;
            CooldownSeconds = cooldownSeconds;
            GiftSeconds = giftSeconds;
            TriggerPrice = triggerPrice;
            TriggerLimit = triggerLimit;
            PopType = popType;
        }
    }

    // These defaults reproduce the web predicate's analyst scenario, not a player.
    public sealed class EnergyGiftState
    {
        public bool LateInited = true;
        public double ServerTime = 86400;
        public double RefreshTime = 86400;
        public double TriggerCount;
        public bool CoolingDown;
        public bool FreeAvailable;
        public double GemPrice = 20;
        public bool ExistingValidBundle;
        public double Energy;
        public double GenerationCost = 1;
        public bool ChainEnergyOpen;
    }

    public sealed class GateResult
    {
        public readonly string Id;
        public readonly string Label;
        public readonly bool Evaluated;
        public readonly bool? Pass;

        internal GateResult(string id, string label, bool evaluated, bool? pass)
        {
            Id = id;
            Label = label;
            Evaluated = evaluated;
            Pass = pass;
        }
    }

    public sealed class EnergyGiftEvaluation
    {
        public readonly bool CanCreate;
        public readonly EnergyGiftConfig Config;
        public readonly IReadOnlyList<GateResult> Gates;
        public readonly bool Refreshed;
        public readonly double EffectiveTriggerCount;
        public readonly string FirstFailure;
        public const string Scope = "New EnergyBundle creation only; existing-offer exposure, IAP, tutorial and UI gates remain separate.";

        internal EnergyGiftEvaluation(bool canCreate, EnergyGiftConfig config,
            IReadOnlyList<GateResult> gates, bool refreshed, double count, string firstFailure)
        {
            CanCreate = canCreate;
            Config = config;
            Gates = gates;
            Refreshed = refreshed;
            EffectiveTriggerCount = count;
            FirstFailure = firstFailure;
        }
    }

    internal static class Guard
    {
        internal static void NotNull(object value, string name)
        {
            if (value == null) throw new ArgumentNullException(name);
        }

        internal static double Number(double value, string name, double min = 0)
        {
            if (double.IsNaN(value) || double.IsInfinity(value) || value < min)
                throw new ArgumentOutOfRangeException(name, "A finite number at or above " + min + " is required.");
            return value;
        }
    }
}
