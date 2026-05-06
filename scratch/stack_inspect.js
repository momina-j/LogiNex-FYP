const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/brand-delivery/page.tsx', 'utf8');

const lines = content.split('\n');
let stack = [];

lines.forEach((line, i) => {
  const lineNum = i + 1;
  if (lineNum === 454) {
    console.log('Stack at line 454:');
    stack.forEach(t => console.log(`${t.type} opened at line ${t.line}`));
  }

  const openMatches = line.matchAll(/<div(\s|>)/g);
  for (const match of openMatches) {
    if (!line.includes('/>', match.index)) {
      stack.push({ type: 'div', line: lineNum });
    }
  }

  const closeMatches = line.matchAll(/<\/div>/g);
  for (const match of closeMatches) {
    if (stack.length > 0) {
      stack.pop();
    }
  }
});
console.log('Final stack size:', stack.length);
