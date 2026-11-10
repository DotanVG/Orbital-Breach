# Animated FLOATING frame time: pre-merge staging 86012ba vs PR 238 head 2c961b7

Headless Chrome, CDP CPU throttle 4x, 8 players, Alien_Swimming mixer ticked every frame, ProjectileSystem.update only, 40+240 frames, 3 interleaved repeats.

| Case | staging 86012ba mean / p95 / p99 (ms) | PR head mean / p95 / p99 (ms) | Mean delta (ms) | Mean ratio |
| --- | ---: | ---: | ---: | ---: |
| hit_every1 | 32.576 / 75.500 / 116.900 | 31.572 / 75.000 / 104.900 | -1.004 | 0.969x |
| miss_every1 | 6.390 / 19.900 / 28.400 | 6.442 / 18.400 / 33.400 | 0.052 | 1.008x |
| hit_every10 | 3.249 / 26.500 / 42.900 | 3.194 / 25.000 / 54.000 | -0.055 | 0.983x |
| miss_every10 | 3.411 / 12.400 / 18.300 | 2.585 / 5.800 / 13.500 | -0.826 | 0.758x |

hit_every1 actorHits: staging 5760/5760, head 5760/5760
hit_every1 zoneShares staging: {"head":5760}; head: {"head":5760}
miss_every1 actorHits: staging 0/5760, head 0/5760
miss_every1 zoneShares staging: {}; head: {}
hit_every10 actorHits: staging 576/576, head 576/576
hit_every10 zoneShares staging: {"head":576}; head: {"head":576}
miss_every10 actorHits: staging 0/576, head 0/576
miss_every10 zoneShares staging: {}; head: {}
