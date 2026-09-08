import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const cli = resolve('bin/mermaid-svg-css-vars.js');
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><rect id="node-a" width="100" height="40" fill="#fff"/></svg>';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'mermaid-svg-css-vars-'));
  const input = join(directory, 'diagram.svg');
  const manifest = join(directory, 'manifest.json');
  writeFileSync(input, svg, 'utf8');
  writeFileSync(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      namespace: 'mermaid-flow',
      source: { kind: 'mermaid', generator: 'mermaid' },
      tokens: [{ id: 'color.surface.primary' }],
      defaultPreset: 'light',
      presets: {
        light: { 'color.surface.primary': '#eef2ff' },
        dark: { 'color.surface.primary': '#312e81' },
      },
      bindings: [
        {
          kind: 'presentation',
          selector: '#node-a',
          attribute: 'fill',
          token: 'color.surface.primary',
        },
      ],
    }),
    'utf8'
  );
  return { directory, input, manifest };
}

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('manifest CLI route', () => {
  it('defaults to host output with namespaced variables', () => {
    const { input, manifest } = fixture();
    const result = run(['--manifest', manifest, input]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /var\(--themed-svg-mermaid-flow-color-surface-primary, #eef2ff\)/
    );
    assert.doesNotMatch(result.stdout, /prefers-color-scheme/);
  });

  it('supports explicit standalone-adaptive output', () => {
    const { input, manifest } = fixture();
    const result = run([
      '--manifest',
      manifest,
      '--mode',
      'standalone-adaptive',
      input,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /prefers-color-scheme:dark/);
  });

  it('writes and checks portable plus host delivery artifacts together', () => {
    const { directory, manifest } = fixture();
    const raw = join(directory, 'system.raw.svg');
    writeFileSync(raw, svg, 'utf8');

    const generated = run(['--manifest', manifest, '--dual-output', raw]);
    const adaptive = join(directory, 'system.svg');
    const host = join(directory, 'system.host.svg');
    assert.equal(generated.status, 0, generated.stderr);
    assert.match(readFileSync(adaptive, 'utf8'), /prefers-color-scheme:dark/);
    assert.match(
      readFileSync(host, 'utf8'),
      /var\(--themed-svg-mermaid-flow-color-surface-primary, #eef2ff\)/
    );
    assert.doesNotMatch(readFileSync(host, 'utf8'), /prefers-color-scheme/);

    const current = run(['--manifest', manifest, '--dual-output', '--check', raw]);
    assert.equal(current.status, 0, current.stderr);
    writeFileSync(host, 'stale', 'utf8');
    const stale = run(['--manifest', manifest, '--dual-output', '--check', raw]);
    assert.equal(stale.status, 3);
    assert.match(stale.stderr, /stale: .*system\.host\.svg/);
  });

  it('supports explicit dual output paths', () => {
    const { directory, input, manifest } = fixture();
    const adaptive = join(directory, 'portable.svg');
    const host = join(directory, 'runtime.svg');
    const result = run([
      '--manifest',
      manifest,
      '--dual-output',
      '--output',
      adaptive,
      '--host-output',
      host,
      input,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(adaptive), true);
    assert.equal(existsSync(host), true);
  });

  it('emits concrete fixed output without variables or media', () => {
    const { input, manifest } = fixture();
    const result = run([
      '--manifest',
      manifest,
      '--mode',
      'fixed',
      input,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fill="#eef2ff"/);
    assert.doesNotMatch(result.stdout, /var\(/);
    assert.doesNotMatch(result.stdout, /prefers-color-scheme/);
  });

  it('uses separate palettes and explicit paired output paths', () => {
    const { directory, input, manifest } = fixture();
    const lightPalette = join(directory, 'light.json');
    const darkPalette = join(directory, 'dark.json');
    const lightOutput = join(directory, 'custom-light.svg');
    const darkOutput = join(directory, 'custom-dark.svg');
    writeFileSync(
      lightPalette,
      JSON.stringify({ 'color.surface.primary': '#fed7aa' }),
      'utf8'
    );
    writeFileSync(
      darkPalette,
      JSON.stringify({ 'color.surface.primary': '#431407' }),
      'utf8'
    );

    const result = run([
      '--manifest',
      manifest,
      '--mode',
      'paired-fixed',
      '--light-palette',
      lightPalette,
      '--dark-palette',
      darkPalette,
      '--light-output',
      lightOutput,
      '--dark-output',
      darkOutput,
      input,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(readFileSync(lightOutput, 'utf8'), /fill="#fed7aa"/);
    assert.match(readFileSync(darkOutput, 'utf8'), /fill="#431407"/);
  });

  it('derives paired output names beside the input', () => {
    const { directory, input, manifest } = fixture();
    const result = run([
      '--manifest',
      manifest,
      '--mode',
      'paired-fixed',
      input,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      readFileSync(join(directory, 'diagram.light.svg'), 'utf8'),
      /fill="#eef2ff"/
    );
    assert.match(
      readFileSync(join(directory, 'diagram.dark.svg'), 'utf8'),
      /fill="#312e81"/
    );
  });

  it('reports generic transform diagnostics with status 2 and no output', () => {
    const { directory, manifest } = fixture();
    const input = join(directory, 'missing-viewbox.svg');
    const output = join(directory, 'must-not-exist.svg');
    writeFileSync(
      input,
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="node-a" fill="#fff"/></svg>',
      'utf8'
    );

    const result = run(['--manifest', manifest, '-o', output, input]);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /error: missing-viewbox:/);
    assert.equal(existsSync(output), false);
  });
});

describe('CLI argument validation', () => {
  it('returns status 1 for conflicts and malformed arguments', () => {
    const { directory, input, manifest } = fixture();
    const themeVars = join(directory, 'theme.json');
    writeFileSync(themeVars, '{}', 'utf8');
    const invalidCases = [
      ['--manifest', manifest, '--theme-vars', themeVars, input],
      ['--mode', 'host', input],
      ['--preset', 'light', input],
      ['--palette', themeVars, input],
      ['--light-palette', themeVars, input],
      ['--dark-palette', themeVars, input],
      ['--dual-output', input],
      ['--host-output', join(directory, 'host.svg'), input],
      ['--light-output', join(directory, 'light.svg'), input],
      ['--dark-output', join(directory, 'dark.svg'), input],
      ['--check', input],
      ['--manifest', manifest, '--prefix', '--custom-', input],
      ['--manifest', manifest, '--no-css-variables', input],
      ['--manifest', manifest, '--no-web-compatibility', input],
      ['--manifest', manifest, '--strip-background', input],
      ['--manifest', manifest, '--no-strip-background', input],
      ['--manifest', manifest, '--light-output', join(directory, 'light.svg'), input],
      ['--manifest', manifest, '--dark-output', join(directory, 'dark.svg'), input],
      ['--manifest', manifest, '--host-output', join(directory, 'host.svg'), input],
      ['--manifest', manifest, '--check', input],
      ['--manifest', manifest, '--dual-output', '--mode', 'fixed', input],
      ['--manifest', manifest, '--mode', 'unknown', input],
      ['--manifest'],
      ['--mode'],
      ['--preset'],
      ['--palette'],
      ['--light-palette'],
      ['--dark-palette'],
      ['--light-output'],
      ['--dark-output'],
      ['--host-output'],
      ['--theme-vars'],
      ['--prefix'],
      ['--output'],
      [input, input],
      [],
    ];

    for (const args of invalidCases) {
      const result = run(args);
      assert.equal(
        result.status,
        1,
        `${args.join(' ')}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }
  });
});

describe('legacy CLI compatibility route', () => {
  it('preserves theme-vars prefix and web normalization behavior', () => {
    const { directory } = fixture();
    const input = join(directory, 'legacy.svg');
    const themeVars = join(directory, 'theme.json');
    writeFileSync(
      input,
      '<svg width="100" height="40" style="background:#fff"><rect fill="#ececff"/></svg>',
      'utf8'
    );
    writeFileSync(
      themeVars,
      JSON.stringify({ primaryColor: '#ececff', background: '#fff' }),
      'utf8'
    );

    const result = run([
      '--theme-vars',
      themeVars,
      '--prefix',
      '--legacy-',
      input,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /var\(--legacy-primaryColor, #ececff\)/i);
    assert.match(result.stdout, /viewBox="0 0 100 40"/);
    assert.match(result.stdout, /width="100%"/);
    assert.match(result.stdout, /height="auto"/);
    assert.doesNotMatch(result.stdout, /background/i);
  });
});
