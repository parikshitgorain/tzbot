const fs = require('fs');

const filePath = '/var/www/tzbot/current/dist/ai/ai-manager.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace single backslash with double backslash for proper escaping
content = content.replace(/'f\\*ck'/g, "'f\\\\*ck'");
content = content.replace(/'sh\\*t'/g, "'sh\\\\*t'");
content = content.replace(/'b\\*tch'/g, "'b\\\\*tch'");
content = content.replace(/'a\\*\\*'/g, "'a\\\\*\\\\*'");
content = content.replace(/'d\\*mn'/g, "'d\\\\*mn'");
content = content.replace(/'h\\*ll'/g, "'h\\\\*ll'");
content = content.replace(/'f\\*\\*k'/g, "'f\\\\*\\\\*k'");
content = content.replace(/'s\\*\\*t'/g, "'s\\\\*\\\\*t'");
content = content.replace(/'b\\*\\*ch'/g, "'b\\\\*\\\\*ch'");
content = content.replace(/'a\\*\\*hole'/g, "'a\\\\*\\\\*hole'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed regex patterns - doubled backslashes');
