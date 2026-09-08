import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  prepareThemedMermaidSvg,
  prepareThemedMermaidSvgDualOutput,
  type ThemedSvgManifest,
} from '../src/index.js';

it('adapts Mermaid output through the generator-neutral themed SVG contract', () => {
  const manifest: ThemedSvgManifest = {
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
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect id="node-a" width="100" height="40" fill="#fff"/></svg>';

  const result = prepareThemedMermaidSvg(svg, manifest);

  assert.equal(result.diagnostics.length, 0);
  assert.match(result.svg!, /var\(--themed-svg-mermaid-flow-color-surface-primary, #eef2ff\)/);
  assert.doesNotMatch(result.svg!, /prefers-color-scheme:dark/);

  const adaptive = prepareThemedMermaidSvg(svg, manifest, {
    mode: 'standalone-adaptive',
  });

  assert.equal(adaptive.diagnostics.length, 0);
  assert.match(adaptive.svg!, /prefers-color-scheme:dark/);

  const dual = prepareThemedMermaidSvgDualOutput(svg, manifest);
  assert.equal(dual.diagnostics.length, 0);
  assert.match(dual.standaloneSvg!, /prefers-color-scheme:dark/);
  assert.match(
    dual.hostSvg!,
    /var\(--themed-svg-mermaid-flow-color-surface-primary, #eef2ff\)/
  );
  assert.doesNotMatch(dual.hostSvg!, /prefers-color-scheme:dark/);
});

it('withholds both dual outputs when transformation fails', () => {
  const manifest: ThemedSvgManifest = {
    schemaVersion: 1,
    namespace: 'mermaid-flow',
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
  };
  const result = prepareThemedMermaidSvgDualOutput(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect id="node-a" fill="#fff"/></svg>',
    manifest
  );

  assert.equal(result.standaloneSvg, undefined);
  assert.equal(result.hostSvg, undefined);
  assert.equal(
    result.diagnostics.filter(({ code }) => code === 'missing-viewbox').length,
    2
  );
  assert.deepEqual(
    result.diagnostics.map(({ output }) => output),
    ['standalone-adaptive', 'host']
  );
});
