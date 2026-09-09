"""A2UI envelope validation and bounded, atomic per-chat surface state."""

import copy
import json
import math
import re
from datetime import date, datetime, time
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match
from referencing import Registry, Resource

CATALOG = "urn:a2ui-zero:catalog:1"
STATE_KEY = "a2ui_zero"
INPUTS = {"TextField", "CheckBox", "ChoicePicker", "DateTimeInput", "Slider"}
BAD_KEYS = {"__proto__", "prototype", "constructor"}
ID = re.compile(r"^[A-Za-z0-9_-]{1,48}$")
MISSING = object()
MEDIA_TYPES = {
    **dict.fromkeys((".jpg", ".jpeg"), "image/jpeg"),
    ".png": "image/png", ".apng": "image/apng", ".gif": "image/gif",
    ".bmp": "image/bmp", ".webp": "image/webp", ".avif": "image/avif",
    ".svg": "image/svg+xml", ".svgz": "image/svg+xml", ".ico": "image/x-icon",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".mov": "video/quicktime",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac",
    ".aac": "audio/aac", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".opus": "audio/ogg",
}
MEDIA_ROUTES = {"/api/image_get", "/api/download_work_dir_file", "/api/plugins/a2ui_zero/media"}


def media_path(value):
    """Accept explicit Agent Zero file references, never arbitrary API routes."""
    if not isinstance(value, str) or len(value) > 4000 or any(ord(c) < 32 for c in value) or "\\" in value:
        raise ValueError("Invalid media source")
    if value.startswith("/a0/"):
        path = value
    else:
        parsed = urlsplit(value)
        if parsed.scheme in ("file", "img") and not parsed.netloc and not parsed.query and not parsed.fragment:
            path = unquote(parsed.path)
        elif not parsed.scheme and not parsed.netloc and parsed.path in MEDIA_ROUTES:
            query = parse_qs(parsed.query)
            if set(query) - {"path", "t"} or len(query.get("path", [])) != 1:
                raise ValueError("Invalid media file URL")
            path = query["path"][0]
        else:
            return None
    if not path.startswith("/a0/") or any(part in (".", "..") for part in path.split("/")) or "\\" in path or any(ord(c) < 32 for c in path):
        raise ValueError("Media files must be inside /a0")
    if Path(path).suffix.lower() not in MEDIA_TYPES:
        raise ValueError("Unsupported media file type")
    return path


def resolve_media_path(value, base_dir):
    path = media_path(value)
    if path is None:
        raise ValueError("Expected an Agent Zero media file")
    base = Path(base_dir).resolve()
    resolved = (base / path.removeprefix("/a0/")).resolve()
    if not resolved.is_relative_to(base):
        raise ValueError("Media file is outside Agent Zero")
    return resolved


def safe_media_url(value):
    if media_path(value) is None:
        safe_url(value)
    return value


@lru_cache
def validator():
    folder = Path(__file__).resolve().parents[1] / "schema"
    schemas = {name: json.loads((folder / name).read_text()) for name in
               ("server_to_client.json", "common_types.json", "catalog.json")}
    base = "https://a2ui.org/specification/v0_9/"
    registry = Registry().with_resources(
        (base + name, Resource.from_contents(schema)) for name, schema in schemas.items()
    ).with_resource(CATALOG, Resource.from_contents(schemas["catalog.json"]))
    return Draft202012Validator(schemas["server_to_client.json"], registry=registry)


def bounded(value, depth=0):
    if depth > 24:
        raise ValueError("UI data is nested too deeply")
    if isinstance(value, dict):
        for key, item in value.items():
            if key in BAD_KEYS or len(key) > 60:
                raise ValueError("Unsupported data key")
            bounded(item, depth + 1)
    elif isinstance(value, list):
        if len(value) > 256:
            raise ValueError("UI lists are limited to 256 items")
        for item in value:
            bounded(item, depth + 1)
    elif isinstance(value, str) and len(value) > 4000:
        raise ValueError("UI text is limited to 4000 characters per value")
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValueError("UI numbers must be finite")


def pointer(path):
    if not isinstance(path, str) or (path and not path.startswith("/")):
        raise ValueError("Data paths must be JSON Pointers")
    if re.search(r"~(?![01])", path):
        raise ValueError("Invalid JSON Pointer escape")
    parts = [] if path in ("", "/") else [p.replace("~1", "/").replace("~0", "~") for p in path[1:].split("/")]
    if len(parts) > 16 or any(p in BAD_KEYS or len(p) > 60 for p in parts):
        raise ValueError("Unsupported data path")
    return parts


