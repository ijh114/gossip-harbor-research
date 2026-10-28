using System.Text.Json;
using Harbor.Research.Rules;

var file=args.Length>0?args[0]:Path.Combine(AppContext.BaseDirectory,"fixtures.json");
using var json=JsonDocument.Parse(File.ReadAllText(file));
int assertions=0,sequences=0,steps=0;
void Check(bool condition,string message){assertions++;if(!condition)throw new Exception(message);}
double Num(JsonElement j,string name,double fallback=0)=>j.TryGetProperty(name,out var x)?x.GetDouble():fallback;
void Equal(double actual,JsonElement expected,string label){Check(Math.Abs(actual-expected.GetDouble())<1e-8,label+": "+actual+" != "+expected);}
foreach(var c in json.RootElement.GetProperty("cases").EnumerateArray()){
 var initial=c.GetProperty("initial");var s=new ExperimentState(63){Energy=Num(initial,"energy",100),Gems=Num(initial,"gems",200),Coins=Num(initial,"coins"),Time=Num(initial,"time"),RecoveryRemainder=Num(initial,"recoveryRemainder"),FreeUsed=(int)Num(initial,"freeUsed"),FreeTotal=(int)Num(initial,"freeTotal",1),Price=Num(initial,"price",10),Seed=(uint)Num(initial,"seed",42)};
 if(initial.TryGetProperty("board",out var initialBoard)){int i=0;foreach(var x in initialBoard.EnumerateArray()){if(x.ValueKind!=JsonValueKind.Null)s.Board[i]=new BoardItem(x.GetProperty("family").GetString(),x.GetProperty("level").GetInt32());i++;}}
 var expected=c.GetProperty("expected").EnumerateArray().ToArray();int step=0;
 foreach(var a in c.GetProperty("actions").EnumerateArray()){
  var result=a.GetProperty("kind").GetString() switch {"advance"=>EnergyRules.AdvanceTime(s,a.GetProperty("value").GetDouble()),"buy"=>EnergyRules.BuyEnergy(s),"generate"=>BoardRules.GenerateItem(s),"merge"=>BoardRules.MergeItems(s,a.GetProperty("from").GetInt32(),a.GetProperty("to").GetInt32()),"deliver"=>BoardRules.DeliverOrder(s),_=>throw new Exception("action")};
  var ex=expected[step++];var state=ex.GetProperty("state");string label=c.GetProperty("id")+"/"+step;
  Check(result.Ok==ex.GetProperty("ok").GetBoolean(),label+" result");
  foreach(var pair in new Dictionary<string,double>{{"energy",s.Energy},{"gems",s.Gems},{"coins",s.Coins},{"time",s.Time},{"recoveryRemainder",s.RecoveryRemainder},{"freeUsed",s.FreeUsed},{"freeTotal",s.FreeTotal},{"price",s.Price},{"energyBuys",s.EnergyBuys},{"generated",s.Generated},{"orders",s.Orders},{"seed",s.Seed}})Equal(pair.Value,state.GetProperty(pair.Key),label+"/"+pair.Key);
  var cells=state.GetProperty("board").EnumerateArray().ToArray();Check(s.Board.Length==cells.Length,label+" board size");
  for(int i=0;i<cells.Length;i++){if(cells[i].ValueKind==JsonValueKind.Null)Check(s.Board[i]==null,label+" null cell"+i);else{Check(s.Board[i]!=null,label+" occupied cell"+i);Check(s.Board[i].Family==cells[i].GetProperty("family").GetString(),label+" family"+i);Check(s.Board[i].Level==cells[i].GetProperty("level").GetInt32(),label+" level"+i);}}
  steps++;
 }
 sequences++;
}
EnergyGiftRaw Raw(JsonElement r)=>new EnergyGiftRaw(Num(r,"groupDuration"),Num(r,"groupCD"),Num(r,"giftDuration"),Num(r,"triggerEnergyPrice"),Num(r,"dailyTriggerUpper"),Num(r,"poptype"));
bool Flag(JsonElement j,string name,bool fallback=false)=>j.TryGetProperty(name,out var x)?x.GetBoolean():fallback;
foreach(var p in json.RootElement.GetProperty("predicates").EnumerateArray()){
 var j=p.GetProperty("state");var s=new EnergyGiftState{Energy=Num(j,"energy"),GenerationCost=Num(j,"generationCost",1),GemPrice=Num(j,"gemPrice",20),TriggerCount=Num(j,"triggerCount"),ServerTime=Num(j,"serverTime",86400),RefreshTime=Num(j,"refreshTime",86400),LateInited=Flag(j,"lateInited",true),CoolingDown=Flag(j,"coolingDown"),FreeAvailable=Flag(j,"freeAvailable"),ExistingValidBundle=Flag(j,"existingValidBundle"),ChainEnergyOpen=Flag(j,"chainEnergyOpen")};
 var result=BmRules.EvaluateEnergyGift(Raw(p.GetProperty("raw")),s);var ex=p.GetProperty("expected");Check(result.CanCreate==ex.GetProperty("canCreate").GetBoolean(),"BM eligibility");Check(result.FirstFailure==ex.GetProperty("firstFailure").GetString(),"BM first failure");Equal(result.EffectiveTriggerCount,ex.GetProperty("effectiveTriggerCount"),"BM count");Check(result.Refreshed==ex.GetProperty("refreshed").GetBoolean(),"BM refresh");
 var gates=ex.GetProperty("gates").EnumerateArray().ToArray();for(int i=0;i<gates.Length;i++){Check(result.Gates[i].Id==gates[i].GetProperty("id").GetString(),"gate ID");Check(result.Gates[i].Evaluated==gates[i].GetProperty("evaluated").GetBoolean(),"gate evaluation");var pass=gates[i].GetProperty("pass");Check(result.Gates[i].Pass==(pass.ValueKind==JsonValueKind.Null?(bool?)null:pass.GetBoolean()),"gate result");}
}
foreach(var p in json.RootElement.GetProperty("prices").EnumerateArray()){var chain=p.GetProperty("chain").EnumerateArray().Select(x=>x.GetDouble()).ToArray();Equal(BmRules.EnergyCostExcludeFree(p.GetProperty("normal").GetDouble(),chain,p.GetProperty("index").GetInt32()),p.GetProperty("expected"),"price");}
var normalization=json.RootElement.GetProperty("normalization");var conf=BmRules.NormalizeEnergyGift(Raw(normalization.GetProperty("raw")));var n=normalization.GetProperty("expected");Equal(conf.GroupSeconds,n.GetProperty("groupSeconds"),"group seconds");Equal(conf.CooldownSeconds,n.GetProperty("cooldownSeconds"),"CD seconds");Equal(conf.GiftSeconds,n.GetProperty("giftSeconds"),"gift seconds");
Console.WriteLine(JsonSerializer.Serialize(new{success=true,sequences,steps,predicates=9,priceCases=4,assertions,scope="Portable C# rules compile and JS fixture parity. Unity Editor/NUnit/scene import not executed."}));
