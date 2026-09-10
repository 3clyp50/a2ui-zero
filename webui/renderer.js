import { safeUrl, mediaSource, createMediaCard, stopMedia } from "./media.js";
export { safeUrl } from "./media.js";

const drafts = new Map();
const forbidden = new Set(["__proto__", "prototype", "constructor"]);

export function parts(path) {
  if (typeof path !== "string" || !path.startsWith("/") || /~(?![01])/.test(path)) throw new Error("Invalid data path");
  const keys = path === "/" ? [] : path.slice(1).split("/").map(p => p.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (keys.some(key => forbidden.has(key))) throw new Error("Invalid data path");
  return keys;
}

export function read(data, path) {
  return parts(path).reduce((value, key) => value?.[key], data);
}

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

function draftFor(contextId, surface) {
  const key = `${contextId}:${surface.id}:${surface.revision}`;
  if (!drafts.has(key)) drafts.set(key, { data: structuredClone(surface.data), edits: {}, bindings: [] });
  while (drafts.size > 64) drafts.delete(drafts.keys().next().value);
  const draft = drafts.get(key);
  draft.bindings = draft.bindings.filter(binding => binding.node.isConnected);
  return draft;
}

export function forgetDrafts(contextId) {
  for (const key of drafts.keys()) if (!key.startsWith(`${contextId}:`)) drafts.delete(key);
}

export function renderSurface(surface, contextId, { onAction, onMedia }) {
  const draft = draftFor(contextId, surface);
  const root = element("section", "a2ui-surface");
  root.dataset.surfaceId = surface.id;
  root.dataset.revision = surface.revision;
  root.dataset.contextId = contextId;
  root.setAttribute("aria-label", surface.title);
  const header = element("header", "a2ui-heading");
  header.append(element("span", "a2ui-title", surface.title));
  const version = element("span", "a2ui-caption a2ui-version");
  version.hidden = true;
  header.append(version);
  root.append(header);
  const form = element("form", "a2ui-tree");
  form.addEventListener("submit", event => event.preventDefault());
  root.append(form);

  const valueOf = value => value && typeof value === "object" ? read(draft.data, value.path) : value;
  function bind(node, value, update) {
    update(valueOf(value));
    if (value && typeof value === "object") draft.bindings.push({ node, value, update });
  }
  function edit(path, value) {
    const keys = parts(path);
    let target = draft.data;
    for (const key of keys.slice(0, -1)) target = target[key] ??= {};
    target[keys.at(-1)] = value;
    draft.edits[path] = value;
    draft.bindings = draft.bindings.filter(binding => binding.node.isConnected);
    for (const binding of draft.bindings) binding.update(valueOf(binding.value));
  }
  let count = 0;
  function render(id, ancestors = []) {
    if (++count > 512 || ancestors.length > 24 || ancestors.includes(id)) return element("span");
    const component = surface.components[id];
    if (!component) return element("span", "a2ui-placeholder");
    const kind = component.component;
    let node;
    const child = key => render(key, [...ancestors, id]);
    if (["Column", "Row", "List", "Card"].includes(kind)) {
      node = element("div", `a2ui-${kind.toLowerCase()}`);
      const align = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
      const justify = { start: "flex-start", center: "center", end: "flex-end", spaceBetween: "space-between", spaceAround: "space-around" };
      if (align[component.align]) node.style.alignItems = align[component.align];
      if (justify[component.justify]) node.style.justifyContent = justify[component.justify];
      for (const key of component.children || [component.child]) node.append(child(key));
    } else if (kind === "Text") {
      const variant = ["h1", "h2", "h3"].includes(component.variant) ? component.variant : "p";
      node = element(variant, `a2ui-text ${component.variant === "caption" ? "a2ui-caption" : ""}`);
      bind(node, component.text, value => { node.textContent = value ?? ""; });
    } else if (["Image", "Audio", "Video"].includes(kind)) {
      node = element("div", "a2ui-media-slot");
      const update = () => {
        const source = mediaSource(valueOf(component.url), kind.toLowerCase());
        const poster = component.poster ? mediaSource(valueOf(component.poster), "image")?.url || "" : "";
        const key = JSON.stringify([source?.url, poster]);
        if (node.dataset.mediaKey === key) return;
        node.dataset.mediaKey = key;
        stopMedia(node);
        node.replaceChildren();
        if (source) node.append(createMediaCard({ ...source, title: component.alt || component.title }, {
          onOpen: onMedia, caption: component.caption, fit: component.fit, poster,
        }));
      };
      bind(node, component.url, update);
      if (component.poster) bind(node, component.poster, update);
    } else if (kind === "Link") {
      node = element("a", "a2ui-link", component.text);
      node.target = "_blank"; node.rel = "noopener noreferrer";
      bind(node, component.url, value => { const url = safeUrl(value); if (url) node.href = url; else node.removeAttribute("href"); });
    } else if (kind === "Icon") {
      node = element("x-icon"); node.setAttribute("name", component.name);
    } else if (kind === "Divider") {
      node = element("hr", "a2ui-divider");
    } else if (kind === "Button") {
      node = element("button", `button a2ui-button ${component.variant === "primary" ? "a2ui-primary" : ""}`);
      node.type = "button";
      const label = surface.components[component.child];
      bind(node, label?.text ?? "Continue", value => {
        node.textContent = value ?? "Continue";
        node.setAttribute("aria-label", node.textContent);
      });
      node.title = "Send: " + component.action.event.context.message;
      node.dataset.bsAnimation = "false";
      node.addEventListener("click", async () => {
        if (!form.reportValidity()) return;
        node.disabled = true;
        try { await onAction(surface, component.id, { ...draft.edits }); }
        finally { node.disabled = false; }
      });
    } else if (["TextField", "CheckBox", "ChoicePicker", "DateTimeInput", "Slider"].includes(kind)) {
      node = element(kind === "ChoicePicker" ? "fieldset" : "label", "a2ui-field");
      const label = element(kind === "ChoicePicker" ? "legend" : "span", "a2ui-field-label", component.label);
      node.append(label);
      if (kind === "ChoicePicker") {
        const multiple = component.variant === "multipleSelection";
        for (const option of component.options) {
          const wrapper = element("label", "a2ui-option");
          const input = element("input");
          input.type = multiple ? "checkbox" : "radio";
          input.name = `${contextId}-${surface.id}-${id}`;
          input.value = option.value;
          input.required = Boolean(component.required && !multiple);
          bind(input, component.value, value => { input.checked = Array.isArray(value) && value.includes(option.value); });
          input.addEventListener("change", () => {
            const selected = Array.isArray(valueOf(component.value)) ? valueOf(component.value) : [];
            edit(component.value.path, multiple ? (input.checked ? [...new Set([...selected, option.value])] : selected.filter(v => v !== option.value)) : [option.value]);
          });
          wrapper.append(input, element("span", "", option.label)); node.append(wrapper);
        }
      } else {
        const input = element(kind === "TextField" && component.variant === "longText" ? "textarea" : "input", "a2ui-input");
        input.setAttribute("aria-label", component.label);
        if (kind === "CheckBox") { input.type = "checkbox"; node.classList.add("a2ui-checkbox"); }
        else if (kind === "Slider") {
          input.type = "range"; input.min = component.min; input.max = component.max; input.step = component.step ?? 1;
          const output = element("output", "a2ui-caption");
          bind(output, component.value, value => { output.textContent = value ?? component.min; });
          node.append(output);
        } else if (kind === "DateTimeInput") {
          input.type = component.enableTime ? (component.enableDate === false ? "time" : "datetime-local") : "date";
        } else if (input.tagName === "INPUT") input.type = component.variant === "number" ? "number" : "text";
        input.required = Boolean(component.required);
        if (kind === "TextField") input.maxLength = 4000;
        bind(input, component.value, value => {
          if (kind === "CheckBox") input.checked = Boolean(value);
          else if (input !== document.activeElement) input.value = value ?? (kind === "Slider" ? component.min : "");
        });
        input.addEventListener("input", () => edit(component.value.path, kind === "CheckBox" ? input.checked : kind === "Slider" ? Number(input.value) : input.value));
        node.append(input);
      }
    } else node = element("span", "a2ui-placeholder");
    node.dataset.componentId = id;
    return node;
  }
  form.append(render("root"));
  return root;
}
