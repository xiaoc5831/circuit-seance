# Haunted Classics — pre-verified netlists (2026-11-03)

Verified by hand with eecircuit-engine 1.9.0 (ngspice-45.2) in Node before handing to Kiro. Results:

- **555 astable**: v(thr) swings 1.667↔3.333 V, v(out) 0/5 V square, period 147.5 µs (theory 0.693·(RA+2RB)·C = 145.5 µs, f≈6.8 kHz).
- **Wien bridge**: v(out) ±12.1 V sine (soft-clipped by tanh op-amp), period 1008 µs (theory 1/(2πRC)=995 Hz).
- **Op-amp integrator**: ±1 V square in → triangle out, −2.59…+2.47 V.
- **RC low-pass** (see spikes/rc-transient.mjs): τ = 1 ms, matches 5(1−e^(−t/τ)) within sampling error.

## astable555

```spice
NE555 astable multivibrator (behavioural, after Signetics 1972)
VCC vcc 0 DC 5
RA vcc dis 1k
RB dis thr 10k
C1 thr 0 10n
* discharge transistor + comparators: switch with hysteresis 1/3..2/3 Vcc
S1 dis 0 thr 0 SW555
.model SW555 SW(Ron=10 Roff=1e9 Vt=2.5 Vh=0.8333)
Bout out 0 V = v(dis) > 1 ? 5 : 0
.tran 0.5u 600u
.end
```

## wien

```spice
Wien bridge oscillator (after Hewlett, 1939)
.subckt opamp inp inn out
Rin inp inn 1e7
B1 out 0 V = 12*tanh(1e4*(v(inp)-v(inn))/12)
.ends
X1 p n out opamp
R1 out a 10k
C1 a p 16n
R2 p 0 10k
C2 p 0 16n
Rf out n 21k
Rg n 0 10k
.ic v(p)=0.01
.tran 5u 20m
.end
```

## integ

```spice
Op-amp integrator (after Philbrick/NatSemi app notes, 1970s)
.subckt opamp inp inn out
Rin inp inn 1e7
B1 out 0 V = 13*tanh(1e5*(v(inp)-v(inn))/13)
.ends
V1 in 0 PULSE(-1 1 0.25m 1u 1u 0.5m 1m)
R1 in n 10k
C1 n out 10n
Rf n out 1meg
X1 0 n out opamp
.ic v(out)=0 v(n)=0
.tran 2u 5m UIC
.end
```
