from agent import AgentContext
from helpers.api import ApiHandler, Request, Response
from helpers.plugins import get_enabled_plugins
from usr.plugins.a2ui_zero.helpers.protocol import STATE_KEY, action_message


class Surfaces(ApiHandler):
    async def process(self, input: dict, request: Request) -> dict | Response:
        identifiers = ("action", "context_id", "surface_id", "component_id")
        if not isinstance(input, dict) or not all(isinstance(input.get(key, ""), str) for key in identifiers):
            return Response(status=400, response="Expected string action and identifiers")
        context = AgentContext.get(input.get("context_id", ""))
        if context is None:
            return Response(status=404, response="Chat not found")
        if "a2ui_zero" not in get_enabled_plugins(context.get_agent()):
            return Response(status=403, response="a2ui-zero is disabled")
        state = context.get_data(STATE_KEY) or {"revision": 0, "surfaces": {}}
        if input.get("action", "list") == "list":
            return {"context_id": context.id, **state}
        if input.get("action") != "prepare_action":
            return Response(status=400, response="Unknown action")
        if type(input.get("revision")) is not int:
            return Response(status=400, response="Expected a numeric revision")
        surface = state["surfaces"].get(input.get("surface_id", ""))
        if not surface or surface["revision"] != input.get("revision"):
            return Response(status=409, response="This view has changed. Use the latest response or reopen it in the canvas.")
        try:
            message = action_message(surface, input.get("component_id", ""), input.get("values", {}))
        except (ValueError, TypeError) as exc:
            return Response(status=400, response=str(exc))
        return {"message": message, "context_id": context.id}
