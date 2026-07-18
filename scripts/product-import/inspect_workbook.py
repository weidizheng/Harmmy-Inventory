"""Inspect (never modify) the local product workbook and generate preview-only artifacts."""
from __future__ import annotations

import csv
import html
import json
import re
import shutil
import posixpath
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "private-import" / "source" / "products.xlsx"
EXTRACTED = ROOT / "private-import" / "extracted-images"
OUTPUT = ROOT / "private-import" / "output"
REPORTS = ROOT / "private-import" / "reports"
MAIN_MAX, THUMB_MAX = 1600, 480
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
DRAW_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
DRAW_MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"m": MAIN_NS, "r": REL_NS, "xdr": DRAW_NS, "a": DRAW_MAIN_NS}

STANDARD_FIELDS = [
    "sku", "product_name_zh", "product_name_en", "brand_name", "ip_name", "product_type", "retail_price", "wholesale_price",
    "quantity_per_carton_source", "units_per_inner", "inners_per_carton", "units_per_carton_calculated",
    "size_text", "details_raw", "image_source", "image_path", "validation_status", "validation_notes",
    "is_pinned", "sort_weight",
]

# Verified by reading the matched source image. These overrides record the
# physical package hierarchy where it is explicitly shown.
IMAGE_CONFIRMED_PACKAGING: dict[str, tuple[int, int]] = {
    "EAKI1002": (18, 10),  # Image: 18 small packs / middle box, 10 middle boxes / carton.
    "EAKI1012": (6, 30),  # Image: 1 small box / pack, 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1030": (6, 12),  # Image: 6 pieces / middle box; source confirms 12 middle boxes / carton.
    "EAKI1043": (6, 30),  # Image: 1 small box / pack, 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1044": (6, 30),  # Image: 1 small box / pack, 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1046": (10, 40), # Image: 10 small boxes / middle box; source confirms 40 / case.
    "EAKI1047": (6, 24),  # Image: 6 packs / middle box, 24 middle boxes / carton.
    "EAKI1048": (5, 20),  # Image: 5 packs / middle box, 20 middle boxes / carton.
    "EAKI1063": (6, 30),  # Image: 1 unit / pack, 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1025": (12, 12), # Image: 12 small packs / box, 12 boxes / carton.
    "EAKI1035": (6, 30),  # Image: 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1082": (6, 30),  # Image: 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1087": (6, 30),  # Image: 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1088": (6, 30),  # Image: 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1104": (6, 30),  # Image: 6 packs / middle box, 30 middle boxes / carton.
    "EAKI1090": (6, 30),  # Image: 6 small packs / middle box, 30 middle boxes / carton.
    "EAKI1084": (6, 30),  # Image: 1 small box / pack, 6 packs / middle box, 30 middle boxes / carton.
}

# Read from the matched product image/logo. Keep image-derived conclusions separate
# from name matching so a later import can remain auditable.
IMAGE_CONFIRMED_IPS: dict[str, str] = {
    "EAKI1048": "Naruto", "EAKI1049": "Naruto", "EAKI1076": "Yeastken",
    "EAKI1045": "Naruto", "EAKI1061": "The Prince of Tennis", "EAKI1067": "Bocchi the Rock!",
    "EAKI1073": "Solo Leveling", "EAKI1077": "Jujutsu Kaisen", "EAKI1083": "Sakamoto Days",
    "EAKI1072": "Bocchi the Rock!", "EAKI1086": "Sakamoto Days", "EAKI1093": "Opanchu Usagi",
    "EAKI1094": "Opanchu Usagi", "EAKI1096": "The Fallen Mermaid", "EAKI1097": "The Fallen Mermaid",
    "EAKI1098": "Shugo Chara!", "EAKI1099": "Oblivion Battery", "EAKI1100": "Demon Slayer",
    "EAKI1101": "Demon Slayer", "EAKI1102": "Demon Slayer", "EAKI1103": "The Apothecary Diaries",
    "EAKI1104": "The Apothecary Diaries", "EAKI1105": "Gintama", "EAKI1108": "Natsume's Book of Friends",
    "EAKI11109": "Detective Conan", "EAKI11110": "Haikyu!!", "EAKI11112": "Shugo Chara!",
    "PQHZ-M101": "Haikyu!!", "EAKI1066": "The Prince of Tennis", "EAKI1087": "Wind Breaker",
    "EAKI1089": "The Elusive Samurai", "EAKI1092": "Katekyo Hitman Reborn!",
}

