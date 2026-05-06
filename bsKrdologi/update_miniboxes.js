const fs = require('fs');
const path = require('path');

const boxBg = '#f5efef';
const fontColor = '#ffffff';

function applyMiniBoxes(content) {
    let updated = content;

    // Target the specific "icon boxes" and "mini containers"
    // 1. Icon circles (w-8 h-8 rounded-full bg-red-600/10 etc)
    updated = updated.replace(/bg-red-600\/10/g, `bg-[${boxBg}] shadow-inner`);
    updated = updated.replace(/bg-rose-500\/10/g, `bg-[${boxBg}] shadow-inner`);
    updated = updated.replace(/bg-amber-500\/10/g, `bg-[${boxBg}] shadow-inner`);
    updated = updated.replace(/bg-emerald-500\/10/g, `bg-[${boxBg}] shadow-inner`);
    updated = updated.replace(/bg-blue-500\/10/g, `bg-[${boxBg}] shadow-inner`);
    
    // 2. Icon/Font colors inside those boxes (currently text-red-500, rose-400 etc)
    // Add shadows to make white text visible on light background
    const whiteWithShadow = `text-[${fontColor}] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]`;
    
    updated = updated.replace(/text-red-500/g, whiteWithShadow);
    updated = updated.replace(/text-rose-400/g, whiteWithShadow);
    updated = updated.replace(/text-amber-500/g, whiteWithShadow);
    updated = updated.replace(/text-emerald-500/g, whiteWithShadow);
    updated = updated.replace(/text-blue-500/g, whiteWithShadow);
    updated = updated.replace(/text-red-400/g, whiteWithShadow);

    // 3. Status Badges/Chips
    updated = updated.replace(/bg-red-600\/20/g, `bg-[${boxBg}]`);
    
    // 4. Subtle inner-card boxes
    updated = updated.replace(/bg-\[#88030520\]/g, `bg-[${boxBg}]/10`); 

    return updated;
}

const files = [
    'app/dashboard/shipper/page.tsx',
    'app/dashboard/driver/page.tsx',
    'app/dashboard/brand-delivery/page.tsx',
    'app/dashboard/hub-holder/page.tsx',
    'app/dashboard/hub-partner/page.tsx'
];

files.forEach(f => {
    const filePath = path.join('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi', f);
    if (fs.existsSync(filePath)) {
        const orig = fs.readFileSync(filePath, 'utf8');
        const updated = applyMiniBoxes(orig);
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Successfully updated mini boxes in: ${f}`);
    }
});

console.log('Mini box update complete.');
