const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/brand-delivery/page.tsx', 'utf8');

const lines = content.split('\n');
let stack = [];
let openTags = [];

lines.forEach((line, i) => {
  const lineNum = i + 1;
  // Match opening tags (excluding self-closing)
  const openMatches = line.matchAll(/<div(\s|>)/g);
  for (const match of openMatches) {
    if (!line.includes('/>', match.index)) {
      stack.push({ type: 'div', line: lineNum });
    }
  }

  // Match closing tags
  const closeMatches = line.matchAll(/<\/div>/g);
  for (const match of closeMatches) {
    if (stack.length > 0) {
      stack.pop();
    } else {
      console.log(`Extra closing div at line ${lineNum}`);
    }
  }
});

console.log('Unclosed tags at the end:');
stack.forEach(t => console.log(`${t.type} opened at line ${t.line}`));
