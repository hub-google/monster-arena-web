const fs = require('fs');
const path = require('path');
const COMPENDIUM_DIR = path.join(__dirname, '..', 'docs', 'Monster_Compendium');

// Ensure directory exists
if (!fs.existsSync(COMPENDIUM_DIR)) {
  fs.mkdirSync(COMPENDIUM_DIR, { recursive: true });
}

// 1. Generate 00_Combat_Mechanics.md
const combatMechanics = `# 戰鬥機制與戰術體系 (Combat Mechanics & Synergies)

本作的戰鬥不只是純粹的數值比拼，更強調「種族屬性」、「自然元素」與「異常狀態」的交織搭配。

## 一、 雙軸剋制系統 (Dual-Axis Counter System)

每隻怪獸同時擁有一種 **核心種族 (Type)** 與一至兩種 **自然元素 (Element)**。

### 1. 核心種族 (Type)
決定了基礎傷害的巨大增幅與減免：
- **疫苗種 (Vaccine)** 剋制 病毒種 (Virus)
- **病毒種 (Virus)** 剋制 資料種 (Data)
- **資料種 (Data)** 剋制 疫苗種 (Vaccine)
> **剋制效果**：造成傷害 +30%，受到傷害 -30%。

### 2. 自然元素 (Element)
- 🔴 **火 (Fire)**：剋制自然。主打持續傷害 (燃燒) 與瞬間爆發。
- 🔵 **水 (Water)**：剋制火。主打賦予潮濕、緩速與控制。
- 🟢 **自然 (Nature)**：剋制水。主打回復生命、持久戰與猛毒。
- 🟡 **雷 (Electric)**：剋制水、飛行。主打麻痺、打斷行動條 (ATB)。
- ⚪ **光 (Light)**：與暗互剋。主打全體護盾與淨化。
- ⚫ **暗 (Dark)**：與光互剋。主打真實傷害與吸血。

## 二、 戰術搭配 (Tactical Synergies)
- **🔥 爆炎引爆**：目標\`[燃燒]\` + \`[爆破]\`技能 -> 消耗燃燒造成 250% 爆發。
- **⚡ 導電麻痺**：目標\`[潮濕]\` + \`[雷屬性]\`攻擊 -> 100% 賦予\`[麻痺]\`。
- **☠️ 猛毒吞噬**：目標疊加3層\`[中毒]\` + \`[毒液爆發]\`技能 -> 真實傷害斬殺。
- **🌑 影之刺殺**：目標擁有\`[護盾]\` + \`[暗殺]\`技能 -> 無視護盾。
`;

fs.writeFileSync(path.join(COMPENDIUM_DIR, '00_Combat_Mechanics.md'), combatMechanics);

// 2. Generate 100 Monsters across 7 families
const families = [
  { id: '01', name: 'Dragon_Line', theme: '火/光', emoji: '🐉' },
  { id: '02', name: 'Beast_Line', theme: '自然/雷', emoji: '🐺' },
  { id: '03', name: 'Demon_Line', theme: '暗/火', emoji: '👿' },
  { id: '04', name: 'Machine_Line', theme: '雷/光', emoji: '🤖' },
  { id: '05', name: 'Plant_Line', theme: '自然/毒', emoji: '🌿' },
  { id: '06', name: 'Aquatic_Line', theme: '水/冰', emoji: '🐟' },
  { id: '07', name: 'Bird_Line', theme: '風/光', emoji: '🦅' },
];

const stages = [
  { stage: 1, name: 'Egg', count: 1 },
  { stage: 2, name: 'Baby', count: 1 },
  { stage: 3, name: 'Child', count: 3, types: ['Vaccine', 'Data', 'Virus'] },
  { stage: 4, name: 'Mature', count: 3, types: ['Vaccine', 'Data', 'Virus'] },
  { stage: 5, name: 'Perfect', count: 3, types: ['Vaccine', 'Data', 'Virus'] },
  { stage: 6, name: 'Ultimate', count: 3, types: ['Vaccine', 'Data', 'Virus'] }
];

let globalId = 1;

