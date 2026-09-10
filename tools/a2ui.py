import copy
import json

from helpers.errors import RepairableException
from helpers.tool import Response, Tool
from usr.plugins.a2ui_zero.helpers.protocol import STATE_KEY, apply_messages


class A2UI(Tool):
    async def before_execution(self, **kwargs):
        pass

    async def execute(self, action="show", messages=None, text="", title="", **kwargs):
        if kwargs:
            raise RepairableException("Unsupported a2ui arguments: " + ", ".join(sorted(kwargs)))
        state = self.agent.context.get_data(STATE_KEY)
        if action == "inspect":
            return Response(message=json.dumps(state or {"revision": 0, "surfaces": {}}, ensure_ascii=False), break_loop=False)
        if action != "show":
            raise RepairableException("a2ui supports show or inspect")
        if not isinstance(text, str) or not text.strip() or len(text) > 12000:
            raise RepairableException("a2ui show requires a short, non-empty text fallback")
        try:
            result, changed, deleted = apply_messages(state, messages, title)
        except (ValueError, TypeError) as exc:
            raise RepairableException(str(exc)) from exc
        self.agent.context.set_data(STATE_KEY, result)
        payload = {"context_id": self.agent.context.id, "revision": result["revision"],
                   "surfaces": {sid: copy.deepcopy(result["surfaces"][sid]) for sid in changed},
                   "deleted": deleted}
        self.log = self.agent.context.log.log(
            type="response", heading=title or "a2ui-zero", content=text,
            kvps={STATE_KEY: payload}, finished=True,
        )
        return Response(message=text, break_loop=True)

    async def after_execution(self, response, **kwargs):
        # Retain the tool result for subsequent choices and non-WebUI clients.
        self.agent.hist_add_tool_result(self.name, response.message)
