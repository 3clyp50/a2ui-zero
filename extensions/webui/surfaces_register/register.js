import { store } from "/plugins/a2ui_zero/webui/store.js";

export default function register(canvas) {
  canvas.registerSurface({
    id: "a2ui-zero", title: "A2UI", icon: "widgets", order: 65,
    modalPath: "/plugins/a2ui_zero/webui/main.html",
    async open(payload = {}) {
      if (payload.surfaceId) store.selectedId = payload.surfaceId;
      await store.refresh();
    },
  });
}
