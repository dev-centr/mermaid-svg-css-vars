# mermaid-svg-css-vars

See **README.adoc** for the full documentation.

Mermaid adapter for responsive SVG normalization and the generator-neutral [Themed SVG](https://github.com/dev-centr/themed-svg) light/dark standard.

```bash
pnpm add @dev-centr/mermaid-svg-css-vars
```

The recommended CLI flow produces `host` output for the `<themed-svg>` runtime
path:

```bash
mermaid-svg-css-vars --manifest diagram.theme.json diagram.svg -o diagram.themed.svg
```

Use `--mode standalone-adaptive` for a self-contained external `<img>`, or
`--mode paired-fixed` for concrete light/dark files. The legacy `--theme-vars`,
prefix, CSS-variable, and web-normalization flags remain available as a
separate compatibility route. See **README.adoc** for manifests, palettes,
output modes, and embedding-boundary details.
