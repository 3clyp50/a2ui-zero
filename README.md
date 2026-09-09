# a2ui-zero

Rich answers that belong in Agent Zero: interactive cards, images, comparisons,
forms, and choices in chat, with room for larger views in the right canvas.

![a2ui-zero](webui/thumbnail.webp)

![The flight example rendered in Agent Zero with aligned price and action footers](docs/screenshots/comparison-layout.png)

## Try it

- “Show two illustrative flight options from Rome to Tokyo as interactive cards.
  Let me choose direct or one stop. Don't book anything.”
- “Give me a visual Kyoto guide with a photograph and choices for what to explore.”
- “Ask me for a destination, interests, date and daily budget in an interactive
  form, then use my answers to plan a day.”
- “Keep this comparison open in the canvas while we discuss it.”

The agent uses its existing configured model and research tools. A2UI adds the
presentation and interaction; it does not supply flight inventory, photos, or
booking services. Choices send ordinary user messages. Form submissions include
readable labels and entered values. They do not directly execute agent tools.

## Install

Requires an Agent Zero build with community plugins, the `set_messages_after_loop`
WebUI hook, native canvas surfaces, and its existing `jsonschema` dependency.
Install [this repository](https://github.com/3clyp50/a2ui-zero) through
**Plugins → Add plugin** using its URL, or upload a plugin ZIP. Refresh the WebUI
and start a new chat so the agent receives the tool instructions. There are no
new packages, service keys, servers, CDN scripts, or manual Execute steps.

The display/repository name is **a2ui-zero**. Agent Zero's required runtime name
is **a2ui_zero**, installed in `/a0/usr/plugins/a2ui_zero`.

## What is supported

The plugin consumes real **A2UI v0.9.1** envelopes with the custom catalog
`urn:a2ui-zero:catalog:1`. The catalog is supplied locally, never fetched from an
agent-provided URL. Its schema is in [schema/catalog.json](schema/catalog.json).

| Purpose | Components |
| --- | --- |
| Layout | Column, Row, List, Card, Divider |
| Content | Text, Image, Icon, Link |
| Choices | Button, ChoicePicker |
| Forms | TextField, CheckBox, DateTimeInput, Slider |
| Workspace | CanvasPanel |

`CanvasPanel` opens another named UI surface in Agent Zero's native canvas.
Every inline surface also offers **Open in canvas**. The canvas has a view
selector and uses the host's docking, floating-window and mobile controls.
Colors, typography, spacing, borders, focus rings and controls inherit Agent
Zero's design tokens, including light mode.

Comparison cards stretch evenly within a Row and stack when the available width
gets narrow. Use a Column inside each Card, ending with a Button or a Column/Row
of summary details and actions; that footer anchors to the bottom automatically.
This keeps prices and choices aligned without fixed heights or clipped text.

The examples are authoring references, not fixed workflows. The agent composes
and updates these components at runtime. A questionnaire can combine several
radio or checkbox groups with separate text fields for custom answers, then
submit them together. Conditional fields require an agent update; choosing
"Other" does not automatically reveal a text field.

## Agent tool

`a2ui` accepts `action: "show"`, a plain-text fallback `text`, and `messages`.
Optional arguments: `title`, `placement: "chat" | "canvas"`, and
`open_in_canvas: true`. `show` completes the turn. `action: "inspect"` reads this
chat's current surface state without ending the turn.

Supported messages: `createSurface`, `updateComponents`, `updateDataModel`, and
`deleteSurface`. Use one `root` component per surface. Create a surface once;
later messages can replace components by ID or replace/delete data at a JSON
Pointer. Forward component references render when their definitions arrive.

Complete tool arguments:
[flight comparison](examples/flights.json), [place guide](examples/place-guide.json),
[trip brief](examples/trip-brief.json).

`Button.action.event` uses `name: "user_message"` and
`context: {"message": "The user's readable request"}`. Its message is shown in
the button tooltip. Local form edits update bound text immediately. Submitting
validates against the saved component definitions and current revision, then
uses Agent Zero's normal send/queue behavior. The composer draft and attachments
are preserved; a choice never moves to a different chat.

## Persistence and boundaries

- Current surfaces live in Agent Zero's persisted chat context; response logs
  retain snapshots for history replay and exported chats. The canvas shows the
  latest state. Older chat responses remain historical snapshots; stale choices
  are rejected. Deletion removes the current surface, preserving the transcript.
- Local form edits are shared between chat and canvas while mounted. They are
  discarded on a new server revision, chat switch or page reload. Submit them
  before leaving if the agent should remember them.
- Form values enter ordinary chat messages. There is no password/secret input
  component or private credential handoff to terminal tools; do not use these
  forms to collect credentials.
- Supports this custom catalog, not the entire upstream Basic Catalog. Static
  child references and JSON Pointer bindings are supported; template child lists,
  arbitrary client functions, custom themes, HTML, scripts and iframes are not.
  `sendDataModel` metadata is not used: this transport sends the visible form
  fields as a normal user message. Input bindings must use distinct leaf paths.
- Updates stream through Agent Zero's existing log synchronization after each
  completed tool call. Partial JSON tokens are not rendered.
- Up to 16 surfaces / 500 KB state per chat, 160 component definitions per
  surface, 512 expanded nodes, 24 nesting levels, and 4,000 characters per value.
- Images and links accept HTTP(S) URLs plus plugin-owned assets. External images
  are fetched by the browser, with no referrer. Text remains selectable plain text;
  the normal response fallback can still use Agent Zero Markdown.
- Disable/remove through Plugins. Hooks create no external files or processes and
  never alter shared dependencies. Saved chat snapshots remain; the readable
  fallback continues to work without this plugin.

## Development

Use the existing Agent Zero environment:

```bash
conda run --no-capture-output -n a0 python -m unittest discover -s tests -v
node tests/renderer.test.mjs
```

See the [implementation plan](docs/PLAN.md), [verification report](docs/VERIFICATION.md),
and [artwork provenance](docs/ARTWORK.md). Plugin code is MIT licensed; the two
upstream A2UI schemas retain their Apache 2.0 license and attribution in
[schema/NOTICE.md](schema/NOTICE.md).
