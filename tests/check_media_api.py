"""Run in Agent Zero's framework: PYTHONPATH=/a0 python tests/check_media_api.py."""

import asyncio
from pathlib import Path
import tempfile
import threading

from flask import Flask, request
from helpers import files
from usr.plugins.a2ui_zero.api.media import Media


async def check():
    app = Flask(__name__)
    handler = Media(app, threading.Lock())
    with tempfile.TemporaryDirectory(dir=files.get_abs_path("tmp"), prefix="a2ui-media-") as directory:
        path = Path(directory) / "sample.mp4"
        path.write_bytes(bytes(range(256)))
        cases = [({}, 200, 256), ({"Range": "bytes=2-9"}, 206, 8), ({"Range": "bytes=999-"}, 416, None)]
        for headers, status, size in cases:
            with app.test_request_context("/api/plugins/a2ui_zero/media", query_string={"path": str(path)}, headers=headers):
                response = await handler.handle_request(request)
                assert response.status_code == status, (status, response.get_data(as_text=True))
                response.direct_passthrough = False
                if size is not None:
                    assert len(response.get_data()) == size
                if status == 206:
                    assert response.headers["Content-Range"] == "bytes 2-9/256"
                    assert response.get_data() == bytes(range(2, 10))
                response.close()
    print("Media API full, partial and unsatisfiable range checks passed")


if __name__ == "__main__":
    asyncio.run(check())
