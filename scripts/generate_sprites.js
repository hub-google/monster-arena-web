const fs = require('fs');
const path = require('path');

const COMPENDIUM_DIR = path.join(__dirname, '..', 'docs', 'Monster_Compendium');
const OUTPUT_FILE = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'monsterSprites.js');

const TYPE_MAP = {
  'Vaccine': 1,
  'Data': 2,
  'Virus': 3,
  'None': 0
};

// Simple pseudo-random number generator based on a string seed
function seededRandom(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
    }
    return function() {
        hash = Math.imul(hash, 16807) % 2147483647;
        return (hash & 2147483647) / 2147483648;
    };
}

// Generate a 16x16 symmetric pixel grid
function generateSprite(seed, stage, family) {
    const random = seededRandom(seed);
    const grid = Array(16).fill(0).map(() => Array(16).fill(0));
    
    // Determine the bounding box based on stage (stage 1 = small, stage 6 = huge)
    const maxHeight = Math.min(14, 4 + stage * 2);
    const maxWidth = Math.min(8, 2 + stage);

    for (let r = 16 - maxHeight - 1; r < 15; r++) {
       for (let c = 8 - maxWidth; c < 8; c++) {
          // Probability of filling a pixel
          const fillProb = (r < 16 - maxHeight + 2) ? 0.8 : 0.6; // Top is denser
          if (random() < fillProb) {
             grid[r][c] = 1;
             grid[r][15 - c] = 1; // mirror
          }
       }
    }
    
    // Ensure eyes/core
    const eyeY = 16 - maxHeight + 3;
    const eyeX = 8 - Math.floor(maxWidth / 2);
    if (eyeY < 15 && eyeX >= 0 && eyeX < 8) {
       grid[eyeY][eyeX] = 0;
       grid[eyeY][15 - eyeX] = 0;
    }
    
    return grid;
}

const MONSTER_SPRITES = {};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.md') && file !== '00_Combat_Mechanics.md') {
            // Filename format: 001_Stage1_Egg_None.md
            // Or 099_Stage6_RoyalKnight_Vaccine.md
            const parts = file.replace('.md', '').split('_');
            if (parts.length >= 4) {
                const id = parseInt(parts[0], 10);
                const stageStr = parts[1].replace('Stage', '');
                const stage = parseInt(stageStr, 10);
                const typeStr = parts[parts.length - 1];
                const type = TYPE_MAP[typeStr] !== undefined ? TYPE_MAP[typeStr] : 0;
                
                // Extract family from parent dir: 01_Dragon_Line
                const parentDirName = path.basename(dir);
                const familyParts = parentDirName.split('_');
                let family = parseInt(familyParts[0], 10) || 8; // Secret mutants are 8
                
                // Find monster name from first line of markdown
                const content = fs.readFileSync(fullPath, 'utf8');
                const firstLine = content.split('\n')[0];
                const nameMatch = firstLine.match(/ - (.+)$/);
                const name = nameMatch ? nameMatch[1].trim() : parts[2];
                
                const gridKey = `${family}_${stage}_${type}`;
                const seed = `${family}-${stage}-${type}-${id}`;
                const grid = generateSprite(seed, stage, family);
                
                MONSTER_SPRITES[gridKey] = {
                    id: id,
                    name: name,
                    family: family,
                    stage: stage,
                    type: type,
                    grid: grid
                };
            }
        }
    }
}

processDirectory(COMPENDIUM_DIR);

const outputJS = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
export const MONSTER_SPRITES = ${JSON.stringify(MONSTER_SPRITES, null, 2)};
`;

fs.writeFileSync(OUTPUT_FILE, outputJS);
console.log(`Generated sprites for ${Object.keys(MONSTER_SPRITES).length} monsters and saved to ${OUTPUT_FILE}`);
