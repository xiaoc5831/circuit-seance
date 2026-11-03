| Model | Images | Answered | Parsed | Simulated | Behaviour match (±5 %) | R/L/C values right | Fully right (behaviour ✓ + every value) | Exact component set | Median latency | Max latency |
|---|---|---|---|---|---|---|---|---|---|---|
| Gemma-4-31B-IT | 12 | 12 | 12 | 11 | **10/12 (83 %)** | 38/38 (100 %) | 10/12 (83 %) | 11/12 | 15.0 s | 76.0 s |
| MiniCPM-V-4.7-35B-A3B | 12 | 11 | 11 | 9 | **5/12 (42 %)** | 36/38 (95 %) | 5/12 (42 %) | 11/12 | 19.7 s | 32.6 s |
| gpt-5.6-terra | 1 | 1 | 1 | 1 | **1/1 (100 %)** | 2/2 (100 %) | 1/1 (100 %) | 1/1 | 80.1 s | 80.1 s |
| gpt-6.1-sol | 1 | 1 | 1 | 1 | **1/1 (100 %)** | 3/3 (100 %) | 1/1 (100 %) | 1/1 | 4.8 s | 4.8 s |

| Image | Gemma-4-31B-IT | MiniCPM-V-4.7-35B-A3B | gpt-5.6-terra | gpt-6.1-sol |
|---|---|---|---|---|
| rc-lowpass | ✓ tau63 0.0%, final 0.0%; values 2/2; 58.3 s | ✗ api: timeout 90s | ✓ tau63 0.0%, final 0.0%; values 2/2; 80.1 s | n/a |
| rlc-ringing | ✓ ringFreq 0.0%, peak 0.0%; values 3/3; 9.3 s | ✗ ringFreq Infinity%, peak 43.8%; values 3/3; 19.7 s | n/a | ✓ ringFreq 0.0%, peak 0.0%; values 3/3; 4.8 s |
| diode-rectifier | ✓ maxLate 0.6%, minLate 0.7%; values 2/2; 57.8 s | ✗ simulate: strtod: Invalid argument

ERROR: fatal error in ngspice, exi | n/a | n/a |
| opamp-inverting | ✓ ppLate 0.0%; values 2/2; 11.4 s | ✓ ppLate 0.0%; values 2/2; 12.9 s | n/a | n/a |
| ne555-astable | ✗ simulate: Warning: Value of resistor r_dis is too small, set to 1.0000 | ✗ simulate: Too many parameters for subcircuit type "opamp555" (instance | n/a | n/a |
| opamp-integrator | ✓ rampSlope 0.0%; values 3/3; 25.8 s | ✗ rampSlope 77.3%; values 3/3; 30.6 s | n/a | n/a |
| rc-ladder | ✓ f3db 0.0%, gain10k 0.0%; values 4/4; 8.9 s | ✓ f3db 0.0%, gain10k 0.0%; values 4/4; 13.4 s | n/a | n/a |
| wien-bridge | ✗ oscFreq Infinity%; values 6/6; 10.7 s | ✓ oscFreq 0.3%; values 6/6; 29.3 s | n/a | n/a |
| rc-lowpass--tilt | ✓ tau63 0.0%, final 0.0%; values 2/2; 76.0 s | ✓ tau63 0.0%, final 0.0%; values 2/2; 16.8 s | n/a | n/a |
| rlc-ringing--pencil | ✓ ringFreq 0.0%, peak 0.0%; values 3/3; 19.4 s | ✗ ringFreq Infinity%, peak 43.8%; values 3/3; 18.8 s | n/a | n/a |
| opamp-inverting--photo | ✓ ppLate 0.0%; values 2/2; 12.0 s | ✓ ppLate 0.0%; values 2/2; 32.6 s | n/a | n/a |
| wien-bridge--photo | ✓ oscFreq 0.3%; values 6/6; 15.0 s | ✗ oscFreq Infinity%; values 6/6; 28.3 s | n/a | n/a |
