# Sounds – sources & licenses (Graveyard Golf)

All sounds are real recordings released under **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/). No synthesizer, no oscillators, no beeps. They were trimmed, faded, made mono, low-passed where needed (deep, never shrill) and loudness-matched; looping beds got a crossfaded seam. `tools/build.mjs` embeds them as base64 into `js/sounds-src.js` so the game also runs via `file://`. The graveyard echo is a generated convolution impulse (processing only). Credit is not required for CC0 and is given voluntarily, by source ID only. Each new Freesound page was checked for the CC0 1.0 license.

## New for this game – Freesound (CC0 1.0)
| File | Used for | Source |
|---|---|---|
| putt, cup | the putter striking the ball; the ball dropping into the cup | Freesound #512505 |
| putt_soft | soft tap when you start aiming | Freesound #119451 |
| cup_b, cup_c | ball rattling into the cup, lip-outs | Freesound #593482 |
| roll_loop | the ball rolling over the felt (follows its speed) | Freesound #260778 |
| wall_1, wall_2 | ball against the stone cushions | Freesound #533476 |
| bounce_1, bounce_2 | ball bouncing after ramp jumps | Freesound #544365 |
| roll_heavy | the ball rumbling through the crypt tunnel | Freesound #128969 |
| gate_creak, lid_creak | the cemetery gate, swinging coffin lids | Freesound #456816 |
| iron_creak | the mausoleum's iron doors | Freesound #625616 |
| stone_grind | tombstones grinding when the graveyard wakes | Freesound #578491 |
| slab_grind | the "HOLE IN ONE!" stone slab rising | Freesound #844329 |
| mill_loop | the creaking scarecrow mill | Freesound #131924 |
| tunnel | the haunted tunnel | Freesound #475876 |

## Reused from earlier games of this series (all CC0 1.0)
| File | Source |
|---|---|
| groan_1 … groan_3, groan_crowd, groan_short | Freesound #58626, #338059, #463721 |
| zombie_grab | Freesound #213509 |
| creak_1, creak_2, creak_long | Freesound #254735, #168650 |
| chain_rattle, body_fall, bones_rattle | Freesound #387240, #264062, #202102 |
| stone_crash, crumble | Freesound #265580, #262118, #512243 |
| magic | Freesound #249819 |
| impact, thud_a | Kenney "Impact Sounds" (CC0 1.0) |
| door_creak, torch_loop | Freesound #728717, #264471, #483316 |
| cackle_s, straw, wing, thump, thump_b, whoosh, swoosh_rise, flap_1, rumble, boom_cine, hit_dram, boom_bass | Freesound #417826, #542690, #389634, #529396, #60013, #264777, #580967, #177242, #255111, #222517, #268084 |
| thud_wood, knock, punch, splat, stone_1, stone_2, gravel_1, dirt, crack | Freesound #447922, #268500, #269232, #445117, #265580, #179341, #155934, #157804 |
| thunder, thunder_big, thunder_soft | Freesound #194364, #243614, #244053 |
| wind | Freesound #481139, #697217 |
| owl, howl, crow, whisper, boo, ghosts | Freesound #558214, #398430, #404687, #175944, #607205, #763804 |
| bats, bat_swarm | Freesound #546823, #245768 |
| fwoosh, stinger, sub, riser | Freesound #557812, #754771, #428073, #822419 |
| choir_ah, choir_swell | Freesound #764330, #458146 |
| success, laugh_kids, cheer, applause, harp | Freesound #615099, #754399, #32260, #160493, #610703 |
| bell_deep, bell_strike, bell_far | Freesound #240586, #219047, #341866 |
| boom | Freesound #264031 |
| fw_burst, fw_burst_b, fw_crackle | Freesound #587184, #335983, #505264 |
| night_loop, eerie_loop | Freesound #251340, #32805, #159509, #437475 |
| wing | Freesound #389634 |

## Music and orchestral hits – VSCO 2 Community Edition (CC0 1.0)
https://github.com/sgossner/VSCO-2-CE – trimmed, faded and loudness-matched; the game re-pitches the nearest recorded note. Original D-minor "graveyard swing" (menu and game), sequenced note by note.

| Files | Instrument |
|---|---|
| org_48 … org_75 (10), ped_24 … ped_42 (7) | pipe organ manual and pedal |
| pz_D3 … pz_D5 (6), cb_E1 … cb_E2 (5) | violin and contrabass pizzicato |
| hp_D4, hp_A4, glissup | harp, harp glissando |
| tp_1 … tp_4, tproll, bd, crash, gong, cymcresc | timpani, bass drum, cymbals, gong |
| clank, bubbles_a | VSCO "Miscellania": metal clank, bubbling |

Code: three.js (MIT, see three.js-MIT.txt). Font: Fredoka (SIL Open Font License 1.1, see Fredoka-OFL.txt).