# Best Sellers names transcribed from the matched product image. Two records
# whose images do not show a formal Chinese title intentionally remain blank.
IMAGE_CONFIRMED_CHINESE_NAMES: dict[str, str] = {
    "HZMB-M1301": "航海王 艾格赫德篇-毛绒系列",
    "EAKI1007": "间谍过家家-猫猫毛绒玩偶", "EAKI1008": "间谍过家家-动物派对毛绒娃娃",
    "EAKI1009": "间谍过家家-坐坐系列盲盒手办", "FLMA-M101": "葬送的芙莉莲-旅行日记手办",
    "EAKI1016": "葬送的芙莉莲-猫猫毛绒玩偶", "EAKI1019": "葬送的芙莉莲-坐坐系列盲盒手办",
    "NEW": "火影忍者疾风传-异色耳机包", "HYMH-M101": "火影忍者疾风传-疾风萌忍坐坐盲盒手办",
    "EAKI1057": "火影忍者疾风传-萌嘟嘟毛绒挂件", "EAKI1058": "火影忍者疾风传-萌兽派对系列",
    "EAKI1059": "火影忍者疾风传-萌兽坐坐派对", "EAKI1106": "火影忍者疾风传-贴贴坐系列",
    "EAKI1107": "火影忍者疾风传-萌兽趴趴派对", "EAKI11111": "火影忍者疾风传-猫猫乐园",
    "EAKI1072": "孤独摇滚！-萌宠坐坐派对", "ZSMB-M1301": "咒术回战-猫猫坐坐派对",
    "ZSSZ-M101": "咒术回战第二季-咒术街影", "ZSHZ-M201": "咒术回战 死灭回游-黑闪系列徽章",
    "ZSGJ-M101": "咒术回战第二季-追忆流光立牌挂件系列", "ZSSL-M101": "咒术回战手机链挂件",
    "EAKI1081": "咒术回战-跨步走盲盒手办", "ZSMA-M101": "咒术回战-萌坐盲盒手办",
    "EAKI1086": "坂本日常-猫猫乐园派对", "EAKI1094": "脚脚兔-斗篷派对毛绒",
    "EAKI1095": "脚脚兔-角色扮演", "EAKI1097": "人鱼陷落-宠物派对",
    "EAKI1103": "药屋少女的呢喃-豹尾萌宠阁", "EAKI1066": "新网球王子努努",
    "EAKI1038": "蜡笔小新-萌嘟嘟毛绒挂件", "EAKI1105": "银魂万兽屋",
    "EAKI1108": "夏目友人帐-四季之旅系列毛绒挂件", "EAKI11109": "名侦探柯南-跨步走盲盒手办",
    "PQHZ-M101": "排球少年！雕金徽章", "EAKI11110": "排球少年！！搪胶毛绒挂件",
    "EAKI11112": "守护甜心-甜心萌宠派对",
}

IP_KEYWORDS = {
    "naruto": "Naruto", "one piece": "One Piece", "jjk": "JJK", "jujutsu kaisen": "JJK", "spyxfamily": "SPY×FAMILY", "frieren": "Frieren",
    "bocchi the rock": "Bocchi the Rock!", "sakamoto days": "Sakamoto Days", "panty bunny": "Opanchu Usagi",
    "fallen mermaid": "The Fallen Mermaid", "mermaid falls": "The Fallen Mermaid", "apothecary diaries": "The Apothecary Diaries",
    "prince of tennis": "The Prince of Tennis", "crayon shin-chan": "Crayon Shin-chan", "gintama": "Gintama",
    "natsume's book": "Natsume's Book of Friends", "detective conan": "Detective Conan", "haikyu": "Haikyu!!",
    "shugo chara": "Shugo Chara!", "solo leveling": "Solo Leveling", "fūrin kazan": "Wind Breaker", "wind bell tales": "Wind Breaker",
    "elusive samurai": "The Elusive Samurai", "katekyo": "Katekyo Hitman Reborn!", "hitman reborn": "Katekyo Hitman Reborn!",
    "demon slayer": "Demon Slayer", "forgetful batter": "Oblivion Battery",
}


