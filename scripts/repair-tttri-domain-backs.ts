import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { packPbresWorkspace, unpackPbresToWorkspace } from "./pbres-workspace.ts";

const sourceRoot = path.resolve(process.argv[2] || "../PbDH_sheet/public/system-packages/tttri");
const target = path.resolve("apps/player/public/system-packages/tttri/resources/tttri.pbres");
const workspace = path.resolve(".scratch/tttri-resource-repair/workspace");
await unpackPbresToWorkspace(target, workspace);
const source = JSON.parse(await readFile(path.join(sourceRoot, "resources/domain-cards.json"), "utf8")) as Array<Record<string, string>>;
const manifestPath = path.join(workspace, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pairs = [
  { domain: "精准", front: "归乡邀约", back: "归乡邀约·洗礼", text: "此卡牌说明“归乡邀约”的可用洗礼种类。\n\n炮火洗礼：投射纯粹的炮火，摧毁当前场景内所有可摧毁建筑物并对所有敌人造成使用你熟练值的 d20 点物理伤害。请注意，此项可能会被外部支援因特定原因拒绝。\n\n治愈洗礼：投射对生物有治愈效力的药剂，为当前场景内所有友方角色恢复 3 生命点。\n\n脉冲洗礼：投射对生物无害的特定脉冲，迫使当前场景内所有机械电子结构和源石驱动结构失效。" },
  { domain: "奥术", front: "霜白摇篮曲", back: "摇篮曲·终", text: "此卡牌说明“霜白摇篮曲”的收束效果与过载效果。\n\n收束：你可以在施法掷骰前将此次施法的作用目标改为你此时正触及到的一个友方自愿角色，若如此做，施法掷骰难度变为（1），你将伤害掷骰转变为对其的安抚，其获得 3 希望点或清除 3 压力点。\n\n过载：你可以在施法掷骰前额外标记 2 生命点，使得此次施加的寒冷状态直接变为冻结状态。" },
  { domain: "支柱", front: "大地的慈悲", back: "大地的慈悲·昭示", text: "此卡说明“大地的慈悲”的另两种可选项。\n\n白夜如昼：大地揭示了一切阴谋，直至当前场景结束，所有生物无法借助环境隐藏身形。游戏主持人可以花费 2 恐惧点提前结束该效果。\n\n新潮旧渊：大地总在抚平伤痛，将此卡永久放入你的宝库中，该环境将在一段时间后因为某种原因发生变化，这种变化普遍都是朝向更好的方向（例如战火后的房屋修复，或是人们逐步放下仇恨投入新的生活之中）。" },
  { domain: "工业", front: "反击炮火", back: "召唤：炮台", text: "此卡牌说明“反击炮火”的炮台机制。\n\n每当一个敌人针对友方角色进行了一次成功的攻击时，炮台将进行一次强力炮击反击，对该敌人以及其中距离内的其他敌人各造成 1d12 点不可被降低的物理伤害。而后，炮台的召唤骰数值 +1。\n\n当大型炮台损毁时，将本领域卡暂时移除，直至本场游戏结束时才能重新放入你的宝库中。" },
  { domain: "工业", front: "号令巨兵", back: "召唤：巨兵", text: "此卡牌说明“号令巨兵”的巨型造物模式。\n\n巨型造物模式：你不再单独行动，而是操控此巨型造物发起攻击、进行施法以及移动。攻击时，使用放大版本的你当前配置的武器，在原本武器骰基础上提升一级且熟练值 +3。施法时，你的施法范围提升一级且施法掷骰获得 +3 加值。移动时，你只能进行近距离移动，但无视困难地形。\n\n当巨型造物将损毁时，其将发起最终攻势，对中距离内的所有敌人进行一次攻击反应掷骰。" },
];

for (const [domain, oldName, name] of [["精准", "恶魔吞日", "恶魇吞日"], ["心界", "遁入阖那", "遁入阇那"]]) {
  const oldPath = path.join(workspace, "领域卡", domain!, `${oldName}.json`);
  const resource = JSON.parse(await readFile(oldPath, "utf8"));
  if (!source.some((row) => row.ID === resource.id && row.名称 === name)) throw new Error(`来源名称不匹配：${name}`);
  resource.data.名称 = name;
  await writeFile(oldPath, `${JSON.stringify(resource, null, 2)}\n`);
  // 两个路径均来自上述固定清单，且位于本次解包目录内。
  await rename(oldPath, path.join(workspace, "领域卡", domain!, `${name}.json`));
}
for (const pair of pairs) {
  const frontPath = path.join(workspace, "领域卡", pair.domain, `${pair.front}.json`);
  const front = JSON.parse(await readFile(frontPath, "utf8"));
  const row = source.find((item) => item.ID === front.id);
  if (!row?.卡背) throw new Error(`缺少卡背来源：${pair.front}`);
  const imagePath = path.resolve(sourceRoot, row.卡背);
  if (!imagePath.startsWith(`${sourceRoot}${path.sep}`)) throw new Error("卡背路径超出来源目录。");
  const bytes = await readFile(imagePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const assetId = `sha256:${digest}`;
  if (!manifest.assets.some((asset: { id: string }) => asset.id === assetId)) manifest.assets.push({ id: assetId, mediaType: "image/webp", byteLength: String(bytes.length), width: "600", height: "840" });
  await mkdir(path.join(workspace, "assets"), { recursive: true });
  await writeFile(path.join(workspace, "assets", `${digest}.webp`), bytes);
  const backId = `领域卡:${pair.domain}:${pair.back}`;
  front.template.version = "1.1.0";
  front.replacements = [{ replacementId: "alternate-form", targetResourceId: backId }];
  const back = { ...structuredClone(front), id: backId, data: { ...front.data, 名称: pair.back, 特性描述: pair.text }, media: { portrait: assetId }, replacements: [{ replacementId: "alternate-form", targetResourceId: front.id }] };
  await writeFile(frontPath, `${JSON.stringify(front, null, 2)}\n`);
  await writeFile(path.join(workspace, "领域卡", pair.domain, `${pair.back.replace(/[:]/gu, "：")}.json`), `${JSON.stringify(back, null, 2)}\n`);
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const result = await packPbresWorkspace({ workspacePath: workspace, outputPath: target, bump: "patch", overwrite: true });
console.log(JSON.stringify({ version: result.document.package.version, resources: result.document.resources.length, assets: result.document.assets.length }));
