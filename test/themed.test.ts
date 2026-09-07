import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  prepareThemedMermaidSvg,
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
  assert.match(result.svg!, /prefers-color-scheme:dark/);
});
