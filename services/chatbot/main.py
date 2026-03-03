import os
import json
from typing import AsyncGenerator, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials
from botocore.session import get_session
from urllib.parse import urlparse
from urllib.parse import urlsplit, urlunsplit, quote

app = FastAPI()


def _get_env(name: str, default: Optional[str] = None) -> str:
    val = os.getenv(name)
    if val is None or val == "":
        if default is None:
            raise RuntimeError(f"Missing required env var: {name}")
        return default
    return val


def _get_aws_credentials() -> Credentials:
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    session_token = os.getenv("AWS_SESSION_TOKEN")

    if access_key and secret_key:
        return Credentials(access_key, secret_key, session_token)

    session = get_session()
    creds = session.get_credentials()
    if creds is None:
        raise RuntimeError("Missing AWS credentials. Provide them via environment variables or the default AWS credential chain.")
    frozen = creds.get_frozen_credentials()
    return Credentials(frozen.access_key, frozen.secret_key, frozen.token)


def _sign_headers(url: str, body: str, region: str) -> dict:
    credentials = _get_aws_credentials()

    req = AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers={
            "Content-Type": "application/json",
        },
    )

    SigV4Auth(credentials, "bedrock", region).add_auth(req)

    signed = dict(req.headers)
    out = {
        "Content-Type": "application/json",
        "Authorization": signed.get("Authorization"),
        "X-Amz-Date": signed.get("X-Amz-Date"),
    }
    token = signed.get("X-Amz-Security-Token")
    if token:
        out["X-Amz-Security-Token"] = token

    return {k: v for k, v in out.items() if v is not None}


def _encode_url_path(url: str) -> str:
    parts = urlsplit(url)
    encoded_path = quote(parts.path, safe="/-_.~")
    return urlunsplit((parts.scheme, parts.netloc, encoded_path, parts.query, parts.fragment))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat/stream")
async def chat_stream(
    request: Request,
    x_api_token: Optional[str] = Header(default=None, alias="X-API-Token"),
):
    expected_token = _get_env("CHATBOT_API_TOKEN", "200")
    token = x_api_token
    if token is None:
        token = request.headers.get("x_api_token")

    if token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = await request.json()
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        raise HTTPException(status_code=400, detail="Missing message")

    gateway_url = _get_env(
        "BEDROCK_GATEWAY_URL",
        "https://us.gateway.aidefense.security.cisco.com/fe399c8a-8aa7-41a9-b64e-a6a8a04ab49f/connections/5bf35e34-c75f-40b8-bae0-d0083e39cbcc/model/us.anthropic.claude-sonnet-4-20250514-v1:0/converse-stream",
    )
    aws_sign_url = _get_env(
        "BEDROCK_AWS_SIGN_URL",
        "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/converse-stream",
    )
    region = _get_env("AWS_REGION", "us-east-1")

    body_obj = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": message}],
            }
        ]
    }
    body = json.dumps(body_obj)
    signing_url = _encode_url_path(aws_sign_url)
    headers = _sign_headers(signing_url, body, region)
    headers["x-amzn-bedrock-accept-type"] = "application/json"

    async def gen() -> AsyncGenerator[bytes, None]:
        timeout = httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", gateway_url, content=body, headers=headers) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    yield f"event: error\ndata: upstream_status={resp.status_code} body={err.decode(errors='ignore')}\n\n".encode()
                    return

                async for chunk in resp.aiter_bytes():
                    if not chunk:
                        continue
                    text = chunk.decode(errors="ignore")
                    for line in text.splitlines():
                        if line.strip() == "":
                            continue
                        yield f"data: {line}\n\n".encode()

    return StreamingResponse(gen(), media_type="text/event-stream")
