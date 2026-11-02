/**
 * The offline spirit: explanations that need no API key.
 *  - Bundled circuits get a hand-written explanation with the *measured* numbers
 *    interpolated and compared with textbook theory.
 *  - Anything else gets a rule-based reading of the measurements.
 * Output is Markdown with three sections: what the trace shows / why / try next.
 */
import { eng } from '@/features/scope/scope-math';
import type { Measurements, ChannelMeasure } from './measure';

export type Lang = 'en' | 'zh-CN';

const pct = (sim: number, theory: number) => `${(((sim - theory) / theory) * 100).toFixed(1)}%`;

function ch(m: Measurements, re: RegExp): ChannelMeasure | undefined {
  return m.channels.find((c) => re.test(c.name)) ?? m.channels[m.channels.length - 1];
}

type Explainer = (m: Measurements, L: Lang) => string;

const H = (L: Lang) =>
  L === 'en'
    ? { what: '**What the trace shows**', why: '**Why**', next: '**Try next**' }
    : { what: '**波形在说什么**', why: '**为什么**', next: '**下一步试试**' };

const CANNED: Record<string, Explainer> = {
  'rc-lowpass': (m, L) => {
    const o = ch(m, /out/);
    const tau = o?.tau ?? null;
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nThe green ghost (v(in)) leaps to 5 V at t = 0; the amber one (v(out)) creeps after it and settles at ${eng(o?.final ?? 5, 'V')}. It reaches 63.2 % of the step after **τ ≈ ${eng(tau ?? 0, 's')}**${tau ? ` (theory RC = 1 kΩ × 1 µF = 1 ms, off by ${pct(tau, 1e-3)})` : ''}.\n\n${h.why}\nThe capacitor can only fill through R1, and the current I = (Vin − Vout)/R shrinks as it fills — so the curve is the exponential 5·(1 − e^(−t/RC)). After 5 τ it is within 1 % of the final value: the spirit has crossed over.\n\n${h.next}\nChange C1 to 2.2u and re-run (Ctrl+Enter). Predict the new τ first — then use the homework check below to see if you were right.`;
    return `${h.what}\n绿色的幽灵 v(in) 在 t = 0 跳到 5 V；琥珀色的 v(out) 慢慢追上，最终稳定在 ${eng(o?.final ?? 5, 'V')}。它在 **τ ≈ ${eng(tau ?? 0, 's')}** 时达到阶跃的 63.2 %${tau ? `（理论值 RC = 1 kΩ × 1 µF = 1 ms，误差 ${pct(tau, 1e-3)}）` : ''}。\n\n${h.why}\n电容只能经由 R1 充电，而电流 I = (Vin − Vout)/R 随充电越来越小，于是得到指数曲线 5·(1 − e^(−t/RC))。经过 5τ 后误差小于 1 %——亡灵已经安息。\n\n${h.next}\n把 C1 改成 2.2u 再运行（Ctrl+Enter）。先自己预测新的 τ，再用下方的"作业核对"看看对不对。`;
  },
  'rlc-ringing': (m, L) => {
    const c = ch(m, /n2/);
    const f = c?.freq ?? null;
    const os = c?.overshootPct ?? null;
    const h = H(L);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(0.1 * 253e-9));
    if (L === 'en')
      return `${h.what}\nThe capacitor voltage overshoots to ${eng(c?.max ?? 0, 'V')} — far above the 5 V input — and rings ${f ? `at **≈ ${eng(f, 'Hz')}**` : ''} while slowly dying away${os ? ` (first overshoot ${os.toFixed(0)} %)` : ''}.\n\n${h.why}\nL and C trade energy back and forth like a pendulum; R1 is the friction. Natural frequency f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}. Damping ratio ζ = (R/2)·√(C/L) = 0.08 — well below 1, so it is under-damped and rings.\n\n${h.next}\nSet R1 to 1.26k (ζ = 1, critical damping): the fastest rise with no overshoot. Then try 5k and watch it become sluggish.`;
    return `${h.what}\n电容电压冲到 ${eng(c?.max ?? 0, 'V')}——远高于 5 V 输入——并以 ${f ? `**≈ ${eng(f, 'Hz')}**` : ''} 的频率振荡、慢慢衰减${os ? `（首次过冲 ${os.toFixed(0)} %）` : ''}。\n\n${h.why}\nL 和 C 像钟摆一样来回交换能量，R1 就是摩擦。固有频率 f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}；阻尼比 ζ = (R/2)·√(C/L) = 0.08，远小于 1，属于欠阻尼，所以会振铃。\n\n${h.next}\n把 R1 改成 1.26k（ζ = 1，临界阻尼）：上升最快且没有过冲。再试 5k，看它变得多迟钝。`;
  },
  'diode-rectifier': (m, L) => {
    const o = ch(m, /out/);
    const h = H(L);
    const ripple = o?.ripple ?? null;
    const theory = 9.3 / (50 * 10e3 * 10e-6);
    if (L === 'en')
      return `${h.what}\nThe input swings ±10 V at 50 Hz; the output only follows the positive peaks (≈ ${eng(o?.max ?? 0, 'V')}, one diode drop below 10 V) and sags between them. Ripple ≈ **${eng(ripple ?? 0, 'V')}** pk-pk.\n\n${h.why}\nThe diode conducts only when Vin exceeds Vout + ~0.7 V, topping up C1. In between, C1 discharges through R1 with τ = RC = 100 ms. Estimate: ΔV ≈ Vpk/(f·R·C) = ${eng(theory, 'V')}${ripple ? ` — the simulation says ${eng(ripple, 'V')}` : ''}.\n\n${h.next}\nDouble C1 to 20u (ripple should halve), or add a second diode path for a full-wave bridge and watch the ripple frequency double to 100 Hz.`;
    return `${h.what}\n输入在 50 Hz 下摆动 ±10 V；输出只跟随正峰值（≈ ${eng(o?.max ?? 0, 'V')}，比 10 V 低一个二极管压降），峰值之间缓慢下垂。纹波 ≈ **${eng(ripple ?? 0, 'V')}** 峰峰值。\n\n${h.why}\n只有 Vin 超过 Vout + 约 0.7 V 时二极管才导通，给 C1 补电；其余时间 C1 经 R1 放电，τ = RC = 100 ms。估算：ΔV ≈ Vpk/(f·R·C) = ${eng(theory, 'V')}${ripple ? `——仿真结果为 ${eng(ripple, 'V')}` : ''}。\n\n${h.next}\n把 C1 加倍到 20u（纹波应减半），或改成全波桥式整流，看纹波频率翻倍到 100 Hz。`;
  },
  'opamp-inverting': (m, L) => {
    const i = ch(m, /in\)/);
    const o = ch(m, /out/);
    const gain = i && o && i.pkpk ? -(o.pkpk / i.pkpk) : null;
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nA 1 kHz sine of ${eng(i?.pkpk ?? 1, 'V')} pk-pk goes in; ${eng(o?.pkpk ?? 10, 'V')} pk-pk comes out, **upside-down**. Measured gain ≈ **${gain ? gain.toFixed(2) : '−10'}** (theory −Rf/R1 = −10).\n\n${h.why}\nNegative feedback forces the inverting input to a "virtual ground" (0 V). All input current Vin/R1 must flow on through Rf, so Vout = −Vin·Rf/R1.\n\n${h.next}\nRaise the input to 2 V amplitude: the output wants ±20 V but the op-amp's rails stop it near ±14 V — you will see the tops clipped flat.`;
    return `${h.what}\n输入 1 kHz、${eng(i?.pkpk ?? 1, 'V')} 峰峰值的正弦，输出 ${eng(o?.pkpk ?? 10, 'V')} 峰峰值，而且**上下颠倒**。实测增益 ≈ **${gain ? gain.toFixed(2) : '−10'}**（理论 −Rf/R1 = −10）。\n\n${h.why}\n负反馈把反相输入端钳在"虚地"（0 V）。输入电流 Vin/R1 只能全部流过 Rf，所以 Vout = −Vin·Rf/R1。\n\n${h.next}\n把输入幅度调到 2 V：输出想要 ±20 V，但运放的电源轨把它限制在 ±14 V 左右——你会看到波顶被削平。`;
  },
  rl: (m, L) => {
    const o = ch(m, /out/);
    const tau = o?.tau ?? null;
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nAt each edge the inductor voltage jumps to ±5 V and decays back to 0 with **τ ≈ ${eng(tau ?? 0, 's')}** (theory L/R = 10 mH / 100 Ω = 100 µs). When the input falls, it kicks *negative*.\n\n${h.why}\nAn inductor resists changes in current (V = L·di/dt). At the edge the current cannot jump, so the whole step appears across L; as the current builds, V_L dies away exponentially.\n\n${h.next}\nRemove R1's path when the source switches off and the kick becomes enormous — that is why relays need flyback diodes.`;
    return `${h.what}\n每个边沿处电感电压跳到 ±5 V，再以 **τ ≈ ${eng(tau ?? 0, 's')}** 衰减到 0（理论 L/R = 10 mH / 100 Ω = 100 µs）。输入下降时它会反冲到*负*电压。\n\n${h.why}\n电感阻碍电流变化（V = L·di/dt）。边沿瞬间电流不能突变，整个阶跃都加在 L 上；随着电流建立，V_L 指数衰减。\n\n${h.next}\n如果断电时没有放电通路，反冲电压会非常大——这就是继电器需要续流二极管的原因。`;
  },
  'bjt-common-emitter': (m, L) => {
    const s = ch(m, /sig/);
    const c = ch(m, /coll/);
    const gain = s && c && s.pkpk ? c.pkpk / s.pkpk : null;
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nThe collector sits at ≈ ${eng(c?.mean ?? 5.6, 'V')} DC and swings ${eng(c?.pkpk ?? 1.8, 'V')} pk-pk, inverted, for a ${eng(s?.pkpk ?? 0.4, 'V')} input — a voltage gain of **≈ −${gain ? gain.toFixed(1) : '4.5'}** (theory −RC/RE = −4.7).\n\n${h.why}\nR1/R2 bias the base at ≈ 2 V, so ≈ 1.3 V sits on RE and I_C ≈ 1.3 mA. A small base wiggle moves the emitter current by Δv/RE; the same current through RC gives Δv·RC/RE at the collector.\n\n${h.next}\nAdd a 100u bypass capacitor across RE (\`CE emitter 0 100u\`): the gain jumps toward gm·RC ≈ 200 — and the output starts to clip.`;
    return `${h.what}\n集电极直流约 ${eng(c?.mean ?? 5.6, 'V')}，在 ${eng(s?.pkpk ?? 0.4, 'V')} 输入下反相摆动 ${eng(c?.pkpk ?? 1.8, 'V')} 峰峰值——电压增益 **≈ −${gain ? gain.toFixed(1) : '4.5'}**（理论 −RC/RE = −4.7）。\n\n${h.why}\nR1/R2 把基极偏置在约 2 V，RE 上约 1.3 V，I_C ≈ 1.3 mA。基极的小扰动使发射极电流变化 Δv/RE，同样的电流流过 RC，在集电极产生 Δv·RC/RE。\n\n${h.next}\n在 RE 两端并联 100u 旁路电容（\`CE emitter 0 100u\`）：增益会冲向 gm·RC ≈ 200——输出也开始削顶。`;
  },
  'ne555-astable': (m, L) => {
    const o = ch(m, /out/);
    const f = o?.freq ?? null;
    const theory = 1.44 / ((1e3 + 2 * 10e3) * 10e-9);
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nThe timing capacitor (THR) saws between **1/3 and 2/3 of VCC** (1.67 ↔ 3.33 V) while OUT snaps between 0 and 5 V at **${f ? eng(f, 'Hz') : '≈ 6.8 kHz'}** (Signetics formula 1.44/((RA+2RB)C) = ${eng(theory, 'Hz')}${f ? `, off by ${pct(f, theory)}` : ''}).\n\n${h.why}\nC charges through RA+RB until the threshold comparator trips at 2/3 VCC; the discharge transistor then empties it through RB alone until the trigger comparator fires at 1/3 VCC. Charging is slower than discharging, so the duty cycle is (RA+RB)/(RA+2RB) ≈ 52 %.\n\n${h.next}\nMake RA = 10k: the high time grows, the duty cycle rises to ≈ 67 % — the classic 555 limitation that a diode across RB fixes.`;
    return `${h.what}\n定时电容（THR）在 **VCC 的 1/3 与 2/3 之间**（1.67 ↔ 3.33 V）来回锯齿，OUT 在 0 与 5 V 之间以 **${f ? eng(f, 'Hz') : '≈ 6.8 kHz'}** 跳变（Signetics 公式 1.44/((RA+2RB)C) = ${eng(theory, 'Hz')}${f ? `，误差 ${pct(f, theory)}` : ''}）。\n\n${h.why}\nC 通过 RA+RB 充电，直到阈值比较器在 2/3 VCC 翻转；放电管随后只经 RB 放电，直到触发比较器在 1/3 VCC 动作。充电比放电慢，所以占空比为 (RA+RB)/(RA+2RB) ≈ 52 %。\n\n${h.next}\n把 RA 改成 10k：高电平时间变长，占空比升到约 67 %——这是 555 的经典局限，在 RB 上并一个二极管即可解决。`;
  },
  'rc-ladder': (m, L) => {
    const a = m.ac?.find((x) => /out/.test(x.name)) ?? m.ac?.[m.ac.length - 1];
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nThe Bode plot is flat at ${eng(a?.passbandDb ?? 0, 'dB')} then falls away; −3 dB at **${a?.f3dbHz ? eng(a.f3dbHz, 'Hz') : '≈ 1 kHz'}**, steepening to ≈ ${a?.slopeDbPerDecade?.toFixed(0) ?? '−40'} dB/decade at the top.\n\n${h.why}\nEach RC section contributes a pole (−20 dB/decade). Section 1 alone corners at 1/(2π·1k·100n) = 1.59 kHz and section 2 at 1.59 kHz too — but they interact: R2 loads C1, splitting the poles, so the combined −3 dB point lands lower than either.\n\n${h.next}\nMake R2 = 100k and C2 = 1n (same RC, 10× higher impedance): the loading disappears and the corner moves back toward the textbook value.`;
    return `${h.what}\n波特图先在 ${eng(a?.passbandDb ?? 0, 'dB')} 保持平坦然后下降；−3 dB 点在 **${a?.f3dbHz ? eng(a.f3dbHz, 'Hz') : '≈ 1 kHz'}**，高频处斜率接近 ${a?.slopeDbPerDecade?.toFixed(0) ?? '−40'} dB/十倍频。\n\n${h.why}\n每节 RC 贡献一个极点（−20 dB/十倍频）。第一节单独的转折频率为 1/(2π·1k·100n) = 1.59 kHz，第二节也是 1.59 kHz——但两节相互影响：R2 加载 C1，使极点分裂，合成的 −3 dB 点比任一节都低。\n\n${h.next}\n把 R2 改为 100k、C2 改为 1n（RC 不变，阻抗高 10 倍）：加载效应消失，转折频率回到教科书值附近。`;
  },
  'wien-bridge': (m, L) => {
    const o = ch(m, /out/);
    const f = o?.freq ?? null;
    const theory = 1 / (2 * Math.PI * 10e3 * 16e-9);
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nFrom a 10 mV seed the sine grows until it reaches the op-amp's soft limits (≈ ±${eng(o?.max ?? 12, 'V')}), then holds steady at **${f ? eng(f, 'Hz') : '≈ 1 kHz'}** (theory 1/(2πRC) = ${eng(theory, 'Hz')}${f ? `, off by ${pct(f, theory)}` : ''}).\n\n${h.why}\nAt f₀ the series-RC / parallel-RC network passes exactly 1/3 of the output back to the + input with zero phase shift. The non-inverting gain 1 + Rf/Rg = 3.1 is just above 3, so the loop gain exceeds 1 and the oscillation builds — until clipping trims the gain back to exactly 1.\n\n${h.next}\nSet Rf to 19k (gain 2.9 < 3): the ghost fades instead of growing. That knife-edge is why Hewlett used a light bulb as an automatic gain control.`;
    return `${h.what}\n从 10 mV 的初始扰动开始，正弦波不断增长，直到碰到运放的软限幅（≈ ±${eng(o?.max ?? 12, 'V')}），随后稳定在 **${f ? eng(f, 'Hz') : '≈ 1 kHz'}**（理论 1/(2πRC) = ${eng(theory, 'Hz')}${f ? `，误差 ${pct(f, theory)}` : ''}）。\n\n${h.why}\n在 f₀ 处，串联 RC / 并联 RC 网络恰好把输出的 1/3、以零相移送回同相端。同相增益 1 + Rf/Rg = 3.1 略大于 3，环路增益大于 1，振荡得以建立——直到限幅把增益削回恰好 1。\n\n${h.next}\n把 Rf 改为 19k（增益 2.9 < 3）：幽灵会逐渐消失而不是增长。正是这种临界状态，让 Hewlett 用一只灯泡做了自动增益控制。`;
  },
  'opamp-integrator': (m, L) => {
    const o = ch(m, /out/);
    const h = H(L);
    if (L === 'en')
      return `${h.what}\nA ±1 V, 1 kHz square wave goes in; a **triangle** of ${eng(o?.pkpk ?? 5, 'V')} pk-pk comes out, centred near 0 V.\n\n${h.why}\nThe inverting input is a virtual ground, so a constant current Vin/R1 = 100 µA flows into C1, and its voltage ramps linearly: dVout/dt = −Vin/(R1·C1) = ∓10 V/ms. Over half a period (0.5 ms) that is 5 V — exactly the triangle's height. Rf = 1 MΩ bleeds off DC so tiny offsets cannot ramp the output into the rails.\n\n${h.next}\nRemove Rf (\`*Rf n out 1meg\`) and add a 10 mV DC offset to the source: watch the output drift away — the integrator's eternal curse.`;
    return `${h.what}\n输入 ±1 V、1 kHz 方波，输出 ${eng(o?.pkpk ?? 5, 'V')} 峰峰值的**三角波**，中心在 0 V 附近。\n\n${h.why}\n反相端是虚地，恒定电流 Vin/R1 = 100 µA 流入 C1，电容电压线性变化：dVout/dt = −Vin/(R1·C1) = ∓10 V/ms。半个周期（0.5 ms）恰好变化 5 V——正是三角波的高度。Rf = 1 MΩ 泄放直流，防止微小失调把输出推到电源轨。\n\n${h.next}\n去掉 Rf（\`*Rf n out 1meg\`）并给信号源加 10 mV 直流偏置：看输出慢慢漂走——这是积分器永恒的诅咒。`;
  },
};

