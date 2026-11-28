import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return groups.flat().filter((f) => /\.(ts|tsx|mjs)$/.test(f));
}

const failures: string[] = [];
for (const file of [...await files("packages/core/src"), ...await files("apps/web/src")]) {
  const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
  const core = file.startsWith("packages/core/");
  const client = source.statements.some((s) => ts.isExpressionStatement(s) &&
    ts.isStringLiteral(s.expression) && s.expression.text === "use client");
  function check(specifier: string) {
    if (core && !specifier.startsWith(".") && !["@encore/core", "@encore/contracts", "vitest"].includes(specifier)) {
      failures.push(`${file}: domain code imports ${specifier}`);
    }
    if (client && (specifier.includes("/server/") || specifier === "@encore/infrastructure")) {
      failures.push(`${file}: client imports server code ${specifier}`);
    }
  }
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) check(specifier.text);
    }
    if (client && ts.isIdentifier(node) && node.text === "SUPABASE_SERVICE_ROLE_KEY") failures.push(`${file}: service-role key referenced in client`);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("Domain and client/server import boundaries passed.");
