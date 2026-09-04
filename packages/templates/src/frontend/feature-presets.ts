export type FeaturePreset = {
  label: string;
  name: string;
  original: string;
  description: string;
  type?: "动作" | "被动" | "反应";
};

export const armorFeaturePresets: readonly FeaturePreset[] = [
  { label: "臃肿", name: "臃肿", original: "Bulky", description: "闪避值 −1；承受严重伤害时，必须**标记 1 压力点**。" },
  { label: "笨重", name: "笨重", original: "Cumbersome", description: "灵巧 −1。" },
  { label: "附魔", name: "附魔", original: "Enchanted", description: "伤害阈值获得等同于施法属性的加值。" },
  { label: "灵活", name: "灵活", original: "Flexible", description: "闪避值 +1。" },
  { label: "沉重", name: "沉重", original: "Heavy", description: "闪避值 −1。" },
  { label: "极重", name: "极重", original: "Heavy", description: "闪避值 −2；敏捷 −1。" },
  { label: "衬垫", name: "衬垫", original: "Lined", description: "**标记 1 压力点**，免受轻度伤害。" },
];

export const weaponFeaturePresets: readonly FeaturePreset[] = [
  { label: "瞄准", name: "瞄准", original: "Aimed", description: "若目标位于你的邻近范围内，或位于一名盟友的近战范围内，你的攻击具有劣势。你可以**标记 1 压力点**忽略此减值。" },
  { label: "屏障", name: "屏障", original: "Barrier", description: "护甲值 <+1/2/3/4>；闪避值 −1。" },
  { label: "笨重", name: "笨重", original: "Cumbersome", description: "灵巧 −1。" },
  { label: "专注", name: "专注", original: "Focused", description: "用主武器攻击近距离范围内的目标时，伤害骰获得 +1 加值。" },
  { label: "追击", name: "追击", original: "Follow-Up", description: "用主武器成功攻击近战范围内的目标后，你可以**标记 1 压力点**，使本次攻击的熟练值获得 +1 加值。" },
  { label: "沉重", name: "沉重", original: "Heavy", description: "闪避值 −1。" },
  { label: "钩住", name: "钩住", original: "Hooked", description: "攻击成功时，你可以将目标拉至近战范围内。" },
  { label: "巨型", name: "巨型", original: "Massive", description: "闪避值 −1；攻击成功时，额外掷一颗伤害骰，并舍弃最低结果。" },
  { label: "异界", name: "异界", original: "Otherworldly", description: "攻击成功时，你可以选择造成物理或魔法伤害。" },
  { label: "衬垫", name: "衬垫", original: "Padded", description: "伤害阈值 <+1/2/3/4>。" },
  { label: "成对", name: "成对", original: "Paired", description: "用主武器攻击近战范围内的目标时，伤害骰获得 <+1/2/3/4> 加值。" },
  { label: "穿刺", name: "穿刺", original: "Piercing", description: "用此武器造成伤害时，目标的重度伤害阈值视为降低 2。" },
  { label: "强力", name: "强力", original: "Powerful", description: "攻击成功时，额外掷一颗伤害骰，并舍弃最低结果。" },
  { label: "防护", name: "防护", original: "Protective", description: "护甲值 <+1/2/3/4>。" },
  { label: "迅捷", name: "迅捷", original: "Quick", description: "发动攻击时，你可以**标记 1 压力点**，额外指定攻击范围内的另一名生物为目标。" },
  { label: "可靠", name: "可靠", original: "Reliable", description: "攻击掷骰获得 +1 加值。" },
  { label: "装填", name: "装填", original: "Reloading", description: "发动攻击后，掷一颗 **d6**。若结果为 1，再次开火前必须**标记 1 压力点**装填此武器。" },
  { label: "回返", name: "回返", original: "Returning", description: "在射程内投掷此武器后，攻击结束时它会立即回到你手中。" },
  { label: "跳弹", name: "跳弹", original: "Ricochet", description: "投掷此武器后，它会回到你手中。发动攻击时，你可以**标记 1 压力点**，额外指定首个目标邻近范围内的另一名生物为目标。" },
  { label: "惊吓", name: "惊吓", original: "Startling", description: "**标记 1 压力点**并甩响鞭子，迫使近战范围内的所有敌人退至近距离范围。" },
  { label: "储备", name: "储备", original: "Stockpiled", description: "你可以使用<敏捷/灵巧>进行攻击掷骰，将此武器投向<远距离/近距离>范围内的目标。无需回收，因为你手边总有另一把。" },
  { label: "多用", name: "多用", original: "Versatile", description: "此武器也可使用以下数据：<属性>、<距离>范围、**<伤害>**<伤害类型>。" },
];

export const adversaryFeaturePresets: readonly FeaturePreset[] = [
  { label: "无情", name: "无情(X)", original: "Relentless (X)", type: "被动", description: "每个游戏主持人轮次中，<该敌人>至多可被聚焦 <X> 次。照常花费恐惧点来聚焦<该敌人>。" },
  { label: "群体攻击", name: "群体攻击", original: "Group Attack", type: "动作", description: "**花费 1 恐惧点**，选择一个目标，并聚焦其近距离范围内的所有<该敌人>。这些<该敌人>移动到目标的近战范围内，共同进行一次攻击掷骰。成功时，每名<该敌人>造成 <伤害>。合并计算这些伤害。" },
  { label: "杂兵", name: "杂兵(X)", original: "Minion (X)", type: "被动", description: "<该敌人>受到任何伤害即被击败。玩家角色每对<该敌人>造成 <X> 点伤害，便可在本次攻击能够命中的范围内额外击败一个杂兵。" },
  { label: "乘胜追击", name: "乘胜追击", original: "Momentum", type: "反应", description: "当<该敌人>成功攻击玩家角色时，你**获得 1 恐惧点**。" },
  { label: "集群", name: "集群(X)", original: "Horde (X)", type: "被动", description: "当<该敌人>已标记一半或更多生命点时，其普通攻击改为造成 **<X>** 点<伤害类型>伤害。" },
  { label: "惊怖", name: "惊怖", original: "Terrifying", type: "被动", description: "当<该敌人>攻击成功时，<范围>内的所有玩家角色**失去 1 希望点**，你**获得 1 恐惧点**。" },
  { label: "双重打击", name: "双重打击", original: "Double Strike", type: "动作", description: "**标记 1 压力点**，发动两次普通攻击。若两次攻击均成功命中同一目标，合并伤害。" },
  { label: "坐骑", name: "坐骑", original: "Mount", type: "被动", description: "<该敌人>骑乘坐骑时，难度获得 +2 加值。<该敌人>受到严重伤害时会被击落坐骑。若<该敌人>被击落，坐骑会消失，直到你**标记 1 压力点**将其再次召唤。" },
  { label: "压制", name: "压制", original: "Overwhelm", type: "反应", description: "当<该敌人>因近战范围内的攻击而<受伤条件>时，你可以**标记 1 压力点**，对攻击者发动一次<攻击方式>攻击。" },
  { label: "迟缓", name: "迟缓", original: "Slow", type: "被动", description: "当你聚焦<该敌人>且其数据块上没有指示物时，<该敌人>无法立即行动。在其数据块上放置一个指示物，并描述<该敌人>正在准备做什么。当你聚焦<该敌人>且其数据块上有指示物时，移除该指示物，然后其才可以行动。" },
];
