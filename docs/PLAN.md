# a2ui-zero implementation plan

## Experience

Agent Zero can answer with a useful interface: compare flight options, explore a
place through pictures and cards, choose a direction, or fill a short brief.
All interfaces appear in chat. A choice sends an ordinary, visible user message.
Media can expand in Agent Zero's image viewer or native modal shell.

Repository/display name: **a2ui-zero**. Runtime ID: **a2ui_zero**, as required by
Agent Zero's Python imports and community manifest contract.

## Implementation

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
4. **Media.** Preview images, audio, and video in chat with native playback
   controls and expanded viewers. Recognize ordinary assistant media links too.
   Stream local media through an authenticated endpoint with byte-range support;
   validate paths, MIME types, and containment. Keep code and text in the Editor.
5. **Authoring and packaging.** Provide concise policy-filtered tool instructions,
   complete example messages, README, license, generated 256×256 thumbnail under
   20,000 bytes, and a ZIP with plugin files at its root. Lifecycle checks belong
   in hooks.py. No manual Execute step or additional service.
6. **Proof.** Check schemas, malformed inputs, unsafe URLs, graph limits, atomic
   updates, form values, stale actions, and persistence. Install using the actual
   framework management path at localhost:32081. Exercise natural AI chats,
   image loading, media playback, choice continuation, forms, updates, deletion,
   refresh, chat isolation, mobile layout, keyboard use, and browser/server logs.

## Concrete examples

- Travel comparison: cards with times, stops, prices and sources; choose an option
  or refine dates. Flight data still comes from the agent's existing tools.
- Place guide: photographs, a short overview, links, and choices such as museums,
  food or a walking itinerary.
- Project brief: objective, priorities, date, budget range, and a submit button
  that turns the completed form into a visible request.
- Media review: inspect generated images, listen to audio, watch video, and
  submit preferences or feedback through the same chat response.

## Deliberate boundaries

This is a catalog-specific A2UI integration, not an implementation of every Basic
Catalog feature. No arbitrary client functions, remote catalogs, HTML, scripts,
iframes, automatic purchases, or new transport stack. Model output is validated
at completed tool-call boundaries; UI deltas then use Agent Zero's existing log
sync. Unsaved form drafts live in the browser session only. More specialized
widgets, upstream renderer adapters, and token-level partial JSON rendering can
follow real usage. No canvas registration, panel, or routing is included.

## Sources checked

- https://a2ui.org/specification/v0.9.1-a2ui/
- https://a2ui.org/introduction/agent-ui-ecosystem/
- Agent Zero plugin authoring contracts, response logs, message hooks,
  sendMessage(), context persistence, image viewer, and native modal shell.
