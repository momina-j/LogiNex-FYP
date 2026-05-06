const fs = require('fs');
const path = require('path');

const walk = function(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          if (file.includes('node_modules') || file.includes('.next')) {
            next();
            return;
          }
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
            results.push(file);
          }
          next();
        }
      });
    })();
  });
};

const replacements = {
  // Tailwind classes
  'indigo-': 'orange-',
  'blue-': 'rose-',
  'violet-': 'red-',
  
  // Hex codes from page.tsx and layouts
  '#4f46e5': '#ea580c', // indigo-600 -> orange-600
  '#a5b4fc': '#fdba74', // indigo-300 -> orange-300
  '#7c3aed': '#e11d48', // violet-600 -> rose-600
  '#3b82f6': '#f43f5e', // blue-500 -> rose-500
  '#818cf8': '#fb923c', // indigo-400 -> orange-400
  '#60a5fa': '#fb7185', // blue-400 -> rose-400
};

walk('C:/Users/hassa/OneDrive/Desktop/FYP SHIT/bsKrdologi', function(err, results) {
  if (err) throw err;
  
  for (const file of results) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated:', file);
    }
  }
  console.log('Color replacement complete.');
});
