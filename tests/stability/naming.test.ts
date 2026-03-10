import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Project Naming — Wepower Edu App', () => {
  it('package.json has correct app name', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('wepower-edu-app');
  });

  it('no old WeSPEAK references in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    const pkgStr = JSON.stringify(pkg).toLowerCase();
    expect(pkgStr).not.toContain('wespeak');
  });
});
