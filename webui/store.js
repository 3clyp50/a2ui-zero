import { createStore } from "/js/AlpineStore.js";
import { callJsonApi } from "/js/api.js";
import { store as chats } from "/components/sidebar/chats/chats-store.js";
import { toastFrontendError } from "/components/notifications/notification-store.js";
import { renderSurface, forgetDrafts } from "./renderer.js";
import { createMediaCard, previewAttachments, stopMedia } from "./media.js";
import { store as imageViewer } from "/components/modals/image-viewer/image-viewer-store.js";
import { openModal, closeModal } from "/js/modals.js";

const endpoint = "/plugins/a2ui_zero/surfaces";
const sending = new Set();
let loading = null;
const mediaModal = "/plugins/a2ui_zero/webui/media-viewer.html";
if (!document.querySelector('link[data-a2ui-zero]')) {
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "/plugins/a2ui_zero/webui/a2ui.css"; css.dataset.a2uiZero = "";
  document.head.append(css);
}

export const store = createStore("a2uiZero", {
  contextId: "", surfaces: {}, revision: 0, activeMedia: null,

  async setContext(contextId) {
    if (contextId === this.contextId) return loading;
    if (this.activeMedia) void closeModal(mediaModal);
    for (const card of document.querySelectorAll(".a2ui-media")) stopMedia(card);
    this.contextId = contextId || "";
    this.surfaces = {}; this.revision = 0;
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
    } catch (error) { toastFrontendError(error.message, "a2ui-zero"); }
  },

  ingest(payload) {
    if (payload.context_id !== this.contextId || payload.revision <= this.revision) return;
    const surfaces = { ...this.surfaces, ...payload.surfaces };
    for (const id of payload.deleted || []) delete surfaces[id];
    this.surfaces = surfaces; this.revision = payload.revision;
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

  render(surface, contextId) {
    return renderSurface(surface, contextId, {
      onAction: (current, componentId, values) => this.act(contextId, current, componentId, values),
      onMedia: source => this.openMedia(source),
    });
  },

  openMedia(source) {
    if (source.type === "image") return imageViewer.open(source.url, { name: source.title });
    this.activeMedia = source;
    void openModal(mediaModal).finally(() => { this.activeMedia = null; });
  },

  stopMedia,

  renderMediaViewer(element) {
    stopMedia(element);
    element.replaceChildren();
    if (this.activeMedia) element.append(createMediaCard(this.activeMedia, { expanded: true }));
  },

  async afterMessages(batch) {
    await this.setContext(chats.selected);
    for (const entry of batch.results || []) {
      const payload = entry.args?.kvps?.a2ui_zero;
      if (!payload) {
        const response = entry.result?.element?.querySelector(".message-agent-response");
        previewAttachments(response, source => this.openMedia(source), entry.args?.kvps?.attachments);
        continue;
      }
      this.ingest(payload);
      const container = entry.result?.element?.querySelector(".message-agent-response") || entry.result?.element;
      if (!container || payload.context_id !== chats.selected) continue;
      let rich = container.querySelector(":scope > .a2ui-response");
      if (!rich) { rich = document.createElement("div"); rich.className = "a2ui-response"; container.append(rich); }
      if (rich.dataset.revision === String(payload.revision)) continue;
      rich.dataset.revision = payload.revision;
      stopMedia(rich);
      rich.replaceChildren();
      for (const surface of Object.values(payload.surfaces || {})) {
        rich.append(this.render(surface, payload.context_id));
      }
    }
    for (const view of batch.history?.querySelectorAll(".a2ui-surface") || []) {
      if (view.dataset.contextId !== this.contextId) continue;
      const latest = this.surfaces[view.dataset.surfaceId];
      if (latest?.revision === Number(view.dataset.revision)) continue;
      const version = view.querySelector(".a2ui-version");
      version.hidden = false;
      version.textContent = latest ? "Earlier version" : "Removed";
      view.querySelectorAll(".a2ui-tree .a2ui-button, input, textarea").forEach(control => { control.disabled = true; });
    }
  },
});
