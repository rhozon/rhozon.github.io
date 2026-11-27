"""Update the CV credential cards from the verified public credential inventory.

Run from any directory: python scripts/sync_certifications.py
Then render cv.qmd with the project's Quarto workflow.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
records = json.loads((ROOT / "data/certifications.json").read_text(encoding="utf-8"))
ids = [record["credential_id"] for record in records]
if len(ids) != len(set(ids)):
    raise ValueError("Duplicate credential IDs in inventory")

path = ROOT / "cv.qmd"
text = path.read_text(encoding="utf-8")
start = text.index("<!-- Recent credentials verified")
end_marker = "<!-- END RECENT CREDENTIALS -->"
end = text.index(end_marker, start) + len(end_marker)
cards = ["<!-- Recent credentials verified 2026-11-27; records: data/certifications.json -->"]
for record in records:
    # The existing CV already has the earlier ETL certificate card.
    if record["issued"] < "2026-01":
        continue
    name = html.escape(record["name"])
    metadata = html.escape(record["issuer"] + " · " + record["issued"])
    url = html.escape(record["url"], quote=True)
    cards.append(
        '<div class="certification-item">\n'
        '  <div class="cert-info">\n'
        f'    <strong>{name}</strong><br>\n'
        f'    <span>{metadata}</span><br>\n'
        f'    <a href="{url}" target="_blank" rel="noopener noreferrer">View credential</a>\n'
        '  </div>\n</div>\n'
    )
cards.append(end_marker)
path.write_text(text[:start] + "\n".join(cards) + text[end:], encoding="utf-8")
print(f"Updated {len(cards) - 2} recent credential cards from {len(records)} records.")
