# Verification

Target: **http://localhost:32081**, 2026-09-09 (Europe/Rome).
Container: `42eb67c9f635`, with `/home/eclypso/a0/agent-zero` bind-mounted at `/a0`.
Plugin runtime: `/a0/usr/plugins/a2ui_zero`.
Framework checks use `/opt/venv-a0/bin/python`; host checks use conda `a0`.
The WebUI showed the configured **Codex gpt-6-astra** model for the live chats.

## Automated checks

- Eight Python tests passed both in conda `a0` and inside the live framework.
- Node checks passed for JSON Pointer escaping, prototype-key rejection, and
  image/link URL handling; renderer and store syntax checked.
- All three complete examples validate against the vendored A2UI envelope and
  custom catalog, and serialize/deserialize without state changes.
- Tested atomic updates/deletion, duplicate IDs, cycles and size bounds, unknown
  components/properties, unsafe URL changes, form types/options, hidden fields,
  overlapping input paths, and unsupported metadata flags.
- All 17 CSS variables used by the plugin are defined Agent Zero design tokens.
- Thumbnail checked: WebP, 256×256, **18,016 bytes**.

## Real agent and browser checks

| Check | Observed result |
| --- | --- |
| Natural flight-comparison request | Agent chose `a2ui` on its first attempt and generated two interactive cards. Example data was labelled; no flight search or booking. |
| Choice continuation | Clicking Choose direct created exactly one visible user message; the agent continued the conversation. |
| Composer preservation | Existing unsent draft remained unchanged after the choice. |
| Place image + form | A second natural request generated a Kyoto photo and five form controls; the 960 px source image loaded. |
| Local binding | Typing Osaka updated the bound text immediately without an agent turn. |
| CanvasPanel | Opened the brief beside chat, retaining destination, date, interests, slider value and checkbox edits. Opening alone did not send a user turn. |
| Form submission | Canvas submit sent Destination: Osaka, Food, 2026-10-15, budget 176, and step-free preference as readable user text. |
| Model continuation | The agent created a second rich surface with an Osaka itinerary based on those preferences. |
| Multiple surfaces | Both brief and itinerary appeared in the native canvas view selector. |
| Update existing surface | Agent used updateDataModel to set Nara / 180 without recreating the surface. Latest canvas updated; old chat controls became disabled with Earlier version. |
| Delete + automatic open | Agent deleted only the itinerary, updated the brief budget to 190, and automatically opened the brief. Deleted historical UI is marked Removed and disabled. |
| Chat isolation | Creating a fresh chat cleared the previous chat's canvas data. Action callbacks check the selected chat before and after preparing a message. |
| Replay | Page reload restored rich response snapshots and current canvas state. Local unsent form drafts reset as documented. |
| Floating window | Docked and floating forms retained the same edits; repeated tooltip-hover/window teardown passed after disabling animation on plugin-owned tooltips. |
| Mobile | At 390×844, all three rendered response surfaces had scrollWidth equal to clientWidth (308 px); native mobile modal had 315 px width with no horizontal overflow. |
| Light mode | Surface background and text matched the active light tokens (`#ecf1fb`, `#1e2947` in the installed theme). |
| Accessibility | Labelled native inputs, checkbox/radio choices, accessible slider name and keyboard ArrowRight input verified. |
| Literal HTML | An img/onerror-shaped string stayed literal text: zero inserted image/script nodes and no execution. |
| API boundaries | Valid choice 200; stale/deleted surface 409; undeclared field 400; missing chat 404; missing CSRF 403. |

## Final installation and replay

- Installed from ZIP through Agent Zero's normal plugin management API.
- Restarted the container, waited for HTTP 200, and verified persisted revision 4
  with the single remaining trip brief. Malformed context input returned 400.
- Disabled via Plugins API: the plugin route returned 403; after reload there
  were no rich surfaces or plugin store, and all five response fallbacks remained
  visible.
- Uninstalled and reinstalled the current ZIP through the management APIs.
  Installation hooks succeeded, the plugin was enabled, and context state survived.
- Opened a fresh browser session at the normal `/` URL (not safe mode). Both test
  chats restored rich content. The latest brief remained revision 4, older views
  retained Earlier version / Removed indicators, and replay did not open the
  canvas. The fresh-session browser console contained no errors or warnings.
- Standalone source, installed runtime files and ZIP contents were compared by
  SHA-256. Runtime configuration, caches, Git internals and local QA output are
  excluded from the ZIP.

Final screenshot: [flight comparison](screenshots/flight-comparison.png).
Additional local QA screenshots are in the standalone repository's ignored
`output/playwright/` directory. Existing test chats are retained for inspection.

## Comparison layout

- The original saved flight response now has equal 280 px card heights and
  exactly matching CTA top and bottom positions despite unequal copy lengths.
- The revised `examples/flights.json` uses content and footer Columns. Rendered
  through the live plugin renderer, both price/footer tops and button tops matched
  exactly. This was a temporary catalog preview; saved chat content was unchanged.
- Cards stacked without horizontal overflow in a 480 px surface and at a
  390×844 viewport. Heights remain content-driven; colors, spacing, fonts and
  borders continue to use the same Agent Zero tokens.
- The eight existing Python checks passed with the revised example.
- [Refined catalog example](screenshots/comparison-layout.png).

## Scope and limits

This verifies the custom catalog on the named runtime and configured model; it
does not establish support for every A2UI catalog, every model, or every browser.
External flight services and booking were deliberately not involved. Images
remain dependent on their source. Unsent form drafts are not durable; saved
surfaces and chat snapshots are. No Agent Zero core files were changed.
