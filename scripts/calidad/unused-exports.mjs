// Lists the exports in src/ that no production file imports.
// "tests: N" says how many test files still use the export.
// Run: node scripts/calidad/unused-exports.mjs
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

const isTest = (file) => /\.test\.tsx?$/.test(file);
const files = execSync("git ls-files src scripts", { encoding: "utf8" })
  .split("\n")
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"));
const text = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));

// Next.js reads these exports by convention, not by import.
const FRAMEWORK_EXPORTS = new Set(["default", "metadata"]);

const exportedNames = (file) => {
  const source = ts.createSourceFile(file, text[file], ts.ScriptTarget.Latest, true);
  const names = [];
  source.forEachChild((node) => {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return names.push("default");
    if (ts.isVariableStatement(node)) node.declarationList.declarations.forEach((d) => names.push(d.name.getText()));
    else if (node.name) names.push(node.name.getText());
  });
  return names;
};

for (const file of files.filter((f) => f.startsWith("src/") && !isTest(f))) {
  for (const name of exportedNames(file).filter((n) => !FRAMEWORK_EXPORTS.has(n))) {
    const word = new RegExp(String.raw`\b${name}\b`);
    const users = files.filter((other) => other !== file && word.test(text[other]));
    const production = users.filter((other) => !isTest(other));
    if (production.length === 0) console.log(`${file} :: ${name} (tests: ${users.length})`);
  }
}
