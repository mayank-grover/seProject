#!/usr/bin/env python3
"""Create a persistent local Android release key. Never commit .android-signing/."""
import os
from pathlib import Path
import secrets
import subprocess

root = Path(__file__).resolve().parents[1]
folder = root / ".android-signing"
folder.mkdir(mode=0o700, exist_ok=True)
key = folder / "stillspace-release.jks"
properties = folder / "signing.properties"
if key.exists() or properties.exists():
    raise SystemExit("A signing key already exists. It has been preserved.")
password = secrets.token_urlsafe(32)
env = {**os.environ, "STILLSPACE_KEY_PASSWORD": password}
subprocess.run(
    [
        "keytool",
        "-genkeypair",
        "-keystore",
        str(key),
        "-storetype",
        "JKS",
        "-storepass:env",
        "STILLSPACE_KEY_PASSWORD",
        "-keypass:env",
        "STILLSPACE_KEY_PASSWORD",
        "-alias",
        "stillspace",
        "-keyalg",
        "RSA",
        "-keysize",
        "3072",
        "-validity",
        "10000",
        "-dname",
        "CN=Stillspace Release, O=Stillspace, C=IN",
        "-noprompt",
    ],
    env=env,
    check=True,
)
key.chmod(0o600)
properties.write_text(
    f"storePassword={password}\nkeyPassword={password}\nkeyAlias=stillspace\n"
)
properties.chmod(0o600)
print(
    "Release signing key created in .android-signing/. Keep a private backup of this folder."
)
