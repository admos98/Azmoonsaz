import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (target.endsWith('.tsx')) files.push(target);
  }
  return files;
}

const failures = [];
for (const file of await walk('src')) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'button') {
      const attributes = node.openingElement.attributes.properties;
      const named = attributes.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          ['aria-label', 'aria-labelledby', 'title'].includes(attribute.name.getText(source)),
      );
      let visibleText = false;
      let labelledExpression = false;
      for (const child of node.children) {
        function inspect(descendant) {
          if (ts.isJsxText(descendant) && descendant.getText(source).trim()) visibleText = true;
          if (ts.isJsxExpression(descendant) && descendant.expression) labelledExpression = true;
          ts.forEachChild(descendant, inspect);
        }
        inspect(child);
      }
      if (!named && !visibleText && !labelledExpression) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        failures.push(`${file}:${position.line + 1} icon/expression-only button needs an accessible name`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (failures.length) {
  console.error(`Accessible icon-button check failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Accessible icon-button check passed.');
