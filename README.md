# mermaid-svg-css-vars

See **README.adoc** for the full documentation.

Mermaid adapter for responsive SVG normalization and the generator-neutral [Themed SVG](https://github.com/dev-centr/themed-svg) light/dark standard.

```bash
pnpm add github:openshellorg/mermaid-svg-css-vars
```

The legacy color rewriter remains available. New integrations can call `prepareThemedMermaidSvg()` with explicit semantic bindings and bundled light/dark palettes. Host CSS variables do not cross an external `<img>` boundary; see **README.adoc** for output modes and examples.
