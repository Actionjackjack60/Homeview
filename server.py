#!/usr/bin/env python3
"""Serve Homeview and relay WebRTC signaling between devices on a local network."""

import argparse
import asyncio
import json
import logging
import mimetypes
import os
import socket
import ssl
import uuid
from http import HTTPStatus
from pathlib import Path
from urllib.parse import urlsplit

import websockets
from websockets.exceptions import ConnectionClosed


ROOT = Path(__file__).resolve().parent
ROOM_CODE_LENGTH = 8
ROOM_CODE_CHARACTERS = set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
SIGNAL_TYPES = {"offer", "answer", "ice"}
rooms = {}
port = 8000
lan_address = None
scheme = "https"


def default_certificate_paths():
    if os.name == "nt":
        config_root = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        config_root = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    certificate_dir = config_root / "Homeview" / "certs"
    return certificate_dir / "homeview.pem", certificate_dir / "homeview-key.pem"


def json_response(data, status=HTTPStatus.OK):
    body = json.dumps(data).encode("utf-8")
    return status, [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
    ], body


def process_request(path, request_headers):
    request_path = urlsplit(path).path
    is_websocket = request_headers.get("Upgrade", "").lower() == "websocket"
    if is_websocket:
        if request_path == "/signal":
            return None
        return HTTPStatus.NOT_FOUND, [], b"Not found"

    if request_path == "/api/info":
        return json_response({"address": lan_address, "port": port, "scheme": scheme})

    relative_path = "index.html" if request_path == "/" else request_path.lstrip("/")
    if relative_path not in {"index.html", "styles.css", "app.js", "config.js"}:
        return HTTPStatus.NOT_FOUND, [], b"Not found"

    file_path = ROOT / relative_path
    body = file_path.read_bytes()
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return HTTPStatus.OK, [
        ("Content-Type", content_type + ("; charset=utf-8" if content_type.startswith("text/") or content_type == "application/javascript" else "")),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-cache"),
        ("X-Content-Type-Options", "nosniff"),
    ], body


async def send_error(websocket, message):
    await websocket.send(json.dumps({"type": "error", "message": message}))


async def relay(websocket, client_id, room, message):
    target_id = message.get("target")
    payload = message.get("payload")
    if message.get("type") not in SIGNAL_TYPES or not isinstance(target_id, str) or not isinstance(payload, dict):
        await send_error(websocket, "Invalid signaling message.")
        return

    target = rooms.get(room, {}).get(target_id)
    if target is None:
        await send_error(websocket, "The other device is no longer connected.")
        return

    await target["socket"].send(json.dumps({
        "type": message["type"],
        "sender": client_id,
        "payload": payload,
    }))


async def handle_client(websocket, path):
    client_id = uuid.uuid4().hex
    room_code = None
    role = None

    try:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                await send_error(websocket, "Invalid message format.")
                continue

            if not isinstance(message, dict):
                await send_error(websocket, "Invalid message format.")
                continue

            if message.get("type") == "join":
                requested_room = message.get("room")
                requested_role = message.get("role")
                if room_code is not None:
                    await send_error(websocket, "This connection has already joined a cast.")
                    continue
                if (not isinstance(requested_room, str) or len(requested_room) != ROOM_CODE_LENGTH or
                        any(character not in ROOM_CODE_CHARACTERS for character in requested_room)):
                    await send_error(websocket, "Enter a valid 8-character cast code.")
                    continue
                if requested_role not in {"publisher", "viewer"}:
                    await send_error(websocket, "Invalid casting role.")
                    continue

                room = rooms.setdefault(requested_room, {})
                if requested_role == "publisher" and any(
                        peer["role"] == "publisher" for peer in room.values()):
                    await send_error(websocket, "That cast code is already in use.")
                    continue

                existing_peers = [
                    {"id": peer_id, "role": peer["role"]}
                    for peer_id, peer in room.items()
                ]
                room_code = requested_room
                role = requested_role
                room[client_id] = {"socket": websocket, "role": role}
                await websocket.send(json.dumps({
                    "type": "joined",
                    "id": client_id,
                    "peers": existing_peers,
                }))
                for peer in list(room.values()):
                    if peer["socket"] is websocket:
                        continue
                    try:
                        await peer["socket"].send(json.dumps({
                            "type": "peer-joined",
                            "peer": {"id": client_id, "role": role},
                        }))
                    except ConnectionClosed:
                        logging.info("Removed a disconnected peer while notifying room %s", room_code)
                continue

            if room_code is None:
                await send_error(websocket, "Join a cast room before sending messages.")
                continue
            await relay(websocket, client_id, room_code, message)
    finally:
        if room_code is not None:
            room = rooms.get(room_code, {})
            room.pop(client_id, None)
            if not room:
                rooms.pop(room_code, None)
            else:
                for peer in list(room.values()):
                    try:
                        await peer["socket"].send(json.dumps({
                            "type": "peer-left",
                            "peerId": client_id,
                        }))
                    except ConnectionClosed:
                        logging.info("Removed a disconnected peer while closing room %s", room_code)


def get_lan_address():
    connection = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        connection.connect(("192.0.2.1", 1))
        return connection.getsockname()[0]
    except OSError as error:
        raise RuntimeError("Could not determine this computer's local network address.") from error
    finally:
        connection.close()


async def main():
    global port, lan_address, scheme

    parser = argparse.ArgumentParser(description="Run Homeview on your local network.")
    parser.add_argument("--port", type=int, default=8000, help="HTTP and signaling port (default: 8000)")
    default_cert, default_key = default_certificate_paths()
    parser.add_argument("--cert", type=Path, default=default_cert, help="TLS certificate PEM file")
    parser.add_argument("--key", type=Path, default=default_key, help="TLS private key PEM file")
    parser.add_argument("--http", action="store_true", help="serve plain HTTP (LAN screen sharing will not work)")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    port = args.port
    ssl_context = None
    if args.http:
        scheme = "http"
    else:
        if not args.cert.is_file() or not args.key.is_file():
            parser.error(
                "TLS certificate or key not found. Create them with mkcert, or pass --http "
                "to serve without LAN screen sharing."
            )
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        try:
            ssl_context.load_cert_chain(args.cert, args.key)
        except (OSError, ssl.SSLError) as error:
            parser.error("Could not load the TLS certificate and key: " + str(error))
        scheme = "https"

    lan_address = get_lan_address()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.info("Homeview is available at %s://localhost:%d", scheme, port)
    logging.info("On other devices, use %s://%s:%d", scheme, lan_address, port)
    async with websockets.serve(
            handle_client,
            "0.0.0.0",
            port,
            process_request=process_request,
            ssl=ssl_context,
            max_size=65536):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Homeview stopped.")
