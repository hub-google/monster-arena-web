const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.md')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            let originalContent = content;
            
            // 替換 自然元素 -> 家族
            content = content.replace(/- \*\*自然元素 \(Element\)\*\*：.*/g, '- **所屬家族 (Family)**：依據演化樹自動歸屬');
            
            // 替換 專屬被動
            content = content.replace(/- \*\*專屬被動\/特性\*\*：在特定條件下觸發.*相關戰術。/g, '- **戰術特性 (Tactical Role)**：擁有家族專屬的普攻狀態與必殺技連動。');
            
            // 替換 必殺技說明
            content = content.replace(/- \*\*\[必殺技\]\*\*：消耗 30 AP，造成 160% 傷害，並可與.*相關異常狀態產生戰術聯動 \(Synergy\)。/g, '- **[必殺技]**：消耗 30 AP 發動，造成基礎 160% 傷害，並觸發家族專屬「戰術連動 (Synergy)」。');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

const compendiumPath = path.join(__dirname, '..', 'docs', 'Monster_Compendium');
processDirectory(compendiumPath);
console.log('Compendium batch update completed!');
