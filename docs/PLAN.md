# a2ui-zero implementation plan

## Experience

Agent Zero can answer with a useful interface: compare flight options, explore a
place through pictures and cards, choose a direction, or fill a short brief.
Chat is the primary surface. A choice sends an ordinary, visible user message.
Larger interfaces can open in Agent Zero's existing right canvas, with its native
modal/window and mobile behavior.

Repository/display name: **a2ui-zero**. Runtime ID: **a2ui_zero**, as required by
Agent Zero's Python imports and community manifest contract.

## First release

1. **Protocol and persistence.** Pin the A2UI v0.9.1 envelope and common schemas;
   supply an explicit custom catalog. Validate locally without fetching schemas
   from agent-provided URLs. Support create, component updates, data updates,
   and deletion. Keep per-chat state in the framework's persisted context data;
   record immutable snapshots on normal response logs for history replay.
2. **Chat renderer.** Render trusted native DOM elements for text, images, icons,
   cards, row/column/list layouts, dividers, links, buttons, text inputs, choices,
   checkboxes, date/time inputs, and sliders. Inherit Agent Zero's design tokens.
   Use textContent for generated text; never execute generated HTML or JavaScript.
3. **Interaction.** Resolve user events against the server's current surface and
   revision. Accept edits only to catalog-declared input bindings. Return a
   readable message to the normal frontend send function, preserving drafts and
   attachments. Reject stale surfaces and guard against cross-chat clicks.
4. **Canvas.** Register a native A2UI surface. CanvasPanel opens a named surface;
   all rendered chat surfaces also have an Open in canvas affordance. Multiple
   surfaces remain selectable in one canvas. Explicit agent canvas intent may
   open only on a fresh response, never during history replay.
5. **Authoring and packaging.** Provide concise policy-filtered tool instructions,
   complete example messages, README, license, generated 256×256 thumbnail under
   20,000 bytes, and a ZIP with plugin files at its root. Lifecycle checks belong
   in hooks.py. No manual Execute step or additional service.
6. **Proof.** Check schemas, malformed inputs, unsafe URLs, graph limits, atomic
   updates, form values, stale actions, and persistence. Install using the actual
   framework management path at localhost:32081. Exercise natural AI chats,
   image loading, choice continuation, forms, canvas opening, updates, deletion,
   refresh, chat isolation, mobile layout, keyboard use, and browser/server logs.

## Concrete examples

- Travel comparison: cards with times, stops, prices and sources; choose an option
  or refine dates. Flight data still comes from the agent's existing tools.
- Place guide: photographs, a short overview, links, and choices such as museums,
  food or a walking itinerary; open the guide beside the conversation.
- Project brief: objective, priorities, date, budget range, and a submit button
  that turns the completed form into a visible request.
- Decision workspace: inspect alternatives in the canvas while continuing the
  conversation; update a named surface without losing its identity.

## Deliberate boundaries

This is a catalog-specific A2UI integration, not an implementation of every Basic
Catalog feature. No arbitrary client functions, remote catalogs, HTML, scripts,
iframes, automatic purchases, or new transport stack. Model output is validated
at completed tool-call boundaries; UI deltas then use Agent Zero's existing log
sync. Unsaved form drafts live in the browser session only. More specialized
widgets, upstream renderer adapters, and token-level partial JSON rendering can
follow real usage. External publication and a Plugin Index PR are separate work.

## Sources checked

- https://a2ui.org/specification/v0.9.1-a2ui/
- https://a2ui.org/introduction/agent-ui-ecosystem/
- Agent Zero plugin authoring contracts, response logs, message hooks,
  sendMessage(), context persistence, and native surface registration.