def read(data, path):
    for key in pointer(path):
        try:
            data = data[int(key)] if isinstance(data, list) else data[key]
        except (KeyError, IndexError, TypeError, ValueError):
            return None
    return data


def write(data, path, value=MISSING):
    parts = pointer(path)
    if not parts:
        return {} if value is MISSING else copy.deepcopy(value)
    target = data
    for key in parts[:-1]:
        if isinstance(target, list):
            if not key.isdigit() or int(key) >= len(target):
                raise ValueError("Array data path is out of bounds")
            target = target[int(key)]
        elif isinstance(target, dict):
            target = target.setdefault(key, {})
        else:
            raise ValueError("Data path crosses a scalar")
    key = parts[-1]
    if isinstance(target, list):
        if not key.isdigit() or int(key) >= len(target):
            raise ValueError("Array data path is out of bounds")
        if value is MISSING:
            del target[int(key)]
        else:
            target[int(key)] = copy.deepcopy(value)
    elif isinstance(target, dict):
        if value is MISSING:
            target.pop(key, None)
        else:
            target[key] = copy.deepcopy(value)
    else:
        raise ValueError("Data path crosses a scalar")
    return data


def resolve(value, data):
    return read(data, value["path"]) if isinstance(value, dict) and "path" in value else value


def safe_url(value):
    if not isinstance(value, str) or not value or any(ord(c) < 33 for c in value) or "\\" in value:
        raise ValueError("Images and links need a valid HTTP(S) URL or local plugin asset")
    if value.startswith("/plugins/a2ui_zero/") and ".." not in value and "%" not in value:
        return value
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Only HTTP(S) image and link URLs are supported")
    return value


def validate_surface(surface):
    components = surface["components"]
    if len(components) > 160:
        raise ValueError("A surface supports at most 160 components")
    visits = 0
    input_paths = []

    def walk(key, ancestors):
        nonlocal visits
        visits += 1
        if visits > 512 or len(ancestors) > 24 or key in ancestors:
            raise ValueError("Component graph has a cycle or is too large")
        component = components.get(key)
        if component is None:  # A2UI permits references arriving in later messages.
            return
        for child in component.get("children", []) + ([component["child"]] if "child" in component else []):
            walk(child, ancestors | {key})

    for component in components.values():
        if not ID.fullmatch(component["id"]) or component["id"] in BAD_KEYS:
            raise ValueError("Component IDs use 1–48 letters, digits, underscores or hyphens")
        kind = component["component"]
        for value in component.values():
            if isinstance(value, dict) and "path" in value:
                pointer(value["path"])
        if kind in ("Image", "Audio", "Video", "Link"):
            url = resolve(component["url"], surface["data"])
            if url is not None:
                (safe_url if kind == "Link" else safe_media_url)(url)
        if kind == "Video" and "poster" in component:
            poster = resolve(component["poster"], surface["data"])
            if poster is not None:
                safe_media_url(poster)
        if kind in INPUTS and not pointer(component["value"]["path"]):
            raise ValueError("Inputs must bind to a field, not the entire data model")
        if kind in INPUTS:
            path = pointer(component["value"]["path"])
            if any(path[:len(other)] == other or other[:len(path)] == path for other in input_paths):
                raise ValueError("Input fields must use distinct, non-overlapping data paths")
            input_paths.append(path)
            write(copy.deepcopy(surface["data"]), component["value"]["path"], None)
        if kind == "Slider" and component["min"] >= component["max"]:
            raise ValueError("Slider min must be less than max")
        if kind == "Button":
            if not component["action"]["event"]["context"]["message"].strip():
                raise ValueError("Choice messages cannot be blank")
            label = components.get(component["child"])
            if label and label["component"] != "Text":
                raise ValueError("Button child must be Text")
    # Check disconnected definitions too, before a later update makes them visible.
    for key in components:
        visits = 0
        walk(key, set())


def visible_components(surface):
    found = {}
    def visit(key):
        component = surface["components"].get(key)
        if not component or key in found:
            return
        found[key] = component
        for child in component.get("children", []) + ([component["child"]] if "child" in component else []):
            visit(child)
    visit("root")
    return found


