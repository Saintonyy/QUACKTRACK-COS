import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../');
const packageSourceRoot = join(workspaceRoot, 'packages');
const packageRootImportPattern = /from\s+['"](@quacktrack\/[^/'"]+)['"]/g;
const packageDeepImportPattern = /from\s+['"]@quacktrack\/[^/'"]+\/[^'"]+['"]/;
const appImportPattern = /from\s+['"](?:@quacktrack\/(?:overlay|operator)|apps\/)/;

function findTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules') {
        return [];
      }

      return findTypeScriptFiles(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
  });
}

describe('workspace package boundaries', () => {
  const sourceFiles = findTypeScriptFiles(packageSourceRoot);

  it('keeps package code free of app imports', () => {
    const offenders = sourceFiles.filter((file) => appImportPattern.test(readFileSync(file, 'utf8')));

    expect(offenders.map((file) => relative(workspaceRoot, file))).toEqual([]);
  });

  it('uses package-root imports only between packages', () => {
    const offenders = sourceFiles.filter((file) => packageDeepImportPattern.test(readFileSync(file, 'utf8')));

    expect(offenders.map((file) => relative(workspaceRoot, file))).toEqual([]);
  });

  it('does not require renderer to validate package schemas', async () => {
    const imports = sourceFiles
      .filter((file) => !file.replace(/\\/g, '/').includes('packages/runtime'))
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(packageRootImportPattern)]);

    expect(imports.map((match) => match[1])).not.toContain('@quacktrack/renderer');
  });
});
