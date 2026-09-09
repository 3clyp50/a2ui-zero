import assert from "node:assert/strict";
import { read, parts, safeUrl } from "../webui/renderer.js";
import { mediaSource } from "../webui/media.js";

assert.equal(read({ "a/b": { "~x": [1, 2] } }, "/a~1b/~0x/1"), 2);
for (const path of ["no-root", "/__proto__/x", "/constructor/x", "/a~2b"]) assert.throws(() => parts(path));
for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "https://u:p@example.com", "https://example.com\\x", "/api/private"]) assert.equal(safeUrl(url), "");
assert.equal(safeUrl("https://example.com/image.png"), "https://example.com/image.png");
assert.equal(safeUrl("/plugins/a2ui_zero/webui/thumbnail.webp"), "/plugins/a2ui_zero/webui/thumbnail.webp");
console.log("Renderer URL and binding checks passed");

for (const path of ["/a0/usr/workdir/My clip.mp4", "file:///a0/usr/workdir/My%20clip.mp4",
  "/api/download_work_dir_file?path=%2Fa0%2Fusr%2Fworkdir%2FMy%20clip.mp4"]) {
  const media = mediaSource(path);
  assert.equal(media.type, "video");
  assert.equal(media.path, "/a0/usr/workdir/My clip.mp4");
  assert.equal(media.url, "/api/plugins/a2ui_zero/media?path=%2Fa0%2Fusr%2Fworkdir%2FMy%20clip.mp4");
}
for (const path of ["/etc/test.mp4", "file://localhost/a0/test.mp4", "file:///a0/../etc/test.mp4",
  "file:///a0/%2e%2e/test.mp4", "/a0/usr/../test.mp3", "/a0/usr/code.html",
  "/api/private?path=/a0/test.mp4", "/api/image_get?path=/etc/test.png",
  "/api/image_get?path=/a0/a.png&path=/a0/b.png", "javascript:alert(1)", "data:video/mp4;base64,abc"]) {
  assert.equal(mediaSource(path), null, path);
}
assert.equal(mediaSource("https://example.com/signed?token=abc", "audio").type, "audio");
assert.equal(mediaSource("img:///a0/usr/output.png").type, "image");
assert.equal(mediaSource("/a0/usr/sound.ogg").type, "audio");
assert.equal(mediaSource("/a0/usr/clip.ogg", "video").type, "video");
console.log("Media source checks passed");
