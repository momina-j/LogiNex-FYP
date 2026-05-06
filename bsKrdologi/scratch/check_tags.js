
const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/driver/page.tsx', 'utf8');

function checkBalance(text) {
    let stack = [];
    const tagRegex = /<(\/?[a-zA-Z0-9\.]+)(?:\s+[^>]*?)?(\/?)>/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        let [full, name, selfClosing] = match;
        if (selfClosing || name.toLowerCase() === 'img' || name.toLowerCase() === 'br' || name.toLowerCase() === 'hr' || name.toLowerCase() === 'input') {
            continue;
        }
        if (name.startsWith('/')) {
            let openName = stack.pop();
            if (openName !== name.substring(1)) {
                console.log(`Mismatch: expected ${openName}, got ${name} at pos ${match.index}`);
            }
        } else {
            stack.push(name);
        }
    }
    console.log('Unclosed tags:', stack);
}

checkBalance(content);
