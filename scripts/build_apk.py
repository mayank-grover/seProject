#!/usr/bin/env python3
"""Build and copy the signed offline Android APK using the Gradle wrapper."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
if not (root / ".android-signing/signing.properties").is_file():
    raise SystemExit("First run: python3 scripts/create_signing_key.py")
env = dict(os.environ)
if sys.platform == "darwin" and not env.get("JAVA_HOME"):
    env["JAVA_HOME"] = subprocess.check_output(
        ["/usr/libexec/java_home", "-v", "17"], text=True
    ).strip()
if not env.get("ANDROID_HOME") and not env.get("ANDROID_SDK_ROOT"):
    sdk = Path.home() / (
        "Library/Android/sdk" if sys.platform == "darwin" else "Android/Sdk"
    )
    if sdk.is_dir():
        env["ANDROID_HOME"] = str(sdk)
wrapper = "gradlew.bat" if os.name == "nt" else "./gradlew"
subprocess.run(
    [wrapper, "assembleRelease", "--no-daemon"],
    cwd=root / "android",
    env=env,
    check=True,
)
source = root / "android/app/build/outputs/apk/release/app-release.apk"
output = root / "output/apk"
output.mkdir(parents=True, exist_ok=True)
artifact = output / "stillspace-0.2.0.apk"
shutil.copy2(source, artifact)
digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
(output / "SHA256SUMS.txt").write_text(f"{digest}  {artifact.name}\n")
print(f"APK: {artifact}\nSHA-256: {digest}")
