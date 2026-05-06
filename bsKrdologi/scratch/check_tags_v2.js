
const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/driver/page.tsx', 'utf8');

function checkJSXBalance(text) {
    let stack = [];
    const tagRegex = /<(\/?[a-zA-Z0-9\.]+)(?:\s+[^>]*?)?(\/?)>/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        let name = match[1];
        let selfClosing = match[2] === '/';
        
        // Ignore known HTML self-closing tags and generic type parameters if they look like tags
        if (selfClosing || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(name.toLowerCase())) {
            continue;
        }

        // Ignore common generic types that regex might pick up
        if (['socket', 'string', 'navtarget', 'number', 'boolean', 'any'].includes(name.toLowerCase())) {
            continue;
        }

        if (name.startsWith('/')) {
            let closingName = name.substring(1);
            if (stack.length === 0) {
                console.log(`Error: Extra closing tag </${closingName}> at index ${match.index}`);
                continue;
            }
            let openName = stack.pop();
            if (openName !== closingName) {
                console.log(`Mismatch: expected </${openName}>, got </${closingName}> at index ${match.index}`);
            }
        } else {
            stack.push(name);
        }
    }
    console.log('Unclosed tags:', stack);
}

checkJSXBalance(content);
