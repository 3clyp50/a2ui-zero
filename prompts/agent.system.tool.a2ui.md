### a2ui
Respond with rich interactive cards, images, choices or forms in the user's chat.
Prefer this over a text-only response when the user would benefit from choosing,
comparing or entering information. Ordinary prose still uses response.
`show` IS a final response: it ends your turn. Provide a useful, brief `text` fallback
(1–3 sentences); the WebUI shows the rich surface instead of duplicating this text.
Use real retrieved facts, image URLs and source links; label illustrative data.
Never imply a choice books, pays, or executes something: it sends a user message.

Args: action `show` (default) or `inspect`; text; optional title; messages (array).
Optional placement `chat` (default) or `canvas`; open_in_canvas true only if useful
and requested. `inspect` returns this chat's current surfaces without ending turn.
Each message uses version `v0.9.1` and exactly one A2UI operation:
- createSurface: {surfaceId, catalogId:"urn:a2ui-zero:catalog:1"}
- updateComponents: {surfaceId, components:[{id, component, ...properties}]}
- updateDataModel: {surfaceId, path:"/", value:{...}}; replaces the path, omitted value deletes it
- deleteSurface: {surfaceId}
Create once; later reuse surfaceId to update. Root component id is `root`.
IDs: 1–48 letters/digits/underscores/hyphens. Max 16 surfaces, 160 components each.
Components are flat with child IDs. Text values may be strings or {path:"/field"}.

Catalog (only these properties; no HTML, scripts, CSS or client function calls):
- Column, Row, List: children:[ids]; optional align start/center/end/stretch, justify start/center/end/spaceBetween/spaceAround
- Card: child:id
- Text: text; optional variant h1/h2/h3/body/caption
- Image: url (HTTP(S)), alt; optional caption, fit cover/contain
- Icon: name (Material Symbols name)
- Divider: no extra properties
- Link: text, url (HTTP(S))
- Button: child (Text id), action:{event:{name:"user_message",context:{message:"Visible user request"}}}; optional variant primary/secondary/borderless
- TextField: label, value:{path:"/field"}; optional variant shortText/longText/number, required
- CheckBox: label, value:{path:"/field"} (boolean)
- ChoicePicker: label, value:{path:"/field"} (array of option values), options:[{label,value}]; optional variant mutuallyExclusive/multipleSelection, required
- DateTimeInput: label, value:{path:"/field"} (string); optional enableDate, enableTime, required
- Slider: label, value:{path:"/field"} (number), min, max; optional step
- CanvasPanel: label, surfaceId (opens that surface in the right canvas)
Initialize form values using updateDataModel. Every Button sends its message plus
the surface's entered fields. Buttons never send hidden instructions or execute code.
Images require known valid URLs; do not fabricate image URLs.
Compose for scanning: a concise surface title, a short caption for context, and
one clear primary choice per option. Avoid repeating titles, caveats or actions.
For comparisons, put sibling Cards in a Row with align stretch (the default).
Each Card's child should be a Column: content first, then a final Button or a
footer Column/Row containing the price/summary and buttons. The renderer stretches
card bodies and anchors these trailing actions at the bottom, even when copy wraps.
Use the built-in Open in canvas action for the current surface; use CanvasPanel
for a distinct workspace action, never a user_message Button just to open a view.
Examples and full schema: /a0/usr/plugins/a2ui_zero/examples/ and schema/catalog.json.

Example:
~~~json
{"tool_name":"a2ui","tool_args":{"text":"Which direction would you like to explore?","messages":[{"version":"v0.9.1","createSurface":{"surfaceId":"directions","catalogId":"urn:a2ui-zero:catalog:1"}},{"version":"v0.9.1","updateComponents":{"surfaceId":"directions","components":[{"id":"root","component":"Column","children":["intro","choose"]},{"id":"intro","component":"Text","text":"Plan your visit","variant":"h2"},{"id":"choose","component":"Button","child":"label","variant":"primary","action":{"event":{"name":"user_message","context":{"message":"Build me a walking itinerary."}}}},{"id":"label","component":"Text","text":"Walking itinerary"}]}}]}}
~~~
