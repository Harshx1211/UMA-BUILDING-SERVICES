const fs = require('fs');
const path = require('path');

const targetDirs = ['app', 'components', 'constants', 'hooks', 'lib', 'store', 'types', 'utils', 'supabase/migrations'];
const skipDirs = ['node_modules', '.git', '.expo', 'assets', 'dist'];

function getTree(dir, prefix = '') {
  let result = '';
  const files = fs.readdirSync(dir);
  const filtered = files.filter(f => !skipDirs.includes(f));
  
  filtered.forEach((file, i) => {
    const p = path.join(dir, file);
    const isLast = i === filtered.length - 1;
    result += prefix + (isLast ? '└── ' : '├── ') + file + '\n';
    if (fs.statSync(p).isDirectory()) {
      result += getTree(p, prefix + (isLast ? '    ' : '│   '));
    }
  });
  return result;
}

function findFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!skipDirs.includes(file)) {
        findFiles(filePath, fileList);
      }
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.sql') || filePath.endsWith('.js')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

function extractCodeBlock(content, matchIndex) {
  let openBraces = 0;
  let inBlock = false;
  let endIndex = matchIndex;

  for (let i = matchIndex; i < content.length; i++) {
    if (content[i] === '{') {
      openBraces++;
      inBlock = true;
    } else if (content[i] === '}') {
      openBraces--;
    }
    
    if (inBlock && openBraces === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  if (!inBlock) {
    // Fallback for one-liners or things without braces
    const newline = content.indexOf('\n', matchIndex);
    endIndex = newline !== -1 ? newline : content.length;
  }
  
  return content.slice(matchIndex, endIndex).trim();
}

let allFiles = [];
for (const dir of targetDirs) {
  allFiles = findFiles(dir, allFiles);
}

const groupedFiles = {};
for (const file of allFiles) {
  const normalizedPath = file.replace(/\\/g, '/');
  const topLevel = normalizedPath.split('/')[0];
  if (!groupedFiles[topLevel]) groupedFiles[topLevel] = [];
  groupedFiles[topLevel].push({ path: normalizedPath, absolute: file });
}

let mdContent = `# SiteTrack App — Exhaustive File-by-File Technical Reference\n\n`;
mdContent += `> This document provides a 100% exhaustive breakdown of every single file in the SiteTrack codebase, including all exported functions, components, hooks, constants, and the explicit technical logic contained within each file.\n\n`;

mdContent += `## 📂 Complete Folder Structure\n\n`;
mdContent += '```text\n';
for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    mdContent += `[${dir}]\n`;
    mdContent += getTree(dir);
  }
}
mdContent += '```\n\n';
mdContent += `---\n\n`;

for (const [group, files] of Object.entries(groupedFiles)) {
  mdContent += `# 📁 \`${group}/\` Directory\n\n`;
  
  for (const fileObj of files) {
    const content = fs.readFileSync(fileObj.absolute, 'utf8');
    
    mdContent += `## 📄 \`${fileObj.path}\`\n\n`;
    
    const topCommentMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
    let description = "Contains specific implementation logic for this module.";
    if (topCommentMatch) {
      description = topCommentMatch[1].split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(l => l).join(' ');
    }
    
    let intent = "Core system file.";
    if (fileObj.path.startsWith('app/')) intent = "Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**";
    if (fileObj.path.startsWith('components/')) intent = "Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**";
    if (fileObj.path.startsWith('lib/')) intent = "Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**";
    if (fileObj.path.startsWith('store/')) intent = "Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**";
    if (fileObj.path.startsWith('utils/')) intent = "Utility functions. **We expect pure functions that take inputs and return formatted or sanitized outputs.**";
    if (fileObj.path.startsWith('supabase/')) intent = "Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**";

    mdContent += `> **Description:** ${description}\n>\n> **What we expect from it:** ${intent}\n\n`;
    
    mdContent += `### Core Code Logic & Implementations:\n\n`;

    let extractedAnything = false;

    // Extract default exports
    const defRegex = /export\s+default\s+(?:async\s+)?function\s+([a-zA-Z0-9_]*)/g;
    let m;
    while ((m = defRegex.exec(content)) !== null) {
      extractedAnything = true;
      const name = m[1] || 'DefaultComponent';
      const block = extractCodeBlock(content, m.index);
      mdContent += `#### \`default function ${name}\`\n\`\`\`tsx\n${block}\n\`\`\`\n\n`;
    }

    // Extract functions
    const funcRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
    while ((m = funcRegex.exec(content)) !== null) {
      // Don't duplicate if it's export default function (handled above loosely, but just in case)
      extractedAnything = true;
      const block = extractCodeBlock(content, m.index);
      mdContent += `#### \`function ${m[1]}\`\n\`\`\`tsx\n${block}\n\`\`\`\n\n`;
    }
    
    // Extract const exports (including arrows)
    const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*=/g;
    while ((m = constRegex.exec(content)) !== null) {
      extractedAnything = true;
      const block = extractCodeBlock(content, m.index);
      mdContent += `#### \`const ${m[1]}\`\n\`\`\`tsx\n${block}\n\`\`\`\n\n`;
    }

    // Extract interfaces/types
    const typeRegex = /export\s+(?:interface|type)\s+([a-zA-Z0-9_]+)/g;
    while ((m = typeRegex.exec(content)) !== null) {
      extractedAnything = true;
      const block = extractCodeBlock(content, m.index);
      mdContent += `#### \`type ${m[1]}\`\n\`\`\`tsx\n${block}\n\`\`\`\n\n`;
    }

    if (!extractedAnything) {
      // If no explicit exports, maybe it's just a raw sql script or logic file. Show the whole file.
      if (fileObj.path.endsWith('.sql') || content.length < 500) {
        mdContent += `#### Raw File Source\n\`\`\`sql\n${content.trim()}\n\`\`\`\n\n`;
      } else {
        mdContent += `- *No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.*\n\n`;
      }
    }
    
    const lines = content.split('\n').length;
    mdContent += `*Size: **${lines}** lines of code.*\n\n---\n\n`;
  }
}

fs.writeFileSync('docs/EXHAUSTIVE_CODEBASE_REFERENCE.md', mdContent);
console.log('Done generating code blocks!');
