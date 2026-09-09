// Media coverage adapted from keyboardstaff/attachment_preview; see LICENSE.
const formats = {
  image: new Set(["jpg", "jpeg", "png", "apng", "gif", "bmp", "webp", "avif", "svg", "svgz", "ico"]),
  video: new Set(["mp4", "webm", "ogv", "mov"]),
  audio: new Set(["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus"]),
};
const routes = new Set(["/api/image_get", "/api/download_work_dir_file", "/api/plugins/a2ui_zero/media"]);

export function safeUrl(value) {
  if (typeof value !== "string" || /[\s\\\x00-\x1f]/.test(value)) return "";
  if (value.startsWith("/plugins/a2ui_zero/") && !value.includes("..") && !value.includes("%")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function mediaSource(value, type = "", origin = globalThis.location?.origin) {
  if (typeof value !== "string" || value.length > 4000 || /[\\\x00-\x1f]/.test(value)) return null;
  try {
    let path = "";
    const parsed = new URL(value, origin || "http://a2ui.invalid");
    if (value.startsWith("/a0/")) path = value;
    else if (["file:", "img:"].includes(parsed.protocol)) {
      if (!value.startsWith(`${parsed.protocol}///`) || parsed.host || parsed.search || parsed.hash) return null;
      path = decodeURIComponent(value.slice(value.indexOf("://") + 3));
    } else if ((value.startsWith("/") && !value.startsWith("//") || parsed.origin === origin) && routes.has(parsed.pathname)) {
      if ([...parsed.searchParams.keys()].some(key => !["path", "t"].includes(key)) || parsed.searchParams.getAll("path").length !== 1) return null;
      path = parsed.searchParams.get("path");
    }
    const name = path ? path.split("/").at(-1) : decodeURIComponent(parsed.pathname.split("/").at(-1));
    const extension = name.split(".").at(-1).toLowerCase();
    const detected = Object.keys(formats).find(kind => formats[kind].has(extension));
    if (path && (!path.startsWith("/a0/") || path.split("/").some(part => [".", ".."].includes(part)) || /[\\\x00-\x1f]/.test(path) || !detected)) return null;
    type ||= detected;
    if (!formats[type]) return null;
    const url = path ? `/api/plugins/a2ui_zero/media?path=${encodeURIComponent(path)}` : safeUrl(value);
    if (!url) return null;
    return { url, type, title: name || type, path,
      download: path ? `/api/download_work_dir_file?path=${encodeURIComponent(path)}` : url };
  } catch { return null; }
}

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export function stopMedia(root) {
  for (const player of root?.querySelectorAll("audio, video") || []) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }
}

export function createMediaCard(source, { onOpen, caption = "", fit = "contain", poster = "", expanded = false } = {}) {
  const figure = node("figure", `a2ui-media a2ui-media-${source.type}`);
  figure.dataset.mediaUrl = source.url;
  const media = node(source.type === "image" ? "img" : source.type);
  media.className = "a2ui-media-content";
  media.setAttribute("aria-label", source.title);
  const unavailable = node("p", "a2ui-media-unavailable", "Preview unavailable. Open the original file to view it.");
  unavailable.hidden = true;
  media.addEventListener("error", () => { unavailable.hidden = false; });
  media.addEventListener(source.type === "image" ? "load" : "loadeddata", () => { unavailable.hidden = true; });
  if (source.type === "image") {
    media.alt = source.title;
    media.loading = "lazy";
    media.referrerPolicy = "no-referrer";
    media.style.objectFit = fit;
    const button = node("button", "a2ui-media-image-open");
    button.type = "button";
    button.setAttribute("aria-label", `Open ${source.title}`);
    button.addEventListener("click", () => onOpen?.(source));
    button.append(media); figure.append(button);
  } else {
    media.controls = true;
    media.preload = "metadata";
    if (source.type === "video") {
      media.playsInline = true;
      if (poster) media.poster = poster;
    }
    media.addEventListener("play", () => {
      for (const other of document.querySelectorAll(".a2ui-media audio, .a2ui-media video")) {
        if (other !== media) other.pause();
      }
    });
    figure.append(media);
  }
  media.src = source.url;
  const footer = node("figcaption", "a2ui-media-footer");
  const details = node("div", "a2ui-media-details");
  details.append(node("span", "a2ui-media-title", source.title));
  if (caption) details.append(node("span", "a2ui-caption", caption));
  footer.append(details);
  if (!expanded && source.type !== "image") {
    const open = node("button", "text-button", "Expand");
    open.type = "button";
    open.setAttribute("aria-label", `Open ${source.title}`);
    open.addEventListener("click", () => { media.pause(); onOpen?.(source); });
    footer.append(open);
  }
  const original = node("a", "text-button", source.path ? "Download" : "Open original");
  original.href = source.download; original.target = "_blank"; original.rel = "noopener noreferrer";
  footer.append(original);
  figure.append(unavailable, footer);
  return figure;
}

export function previewAttachments(container, onOpen, attachments = []) {
  if (!container || container.querySelector(".a2ui-response")) return;
  const sources = new Map();
  const images = new Set([...container.querySelectorAll(".message-body img[src]")]
    .map(image => mediaSource(image.getAttribute("src"), "image")?.url));
  for (const link of container.querySelectorAll(".message-body a[href], .message-body a[data-path]")) {
    // Markdown images already have an inline preview and the native image viewer.
    if (link.querySelector("img")) continue;
    let value = link.dataset.path || link.getAttribute("href");
    if (value.startsWith("/a0/")) {
      try { value = decodeURIComponent(value); } catch { /* A literal percent can be part of a filename. */ }
    }
    const source = mediaSource(value);
    if (!source) continue;
    source.title = link.textContent.trim() || source.title;
    if (!images.has(source.url)) sources.set(source.url, source);
    if (!link.dataset.a2uiMediaLink) {
      link.dataset.a2uiMediaLink = "true";
      link.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); event.stopImmediatePropagation(); onOpen(source);
      }, true);
    }
  }
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const name = typeof attachment === "string" ? attachment : attachment?.name;
    const value = typeof attachment === "object" ? attachment?.url || attachment?.path || name : name;
    const source = mediaSource(value) || (typeof name === "string" && !name.includes("/") ? mediaSource(`/a0/usr/uploads/${name}`) : null);
    if (source && !images.has(source.url)) sources.set(source.url, { ...source, title: name || source.title });
  }
  const existing = container.querySelector(":scope > .a2ui-attachments");
  const signature = JSON.stringify([...sources.values()]);
  if (existing?.dataset.signature === signature) return;
  stopMedia(existing);
  existing?.remove();
  if (!sources.size) return;
  const gallery = node("div", "a2ui-attachments");
  gallery.dataset.signature = signature;
  for (const source of [...sources.values()].slice(0, 16)) gallery.append(createMediaCard(source, { onOpen }));
  container.append(gallery);
}
