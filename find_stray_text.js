const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('f:/SiteTrack App/app/(app)/jobs/[id]/signature.tsx', 'utf8');

const ast = babel.parse(code, {
  filename: 'signature.tsx',
  presets: ['@babel/preset-typescript', '@babel/preset-react']
});

let found = false;

babel.traverse(ast, {
  JSXText(path) {
    const text = path.node.value;
    if (text.trim().length > 0) {
      let parent = path.parentPath;
      let inText = false;
      while (parent) {
        if (parent.isJSXElement() && parent.node.openingElement.name.name === 'Text') {
          inText = true;
          break;
        }
        parent = parent.parentPath;
      }
      if (!inText) {
        console.log(`\nFound stray text: "${text}" at line ${path.node.loc.start.line}`);
        found = true;
      }
    }
  },
  JSXExpressionContainer(path) {
    const parent = path.parentPath;
    let isInsideText = false;
    let p = parent;
    while (p) {
      if (p.isJSXElement() && p.node.openingElement.name.name === 'Text') {
        isInsideText = true;
        break;
      }
      p = p.parentPath;
    }
    
    if (!isInsideText) {
      // Check if it's a string literal
      if (path.node.expression.type === 'StringLiteral') {
        console.log(`\nFound bare string expression: "${path.node.expression.value}" at line ${path.node.loc.start.line}`);
        found = true;
      }
      // Check logical expressions (&&, ||)
      if (path.node.expression.type === 'LogicalExpression') {
        // We only care if the evaluated value could be a string
        // Since typing is hard to infer, let's just log them and inspect manually
        const code = codeSlice(path.node.loc);
        // Only log if it's a logical expression inside JSX children
        if (parent.isJSXElement() || parent.isJSXFragment()) {
           // check if right side is a string
           if (path.node.expression.right.type === 'StringLiteral' || path.node.expression.right.type === 'TemplateLiteral') {
              console.log(`\nFound LogicalExpression with string right side: "${code}" at line ${path.node.loc.start.line}`);
           }
        }
      }
      // Check conditionals
      if (path.node.expression.type === 'ConditionalExpression') {
        if (parent.isJSXElement() || parent.isJSXFragment()) {
          const c = path.node.expression;
          if (c.consequent.type === 'StringLiteral' || c.alternate.type === 'StringLiteral') {
            console.log(`\nFound ConditionalExpression returning string: "${codeSlice(path.node.loc)}" at line ${path.node.loc.start.line}`);
          }
        }
      }
    }
  }
});

function codeSlice(loc) {
    const lines = code.split('\n');
    if (loc.start.line === loc.end.line) {
        return lines[loc.start.line - 1].substring(loc.start.column, loc.end.column);
    }
    return lines[loc.start.line - 1];
}

if (!found) {
  console.log("No stray text found.");
}
