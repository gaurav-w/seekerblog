"""Create the static reader pages for Bhagavad Gita chapters 11 through 18."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "gita" / "10" / "index.html"

CHAPTERS = {
    11: ("विश्वरूपदर्शनयोग", "The yoga of the vision of the universal form", 55, "2bmRapKPFeI"),
    12: ("भक्तियोग", "The yoga of devotion", 20, "TLX3S-BD5vk"),
    13: ("क्षेत्रक्षेत्रज्ञविभागयोग", "The yoga of the distinction between the field and its knower", 34, "nPqpIg4dIpc"),
    14: ("गुणत्रयविभागयोग", "The yoga of the division of the three gunas", 27, "MaAYGYjbpaw"),
    15: ("पुरुषोत्तमयोग", "The yoga of the supreme person", 20, "cEsJL3jqTOM"),
    16: ("दैवासुरसम्पद्विभागयोग", "The yoga of the division between divine and demonic qualities", 24, "6avQjcWU0Io"),
    17: ("श्रद्धात्रयविभागयोग", "The yoga of the threefold faith", 28, "NJkdl9kon4k"),
    18: ("मोक्षसंन्यासयोग", "The yoga of liberation through renunciation", 78, "FIK-Hm62_xc"),
}


def main() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    for chapter, (name, subtitle, count, video_id) in CHAPTERS.items():
        page = template
        devanagari_chapter = str(chapter).translate(str.maketrans("0123456789", "०१२३४५६७८९"))
        page = page.replace("अध्याय १०", f"अध्याय {devanagari_chapter}")
        page = page.replace("CHAPTER 10", f"CHAPTER {chapter}")
        page = page.replace("विभूतियोग", name)
        page = page.replace("The yoga of divine manifestations", subtitle)
        page = page.replace("all 42 shlokas of Bhagavad Gita Chapter 10", f"all {count} shlokas of Bhagavad Gita Chapter {chapter}")
        page = page.replace("42 shlokas · Sanskrit recitation", f"{count} shlokas · Sanskrit recitation")
        page = page.replace("/gita/10/", f"/gita/{chapter}/")
        page = page.replace('data-gita-chapter="10"', f'data-gita-chapter="{chapter}"')
        page = page.replace("/ 42</span>", f"/ {count}</span>")
        page = page.replace("DMSwDB2476A", video_id)
        destination = ROOT / "gita" / str(chapter) / "index.html"
        destination.write_text(page, encoding="utf-8")
        print(destination)


if __name__ == "__main__":
    main()
