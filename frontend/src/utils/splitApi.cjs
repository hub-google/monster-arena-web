const fs = require('fs');
const path = require('path');

const srcCode = fs.readFileSync('api.js', 'utf8');

const sections = srcCode.split(/\/\/\s*───\s*(.*?)\s*─+\r?\n/);

const outputDir = path.join(__dirname, 'api');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let coreCode = sections[0]; // import
let dbCode = sections[2]; // DB Helper Shim

// Fix DB shim exports
dbCode = dbCode.replace(/const ([a-zA-Z0-9_]+) =/g, 'export const $1 =');
coreCode += dbCode + '\nexport { supabase };\n';
fs.writeFileSync(path.join(outputDir, 'core.js'), coreCode);

const coreExports = [
  'getUserId', 'usernameToEmail', 'getPK', 'doc', 'collection', 'getDoc',
  'updateDoc', 'setDoc', 'deleteDoc', 'query', 'where', 'limit', 'orderBy',
  'getDocs', 'makeTransaction', 'insertAndGetId', 'supabase'
];
const coreImportStmt = "import { " + coreExports.join(', ') + " } from './core';\n";

const moduleMap = {
  'Auth': 'auth',
  'Monsters': 'monsters',
  'Inventory': 'inventory',
  'Daily Quests': 'quests',
  'Friends': 'friends',
  'Challenges / PvP': 'pvp',
  'Guild': 'guild',
  'Raid Boss': 'raid',
  'Social / Chat': 'social',
  'PVE Mock Matchmaking': 'pve',
  'User Profile': 'profile'
};

const exportedModules = [];

for (let i = 5; i < sections.length; i += 2) {
  const rawName = sections[i];
  const code = sections[i + 1];
  
  const mappedName = Object.keys(moduleMap).find(k => rawName.startsWith(k));
  if (mappedName) {
    const filename = moduleMap[mappedName] + '.js';
    
    let cleanedCode = code.replace(/};?\s*$/g, ''); 
    
    let imports = coreImportStmt;
    if (mappedName === 'Monsters') {
      imports += "import { questsApi } from './quests';\n";
      cleanedCode = cleanedCode.replace(/api\.trackQuestProgress/g, 'questsApi.trackQuestProgress');
    }
    
    const objName = moduleMap[mappedName] + 'Api';
    exportedModules.push({ objName, filename });
    
    const finalCode = imports + "\nexport const " + objName + " = {\n" + cleanedCode + "\n};\n";
    fs.writeFileSync(path.join(outputDir, filename), finalCode);
  }
}

// Generate the new api.js
let newApiJs = "";
for (const mod of exportedModules) {
  newApiJs += "import { " + mod.objName + " } from './api/" + mod.filename.replace('.js', '') + "';\n";
}
newApiJs += "\nexport const api = {\n";
for (const mod of exportedModules) {
  newApiJs += "  ..." + mod.objName + ",\n";
}
newApiJs += "};\n";

fs.writeFileSync(path.join(__dirname, 'api.js'), newApiJs);

console.log("Splitting complete!");
