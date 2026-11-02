#!/usr/bin/env python3
"""Generate the bundled schematic drawings (SVG) for Demo Séance + Haunted Classics.

Two looks:
  * "notebook": blue ballpoint on squared student paper (Demo Séance samples)
  * "aged":     sepia ink on yellowed, stained paper with typewriter labels (Haunted Classics)

A hand-drawn wobble comes from an SVG feTurbulence/feDisplacementMap filter, so the
circuit topology stays exactly right while looking hand-made. Each drawing matches
its netlist in src/examples / src/features/haunted.

Usage: python3 scripts/gen-schematics.py   (writes public/samples/*.svg, public/classics/*.svg)
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Sch:
    def __init__(self, w, h, style, seed=1):
        self.w, self.h, self.style = w, h, style
        self.parts = []
        self.rng = random.Random(seed)
        self.ink = "#1d3f8f" if style == "notebook" else "#3b2a1a"
        self.font = (
            "'Comic Sans MS','Segoe Print','Bradley Hand',cursive"
            if style == "notebook"
            else "'Courier New',Courier,monospace"
        )

    # ---- primitives -------------------------------------------------
    def line(self, *pts):
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.parts.append(f'<path d="{d}" class="ink"/>')

    def dot(self, x, y):
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{self.ink}"/>')

    def text(self, x, y, s, size=20, anchor="middle", italic=False):
        st = ' font-style="italic"' if italic else ""
        self.parts.append(
            f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}"{st} class="lbl">{s}</text>'
        )

    # ---- components (horizontal if x1!=x2 else vertical) --------------
    def resistor(self, x1, y1, x2, y2, label=None, lab_off=(0, -18)):
        horiz = y1 == y2
        L = abs(x2 - x1) if horiz else abs(y2 - y1)
        body = 60
        a = (L - body) / 2
        pts = []
        n = 6
        for i in range(n + 1):
            t = a + body * i / n
            off = 0 if i in (0, n) else (10 if i % 2 else -10)
            pts.append((t, off))
        pts = [(0, 0)] + pts + [(L, 0)]
        self._emit(pts, x1, y1, horiz, x2 < x1 if horiz else y2 < y1)
        self._label(x1, y1, x2, y2, label, lab_off)

    def capacitor(self, x1, y1, x2, y2, label=None, lab_off=(0, -22), polar=False):
        horiz = y1 == y2
        if horiz:
            mx = (x1 + x2) / 2
            self.line((x1, y1), (mx - 6, y1))
            self.line((mx + 6, y1), (x2, y2))
            self.line((mx - 6, y1 - 18), (mx - 6, y1 + 18))
            self.line((mx + 6, y1 - 18), (mx + 6, y1 + 18))
        else:
            my = (y1 + y2) / 2
            self.line((x1, y1), (x1, my - 6))
            self.line((x1, my + 6), (x2, y2))
            self.line((x1 - 18, my - 6), (x1 + 18, my - 6))
            self.line((x1 - 18, my + 6), (x1 + 18, my + 6))
        self._label(x1, y1, x2, y2, label, lab_off)

    def inductor(self, x1, y1, x2, y2, label=None, lab_off=(0, -22)):
        horiz = y1 == y2
        L = abs(x2 - x1) if horiz else abs(y2 - y1)
        body = 64
        a = (L - body) / 2
        pts = [(0, 0), (a, 0)]
        humps = 4
        for h in range(humps):
            c0 = a + body * h / humps
            for k in range(1, 9):
                ang = math.pi * k / 8
                r = body / humps / 2
                pts.append((c0 + r - r * math.cos(ang), -r * math.sin(ang) * 1.1))
        pts.append((L, 0))
        self._emit(pts, x1, y1, horiz, False)
        self._label(x1, y1, x2, y2, label, lab_off)

    def diode(self, x1, y1, x2, y2, label=None, lab_off=(0, -24)):
        # anode at (x1,y1) -> cathode (x2,y2), horizontal only
        mx = (x1 + x2) / 2
        self.line((x1, y1), (mx - 14, y1))
        self.line((mx + 14, y1), (x2, y2))
        self.line((mx - 14, y1 - 15), (mx - 14, y1 + 15), (mx + 14, y1), (mx - 14, y1 - 15))
        self.line((mx + 14, y1 - 15), (mx + 14, y1 + 15))
        self._label(x1, y1, x2, y2, label, lab_off)

    def source(self, x, ytop, ybot, label=None, kind="sine"):
        # vertical source between ytop (+) and ybot (-)
        cy = (ytop + ybot) / 2
        r = 24
        self.line((x, ytop), (x, cy - r))
        self.line((x, cy + r), (x, ybot))
        self.parts.append(f'<circle cx="{x}" cy="{cy}" r="{r}" class="ink"/>')
        if kind == "sine":
            pts = [(x - 13 + 26 * i / 16, cy - 8 * math.sin(2 * math.pi * i / 16)) for i in range(17)]
            self.line(*pts)
        elif kind == "pulse":
            self.line((x - 13, cy + 7), (x - 5, cy + 7), (x - 5, cy - 7), (x + 5, cy - 7), (x + 5, cy + 7), (x + 13, cy + 7))
        else:  # dc
            self.text(x, cy - 4, "+", 18)
            self.text(x, cy + 16, "−", 18)
        if label:
            self.text(x - r - 10, cy + 6, label, 18, "end")

    def ground(self, x, y):
        self.line((x, y), (x, y + 10))
        for i, w in enumerate((22, 14, 6)):
            self.line((x - w, y + 10 + i * 6), (x + w, y + 10 + i * 6))

    def opamp(self, x, y, label=None, flip_inputs=False):
        # triangle pointing right, left edge at x, centre y, height 100, width 90
        self.line((x, y - 50), (x, y + 50), (x + 90, y), (x, y - 50))
        top, bot = ("−", "+") if not flip_inputs else ("+", "−")
        self.text(x + 14, y - 20, top, 22)
        self.text(x + 14, y + 34, bot, 22)
        if label:
            self.text(x + 40, y + 70, label, 16)
        return (x, y - 25), (x, y + 25), (x + 90, y)  # inv/top, noninv/bottom, out

    def _emit(self, pts, x0, y0, horiz, rev):
        out = []
        for t, o in pts:
            t = -t if rev else t
            out.append((x0 + t, y0 + o) if horiz else (x0 + o, y0 + t))
        self.line(*out)

    def _label(self, x1, y1, x2, y2, label, off):
        if not label:
            return
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if y1 == y2:
            self.text(mx + off[0], my + off[1], label, 18)
        else:
            self.text(mx + 30 + off[0] if off != (0, -18) and off != (0, -22) and off != (0, -24) else mx + 30, my + 6, label, 18, "start")

    # ---- output -------------------------------------------------------
    def svg(self, title, subtitle=None, footer=None):
        w, h = self.w, self.h
        defs = f'''<defs>
  <filter id="hand" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="{self.rng.randint(1,99)}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="{3.2 if self.style=='notebook' else 2.4}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0.10 0"/></filter>
  <radialGradient id="stain" cx="50%" cy="50%" r="50%"><stop offset="60%" stop-color="#8a5a2b" stop-opacity="0"/><stop offset="85%" stop-color="#8a5a2b" stop-opacity="0.22"/><stop offset="100%" stop-color="#8a5a2b" stop-opacity="0"/></radialGradient>
  <radialGradient id="age" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#5a3a12" stop-opacity="0.35"/></radialGradient>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#9fc3e6" stroke-width="0.8"/></pattern>
</defs>'''
        if self.style == "notebook":
            bg = (f'<rect width="{w}" height="{h}" fill="#fbfcf7"/><rect width="{w}" height="{h}" fill="url(#grid)"/>'
                  f'<line x1="70" y1="0" x2="70" y2="{h}" stroke="#e79b9b" stroke-width="1.5"/>')
            rot = self.rng.uniform(-1.2, 1.2)
        else:
            bg = (f'<rect width="{w}" height="{h}" fill="#e9d8a6"/><rect width="{w}" height="{h}" filter="url(#paper)"/>'
                  f'<circle cx="{w*0.82:.0f}" cy="{h*0.22:.0f}" r="{min(w,h)*0.16:.0f}" fill="url(#stain)"/>'
                  f'<rect width="{w}" height="{h}" fill="url(#age)"/>')
            rot = self.rng.uniform(-1.8, 1.8)
        head = f'<text x="{90 if self.style=="notebook" else 40}" y="44" font-size="24" class="lbl" font-weight="bold">{title}</text>'
        if subtitle:
            head += f'<text x="{90 if self.style=="notebook" else 40}" y="72" font-size="16" class="lbl">{subtitle}</text>'
        if footer:
            head += f'<text x="{w-30}" y="{h-20}" font-size="14" text-anchor="end" class="lbl">{footer}</text>'
        style = (f'<style>.ink{{fill:none;stroke:{self.ink};stroke-width:{2.6 if self.style=="notebook" else 2.2};'
                 f'stroke-linecap:round;stroke-linejoin:round}}.lbl{{fill:{self.ink};font-family:{self.font}}}</style>')
        body = "\n".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">\n'
                f'{style}{defs}{bg}<g transform="rotate({rot:.2f} {w/2} {h/2})"><g filter="url(#hand)">{head}\n{body}</g></g></svg>\n')


def save(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path)


# ----------------------------------------------------------------- samples
def rc_lowpass(style="notebook", title="RC low-pass — step response", sub="V1: 0→5 V step   τ = RC = ?"):
    s = Sch(720, 440, style, seed=3)
    s.source(160, 160, 340, "V1", "pulse")
    s.line((160, 160), (160, 130), (260, 130))
    s.resistor(260, 130, 420, 130, "R1 = 1kΩ")
    s.line((420, 130), (540, 130))
    s.dot(540, 130)
    s.text(560, 120, "out", 18, "start", italic=True)
    s.line((540, 130), (540, 180))
    s.capacitor(540, 180, 540, 300, "C1 = 1µF")
    s.line((540, 300), (540, 340), (160, 340))
    s.text(150, 125, "in", 18, "end", italic=True)
    s.ground(350, 340)
    return s.svg(title, sub)


def rlc_ringing():
    s = Sch(760, 440, "notebook", seed=5)
    s.source(150, 160, 340, "V1", "pulse")
    s.line((150, 160), (150, 130), (220, 130))
    s.resistor(220, 130, 340, 130, "R1 = 100Ω")
    s.line((340, 130), (380, 130))
    s.inductor(380, 130, 520, 130, "L1 = 100mH")
    s.line((520, 130), (600, 130))
    s.dot(600, 130)
    s.text(620, 120, "n2", 18, "start", italic=True)
    s.line((600, 130), (600, 180))
    s.capacitor(600, 180, 600, 300, "C1 = 253nF")
    s.line((600, 300), (600, 340), (150, 340))
    s.ground(380, 340)
    return s.svg("Series RLC — why does it ring?", "f0 = 1/(2π√LC) ≈ 1 kHz,  ζ = ?")


def diode_rectifier():
    s = Sch(760, 440, "notebook", seed=8)
    s.source(150, 160, 340, "V1", "sine")
    s.text(150, 380, "10 V, 50 Hz", 15)
    s.line((150, 160), (150, 130), (260, 130))
    s.diode(260, 130, 400, 130, "D1 1N4148")
    s.line((400, 130), (500, 130), (620, 130))
    s.dot(500, 130)
    s.dot(620, 130)
    s.text(640, 120, "out", 18, "start", italic=True)
    s.line((500, 130), (500, 180))
    s.capacitor(500, 180, 500, 300, "C1 10µF")
    s.line((620, 130), (620, 170))
    s.resistor(620, 170, 620, 300, "R1 10k")
    s.line((500, 300), (500, 340))
    s.line((620, 300), (620, 340), (150, 340))
    s.dot(500, 340)
    s.ground(330, 340)
    return s.svg("Half-wave rectifier + smoothing cap", "ripple = ?")


def opamp_inverting():
    s = Sch(760, 460, "notebook", seed=11)
    s.source(140, 200, 360, "Vin", "sine")
    s.text(140, 400, "0.5 V, 1 kHz", 15)
    s.line((140, 200), (140, 175), (210, 175))
    s.resistor(210, 175, 340, 175, "R1 1k")
    s.line((340, 175), (400, 175))
    s.dot(400, 175)
    inv, non, out = s.opamp(420, 200)
    s.line((400, 175), inv)
    s.line((400, 175), (400, 100), (450, 100))
    s.resistor(450, 100, 580, 100, "Rf 10k")
    s.line((580, 100), (620, 100), (620, 200))
    s.line(out, (680, 200))
    s.dot(620, 200)
    s.text(690, 205, "out", 18, "start", italic=True)
    s.line(non, (400, 225), (400, 360))
    s.line((140, 360), (400, 360))
    s.ground(400, 360)
    return s.svg("Inverting amplifier", "gain = −Rf/R1 = ?")


# ----------------------------------------------------------------- classics
def ne555():
    s = Sch(820, 520, "aged", seed=21)
    # chip box
    s.line((380, 150), (560, 150), (560, 400), (380, 400), (380, 150))
    s.text(470, 368, "NE555", 26)
    for y, lab in ((190, "7 DIS"), (270, "6 THR"), (330, "2 TRIG")):
        s.text(388, y + 5, lab, 14, "start")
    s.text(552, 245, "3 OUT", 14, "end")
    s.text(470, 172, "8 VCC   4 RST", 13)
    s.text(470, 392, "1 GND", 13)
    # VCC rail
    s.source(110, 120, 460, "VCC 5V", "dc")
    s.line((110, 120), (110, 90), (470, 90), (470, 150))
    s.line((230, 90), (230, 110))
    s.resistor(230, 110, 230, 190, "RA 1k")
    s.line((230, 190), (380, 190))
    s.dot(230, 190)
    s.line((230, 190), (230, 210))
    s.resistor(230, 210, 230, 300, "RB 10k")
    s.line((230, 300), (300, 300))
    s.dot(300, 300)
    s.line((300, 270), (380, 270))
    s.line((300, 270), (300, 330), (380, 330))
    s.line((300, 330), (300, 350))
    s.capacitor(300, 350, 300, 440, None)
    s.text(285, 400, "C 10nF", 16, "end")
    s.line((560, 240), (660, 240))
    s.dot(660, 240)
    s.text(670, 232, "OUT", 16, "start")
    s.line((110, 460), (110, 480), (470, 480), (470, 400))
    s.line((300, 440), (300, 480))
    s.ground(380, 480)
    return s.svg("SIGNETICS NE555 — ASTABLE MODE", "Fig. 9  (after Signetics app. note, 1972)  f = 1.44/((RA+2RB)C)", "Haunted Classics")


def rc_ladder():
    s = Sch(820, 440, "aged", seed=23)
    s.source(130, 160, 340, "Vin 1V", "sine")
    s.line((130, 160), (130, 130), (200, 130))
    s.resistor(200, 130, 330, 130, "R1 1k")
    s.line((330, 130), (400, 130))
    s.dot(400, 130)
    s.line((400, 130), (400, 180))
    s.capacitor(400, 180, 400, 300, "C1 100nF")
    s.line((400, 130), (450, 130))
    s.resistor(450, 130, 580, 130, "R2 10k")
    s.line((580, 130), (650, 130))
    s.dot(650, 130)
    s.text(665, 122, "OUT", 16, "start")
    s.line((650, 130), (650, 180))
    s.capacitor(650, 180, 650, 300, "C2 10nF")
    s.line((650, 300), (650, 340), (130, 340))
    s.line((400, 300), (400, 340))
    s.dot(400, 340)
    s.ground(270, 340)
    return s.svg("TWO-SECTION RC LOW-PASS FILTER", "after a 1950s radio servicing handbook — corner ≈ 1.6 kHz", "Haunted Classics")


def wien():
    s = Sch(820, 560, "aged", seed=25)
    inv, non, out = s.opamp(430, 290, flip_inputs=True)  # top '+', bottom '-'
    # positive feedback: series R1-C1 from OUT to '+', parallel R2 || C2 from '+' to ground
    s.line(out, (600, 290))
    s.dot(600, 290)
    s.text(612, 282, "OUT", 16, "start")
    s.line((600, 290), (600, 140), (530, 140))
    s.resistor(530, 140, 410, 140, "R1 10k")
    s.line((410, 140), (380, 140))
    s.capacitor(380, 140, 300, 140, "C1 16n", lab_off=(0, -26))
    s.line((300, 140), (260, 140), (260, 265))
    s.dot(260, 265)
    s.line((260, 265), inv)
    s.line((260, 265), (170, 265), (170, 290))
    s.resistor(170, 290, 170, 420, None)
    s.text(160, 360, "R2 10k", 16, "end")
    s.line((260, 265), (260, 300))
    s.capacitor(260, 300, 260, 410, None)
    s.text(285, 360, "C2 16n", 16, "start")
    s.line((170, 420), (170, 470), (400, 470))
    s.line((260, 410), (260, 470))
    s.dot(260, 470)
    # negative feedback: Rf from OUT to '-', Rg from '-' to ground (gain 1+Rf/Rg = 3.1)
    s.line(non, (400, 315), (400, 380))
    s.dot(400, 380)
    s.line((400, 380), (450, 380))
    s.resistor(450, 380, 570, 380, "Rf 21k", lab_off=(0, 30))
    s.line((570, 380), (600, 380), (600, 290))
    s.line((400, 380), (400, 390))
    s.resistor(400, 390, 400, 470, None)
    s.text(415, 440, "Rg 10k", 16, "start")
    s.ground(330, 470)
    return s.svg("WIEN-BRIDGE OSCILLATOR", "after W. R. Hewlett's thesis (1939), the HP 200A  -  f = 1/(2πRC) ≈ 1 kHz", "Haunted Classics")


def integrator():
    s = Sch(820, 520, "aged", seed=27)
    s.parts.append('<g transform="translate(0,60)">')
    s.source(130, 190, 360, "Vin", "pulse")
    s.text(130, 400, "±1 V square", 15)
    s.line((130, 190), (130, 175), (200, 175))
    s.resistor(200, 175, 330, 175, "R1 10k")
    s.line((330, 175), (400, 175))
    s.dot(400, 175)
    inv, non, out = s.opamp(420, 200)
    s.line((400, 175), inv)
    s.line((400, 175), (400, 100), (470, 100))
    s.capacitor(470, 100, 570, 100, "C1 10nF")
    s.line((570, 100), (620, 100), (620, 200))
    s.line((400, 100), (400, 50), (470, 50))
    s.resistor(470, 50, 570, 50, "Rf 1M", lab_off=(0, -14))
    s.line((570, 50), (620, 50), (620, 100))
    s.line(out, (680, 200))
    s.dot(620, 200)
    s.text(690, 205, "OUT", 16, "start")
    s.line(non, (400, 225), (400, 360))
    s.line((130, 360), (400, 360))
    s.ground(400, 360)
    s.parts.append("</g>")
    return s.svg("OP-AMP INTEGRATOR", "after the 1970s linear-applications handbooks — square in, triangle out", "Haunted Classics")


if __name__ == "__main__":
    save("public/samples/rc-lowpass.svg", rc_lowpass())
    save("public/samples/rlc-ringing.svg", rlc_ringing())
    save("public/samples/diode-rectifier.svg", diode_rectifier())
    save("public/samples/opamp-inverting.svg", opamp_inverting())
    save("public/classics/ne555-astable.svg", ne555())
    save("public/classics/rc-ladder.svg", rc_ladder())
    save("public/classics/wien-bridge.svg", wien())
    save("public/classics/opamp-integrator.svg", integrator())
