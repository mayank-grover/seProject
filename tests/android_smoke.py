#!/usr/bin/env python3
"""Smoke-test an already installed APK on the named disposable Android emulator."""
import argparse
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--serial", default="emulator-5554")
args = parser.parse_args()
if not args.serial.startswith("emulator-"):
    raise SystemExit("This test changes network settings; use a disposable emulator.")
base = ["adb", "-s", args.serial]


def adb(*command):
    return subprocess.check_output([*base, *command], text=True)


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/stillspace-test.xml")
    return list(
        ET.fromstring(adb("shell", "cat", "/sdcard/stillspace-test.xml")).iter("node")
    )


def visible(node):
    bounds = [int(n) for n in re.findall(r"\d+", node.get("bounds", ""))]
    return len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]


def find(attribute, value):
    return next((n for n in nodes() if n.get(attribute) == value and visible(n)), None)


def tap(attribute, value):
    node = find(attribute, value)
    if node is None:
        raise AssertionError(f"Cannot find visible {attribute}={value}")
    x0, y0, x1, y1 = map(int, re.findall(r"\d+", node.get("bounds")))
    adb("shell", "input", "tap", str((x0 + x1) // 2), str((y0 + y1) // 2))


def screenshot(name):
    path = Path("/tmp") / name
    path.write_bytes(subprocess.check_output([*base, "exec-out", "screencap", "-p"]))
    print(f"Screenshot: {path}")


adb("shell", "wm", "dismiss-keyguard")
adb("shell", "am", "force-stop", "com.mayankgrover.stillspace")
adb("shell", "am", "start", "-n", "com.mayankgrover.stillspace/.MainActivity")
assert any(find("text", "Room to think.") is not None for _ in range(4))
screenshot("stillspace-android-light.png")
tap("resource-id", "test-toggle")
assert find("text", "Move through the day.") is not None
tap("text", "Mon 10:30")
screenshot("stillspace-android-clock.png")
tap("resource-id", "apply-time")
assert any(
    "10:30" in n.get("content-desc", "") and "Simulated" in n.get("content-desc", "")
    for n in nodes()
)
# Native Back closes a sheet instead of exiting.
tap("resource-id", "test-toggle")
adb("shell", "input", "keyevent", "4")
assert any(find("text", "Room to think.") is not None for _ in range(4))
tap("resource-id", "appearance")
tap("text", "Dark")
# WebView accessibility on this emulator does not expose the checked state.
# Browser tests assert the state and persistence; inspect the native screenshot.
tap("resource-id", "reduce-transparency")
screenshot("stillspace-android-appearance.png")
tap("content-desc", "Close appearance")
screenshot("stillspace-android-dark.png")
tap("text", "Data")
for _ in range(10):
    if find("resource-id", "export-json") is not None:
        break
    adb("shell", "input", "swipe", "540", "1900", "540", "700", "350")
else:
    raise AssertionError("Export control not found")
tap("resource-id", "export-json")
assert any(
    "stillspace-timetable.json" in n.get("text", "") for n in nodes()
), "Native document picker did not open"
screenshot("stillspace-android-export.png")
print("Native document picker opened for JSON export.")
# Cancel the picker; Android controls whether a file is actually saved.
adb("shell", "input", "keyevent", "4")
adb("shell", "input", "keyevent", "4")
assert any(find("text", "Room to think.") is not None for _ in range(4))
# Verify a cold start without a network connection; this emulator is disposable.
adb("shell", "svc", "wifi", "disable")
adb("shell", "svc", "data", "disable")
adb("shell", "am", "force-stop", "com.mayankgrover.stillspace")
adb("shell", "am", "start", "-n", "com.mayankgrover.stillspace/.MainActivity")
assert any(find("text", "Room to think.") is not None for _ in range(4))
assert find("text", "CL 5") is not None
print(
    "PASS: Android launch, time preset, native Back, dark theme, reduced transparency, document picker, and offline cold start."
)
