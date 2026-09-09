import { createStore } from "/js/AlpineStore.js";
import { callJsonApi } from "/js/api.js";
import { store as chats } from "/components/sidebar/chats/chats-store.js";
import { open as openSurface } from "/js/surfaces.js";
import { toastFrontendError } from "/components/notifications/notification-store.js";
import { renderSurface, forgetDrafts } from "./renderer.js";

const endpoint = "/plugins/a2ui_zero/surfaces";
const sending = new Set();
const autoOpened = new Set();
let loading = null;
if (!document.querySelector('link[data-a2ui-zero]')) {
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "/plugins/a2ui_zero/webui/a2ui.css"; css.dataset.a2uiZero = "";
  document.head.append(css);
}

export const store = createStore("a2uiZero", {
  contextId: "", surfaces: {}, revision: 0, selectedId: "",
  get list() { return Object.values(this.surfaces); },

  async setContext(contextId) {
    if (contextId === this.contextId) return loading;
    this.contextId = contextId || "";
    this.surfaces = {}; this.revision = 0; this.selectedId = "";
    forgetDrafts(this.contextId);
    loading = contextId ? this.refresh() : null;
    return loading;
  },

  async refresh() {
    const contextId = this.contextId;
    if (!contextId) return;
    try {
      const result = await callJsonApi(endpoint, { context_id: contextId });
      if (contextId !== this.contextId || result.revision < this.revision) return;
      this.surfaces = result.surfaces; this.revision = result.revision;
      if (!this.surfaces[this.selectedId]) this.selectedId = this.list.at(-1)?.id || "";
    } catch (error) { toastFrontendError(error.message, "a2ui-zero"); }
  },

  ingest(payload) {
    if (payload.context_id !== this.contextId || payload.revision <= this.revision) return;
    const surfaces = { ...this.surfaces, ...payload.surfaces };
    for (const id of payload.deleted || []) delete surfaces[id];
    this.surfaces = surfaces; this.revision = payload.revision;
    if (!surfaces[this.selectedId]) this.selectedId = this.list.at(-1)?.id || "";
  },

  async open(id, contextId = chats.selected) {
    if (!contextId || contextId !== chats.selected) return;
    await this.setContext(contextId);
    await this.refresh();
    if (contextId !== chats.selected) return;
    if (id && !this.surfaces[id]) {
      toastFrontendError("This view is no longer available.", "a2ui-zero"); return;
    }
    this.selectedId = id || this.selectedId || this.list.at(-1)?.id || "";
    await openSurface("a2ui-zero", { surfaceId: this.selectedId });
  },

  async act(contextId, surface, componentId, values) {
    const key = `${contextId}:${surface.id}`;
    if (sending.has(key)) return;
    sending.add(key);
    try {
      if (contextId !== chats.selected) throw new Error("Switch back to the chat that owns this view.");
      const result = await callJsonApi(endpoint, {
        action: "prepare_action", context_id: contextId, surface_id: surface.id,
        revision: surface.revision, component_id: componentId, values,
      });
      if (contextId !== chats.selected) throw new Error("The chat changed before this choice could be sent.");
      await globalThis.sendMessage({ message: result.message, context: contextId, attachments: [], preserveInput: true });
    } catch (error) { toastFrontendError(error.message, "a2ui-zero"); }
    finally { sending.delete(key); }
  },

  render(surface, contextId, canvas = false) {
    return renderSurface(surface, contextId, {
      canvas,
      onOpen: id => this.open(id, contextId),
      onAction: (current, componentId, values) => this.act(contextId, current, componentId, values),
    });
  },

  renderPanel(element) {
    const surface = this.surfaces[this.selectedId];
    const key = `${this.contextId}:${surface?.id || ""}:${surface?.revision || 0}`;
    if (element.dataset.renderKey === key) return;
    element.dataset.renderKey = key;
    element.replaceChildren();
    if (surface) element.append(this.render(surface, this.contextId, true));
  },

  async afterMessages(batch) {
    await this.setContext(chats.selected);
    for (const entry of batch.results || []) {
      const payload = entry.args?.kvps?.a2ui_zero;
      if (!payload) continue;
      this.ingest(payload);
      const container = entry.result?.element?.querySelector(".message-agent-response") || entry.result?.element;
      if (!container || payload.context_id !== chats.selected) continue;
      let rich = container.querySelector(":scope > .a2ui-response");
      if (!rich) { rich = document.createElement("div"); rich.className = "a2ui-response"; container.append(rich); }
      if (rich.dataset.revision === String(payload.revision)) continue;
      rich.dataset.revision = payload.revision;
      rich.replaceChildren();
      for (const surface of Object.values(payload.surfaces || {})) {
        if (surface.placement === "canvas") {
          const button = document.createElement("button");
          button.type = "button"; button.className = "button"; button.textContent = `Open ${surface.title} in canvas`;
          button.addEventListener("click", () => this.open(surface.id, payload.context_id));
          rich.append(button);
        } else rich.append(this.render(surface, payload.context_id));
      }
      const timestamp = Number(entry.args.timestamp) * 1000;
      const openKey = `${payload.context_id}:${payload.revision}`;
      if (payload.open_in_canvas && !batch.massRender && !batch.windowRebuild &&
          timestamp > Date.now() - 30000 && !autoOpened.has(openKey)) {
        autoOpened.add(openKey);
        while (autoOpened.size > 128) autoOpened.delete(autoOpened.values().next().value);
        const id = Object.keys(payload.surfaces || {}).at(-1);
        if (id) void this.open(id, payload.context_id);
      }
    }
    for (const view of batch.history?.querySelectorAll(".a2ui-surface") || []) {
      if (view.dataset.contextId !== this.contextId) continue;
      const latest = this.surfaces[view.dataset.surfaceId];
      if (latest?.revision === Number(view.dataset.revision)) continue;
      const version = view.querySelector(".a2ui-version");
      version.hidden = false;
      version.textContent = latest ? "Earlier version" : "Removed";
      view.querySelectorAll(".a2ui-tree button, input, textarea").forEach(control => { control.disabled = true; });
      if (!latest) view.querySelector(".a2ui-heading button")?.setAttribute("disabled", "");
    }
  },
});
