import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { palette } from '@/theme/tokens';

// The sign-in code e-mail (prompts/auth-onboarding/plan.md, step 11, D25): one English template for both the
// "magic link" and "confirmation" mails, code only, no link, and only colours from the design tokens.

const root = join(__dirname, '../../..');
const template = readFileSync(join(root, 'supabase/templates/magic_link.html'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');

function flattenStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenStrings);
  return [];
}

function configSection(name: string): string {
  const start = config.indexOf(`[${name}]`);
  if (start === -1) return '';
  const rest = config.slice(start + name.length + 2);
  const next = rest.search(/^\s*#?\s*\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('code e-mail template', () => {
  it('is an English document', () => {
    expect(template).toContain('<html lang="en">');
  });

  it('shows the code in the visible element', () => {
    expect(template).toMatch(/<span[^>]*class="code[^"]*"[^>]*>\{\{ \.Token \}\}<\/span>/);
  });

  it('repeats the code in the hidden preheader', () => {
    expect(template).toMatch(/<div style="display:none[^"]*">[^<]*\{\{ \.Token \}\}[^<]*<\/div>/);
  });

  it('carries no link and no token hash', () => {
    expect(template).not.toContain('{{ .ConfirmationURL }}');
    expect(template).not.toContain('{{ .TokenHash }}');
    expect(template).not.toMatch(/<a\s/i);
  });

  it('uses only colours that are design tokens', () => {
    const tokenColours = new Set(
      flattenStrings(palette)
        .filter((value) => /^#[0-9a-f]{3,8}$/i.test(value))
        .map((value) => value.toLowerCase()),
    );
    const used = [...template.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0].toLowerCase());

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((colour) => !tokenColours.has(colour))).toEqual([]);
  });

  it.each(['magic_link', 'confirmation'])('config sets the English subject and shared file for %s', (name) => {
    const section = configSection(`auth.email.template.${name}`);

    expect(section).toContain('subject = "Your Travelo code"');
    expect(section).toContain('content_path = "./supabase/templates/magic_link.html"');
  });
});
