"""kgb-beacon: tiny analytics sink. Events land in Cloud Logging as JSON
(one line per event); query with: resource.type=cloud_run_revision AND
jsonPayload.kgb=true. No cookies, no third parties, ~free."""
import json

from flask import Flask, request

app = Flask(__name__)


@app.post("/e")
def event():
    try:
        p = json.loads(request.get_data(as_text=True) or "{}")
    except Exception:  # noqa: BLE001
        p = {}
    print(json.dumps({
        "kgb": True,
        "e": str(p.get("e", ""))[:40],
        "sid": str(p.get("sid", ""))[:24],
        "path": str(p.get("path", ""))[:120],
        "p": p.get("p") if isinstance(p.get("p"), dict) else {},
        "ua": (request.user_agent.string or "")[:120],
    }), flush=True)
    resp = app.response_class(status=204)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.get("/")
def ok():
    return "ok"
