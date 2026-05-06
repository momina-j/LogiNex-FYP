const fs = require('fs');
const content = fs.readFileSync('c:/Users/hassa/OneDrive/Desktop/Prototype/bsKrdologi/app/dashboard/brand-delivery/page.tsx', 'utf8');

const openDivs = (content.match(/<div(\s|>)/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;

console.log('Open divs:', openDivs);
console.log('Close divs:', closeDivs);

// Count brackets
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
console.log('Open braces:', openBraces);
console.log('Close braces:', closeBraces);

const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;
console.log('Open parens:', openParens);
console.log('Close parens:', closeParens);
