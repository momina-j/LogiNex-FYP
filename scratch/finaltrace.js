const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/brand-delivery/page.tsx', 'utf8');

const lines = content.split('\n');
let stack = [];

lines.forEach((line, i) => {
  const lineNum = i + 1;
  const openMatches = [...line.matchAll(/<div(\s|>)/g)];
  const closeMatches = [...line.matchAll(/<\/div>/g)];

  openMatches.forEach(match => {
    if (!line.includes('/>', match.index)) {
      stack.push(lineNum);
    }
  });

  closeMatches.forEach(() => {
    if (stack.length > 0) {
      stack.pop();
    } else {
      console.log(`Extra closing div at line ${lineNum}`);
    }
  });
});

console.log('Unclosed stacks lines:', stack.join(', '));
