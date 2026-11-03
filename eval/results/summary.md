| Model | Images | Answered | Parsed | Simulated | Behaviour match (±5 %) | R/L/C values right | Fully right (behaviour ✓ + every value) | Exact component set | Median latency | Max latency |
|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5.6-terra | 1 | 1 | 1 | 1 | **1/1 (100 %)** | 2/2 (100 %) | 1/1 (100 %) | 1/1 | 80.1 s | 80.1 s |
| gpt-6.1-sol | 1 | 1 | 1 | 1 | **1/1 (100 %)** | 3/3 (100 %) | 1/1 (100 %) | 1/1 | 4.8 s | 4.8 s |

| Image | gpt-5.6-terra | gpt-6.1-sol |
|---|---|---|
| rc-lowpass | ✓ tau63 0.0%, final 0.0%; values 2/2; 80.1 s | n/a |
| rlc-ringing | n/a | ✓ ringFreq 0.0%, peak 0.0%; values 3/3; 4.8 s |
| diode-rectifier | n/a | n/a |
| opamp-inverting | n/a | n/a |
| ne555-astable | n/a | n/a |
| opamp-integrator | n/a | n/a |
| rc-ladder | n/a | n/a |
| wien-bridge | n/a | n/a |
| rc-lowpass--tilt | n/a | n/a |
| rlc-ringing--pencil | n/a | n/a |
| opamp-inverting--photo | n/a | n/a |
| wien-bridge--photo | n/a | n/a |
