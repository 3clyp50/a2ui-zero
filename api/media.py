"""Inline media streaming inspired by keyboardstaff/attachment_preview (see LICENSE)."""

from helpers.api import ApiHandler, Request, Response, send_file
from helpers import files
from helpers.plugins import get_enabled_plugins
from usr.plugins.a2ui_zero.helpers.protocol import MEDIA_TYPES, resolve_media_path
from werkzeug.exceptions import HTTPException


class Media(ApiHandler):
    @classmethod
    def get_methods(cls):
        return ["GET", "HEAD"]

    async def process(self, input: dict, request: Request):
        if "a2ui_zero" not in get_enabled_plugins(None):
            return Response("a2ui-zero is disabled", status=403)
        try:
            path = resolve_media_path(request.args.get("path", ""), files.get_base_dir())
        except ValueError as exc:
            return Response(str(exc), status=400, mimetype="text/plain")
        if not path.is_file():
            return Response("Media file not found", status=404, mimetype="text/plain")
        mime = MEDIA_TYPES.get(path.suffix.lower())
        if not mime:
            return Response("Unsupported media file type", status=415)
        try:
            response = send_file(path, mimetype=mime, as_attachment=False, conditional=True)
        except HTTPException as exc:
            return Response(exc.get_description(), status=exc.code, headers=exc.get_headers())
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'"
        if path.suffix.lower() == ".svgz":
            response.headers["Content-Encoding"] = "gzip"
        return response
