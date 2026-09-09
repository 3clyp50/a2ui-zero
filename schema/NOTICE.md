# A2UI schema provenance

The unmodified `server_to_client.json` and `common_types.json` were obtained from
the A2UI project's `specification/v0_9_1/json/` directory on 2026-09-09.
Upstream intentionally retains v0_9 schema IDs in these v0.9.1 files.

- Repository: https://github.com/a2ui-project/a2ui
- Protocol: https://a2ui.org/specification/v0.9.1-a2ui/
- server_to_client.json Git blob: `0af8aae8b6cb4e3dcbd0327a1710221ada7d763b`
- common_types.json Git blob: `51c5b036bcba83631aad780f5b6b78dad6b552f8`
- License: [Apache 2.0](LICENSE-A2UI), copyright the A2UI authors.

`catalog.json` is a separate, plugin-owned catalog. It uses A2UI's required
ComponentId and ChildList schema references and declares a narrower set of native
components. Catalog identifiers are matching identifiers, not download URLs.
