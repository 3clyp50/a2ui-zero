### a2ui
rich chat cards, forms, media; ordinary prose -> response
args: action show(default)|inspect
show REQUIRED: text (nonempty fallback), messages
optional: title
show ends turn; inspect reads current chat UI, keeps turn open
buttons send visible user messages + form values, never execute/book/pay
real sources/files; label examples; no secrets, HTML, scripts, CSS, client functions

messages: array of envelopes, each with version:"v0.9.1" and one operation below:
- createSurface: surfaceId, catalogId:"urn:a2ui-zero:catalog:1"
- updateComponents: surfaceId, components:[{id,component,...}]
- updateDataModel: surfaceId, path:"/", value:{...}; replaces path, omitted value deletes
- deleteSurface: surfaceId
create once; reuse surfaceId for updates. root id="root"; flat child-ID references
IDs: 1–48 letters/digits/_/-; max 16 surfaces,160 components/surface
Text.text/media url/poster: literal or {path:"/field"}. inputs value:{path:"/field"}; types below describe bound data. initialize via updateDataModel; distinct input paths

catalog (only listed fields; ?optional):
- Column/Row/List children:[ids]; ?align start/center/end/stretch, justify start/center/end/spaceBetween/spaceAround
- Card child:id; Divider no fields; Icon name (Material Symbols)
- Text text; ?variant h1/h2/h3/body/caption
- Image url,alt; ?caption,fit contain/cover
- Audio url,title; ?caption
- Video url,title; ?caption,poster:image_source
- Link text,url:HTTP(S)
- Button child:Text_id, action:{event:{name:"user_message",context:{message:"visible request"}}}; ?variant primary/secondary/borderless
- TextField label,value; ?variant shortText/longText/number,required
- CheckBox label,value:{path:"/field"} only; data:boolean
- ChoicePicker label,value:array,options:[{label,value}]; ?variant mutuallyExclusive/multipleSelection,required
- DateTimeInput label,value:string; ?enableDate,enableTime,required
- Slider label,value:number,min,max; ?step

media: known HTTP(S) URLs or existing /a0/... files; file:///a0/... and img:///a0/... also valid. no base64/invented paths
inline playback + viewer; ordinary media links also preview. code/text -> Editor
layout: concise title/caption; no repetition. comparisons/media -> Row of Cards with Column bodies, trailing button/footer for aligned actions; narrow views stack
full schema/examples: /a0/usr/plugins/a2ui_zero/schema/catalog.json and examples/

example: bound text + checkbox + submit; actual values go in data
~~~json
{"tool_name":"a2ui","tool_args":{"text":"Where to?","messages":[{"version":"v0.9.1","createSurface":{"surfaceId":"trip","catalogId":"urn:a2ui-zero:catalog:1"}},{"version":"v0.9.1","updateComponents":{"surfaceId":"trip","components":[{"id":"root","component":"Column","children":["destination","details","submit"]},{"id":"destination","component":"TextField","label":"Destination","value":{"path":"/destination"},"required":true},{"id":"details","component":"CheckBox","label":"Details","value":{"path":"/details"}},{"id":"submit","component":"Button","child":"label","action":{"event":{"name":"user_message","context":{"message":"Plan my trip."}}}},{"id":"label","component":"Text","text":"Continue"}]}},{"version":"v0.9.1","updateDataModel":{"surfaceId":"trip","path":"/","value":{"destination":"Rome","details":false}}}]}}
~~~
