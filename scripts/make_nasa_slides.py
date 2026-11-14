"""Seven English slides for the NASA Space Apps project form."""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

OUT = Path(__file__).resolve().parents[1] / "docs" / "TerraShift-NASA-7slides.pptx"
INK = RGBColor(0x24, 0x30, 0x24)
LEAF = RGBColor(0x2F, 0x55, 0x36)
CREAM = RGBColor(0xF6, 0xF4, 0xEF)
GOLD = RGBColor(0xC4, 0x8A, 0x12)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
STONE = RGBColor(0x4A, 0x45, 0x3C)


def paint(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def slide(prs, dark=False):
    page = prs.slides.add_slide(prs.slide_layouts[6])
    page.background.fill.solid()
    page.background.fill.fore_color.rgb = INK if dark else CREAM
    if not dark:
        bar = page.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.16), Inches(7.5))
        paint(bar, LEAF)
    return page


def text(page, value, x, y, w, h, size=20, bold=False, color=INK):
    box = page.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.word_wrap = True
    lines = value.split("\n")
    paragraph = frame.paragraphs[0]
    paragraph.text = lines[0]
    paragraph.font.size = Pt(size)
    paragraph.font.bold = bold
    paragraph.font.color.rgb = color
    paragraph.font.name = "Calibri"
    paragraph.alignment = PP_ALIGN.LEFT
    for line in lines[1:]:
        extra = frame.add_paragraph()
        extra.text = line
        extra.font.size = Pt(size)
        extra.font.bold = bold
        extra.font.color.rgb = color
        extra.font.name = "Calibri"
        extra.space_before = Pt(8)
    return frame


def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    prs.core_properties.title = "TerraShift"

    page = slide(prs, True)
    text(page, "NASA SPACE APPS 2026  ·  FIELD SHIFT", 0.8, 1.8, 11, 0.4, 16, True, GOLD)
    text(page, "TerraShift", 0.8, 2.4, 11, 1.1, 60, True, WHITE)
    text(page, "Which rotation fits this field,\nusing the climate NASA already measured there?", 0.8, 4.0, 11, 1.4, 26, False, CREAM)
    text(page, "Decision support. Not a planting order.", 0.8, 6.2, 11, 0.4, 18, False, GOLD)

    page = slide(prs)
    text(page, "The problem", 0.7, 0.5, 12, 0.7, 36, True)
    text(page, "A farmer chooses the next crop with little local climate evidence.\nRain, heat, and a dry spell show up at harvest, when the choice is already made.\nNASA POWER describes that place. It does not speak the language of the field.\nTerraShift starts from one point on Earth and compares rotations for that point.", 0.7, 1.8, 11.5, 4.5, 24, False, STONE)

    page = slide(prs)
    text(page, "What the farmer does", 0.7, 0.45, 12, 0.6, 36, True)
    steps = [
        ("1  Place", "Search or tap. The map zooms to streets and fields. Satellite photos are Esri / Maxar, not a live camera."),
        ("2  Field", "Soil, slope, irrigation, current rotation, and what matters: water, soil, income, pests."),
        ("3  Result", "Several rotations, a score, the reasons, and what is still unknown. An alert text is prepared for the phone number."),
    ]
    for index, (title, body) in enumerate(steps):
        card = page.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.6 + index * 4.2), Inches(1.7), Inches(3.9), Inches(4.6))
        paint(card, WHITE)
        text(page, title, 0.85 + index * 4.2, 2.0, 3.4, 0.7, 24, True, LEAF)
        text(page, body, 0.85 + index * 4.2, 3.0, 3.4, 2.8, 18, False, STONE)

    page = slide(prs)
    text(page, "NASA data we actually use", 0.7, 0.4, 12, 0.6, 32, True)
    text(page, "NASA POWER daily point data, 2011–2024. No API key.\nPRECTOTCORR rain · T2M, T2M_MIN, T2M_MAX · RH2M · ALLSKY_SFC_SW_DWN\nGWETROOT and GWETTOP soil wetness · EVPTRNS stored, not converted to millimeters\nWater balance uses Hargreaves. Grid about 0.5° × 0.625°: the area’s climate, not one square meter.\nSMAP, GPM/IMERG, NDVI, ECOSTRESS, and GRACE are on a roadmap only. No figure comes from them.", 0.7, 1.5, 11.8, 5, 22, False, STONE)

    page = slide(prs)
    text(page, "Try the product", 0.7, 0.5, 12, 0.7, 36, True)
    text(page, "https://jmcagboh.github.io/Agro-cunasa/\n\nCreate an account, including a phone number.\nChoose a town. Zoom until roofs and fields show.\nRun NASA POWER. Open Alerts for the prepared message.\n\nCode: https://github.com/jmcagboh/Agro-cunasa", 0.7, 1.6, 11.5, 4.5, 24, False, STONE)

    page = slide(prs)
    text(page, "Impact, and the limits we state", 0.7, 0.45, 12, 0.6, 32, True)
    text(page, "A farmer can see whether the current rotation still fits the climate of that point, before sowing.\nThe app says when a local adviser is still needed: soil, seed, water, and prices.\nThe phone message describes the usual climate of 2011–2024. It is not the weather of next week.\nNo SMS is sent yet. The number is saved; the text stays on screen.\nA warmer or drier slider is a sensitivity test, not a climate projection.", 0.7, 1.5, 11.8, 5, 22, False, STONE)

    page = slide(prs, True)
    text(page, "REFERENCES", 0.8, 1.5, 11, 0.4, 16, True, GOLD)
    text(page, "NASA POWER  ·  power.larc.nasa.gov\nOpen-Meteo geocoding  ·  Esri World Imagery / Maxar\nOpenStreetMap  ·  Supabase Auth\nReact, Vite, Leaflet, Recharts\nCursor, an AI coding assistant, helped build the app and this deck.", 0.8, 2.2, 11, 3.2, 22, False, CREAM)
    text(page, "TerraShift  ·  Field Shift  ·  NASA Space Apps 2026", 0.8, 6.2, 11, 0.4, 16, False, GOLD)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