const NAME_MAP = {
  '01': {
    1: { 'None': '龍之蛋' },
    2: { 'None': '黑球獸' },
    3: { 'Vaccine': '亞古獸', 'Data': '積木亞古獸', 'Virus': '黑亞古獸' },
    4: { 'Vaccine': '暴龍獸', 'Data': '巨龍獸', 'Virus': '黑暴龍獸' },
    5: { 'Vaccine': '機械暴龍獸', 'Data': '金屬巨龍獸', 'Virus': '喪屍暴龍獸' },
    6: { 'Vaccine': '戰鬥暴龍獸', 'Data': '無限龍獸', 'Virus': '黑暗戰鬥暴龍獸' }
  },
  '02': {
    1: { 'None': '獸之蛋' },
    2: { 'None': '獨角獸' },
    3: { 'Vaccine': '加布獸', 'Data': '迷幻獸', 'Virus': '黑加布獸' },
    4: { 'Vaccine': '加魯魯獸', 'Data': '獅子獸', 'Virus': '黑加魯魯獸' },
    5: { 'Vaccine': '獸人加魯魯', 'Data': '格鬥獅子獸', 'Virus': '影刃加魯魯' },
    6: { 'Vaccine': '鋼鐵加魯魯獸', 'Data': '黃金劍獅獸', 'Virus': '終結加魯魯獸' }
  },
  '03': {
    1: { 'None': '惡魔蛋' },
    2: { 'None': '柏古獸' },
    3: { 'Vaccine': '小惡魔獸', 'Data': '使魔獸', 'Virus': '幼魔獸' },
    4: { 'Vaccine': '惡魔獸', 'Data': '冰惡魔獸', 'Virus': '邪龍獸' },
    5: { 'Vaccine': '吸血魔獸', 'Data': '喪屍撒旦獸', 'Virus': '女惡魔獸' },
    6: { 'Vaccine': '究極吸血魔獸', 'Data': '墮天地獄獸', 'Virus': '莉莉絲獸' }
  },
  '04': {
    1: { 'None': '鐵之蛋' },
    2: { 'None': '齒輪獸' },
    3: { 'Vaccine': '守衛獸', 'Data': '機器裝甲獸', 'Virus': '猛鬼獸' },
    4: { 'Vaccine': '安杜路獸', 'Data': '炮彈獸', 'Virus': '垃圾桶獸' },
    5: { 'Vaccine': '機械載物獸', 'Data': '鋼鐵豆豆獸', 'Virus': '巨雞獸' },
    6: { 'Vaccine': '機械邪龍獸', 'Data': '炮神獸', 'Virus': '死亡獸' }
  },
  '05': {
    1: { 'None': '草之蛋' },
    2: { 'None': '浮球獸' },
    3: { 'Vaccine': '巴魯獸', 'Data': '蘑菇獸', 'Virus': '毒蔓獸' },
    4: { 'Vaccine': '仙人掌獸', 'Data': '朽木獸', 'Virus': '曼陀羅獸' },
    5: { 'Vaccine': '花仙獸', 'Data': '祖利獸', 'Virus': '暴羅剎獸' },
    6: { 'Vaccine': '薔薇獸', 'Data': '木偶獸', 'Virus': '蓮花獸' }
  },
  '06': {
    1: { 'None': '水之蛋' },
    2: { 'None': '泡沫獸' },
    3: { 'Vaccine': '哥瑪獸', 'Data': '貝殼獸', 'Virus': '企鵝獸' },
    4: { 'Vaccine': '海獅獸', 'Data': '海龍獸', 'Virus': '墨魚獸' },
    5: { 'Vaccine': '祖頓獸', 'Data': '超海龍獸', 'Virus': '達高獸' },
    6: { 'Vaccine': '維京獸', 'Data': '鋼鐵海龍獸', 'Virus': '尼普頓獸' }
  },
  '07': {
    1: { 'None': '鳥之蛋' },
    2: { 'None': '豆苗獸' },
    3: { 'Vaccine': '比丘獸', 'Data': '獵鷹獸', 'Virus': '黑比丘獸' },
    4: { 'Vaccine': '巴多拉獸', 'Data': '巨鳥獸', 'Virus': '黑暗巨鳥獸' },
    5: { 'Vaccine': '伽樓達獸', 'Data': '耀獅獸', 'Virus': '鐵雞獸' },
    6: { 'Vaccine': '鳳凰獸', 'Data': '究極巨鳥獸', 'Virus': '死亡火鳥獸' }
  }
};

const STAGE_BASES = {
  1: { hp: 0, atk: 0, def: 0, spd: 0 },
  2: { hp: 10, atk: 1, def: 1, spd: 1 },
  3: { hp: 100, atk: 15, def: 10, spd: 10 },
  4: { hp: 500, atk: 70, def: 50, spd: 40 },
  5: { hp: 1500, atk: 200, def: 150, spd: 120 },
  6: { hp: 4000, atk: 500, def: 400, spd: 300 }
};

