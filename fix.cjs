const fs = require('fs');
let content = fs.readFileSync('src/OnlineApp.tsx', 'utf8');

content = content.replace(/discard=\{topDiscard \? \$\{topDiscard\.value\} : ''\}/g, "discard={topDiscard ? topDiscard.value.toString() : ''}");
content = content.replace(/discard=\{leftDiscard \? \$\{leftDiscard\.value\} : ''\}/g, "discard={leftDiscard ? leftDiscard.value.toString() : ''}");
content = content.replace(/discard=\{rightDiscard \? \$\{rightDiscard\.value\} : ''\}/g, "discard={rightDiscard ? rightDiscard.value.toString() : ''}");
content = content.replace(/position: 'top' \| 'left' \| 'right'/g, "position: string");

fs.writeFileSync('src/OnlineApp.tsx', content, 'utf8');
