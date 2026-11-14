"""Comptes TerraShift : mot de passe hashé, jeton signé, base SQLite locale."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "users.sqlite"
SECRET_PATH = ROOT / "data" / "auth_secret"
ITERATIONS = 200_000
TOKEN_DAYS = 14

router = APIRouter(prefix="/api/auth")


class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: str
    password: str


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"""
    )
    return conn


def _secret() -> bytes:
    env = os.getenv("AUTH_SECRET", "").strip()
    if env:
        return env.encode()
    if SECRET_PATH.exists():
        return SECRET_PATH.read_bytes()
    SECRET_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw = secrets.token_hex(32).encode()
    SECRET_PATH.write_bytes(raw)
    return raw


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    _, digest = hash_password(password, bytes.fromhex(salt_hex))
    return hmac.compare_digest(digest, hash_hex)


def make_token(user_id: int, email: str) -> str:
    header = _b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64(json.dumps({"sub": user_id, "email": email, "exp": int(time.time()) + TOKEN_DAYS * 86400}).encode())
    signature = hmac.new(_secret(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64(signature)}"


def read_token(token: str) -> dict:
    try:
        header, payload, signature = token.split(".")
        expected = hmac.new(_secret(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64(signature), expected):
            raise ValueError("signature")
        data = json.loads(_unb64(payload))
        if int(data["exp"]) < time.time():
            raise ValueError("expired")
        return data
    except (ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(401, "Connexion expirée, reconnecte-toi")


def _user_from_header(authorization: str | None) -> sqlite3.Row:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Connexion requise")
    data = read_token(authorization.split(" ", 1)[1].strip())
    conn = _db()
    try:
        row = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (data["sub"],)).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(401, "Compte introuvable")
    return row


def _public(row: sqlite3.Row, token: str | None = None) -> dict:
    body = {"id": row["id"], "name": row["name"], "email": row["email"]}
    if token:
        body["token"] = token
    return body


@router.post("/register")
def register(body: RegisterBody):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "E-mail invalide")
    salt, digest = hash_password(body.password)
    conn = _db()
    try:
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (body.name.strip(), email, salt, digest, int(time.time())),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Un compte existe déjà avec cet e-mail")
        row = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    finally:
        conn.close()
    return _public(row, make_token(row["id"], row["email"]))


@router.post("/login")
def login(body: LoginBody):
    email = body.email.strip().lower()
    conn = _db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    finally:
        conn.close()
    if row is None or not verify_password(body.password, row["salt"], row["password_hash"]):
        raise HTTPException(401, "E-mail ou mot de passe incorrect")
    return _public(row, make_token(row["id"], row["email"]))


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return _public(_user_from_header(authorization))