const FAMILY_MULTS = {
  '01': { hp: 1.05, atk: 1.10, def: 0.95, spd: 0.90 },
  '02': { hp: 0.90, atk: 1.10, def: 0.85, spd: 1.15 },
  '03': { hp: 0.80, atk: 1.25, def: 0.80, spd: 1.15 },
  '04': { hp: 1.15, atk: 0.95, def: 1.25, spd: 0.65 },
  '05': { hp: 1.30, atk: 0.85, def: 1.05, spd: 0.80 },
  '06': { hp: 1.10, atk: 0.90, def: 1.15, spd: 0.85 },
  '07': { hp: 0.75, atk: 1.00, def: 0.75, spd: 1.50 }
};

families.forEach(family => {
  const familyDir = path.join(COMPENDIUM_DIR, family.id + '_' + family.name);
  if (!fs.existsSync(familyDir)) fs.mkdirSync(familyDir);

  stages.forEach(stageInfo => {
    for (let i = 0; i < stageInfo.count; i++) {
      const typeStr = stageInfo.types ? stageInfo.types[i] : 'None';
      const mId = String(globalId).padStart(3, '0');
      const filename = mId + '_Stage' + stageInfo.stage + '_' + stageInfo.name.split(' ')[0] + '_' + typeStr + '.md';
      
      const specificName = NAME_MAP[family.id] && NAME_MAP[family.id][stageInfo.stage] ? NAME_MAP[family.id][stageInfo.stage][typeStr] : (family.name.replace('_', ' ') + ' (' + stageInfo.name + ')');

      const base = STAGE_BASES[stageInfo.stage];
      const mult = FAMILY_MULTS[family.id] || { hp: 1, atk: 1, def: 1, spd: 1 };
      
      const f_hp = Math.floor(base.hp * mult.hp);
      const f_atk = Math.floor(base.atk * mult.atk);
      const f_def = Math.floor(base.def * mult.def);
      const f_spd = Math.floor(base.spd * mult.spd);

      const content = '# No.' + mId + ' - ' + family.emoji + ' ' + specificName + '\n\n' +
'## 基本資料 (Basic Info)\n' +
'- **世代/階段**：Stage ' + stageInfo.stage + ' (' + stageInfo.name + ')\n' +
'- **核心種族 (Type)**：' + typeStr + '\n' +
'- **自然元素 (Element)**：' + family.theme + '\n' +
'- **專屬被動/特性**：在特定條件下觸發 ' + family.theme + ' 相關戰術。\n\n' +
'## 基礎數值 (Base Stats)\n' +
'- **HP (生命)**：' + f_hp + '\n' +
'- **ATK (攻擊)**：' + f_atk + '\n' +
'- **DEF (防禦)**：' + f_def + '\n' +
'- **SPD (速度)**：' + f_spd + '\n\n' +
'## 進化條件 (Evolution Conditions)\n' +
(stageInfo.stage === 1 ? '- 初始孵化。\n' : '') +
(stageInfo.stage === 2 ? '- 經過 10 分鐘後自動進化。\n' : '') +
(stageInfo.stage === 3 ? '- 存活 12 小時。根據訓練次數決定分支。\n' : '') +
(stageInfo.stage === 4 ? '- 存活 48 小時。要求一定的勝率與失誤次數小於標準。\n' : '') +
(stageInfo.stage === 5 ? '- 存活 96 小時。PvP 勝率需達到 60% 以上。\n' : '') +
(stageInfo.stage === 6 ? '- 存活 168 小時。需消耗特定的進化核心道具。\n' : '') +
'\n## 戰鬥技能 (Combat Skills)\n' +
'- **[普攻]**：造成 100% 基礎傷害，機率賦予敵人異常狀態。\n' +
'- **[必殺技]**：消耗 30 AP，造成 160% 傷害，並可與 `' + family.theme + '` 相關異常狀態產生戰術聯動 (Synergy)。\n';

      fs.writeFileSync(path.join(familyDir, filename), content);
      globalId++;
    }
  });
});

// Add 2 Special Secret Monsters
const secretDir = path.join(COMPENDIUM_DIR, '08_Secret_Mutants');
if (!fs.existsSync(secretDir)) fs.mkdirSync(secretDir);

fs.writeFileSync(path.join(secretDir, '099_Stage6_RoyalKnight_Vaccine.md'), '# No.099 - 🛡️ 皇家騎士/奧米加獸\n\n隱藏究極體，需極端條件達成。');
fs.writeFileSync(path.join(secretDir, '100_Stage6_DemonLord_Virus.md'), '# No.100 - 👑 七大魔王/盧米納獸\n\n隱藏究極體，極高培育失誤與超高勝率達成。');

console.log('Successfully generated ' + globalId + ' monsters across ' + (families.length + 1) + ' families.');