/** Rule-based reading of any circuit's measurements. */
function generic(m: Measurements, L: Lang): string {
  const h = H(L);
  if (m.analysis === 'op' && m.op) {
    const rows = Object.entries(m.op)
      .map(([k, v]) => `- ${k} = ${eng(v, /^i\(/.test(k) ? 'A' : 'V', 4)}`)
      .join('\n');
    return L === 'en'
      ? `${h.what}\nThe DC operating point — every node frozen in its resting state:\n${rows}\n\n${h.why}\nWith no time-varying sources, capacitors act as open circuits and inductors as shorts; ngspice solves the remaining resistive network with Kirchhoff's laws.\n\n${h.next}\nAdd \`.tran\` with a pulse or sine source to watch the circuit move.`
      : `${h.what}\n直流工作点——每个节点都定格在静止状态：\n${rows}\n\n${h.why}\n没有时变源时，电容相当于开路、电感相当于短路，ngspice 用基尔霍夫定律求解剩下的电阻网络。\n\n${h.next}\n加上 \`.tran\` 和脉冲或正弦源，看电路动起来。`;
  }
  if (m.analysis === 'ac' && m.ac?.length) {
    const lines = m.ac
      .map((a) =>
        L === 'en'
          ? `- ${a.name}: ${a.kind}, passband ${a.passbandDb} dB${a.f3dbHz ? `, −3 dB at ${eng(a.f3dbHz, 'Hz')}` : ''}${a.slopeDbPerDecade ? `, roll-off ≈ ${a.slopeDbPerDecade.toFixed(0)} dB/dec` : ''}`
          : `- ${a.name}：${a.kind === 'low-pass' ? '低通' : a.kind === 'high-pass' ? '高通' : a.kind === 'band-pass' ? '带通' : '平坦'}，通带 ${a.passbandDb} dB${a.f3dbHz ? `，−3 dB 点 ${eng(a.f3dbHz, 'Hz')}` : ''}${a.slopeDbPerDecade ? `，衰减斜率 ≈ ${a.slopeDbPerDecade.toFixed(0)} dB/十倍频` : ''}`,
      )
      .join('\n');
    return L === 'en'
      ? `${h.what}\n${lines}\n\n${h.why}\nEvery −20 dB/decade of roll-off means one more pole (one more independent capacitor or inductor in the signal path).\n\n${h.next}\nCompare the −3 dB point with 1/(2πRC) for each RC pair, and see which one dominates.`
      : `${h.what}\n${lines}\n\n${h.why}\n衰减斜率每多 −20 dB/十倍频，就意味着信号通路上多一个极点（多一个独立的电容或电感）。\n\n${h.next}\n把 −3 dB 点与每对 RC 的 1/(2πRC) 比较，看哪一个起主导作用。`;
  }
  const lines = m.channels
    .map((c) => {
      const bits: string[] = [];
      if (L === 'en') {
        bits.push(`${eng(c.min, c.unit)} … ${eng(c.max, c.unit)}`);
        if (c.freq) bits.push(`periodic at ${eng(c.freq, 'Hz')}`);
        if (c.tau) bits.push(`τ ≈ ${eng(c.tau, 's')}`);
        if (c.overshootPct) bits.push(`overshoot ${c.overshootPct.toFixed(0)} %`);
        if (!c.freq) bits.push(`settles at ${eng(c.final, c.unit)}`);
      } else {
        bits.push(`${eng(c.min, c.unit)} … ${eng(c.max, c.unit)}`);
        if (c.freq) bits.push(`周期信号，${eng(c.freq, 'Hz')}`);
        if (c.tau) bits.push(`τ ≈ ${eng(c.tau, 's')}`);
        if (c.overshootPct) bits.push(`过冲 ${c.overshootPct.toFixed(0)} %`);
        if (!c.freq) bits.push(`最终值 ${eng(c.final, c.unit)}`);
      }
      return `- ${c.name}: ${bits.join(', ')}`;
    })
    .join('\n');
  const anyTau = m.channels.some((c) => c.tau);
  const anyPeriodic = m.channels.some((c) => c.freq);
  const why =
    L === 'en'
      ? anyTau
        ? 'An exponential settle means energy is stored in a capacitor or inductor and released through a resistance: τ = RC or L/R.'
        : anyPeriodic
          ? 'A steady periodic trace means the circuit is either driven by a periodic source or oscillating on its own (positive feedback).'
          : 'The node voltages follow the sources through the network; compare their ratios with your hand analysis.'
      : anyTau
        ? '指数式的趋稳说明能量储存在电容或电感中、并经电阻释放：τ = RC 或 L/R。'
        : anyPeriodic
          ? '稳定的周期波形说明电路要么受周期源驱动，要么因正反馈而自激振荡。'
          : '各节点电压随电源经网络变化；把它们的比值与你的手算结果对照。';
  return L === 'en'
    ? `${h.what}\n${lines}\n\n${h.why}\n${why}\n\n${h.next}\nHover the screen to read exact values with the cursor, then change one component and predict the result before re-running.`
    : `${h.what}\n${lines}\n\n${h.why}\n${why}\n\n${h.next}\n把鼠标移到屏幕上，用光标读出精确数值；然后改一个元件，先预测结果再重新仿真。`;
}

export function offlineExplanation(circuitId: string | null, m: Measurements, L: Lang): string {
  const fn = circuitId ? CANNED[circuitId] : undefined;
  return fn ? fn(m, L) : generic(m, L);
}

export const hasCannedExplanation = (id: string | null | undefined) => !!id && id in CANNED;
