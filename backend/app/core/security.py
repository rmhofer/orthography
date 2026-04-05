from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


def _sign(data: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), data.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def issue_admin_token(secret: str, ttl_seconds: int = 60 * 60 * 12) -> str:
    payload = {"issuedAt": int(time.time()), "expiresAt": int(time.time()) + ttl_seconds, "scope": "admin"}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    signature = _sign(encoded, secret)
    return f"{encoded}.{signature}"


def verify_admin_token(token: str, secret: str) -> dict | None:
    try:
        encoded, signature = token.split(".", 1)
        if not hmac.compare_digest(signature, _sign(encoded, secret)):
            return None
        payload = json.loads(base64.urlsafe_b64decode(f"{encoded}==".encode("utf-8")).decode("utf-8"))
        if payload["scope"] != "admin" or payload["expiresAt"] < int(time.time()):
            return None
        return payload
    except Exception:
        return None
