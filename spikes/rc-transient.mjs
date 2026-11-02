import { Simulation } from "eecircuit-engine";
const sim = new Simulation();
const t0=Date.now();
await sim.start();
sim.setNetList(`RC low-pass step response
V1 in 0 PULSE(0 5 0 1n 1n 10m 20m)
R1 in out 1k
C1 out 0 1u
.tran 10u 5m
.end`);
const r = await sim.runSim();
console.log("init+run ms", Date.now()-t0);
console.log("header", r.header, "numVariables", r.numVariables, "numPoints", r.numPoints, "dataType", r.dataType);
console.log("vars", r.variableNames ?? r.data.map(d=>d.name));
const time = r.data[0].values, vout = r.data.find(d=>/out/i.test(d.name)).values;
const at = (t)=>{let i=time.findIndex(x=>x>=t);return vout[i];};
for (const t of [1e-3,2e-3,3e-3,5e-3]) console.log(`t=${t*1e3}ms vout=${at(t).toFixed(4)} expected=${(5*(1-Math.exp(-t/1e-3))).toFixed(4)}`);
process.exit(0);
