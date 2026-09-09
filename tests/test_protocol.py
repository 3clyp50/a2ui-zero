"""Run with the existing Agent Zero framework environment: python -m unittest discover -s tests."""

import copy
import importlib.util
import json
from pathlib import Path
import unittest
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("a2ui_zero_protocol", ROOT / "helpers/protocol.py")
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


def example(name="flights"):
    return json.loads((ROOT / "examples" / (name + ".json")).read_text())


def apply_example(name="flights"):
    args = example(name)
    return p.apply_messages(None, args["messages"], args["title"])[0]


def envelope(kind, **args):
    return {"version": "v0.9.1", kind: args}


class ProtocolTests(unittest.TestCase):
    def test_media_sources_and_containment(self):
        for source in ("/a0/usr/My clip.mp4", "file:///a0/usr/My%20clip.mp4",
                       "/api/download_work_dir_file?path=%2Fa0%2Fusr%2FMy%20clip.mp4"):
            self.assertEqual(p.media_path(source), "/a0/usr/My clip.mp4")
        for source in ("file:///etc/clip.mp4", "file://localhost/a0/clip.mp4", "file:///a0/../clip.mp4",
                       "file:///a0/%2e%2e/clip.mp4", "/a0/usr/code.html", "data:audio/wav;base64,abc",
                       "/api/private?path=/a0/test.png", "/api/image_get?path=/etc/test.png",
                       "/api/image_get?path=/a0/a.png&path=/a0/b.png"):
            with self.subTest(source=source), self.assertRaises(ValueError): p.safe_media_url(source)
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "a0"
            base.mkdir()
            (base / "escape").symlink_to(Path(directory), target_is_directory=True)
            with self.assertRaises(ValueError): p.resolve_media_path("/a0/escape/test.mp4", base)
            self.assertEqual(p.resolve_media_path("/a0/safe.mp4", base), base / "safe.mp4")

    def test_media_components_and_bound_updates(self):
        for kind, suffix in (("Image", "png"), ("Audio", "wav"), ("Video", "mp4")):
            component = {"id": "root", "component": kind, "url": {"path": "/source"},
                         "alt" if kind == "Image" else "title": "Generated media"}
            if kind == "Video": component["poster"] = {"path": "/poster"}
            messages = [envelope("createSurface", surfaceId="media", catalogId=p.CATALOG),
                        envelope("updateComponents", surfaceId="media", components=[component]),
                        envelope("updateDataModel", surfaceId="media", path="/", value={
                            "source": f"/a0/usr/output.{suffix}", "poster": "img:///a0/usr/poster.png"})]
            state, _, _ = p.apply_messages(None, messages)
            with self.assertRaises(ValueError):
                p.apply_messages(state, [envelope("updateDataModel", surfaceId="media", path="/source", value="javascript:alert(1)")])
            if kind == "Video":
                with self.assertRaises(ValueError):
                    p.apply_messages(state, [envelope("updateDataModel", surfaceId="media", path="/poster", value="/etc/secret.png")])

    def test_examples_validate_and_roundtrip(self):
        for path in (ROOT / "examples").glob("*.json"):
            state = apply_example(path.stem)
            self.assertEqual(state, json.loads(json.dumps(state)))
            self.assertEqual(state["revision"], 1)
            self.assertTrue(next(iter(state["surfaces"].values()))["components"]["root"])

    def test_update_and_delete_are_atomic(self):
        state = apply_example()
        original = copy.deepcopy(state)
        updates = [envelope("updateDataModel", surfaceId="flights", path="/price", value=700)]
        changed, ids, deleted = p.apply_messages(state, updates)
        self.assertEqual(changed["surfaces"]["flights"]["data"]["price"], 700)
        self.assertEqual(state, original)
        with self.assertRaises(ValueError):
            p.apply_messages(state, updates + [envelope("deleteSurface", surfaceId="missing")])
        self.assertEqual(state, original)
        removed, _, deleted = p.apply_messages(changed, [envelope("deleteSurface", surfaceId="flights")])
        self.assertEqual(removed["surfaces"], {})
        self.assertEqual(deleted, ["flights"])

    def test_schema_rejects_code_remote_catalogs_and_unknown_properties(self):
        args = example()
        for component in [{"id": "root", "component": "Html", "html": "<script>bad()</script>"},
                          {"id": "root", "component": "Text", "text": "x", "onclick": "bad()"}]:
            bad = copy.deepcopy(args["messages"])
            bad[1]["updateComponents"]["components"] = [component]
            with self.assertRaises(ValueError): p.apply_messages(None, bad)
        args["messages"][0]["createSurface"]["catalogId"] = "https://untrusted.example/catalog.json"
        with self.assertRaises(ValueError): p.apply_messages(None, args["messages"])

    def test_urls_and_pointers(self):
        for url in ["javascript:alert(1)", "data:text/html,x", "//evil.example", "https://u:p@example.com", "https://example.com\\evil", "/api/private"]:
            with self.assertRaises(ValueError): p.safe_url(url)
        self.assertEqual(p.safe_url("https://example.com/picture.jpg"), "https://example.com/picture.jpg")
        for path in ["x", "/__proto__/x", "/constructor/x", "/a~2b"]:
            with self.assertRaises(ValueError): p.pointer(path)
        data = p.write({}, "/a~1b/~0x", [1, 2])
        self.assertEqual(p.read(data, "/a~1b/~0x/1"), 2)
        p.write(data, "/a~1b/~0x/0", 3)
        p.write(data, "/a~1b/~0x/1")
        self.assertEqual(p.read(data, "/a~1b/~0x"), [3])

    def test_cycles_bounds_and_duplicate_ids(self):
        messages = example()["messages"]
        for nodes in [[{"id":"root","component":"Column","children":["root"]}],
                      [{"id":"root","component":"Text","text":"a"}] * 2,
                      [{"id":"root","component":"Text","text":"x" * 4001}]]:
            invalid = copy.deepcopy(messages)
            invalid[1]["updateComponents"]["components"] = nodes
            with self.assertRaises(ValueError): p.apply_messages(None, invalid)
        with self.assertRaises(ValueError): p.apply_messages(apply_example(), messages)

    def test_actions_take_message_from_saved_ui_and_validate_fields(self):
        surface = apply_example("trip-brief")["surfaces"]["trip_brief"]
        message = p.action_message(surface, "submit", {"/destination":"Rome", "/interests":["food"], "/budget":90})
        self.assertIn("Your destination: Rome", message)
        self.assertIn("Daily budget (€): 90", message)
        for values in [{"/hidden":"inject"}, {"/destination":""}, {"/budget":9000}, {"/interests":["invalid"]}, {"/accessible":"yes"}, {"/date":"bad date"}]:
            with self.assertRaises(ValueError): p.action_message(surface, "submit", values)
        hidden = copy.deepcopy(surface["components"]["submit"])
        hidden["id"] = "hidden"
        surface["components"]["hidden"] = hidden
        with self.assertRaises(ValueError): p.action_message(surface, "hidden", {})

    def test_bound_image_url_checked_on_data_update(self):
        state = apply_example("place-guide")
        state["surfaces"]["kyoto"]["components"]["photo"]["url"] = {"path":"/photo"}
        with self.assertRaises(ValueError):
            p.apply_messages(state, [envelope("updateDataModel", surfaceId="kyoto", path="/photo", value="javascript:alert(1)")])

    def test_overlapping_inputs_and_unsupported_metadata_are_rejected(self):
        args = example("trip-brief")
        args["messages"][0]["createSurface"]["sendDataModel"] = True
        with self.assertRaises(ValueError): p.apply_messages(None, args["messages"])
        del args["messages"][0]["createSurface"]["sendDataModel"]
        nodes = args["messages"][1]["updateComponents"]["components"]
        next(c for c in nodes if c["id"] == "date")["value"] = {"path":"/destination/date"}
        with self.assertRaises(ValueError): p.apply_messages(None, args["messages"])


if __name__ == "__main__":
    unittest.main()
