#!/usr/bin/env python3
"""Test scraping YouTube search results."""
import urllib.request
import re
import json
import sys

query = sys.argv[1] if len(sys.argv) > 1 else "lofi music"
url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"

req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})

with urllib.request.urlopen(req, timeout=20) as r:
    html = r.read().decode("utf-8", errors="replace")

print(f"HTML length: {len(html)}")

# Extract ytInitialData JSON
m = re.search(r'ytInitialData"\]\s*=\s*(\{.*?\});', html)
if not m:
    m = re.search(r'var\s+ytInitialData\s*=\s*(\{.*?\});', html)
if not m:
    print("Could not find ytInitialData")
    sys.exit(1)

raw = m.group(1)
print(f"ytInitialData length: {len(raw)}")

try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    print(f"JSON parse error: {e}")
    # Try to find where it fails
    print(f"Around position {e.pos}: ...{raw[max(0,e.pos-50):e.pos+50]}...")
    sys.exit(1)

# Walk the JSON tree looking for videoRenderer objects
def find_video_renderers(obj, results=None):
    if results is None:
        results = []
    if isinstance(obj, dict):
        if "videoRenderer" in obj:
            results.append(obj["videoRenderer"])
        for v in obj.values():
            find_video_renderers(v, results)
    elif isinstance(obj, list):
        for v in obj:
            find_video_renderers(v, results)
    return results

videos = find_video_renderers(data)
print(f"\nFound {len(videos)} video renderers\n")

for i, v in enumerate(videos[:10]):
    try:
        video_id = v.get("videoId", "")
        title = v.get("title", {}).get("runs", [{}])[0].get("text", "")
        channel = v.get("ownerText", {}).get("runs", [{}])[0].get("text", "") or \
                  v.get("shortBylineText", {}).get("runs", [{}])[0].get("text", "")
        views = v.get("viewCountText", {}).get("simpleText", "") or \
                v.get("viewCountText", {}).get("runs", [{}])[0].get("text", "")
        uploaded = v.get("publishedTimeText", {}).get("simpleText", "")
        duration = v.get("lengthText", {}).get("simpleText", "") or \
                   v.get("lengthText", {}).get("accessibility", {}).get("accessibilityData", {}).get("label", "")
        thumbnail = v.get("thumbnail", {}).get("thumbnails", [{}])[-1].get("url", "")
        print(f"{i+1}. {title}")
        print(f"   ID: {video_id}")
        print(f"   Channel: {channel}")
        print(f"   Views: {views} | Uploaded: {uploaded} | Duration: {duration}")
        print()
    except Exception as e:
        print(f"  Error parsing video {i}: {e}")