@dataclass
class SheetInfo:
    name: str
    path: str
    dimensions: str
    header_row: int | None
    headers: list[str]
    non_empty_rows: int
    image_count: int


def q(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


def rel_target(base: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), target))


def xml(zip_file: ZipFile, path: str) -> ET.Element:
    return ET.fromstring(zip_file.read(path))


def relationships(zip_file: ZipFile, path: str) -> dict[str, str]:
    try:
        root = xml(zip_file, path)
    except KeyError:
        return {}
    return {node.attrib["Id"]: node.attrib["Target"] for node in root.findall(q(PKG_REL_NS, "Relationship"))}


def column_index(cell_ref: str) -> int:
    letters = re.match(r"([A-Z]+)", cell_ref).group(1)  # type: ignore[union-attr]
    total = 0
    for char in letters:
        total = total * 26 + ord(char) - 64
    return total - 1


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def normalized_sku(value: str) -> str:
    return value.strip().upper()


def money(value: str) -> Decimal | None:
    value = value.strip().replace("$", "").replace(",", "")
    if not value:
        return None
    try:
        parsed = Decimal(value)
        return parsed if parsed >= 0 else None
    except InvalidOperation:
        return None


def source_rows(zip_file: ZipFile, path: str, strings: list[str]) -> list[tuple[int, dict[int, str]]]:
    root = xml(zip_file, path)
    result: list[tuple[int, dict[int, str]]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        cells: dict[int, str] = {}
        for cell in row.findall("m:c", NS):
            value = cell.find("m:v", NS)
            text = ""
            if value is not None and value.text is not None:
                text = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
            elif cell.attrib.get("t") == "inlineStr":
                text = "".join(node.text or "" for node in cell.findall(".//m:t", NS))
            cells[column_index(cell.attrib["r"])] = text.strip()
        result.append((int(row.attrib["r"]), cells))
    return result


def find_header(rows: list[tuple[int, dict[int, str]]]) -> tuple[int | None, dict[str, int], list[str]]:
    for row_no, cells in rows:
        values = {normalize_header(value): column for column, value in cells.items() if value}
        if "skuno" in values and "productname" in values:
            labels = [value for _, value in sorted(cells.items())]
            return row_no, values, labels
    return None, {}, []


def drawing_images(zip_file: ZipFile, sheet_path: str) -> list[dict[str, Any]]:
    rel_path = str((Path(sheet_path).parent / "_rels" / f"{Path(sheet_path).name}.rels").as_posix())
    sheet_rels = relationships(zip_file, rel_path)
    try:
        sheet = xml(zip_file, sheet_path)
    except KeyError:
        return []
    drawing = sheet.find("m:drawing", NS)
    if drawing is None:
        return []
    target = sheet_rels.get(drawing.attrib.get(q(REL_NS, "id"), ""))
    if not target:
        return []
    drawing_path = rel_target(sheet_path, target)
    drawing_rel_path = str((Path(drawing_path).parent / "_rels" / f"{Path(drawing_path).name}.rels").as_posix())
    drawing_rels = relationships(zip_file, drawing_rel_path)
    root = xml(zip_file, drawing_path)
    results: list[dict[str, Any]] = []
    for anchor in list(root.findall("xdr:twoCellAnchor", NS)) + list(root.findall("xdr:oneCellAnchor", NS)):
        start = anchor.find("xdr:from", NS)
        blip = anchor.find(".//a:blip", NS)
        if start is None or blip is None:
            continue
        embed = blip.attrib.get(q(REL_NS, "embed"))
        target = drawing_rels.get(embed or "")
        if not target:
            continue
        results.append({
            "row": int(start.findtext("xdr:row", default="-1", namespaces=NS)) + 1,
            "column": int(start.findtext("xdr:col", default="-1", namespaces=NS)) + 1,
            "source": rel_target(drawing_path, target),
        })
    return results


def classify_ip(sku: str, name: str, details: str) -> tuple[str, str, str]:
    if sku in IMAGE_CONFIRMED_IPS:
        return IMAGE_CONFIRMED_IPS[sku], "AUTO_IDENTIFIED", "IMAGE"
    text = f"{name} {details}".lower().replace("×", "x")
    for token, label in IP_KEYWORDS.items():
        if token in text:
            return label, "AUTO_IDENTIFIED", "PRODUCT_TEXT"
    return "", "NEEDS_REVIEW", ""


def chinese_name_for(sku: str) -> tuple[str, str]:
    name = IMAGE_CONFIRMED_CHINESE_NAMES.get(sku, "")
    return name, "IMAGE_CONFIRMED" if name else "NEEDS_CONFIRMATION"


def classify_product_type(name: str) -> str:
    lowered = name.lower()
    for token, label in [("plush", "Plush"), ("figure", "Figure"), ("pouch", "Pouch"), ("keychain", "Keychain"), ("blind box", "Blind Box")]:
        if token in lowered:
            return label
    return "Other"


def parse_packaging(sku: str, details: str, carton_source: str) -> dict[str, Any]:
    quantity = int(Decimal(carton_source)) if carton_source and re.fullmatch(r"\d+(?:\.0+)?", carton_source.strip()) else None
    normalized = details.lower().replace("\n", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    if sku in IMAGE_CONFIRMED_PACKAGING and quantity is not None:
        units_per_inner, inners_per_carton = IMAGE_CONFIRMED_PACKAGING[sku]
        calculated = units_per_inner * inners_per_carton
        if calculated == quantity:
            return {"status": "PASS", "notes": "Matched product image confirms the physical package counts.", "evidence": "IMAGE", "units_per_inner": units_per_inner, "inners_per_carton": inners_per_carton, "calculated": calculated}
        return {"status": "ERROR", "notes": f"Image-derived package calculation {calculated} does not equal carton quantity {quantity}.", "evidence": "IMAGE", "units_per_inner": units_per_inner, "inners_per_carton": inners_per_carton, "calculated": calculated}
    if "bonus" in normalized:
        return {"status": "NEEDS_REVIEW", "notes": "Source mentions bonus packs; confirm whether they are included in physical inventory.", "evidence": "SOURCE_DETAILS", "units_per_inner": "", "inners_per_carton": "", "calculated": ""}
    # A source row may describe both its collection size ("8 designs per middle box")
    # and its physical count ("6 pcs per middle box"). Physical pcs/pieces wins; designs
    # is only a variation count in that case (for example EAKI1030: 1 × 6 × 12 = 72).
    inner_match = re.search(r"(\d+)\s+(?:pcs?|pieces?|bags?|(?:small\s+)?packs?|foil\s+packs?|(?:small\s+)?box(?:es)?|envelopes?)\s*(?:/|per)\s*(?:middle\s+)?(?:packs?|box(?:es)?|trays?|tray)", normalized)
    if not inner_match:
        inner_match = re.search(r"each\s+containing\s+(\d+)\s+(?:small\s+)?box(?:es)?", normalized)
    if not inner_match:
        inner_match = re.search(r"(\d+)\s+designs?\s*(?:/|per)\s*(?:middle\s+(?:box|tray|packs?)|inner\s+box|display\s+box)", normalized)
    if not inner_match:
        inner_match = re.search(r"(\d+)\s+designs?\s*(?:/|per)\s*box(?:es)?", normalized)
    if not inner_match:
        inner_match = re.search(r"(\d+)\s+designs?\s*(?:/|per)\s*(?:small\s+)?packs?", normalized)
    carton_match = re.search(r"(\d+)\s+(?:middle\s+)?(?:packs?|box(?:es)?|trays?|tray)\s*(?:/|per)\s*(?:carton|case)", normalized)
    if inner_match and carton_match and quantity is not None:
        units_per_inner, inners_per_carton = int(inner_match.group(1)), int(carton_match.group(1))
        calculated = units_per_inner * inners_per_carton
        if calculated == quantity:
            return {"status": "PASS", "notes": "", "evidence": "SOURCE_DETAILS", "units_per_inner": units_per_inner, "inners_per_carton": inners_per_carton, "calculated": calculated}
        return {"status": "ERROR", "notes": f"Package calculation {calculated} does not equal carton quantity {quantity}.", "evidence": "SOURCE_DETAILS", "units_per_inner": units_per_inner, "inners_per_carton": inners_per_carton, "calculated": calculated}
    if inner_match and quantity is not None and quantity % int(inner_match.group(1)) == 0:
        units_per_inner = int(inner_match.group(1))
        inners_per_carton = quantity // units_per_inner
        return {"status": "PASS", "notes": "Inners per carton derived from the stated carton quantity.", "evidence": "SOURCE_DETAILS", "units_per_inner": units_per_inner, "inners_per_carton": inners_per_carton, "calculated": quantity}
    note = "Could not reconcile stated package counts to the source carton quantity."
    return {"status": "NEEDS_REVIEW", "notes": note, "evidence": "SOURCE_DETAILS", "units_per_inner": "", "inners_per_carton": "", "calculated": ""}


def price_validation(retail: str, wholesale: str, retail_total: str, wholesale_total: str, qty: str) -> dict[str, Any]:
    values = [money(value) for value in (retail, wholesale, retail_total, wholesale_total, qty)]
    retail_price, wholesale_price, retail_carton, wholesale_carton, quantity = values
    if any(value is None for value in values):
        return {"status": "WARNING", "notes": "One or more price fields cannot be parsed.", "retail_difference": "", "wholesale_difference": ""}
    retail_diff = abs(retail_price * quantity - retail_carton)  # type: ignore[operator]
    wholesale_diff = abs(wholesale_price * quantity - wholesale_carton)  # type: ignore[operator]
    if retail_diff <= Decimal("0.02") and wholesale_diff <= Decimal("0.02"):
        return {"status": "PASS", "notes": "", "retail_difference": str(retail_diff), "wholesale_difference": str(wholesale_diff)}
    return {"status": "ERROR", "notes": "Per-unit and per-carton prices do not reconcile within $0.02.", "retail_difference": str(retail_diff), "wholesale_difference": str(wholesale_diff)}


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def packaging_review_row_html(row: dict[str, Any]) -> str:
    image_cell = "No matched image"
    if row["review_image_path"]:
        image_path = html.escape(row["review_image_path"], quote=True)
        sku = html.escape(str(row["sku"]), quote=True)
        image_cell = f'<a href="{image_path}"><img src="{image_path}" alt="{sku}"></a>'
    return (
        "<tr>"
        f"<td>{html.escape(str(row['sku']))}</td>"
        f"<td>{html.escape(str(row['product_name']))}</td>"
        f"<td>{html.escape(str(row['quantity_per_carton_source']))}</td>"
        f"<td>{image_cell}</td>"
        f"<td class=\"details\">{html.escape(str(row['source_details']))}</td>"
        f"<td>{html.escape(str(row['evidence']))}</td>"
        f"<td>{html.escape(str(row['notes']))}</td>"
        "</tr>"
    )

def convert_image(raw: bytes, destination: Path, max_size: int) -> None:
    with Image.open(BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=88, method=6)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source workbook is missing: {SOURCE}")
    for directory in (EXTRACTED, OUTPUT, REPORTS):
        directory.mkdir(parents=True, exist_ok=True)
    sheets: list[SheetInfo] = []
    all_rows: list[dict[str, Any]] = []
    image_anchors: list[dict[str, Any]] = []
    raw_images: dict[str, bytes] = {}
    with ZipFile(SOURCE) as archive:
        strings_root = xml(archive, "xl/sharedStrings.xml")
        strings = ["".join(node.text or "" for node in item.iter(q(MAIN_NS, "t"))) for item in strings_root.findall(q(MAIN_NS, "si"))]
        workbook = xml(archive, "xl/workbook.xml")
        workbook_rels = relationships(archive, "xl/_rels/workbook.xml.rels")
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            name = sheet.attrib["name"]
            path = rel_target("xl/workbook.xml", workbook_rels[sheet.attrib[q(REL_NS, "id")]])
            rows = source_rows(archive, path, strings)
            header_row, columns, headers = find_header(rows)
            images = drawing_images(archive, path)
            image_by_row: dict[int, list[str]] = defaultdict(list)
            for image in images:
                image_by_row[image["row"]].append(image["source"])
                raw_images[image["source"]] = archive.read(image["source"])
            dim = xml(archive, path).find("m:dimension", NS)
            sheets.append(SheetInfo(name, path, dim.attrib.get("ref", "") if dim is not None else "", header_row, headers, sum(bool(cells) for _, cells in rows), len(images)))
            if header_row is None:
                continue
            inverse = {column: header for header, column in columns.items()}
            for row_no, cells in rows:
                if row_no <= header_row:
                    continue
                def value(*headers: str) -> str:
                    for header in headers:
                        if header in columns:
                            return cells.get(columns[header], "")
                    return ""
                sku, product_name = normalized_sku(value("skuno")), value("productname").strip()
                if not sku and not product_name:
                    continue
                all_rows.append({
                    "sheet": name, "row": row_no, "source_columns": {inverse.get(k, str(k)): v for k, v in cells.items()},
                    "sku": sku, "product_name": product_name, "retail_price": value("suggestedretailpriceperunit"), "wholesale_price": value("wholesalepriceperunit", "wholesaleunitprice"),
                    "retail_carton": value("suggestedretailvaluepercarton"), "wholesale_carton": value("wholesaletotalpricepercarton"), "quantity_per_carton_source": value("quanitypercarton") or value("quantitypercarton"),
                    "size_text": value("size"), "details_raw": value("moredetails"), "source_product_type": value("producttype"), "images": image_by_row.get(row_no, []),
                })
            for image in images:
                image_anchors.append({"sheet": name, "row": image["row"], "column": image["column"], "source": image["source"]})

        duplicates = {sku for sku, count in Counter(row["sku"] for row in all_rows if row["sku"]).items() if count > 1}
        clean_rows: list[dict[str, Any]] = []
        image_manifest: list[dict[str, Any]] = []
        package_report: list[dict[str, Any]] = []
        price_report: list[dict[str, Any]] = []
        image_evidence: list[dict[str, Any]] = []
        name_review: list[dict[str, Any]] = []
        for row in all_rows:
            packaging = parse_packaging(row["sku"], row["details_raw"], row["quantity_per_carton_source"])
            prices = price_validation(row["retail_price"], row["wholesale_price"], row["retail_carton"], row["wholesale_carton"], row["quantity_per_carton_source"])
            ip_name, ip_status, ip_evidence = classify_ip(row["sku"], row["product_name"], row["details_raw"])
            product_name_zh, name_review_status = chinese_name_for(row["sku"])
            notes: list[str] = []
            errors = []
            warnings = []
            if not row["sku"]: errors.append("SKU is missing.")
            if row["sku"] in duplicates: errors.append("SKU is duplicated.")
            if not row["product_name"]: errors.append("Product name is missing.")
            if packaging["status"] == "ERROR": errors.append(packaging["notes"])
            if prices["status"] == "ERROR": errors.append(prices["notes"])
            if packaging["status"] == "NEEDS_REVIEW": notes.append(packaging["notes"])
            if ip_status == "NEEDS_REVIEW": notes.append("IP needs manual confirmation.")
            if prices["status"] == "WARNING": warnings.append(prices["notes"])
            if not row["images"]: warnings.append("No anchored image found.")
            status = "ERROR" if errors else "NEEDS_REVIEW" if notes else "WARNING" if warnings else "PASS"
            sku_path = row["sku"].lower()
            output_images: list[str] = []
            for index, source_path in enumerate(row["images"], 1):
                source_name = Path(source_path).name
                raw = raw_images[source_path]
                raw_copy = EXTRACTED / "originals" / sku_path / source_name
                raw_copy.parent.mkdir(parents=True, exist_ok=True)
                if not raw_copy.exists(): raw_copy.write_bytes(raw)
                stem = f"{sku_path}-main" if index == 1 else f"{sku_path}-{index + 1:02d}"
                main_path = EXTRACTED / "products" / sku_path / f"{stem}.webp"
                if not main_path.exists(): convert_image(raw, main_path, MAIN_MAX)
                output_images.append(main_path.relative_to(EXTRACTED).as_posix())
                if index == 1:
                    thumb_path = EXTRACTED / "products" / sku_path / f"{sku_path}-thumb.webp"
                    if not thumb_path.exists(): convert_image(raw, thumb_path, THUMB_MAX)
                image_manifest.append({"sheet": row["sheet"], "row": row["row"], "sku": row["sku"], "source_image": source_path, "main_image_path": output_images[-1], "matched": "YES"})
            clean_rows.append({
                "source_sheet": row["sheet"], "sku": row["sku"], "product_name_zh": product_name_zh, "product_name_en": row["product_name"], "brand_name": "", "ip_name": ip_name, "product_type": row["source_product_type"] or classify_product_type(row["product_name"]),
                "retail_price": row["retail_price"], "wholesale_price": row["wholesale_price"], "quantity_per_carton_source": row["quantity_per_carton_source"],
                "units_per_inner": packaging["units_per_inner"], "inners_per_carton": packaging["inners_per_carton"], "units_per_carton_calculated": packaging["calculated"],
                "size_text": row["size_text"], "details_raw": row["details_raw"], "image_source": ";".join(row["images"]), "image_path": ";".join(output_images),
                "validation_status": status, "validation_notes": " ".join(errors + notes + warnings), "is_pinned": "false", "sort_weight": 0,
            })
            review_image_path = f"../extracted-images/{output_images[0]}" if output_images else ""
            if row["sheet"] == "Best Sellers":
                name_review.append({
                    "sku": row["sku"], "product_name_zh": product_name_zh, "name_review_status": name_review_status,
                    "product_name_en": row["product_name"], "ip_name": ip_name, "quantity_per_carton_source": row["quantity_per_carton_source"],
                    "units_per_inner": packaging["units_per_inner"], "inners_per_carton": packaging["inners_per_carton"],
                    "review_image_path": review_image_path, "details_raw": row["details_raw"],
                })
            package_report.append({
                "sheet": row["sheet"], "row": row["row"], "sku": row["sku"], "product_name": row["product_name"],
                "quantity_per_carton_source": row["quantity_per_carton_source"], "review_image_path": review_image_path,
                "source_details": row["details_raw"], **packaging,
            })
            if packaging["evidence"] == "IMAGE" or ip_evidence == "IMAGE":
                image_evidence.append({"sku": row["sku"], "sheet": row["sheet"], "row": row["row"], "image_path": row["images"][0] if row["images"] else "", "ip_name": ip_name, "ip_evidence": ip_evidence, "units_per_inner": packaging["units_per_inner"], "inners_per_carton": packaging["inners_per_carton"], "packaging_evidence": packaging["evidence"], "notes": packaging["notes"]})
            price_report.append({"sheet": row["sheet"], "row": row["row"], "sku": row["sku"], "retail_price": row["retail_price"], "wholesale_price": row["wholesale_price"], "retail_carton": row["retail_carton"], "wholesale_carton": row["wholesale_carton"], "quantity": row["quantity_per_carton_source"], **prices})

    mapped_rows = {(a["sheet"], a["row"]) for a in image_anchors}
    for anchor in image_anchors:
        matching = next((row for row in all_rows if row["sheet"] == anchor["sheet"] and row["row"] == anchor["row"]), None)
        anchor["sku"] = matching["sku"] if matching else ""
        anchor["matched"] = "YES" if matching and matching["sku"] else "NO"
    unmatched_images = sum(1 for anchor in image_anchors if anchor["matched"] == "NO")
    missing_images = sum(1 for row in all_rows if not row["images"])
    summary = {
        "source": str(SOURCE.relative_to(ROOT)), "worksheet_count": len(sheets), "valid_product_rows": len(all_rows),
        "import_scope": "Best Sellers", "import_preview_row_count": sum(row["sheet"] == "Best Sellers" for row in all_rows),
        "valid_sku_count": len({row["sku"] for row in all_rows if row["sku"]}), "duplicate_sku_count": len(duplicates),
        "missing_sku_count": sum(not row["sku"] for row in all_rows), "missing_product_name_count": sum(not row["product_name"] for row in all_rows),
        "image_total": len(image_anchors), "matched_image_count": len(image_anchors) - unmatched_images, "unmatched_image_count": unmatched_images, "missing_image_count": missing_images,
        "packaging_pass_count": sum(r["status"] == "PASS" for r in package_report), "packaging_needs_review_count": sum(r["status"] == "NEEDS_REVIEW" for r in package_report), "packaging_error_count": sum(r["status"] == "ERROR" for r in package_report),
        "price_pass_count": sum(r["status"] == "PASS" for r in price_report), "price_warning_count": sum(r["status"] == "WARNING" for r in price_report), "price_error_count": sum(r["status"] == "ERROR" for r in price_report),
        "ip_auto_identified_count": sum(bool(row["ip_name"]) for row in clean_rows), "ip_needs_review_count": sum(not row["ip_name"] for row in clean_rows),
    }
    (REPORTS / "workbook-inspection.json").write_text(json.dumps({"source": str(SOURCE.relative_to(ROOT)), "sheets": [asdict(sheet) for sheet in sheets]}, indent=2), encoding="utf-8")
    write_csv(REPORTS / "column-mapping-proposal.csv", [{"standard_field": field, "source_column": {"sku":"SKU No.","product_name_zh":"matched product image (manual transcription)","product_name_en":"Product Name","retail_price":"Suggested Retail Price (Per Unit)","wholesale_price":"Wholesale Price (Per Unit)","quantity_per_carton_source":"Quanity Per Carton","size_text":"Size","details_raw":"More Details"}.get(field, "derived or blank"), "rule": "preview mapping"} for field in STANDARD_FIELDS], ["standard_field", "source_column", "rule"])
    write_csv(REPORTS / "image-anchor-report.csv", image_anchors, ["sheet", "row", "column", "sku", "source", "matched"])
    write_csv(REPORTS / "image-evidence-review.csv", image_evidence, ["sku", "sheet", "row", "image_path", "ip_name", "ip_evidence", "units_per_inner", "inners_per_carton", "packaging_evidence", "notes"])
    write_csv(REPORTS / "duplicate-sku-report.csv", [{"sku": row["sku"], "sheet": row["sheet"], "row": row["row"]} for row in all_rows if row["sku"] in duplicates], ["sku", "sheet", "row"])
    write_csv(REPORTS / "packaging-review-report.csv", package_report, ["sheet", "row", "sku", "product_name", "quantity_per_carton_source", "review_image_path", "status", "evidence", "notes", "units_per_inner", "inners_per_carton", "calculated", "source_details"])
    write_csv(REPORTS / "price-validation-report.csv", price_report, ["sheet", "row", "sku", "status", "notes", "retail_price", "wholesale_price", "retail_carton", "wholesale_carton", "quantity", "retail_difference", "wholesale_difference"])
    write_csv(REPORTS / "best-sellers-chinese-name-review.csv", name_review, ["sku", "product_name_zh", "name_review_status", "product_name_en", "ip_name", "quantity_per_carton_source", "units_per_inner", "inners_per_carton", "review_image_path", "details_raw"])
    write_csv(OUTPUT / "products-clean-preview.csv", [row for row in clean_rows if row["source_sheet"] == "Best Sellers"], STANDARD_FIELDS)
    write_csv(OUTPUT / "image-manifest-preview.csv", [row for row in image_manifest if row["sheet"] == "Best Sellers"], ["sheet", "row", "sku", "source_image", "main_image_path", "matched"])
    (REPORTS / "import-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    rows_html = "".join(f"<tr><th>{html.escape(key)}</th><td>{html.escape(str(value))}</td></tr>" for key, value in summary.items())
    (REPORTS / "data-quality-report.html").write_text(f"<!doctype html><title>Harmmy import quality</title><style>body{{font-family:Arial;margin:2rem}}table{{border-collapse:collapse}}th,td{{padding:.5rem;border:1px solid #ddd;text-align:left}}th{{background:#f4f4f4}}</style><h1>Workbook data-quality report</h1><p>Preview only; no product was imported or uploaded.</p><table>{rows_html}</table>", encoding="utf-8")
    review_rows = [row for row in package_report if row["status"] in {"NEEDS_REVIEW", "ERROR"}]
    review_table = "".join(packaging_review_row_html(row) for row in review_rows)
    (REPORTS / "packaging-review.html").write_text(
        "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>待审核箱规</title>"
        "<style>body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:24px;background:#f7f7f7;color:#222}h1{margin-bottom:4px}p{color:#555}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}th{background:#1f4e78;color:#fff;position:sticky;top:0}img{width:140px;max-height:210px;object-fit:contain;display:block}.details{white-space:pre-wrap;min-width:280px;line-height:1.45}</style>"
        f"<h1>待审核箱规（{len(review_rows)} 条）</h1><p>每行保留原始图片、Excel 的 More Details 与 Quanity Per Carton，供人工确认；点击图片可放大。</p>"
        "<table><thead><tr><th>SKU</th><th>商品名</th><th>原始每箱数量</th><th>图片</th><th>原始 Details</th><th>证据</th><th>复核原因</th></tr></thead>"
        f"<tbody>{review_table}</tbody></table></html>", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