def apply_messages(state, messages, title="", placement="chat"):
    if not isinstance(messages, list) or not 1 <= len(messages) <= 64:
        raise ValueError("messages must contain 1–64 A2UI envelopes")
    if placement not in ("chat", "canvas"):
        raise ValueError("placement must be chat or canvas")
    if not isinstance(title, str) or len(title) > 120:
        raise ValueError("title must be at most 120 characters")
    bounded(messages)
    if len(json.dumps(messages).encode()) > 200_000:
        raise ValueError("A UI update must be smaller than 200 KB")
    result = copy.deepcopy(state or {"revision": 0, "surfaces": {}})
    result["revision"] += 1
    changed, deleted = set(), set()
    for message in messages:
        errors = list(validator().iter_errors(message))
        if errors:
            detail = best_match(errors)
            path = "/".join(map(str, detail.absolute_path))
            raise ValueError(f"Invalid A2UI at /{path}: {detail.message[:500]}")
        if message["version"] != "v0.9.1":
            raise ValueError("Use A2UI version v0.9.1")
        kind = next(k for k in message if k != "version")
        payload = message[kind]
        sid = payload["surfaceId"]
        if not ID.fullmatch(sid) or sid in BAD_KEYS:
            raise ValueError("surfaceId uses 1–48 letters, digits, underscores or hyphens")
        surfaces = result["surfaces"]
        if kind == "createSurface":
            if payload["catalogId"] != CATALOG:
                raise ValueError("Use catalogId " + CATALOG)
            if payload.get("sendDataModel"):
                raise ValueError("This transport sends visible form fields as user messages; omit sendDataModel")
            if sid in surfaces:
                raise ValueError("Surface already exists; update it or delete before recreating")
            surfaces[sid] = {"id": sid, "components": {}, "data": {}, "title": title or sid,
                             "placement": placement, "sendDataModel": payload.get("sendDataModel", False)}
            deleted.discard(sid)
        elif sid not in surfaces:
            raise ValueError("Unknown surface: " + sid)
        if kind == "deleteSurface":
            del surfaces[sid]
            changed.discard(sid)
            deleted.add(sid)
            continue
        surface = surfaces[sid]
        if title:
            surface["title"] = title
        if kind == "updateComponents":
            ids = [c["id"] for c in payload["components"]]
            if len(set(ids)) != len(ids):
                raise ValueError("Duplicate component ID in update")
            surface["components"].update((c["id"], copy.deepcopy(c)) for c in payload["components"])
        elif kind == "updateDataModel":
            surface["data"] = write(surface["data"], payload.get("path", "/"), payload.get("value", MISSING))
        surface["revision"] = result["revision"]
        changed.add(sid)
    if len(result["surfaces"]) > 16 or len(json.dumps(result).encode()) > 500_000:
        raise ValueError("A chat supports up to 16 surfaces and 500 KB of UI state")
    for sid in changed:
        validate_surface(result["surfaces"][sid])
    return result, sorted(changed), sorted(deleted)


def action_message(surface, component_id, values):
    """Accept edits to declared input fields; derive the message from saved UI."""
    if not isinstance(values, dict):
        raise ValueError("Form values must be an object")
    bounded(values)
    components = visible_components(surface)
    component = components.get(component_id, {})
    if component.get("component") != "Button":
        raise ValueError("Unknown choice")
    fields = {c["value"]["path"]: c for c in components.values() if c["component"] in INPUTS}
    if values.keys() - fields.keys():
        raise ValueError("An undeclared form field was submitted")
    lines = [component["action"]["event"]["context"]["message"]]
    for path, field in fields.items():
        value = values.get(path, read(surface["data"], path))
        kind = field["component"]
        if value is None:
            value = field["min"] if kind == "Slider" else False if kind == "CheckBox" else [] if kind == "ChoicePicker" else ""
        if field.get("required") and (value is None or value == "" or value == []):
            raise ValueError(field["label"] + " is required")
        if kind == "CheckBox":
            valid = isinstance(value, bool)
        elif kind == "Slider":
            valid = type(value) in (int, float) and field["min"] <= value <= field["max"]
        elif kind == "ChoicePicker":
            options = {o["value"] for o in field["options"]}
            valid = isinstance(value, list) and all(isinstance(v, str) and v in options for v in value)
            valid = valid and (field.get("variant") == "multipleSelection" or len(value) <= 1)
        else:
            valid = isinstance(value, str) and len(value) <= 4000
            if valid and value and kind == "TextField" and field.get("variant") == "number":
                try:
                    valid = math.isfinite(float(value))
                except ValueError:
                    valid = False
            if valid and value and kind == "DateTimeInput":
                parser = (time if field.get("enableDate") is False else datetime) if field.get("enableTime") else date
                try:
                    parser.fromisoformat(value)
                except ValueError:
                    valid = False
        if not valid:
            raise ValueError("Invalid value for " + field["label"])
        display = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
        lines.append(field["label"] + ": " + display)
    message = "\n".join(lines)
    if len(message) > 12000:
        raise ValueError("Submitted form is too long")
    return message
