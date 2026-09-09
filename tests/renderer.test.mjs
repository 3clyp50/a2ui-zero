import assert from "node:assert/strict";
import { read, parts, safeUrl } from "../webui/renderer.js";

assert.equal(read({ "a/b": { "~x": [1, 2] } }, "/a~1b/~0x/1"), 2);
for (const path of ["no-root", "/__proto__/x", "/constructor/x", "/a~2b"]) assert.throws(() => parts(path));
for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "https://u:p@example.com", "https://example.com\\x", "/api/private"]) assert.equal(safeUrl(url), "");
assert.equal(safeUrl("https://example.com/image.png"), "https://example.com/image.png");
assert.equal(safeUrl("/plugins/a2ui_zero/webui/thumbnail.webp"), "/plugins/a2ui_zero/webui/thumbnail.webp");
console.log("Renderer URL and binding checks passed");
