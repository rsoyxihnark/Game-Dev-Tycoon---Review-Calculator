# The review algorithm in codeNw.js

Everything below was read out of `codeNw.js` in this repository. Line numbers are that file.
Quoted code is the game's own minified text, copied, not retyped.

## Finding your way around the file

The file is minified: about 1900 lines of roughly 500 characters, no comments, one-letter
variable names that are reused for different values inside the same function. Two habits
make it workable:

- `grep -n -o ".\{0,200\}SOMETHING.\{0,300\}" codeNw.js` to read around a name.
- `sed -n '478,495p' codeNw.js` to read a whole function once you know where it starts.

Cite line numbers, never byte offsets. A single edit anywhere above moves every offset in
the file, and a note that says "around offset 244500" is then pointing at nothing.

### What the letters hold inside `Reviews.rateGame`

Track the value, not the name. The same letter carries three different things in one
function, and reading the tail of `rateGame` with the wrong meaning in mind produces a
confident, wrong answer.

| Letter | What it holds, in order of assignment |
| --- | --- |
| `d` | the company (the function's only argument) |
| `g` | the game, `d.currentGame` |
| `k`, `m` | the bad-review and good-review message lists |
| `l` | the MMO factor (2 for an MMO, else 1), then the base production score |
| `p` | design points, then the topic to genre weight, then the demotion flag |
| `q` | technology points, then the previous release, then the platform to genre weight |
| `s` | the quality term, the thing that becomes `1 + s` |
| `u` | the good-flag counter, then the technical expertise factor |
| `t` | the bad-flag counter, then a loop variable |
| `v` | the golden-ratio percentage, then the genre display name, then topic to audience |
| `A` | the odd-focus mission list, then the bug factor |
| `r` | the mission list, then the tech spread factor, then the trend, then the rescue score |
| `B` | the target top score, then the staff count, then the highest tech level |
| `z` | the score: first `l / topScore`, then that times ten, then the final value |
| `n` | the original game when this one is a sequel or an expansion |

## Where things live

| What | Line | Name in the file |
| --- | --- | --- |
| Tuning constants | 10 | `GameFlags={...}` |
| Golden ratios, genre weights | 247 | `GameGenre.getGoldenRatio`, `GameGenre.getGenreWeighting` |
| Trend factor | 249 | `GameTrends.getCurrentTrendFactor` |
| Duration of a mission | 326 | `General.getDuration` |
| Size factors | 328, 327 | `General.getGameSizePointsFactor`, `getGameSizeDurationFactor` |
| Multi-platform duration | 327 | `General.getMultiPlatformDurationFactor` |
| Topic to audience weight | 331 | `General.getAudienceWeighting` |
| Optimal team size | 334 | `General.getOptimalTeamSize` |
| Mission weight with overrides | 417 | `Missions.getGenreWeighting` |
| Mission table, 9 missions | 418 | `Missions.Stage1Missions` and Stage2, Stage3 |
| Platform weight normalising | 426 | `Platforms.getNormalizedGenreWeighting` |
| Platform table | 427 onward | `var a=[{id:"PC"...]` then `Platforms.allPlatforms.addRange(...)` |
| Multi-platform blend | 451 | `Platforms.getGenreWeighting`, `getPlatformsAudienceWeighting` |
| Topic table, 66 topics | 454 | `Topics.topics=[...]` |
| The review module | 473 to 495 | `var Reviews={}` then one IIFE |
| Target top score and its update | 474 | the IIFE's private `a`, `b` and `c` |
| Technical expertise factor | 477 | the IIFE's private `f` |
| The score itself | 478 | `Reviews.rateGame=function(d)` |
| Four reviewer scores | 493 | `Reviews.getReviews`, `Reviews.getNewStaff` |
| Slider to time share | 928 | `UI._getSelectedFeaturePercentages` |
| The game's tech level | 912 | `b.flags.techLevel=b.features.filter(...).average(...)` |

The platform table is built in pieces. `var a=[...]` holds the first five, then
`Platforms.allPlatforms.addRange([...])` appends the rest. Reading only the first literal
gets you five platforms out of twenty-nine.

Three platform functions on line 426 have near-identical names and different jobs:
`Platforms.getNormalizedGenreWeighting` maps one raw weight to its normalised value,
`Platforms.getNormGenreWeighting` normalises a whole weight array for a genre pair, and
`Platforms.getNormalizedAudienceWeighting` does the first job for an audience weight. Grep
for the wrong one and you will read the wrong function. `Platforms.getAudienceWeighting`
and `Platforms.getPlatformsAudienceWeighting` on line 451 are a second such pair, and only
the second of those is called from the review.

## The symbols the game shows, and the numbers behind them

Every guide and every comment about this game is written in `+++` and `--`, while this page
and the code are written in weights. `Knowledge.getFactorAdj` is the translation, and it
rounds to one decimal before it chooses:

| Weight | Symbol | Word on screen |
| --- | --- | --- |
| 1.0 and above | `+++` | great |
| 0.9 | `++` | good |
| 0.8 | `+` | okay |
| 0.7 | `--` | bad |
| below 0.7 | `---` | terrible |

The same five bands label a topic to genre pair, a topic to audience pair, a platform pair
and a mission's fit to a genre, so the symbol a player reads never says which of those it is
or what it costs.

None of the review's own thresholds sit on the band edges a reader would guess:

- the focus bonus wants a mission at 0.9 or better, so `+++` and `++` and nothing else
- the odd-focus penalty fires below 0.8, so `--` and `---`, which leaves `+` free
- the halving gate fires at 0.7 or lower, so `--` is a cliff and not one step worse than `+`
- the platform audience cut reads the normalised weight, where the raw 0.7 and 0.6 of `--`
  and `---` arrive as 0.8 and 0.65

So `+` is safe wherever the penalty tests for below 0.8, and ruinous nowhere, while the step
from `+` to `--` is the expensive one on every axis that has a cliff.

The wiki's own mission tables print `~` where the game shows `+`, for the same 0.8. A reader
moving between the two is looking at one weight under two symbols.

Counting the topic to genre grid with those bands: of the 396 pairs, 138 are great at 1.0 and
97 are terrible at 0.6. Seventeen of the 66 topics carry more terrible pairs than great ones,
Transport worst at four against two, so the usual claim that bad pairs are rare holds for the
grid as a whole and not for a quarter of the topics in it.

## The pipeline, in order

`Reviews.rateGame(d)` takes the company, reads `d.currentGame`, and writes `g.score`.
Nothing else in the file decides a review score.

### 1. Quality factor, the term called `s`

`s` starts at 0 and collects bonuses and penalties. The final multiplier is `1 + s`.

**Design to technology balance.** Skipped entirely when `designPoints + technologyPoints`
is under 30.

```
var r=GameGenre.getGoldenRatio(g.genre,g.secondGenre), r=p*r-q,
    v = q>p ? Math.abs(r/q*100) : Math.abs(r/p*100);
25>=Math.abs(v) ? (s+=0.1,u+=1,...) : 50<Math.abs(v) && (s-=0.1,...)
```

`p` is design, `q` is technology, and the percentage is measured against whichever of the
two is larger. Golden ratios: Action 1.8, Adventure 0.4, RPG 0.6, Simulation 1.6,
Strategy 1.4, Casual 0.5. A second genre blends as `(2*first + second)/3`.

Setting `r` to zero means `technology = design * goldenRatio`, so the target reads:

| Genre | Ratio | What to aim for |
| --- | --- | --- |
| Action | 1.8 | technology about 1.8 times design |
| Simulation | 1.6 | technology about 1.6 times design |
| Strategy | 1.4 | technology about 1.4 times design |
| RPG | 0.6 | design about 1.7 times technology |
| Casual | 0.5 | design about 2 times technology |
| Adventure | 0.4 | design about 2.5 times technology |

Within 25 percent gives `+0.1`, past 50 percent gives `-0.1`, and the band between gives
nothing. Only the bonus raises the good-flag counter `u`. When the penalty fires, `r < 0`
prints "focus more on design", because a negative `r` means technology already ran ahead.

The percentage is not symmetric. It divides by whichever of design and technology is
larger, while the ratio multiplies the design side, so a target above 1 and its reciprocal
below 1 do not cost the same for a mirrored point split. Produce 100 and 70 in the
direction the genre wants and the miss reads:

| Genre | Ratio | Split | Off by |
| --- | --- | --- | --- |
| Strategy | 1.4 | D70 T100 | 2 percent |
| RPG | 0.6 | D100 T70 | 10 percent |
| Simulation | 1.6 | D70 T100 | 12 percent |
| Casual | 0.5 | D100 T70 | 20 percent |
| Action | 1.8 | D70 T100 | 26 percent |
| Adventure | 0.4 | D100 T70 | 30 percent |

So the same 10 to 7 output mix earns the bonus in four genres and just misses it in Action
and Adventure, the two whose ratios sit furthest from 1. None of the six reaches the 50
percent penalty on that mix.

Inverting that formula gives the window a player actually has to land in. With `x` as the
technology to design ratio the game sees, `v` is `abs(ratio - x) * 100` while `x` is at or
below 1 and `abs(ratio/x - 1) * 100` once `x` passes 1, so the band is not symmetric around
the target and the upper edge stretches:

| Genre | Ratio | `-0.1` below | `+0.1` from | Target | `+0.1` to | `-0.1` above |
| --- | --- | --- | --- | --- | --- | --- |
| Adventure | 0.4 | under 0.00 | 0.15 | 0.40 | 0.65 | over 0.90 |
| Casual | 0.5 | under 0.00 | 0.25 | 0.50 | 0.75 | over 1.00 |
| RPG | 0.6 | under 0.10 | 0.35 | 0.60 | 0.85 | over 1.20 |
| Strategy | 1.4 | under 0.90 | 1.12 | 1.40 | 1.87 | over 2.80 |
| Simulation | 1.6 | under 1.07 | 1.28 | 1.60 | 2.13 | over 3.20 |
| Action | 1.8 | under 1.20 | 1.44 | 1.80 | 2.40 | over 3.60 |

So a game lands the `+0.1` when its technology to design ratio sits between the two inner
columns, and takes the `-0.1` only outside the outer pair. Adventure and Casual have no
reachable lower penalty at all, since the band bottoms out at zero technology.

A second genre moves the target, and `(2*first + second)/3` over six ratios gives thirty
ordered pairs. The one that lands on a target of exactly 1.0, where the game simply wants
equal design and technology, is RPG with Action second:

| Pair | Target | Pair | Target |
| --- | --- | --- | --- |
| RPG / Action | 1.000 | Strategy / Casual | 1.100 |
| Strategy / Adventure | 1.067 | Strategy / RPG | 1.133 |
| Casual / Action | 0.933 | Adventure / Action | 0.867 |
| RPG / Simulation | 0.933 | Casual / Simulation | 0.867 |

Order matters, since the first genre counts twice. Action with RPG second is 1.400, not 1.000.

**Mission focus.** Each of the 9 dev missions has a share of its stage's time. The game
compares that share against the mission's genre weight for this game.

```
0.9 <= Missions.getGenreWeighting(a,g) && 0.4 <= b    good focus
0.8 >  Missions.getGenreWeighting(a,g) && 0.4 <= b    odd focus
0.9 <= Missions.getGenreWeighting(a,g) && 0.2 >= b    forgotten
```

Two or more good: `s += 0.2`, and `u` rises by how many. Exactly one: `s += 0.1`, `u += 1`.
None at all: `s -= 0.15 * mmoFactor`, where the MMO factor is 2 for an MMO and 1 otherwise.

Odd focus costs `0.2 * mmoFactor` for exactly two and `0.1 * mmoFactor` for exactly one, and
raises `t` by the number counted. It is counted with `2===A.length` and `1===A.length`, not
"two or more". Three odd missions therefore cost nothing at all. That is the game's
behaviour, not a typo to fix. Both odd-focus amounts carry the MMO doubling, the same as the
no-good-focus and forgotten-mission penalties, so on an MMO two odd missions cost 0.4.

Each forgotten mission costs `0.15 * mmoFactor` and raises the bad-flag counter `t`.

**The mission table.** `technologyFactor` and `designFactor` decide what a mission's time
turns into. The six weights are the genre fit, in the order Action, Adventure, RPG,
Simulation, Strategy, Casual.

| Stage | Mission id | Shown as | Tech | Design | Act | Adv | RPG | Sim | Str | Cas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Engine | Engine | 0.8 | 0.2 | 1.0 | 0.7 | 0.7 | 0.9 | 0.9 | 0.6 |
| 1 | Gameplay | Gameplay | 0.2 | 0.8 | 0.9 | 0.8 | 0.9 | 1.0 | 1.0 | 1.0 |
| 1 | Story/Quests | Story/Quests | 0.2 | 0.8 | 0.7 | 1.0 | 1.0 | 0.8 | 0.8 | 0.7 |
| 2 | Dialogs | Dialogues | 0.1 | 0.9 | 0.6 | 1.0 | 1.0 | 0.7 | 0.7 | 0.7 |
| 2 | Level Design | Level Design | 0.6 | 0.4 | 0.9 | 0.8 | 0.9 | 0.9 | 1.0 | 1.0 |
| 2 | AI | Artificial Intelligence | 0.8 | 0.2 | 1.0 | 0.7 | 0.8 | 1.0 | 0.9 | 0.6 |
| 3 | World Design | World Design | 0.4 | 0.6 | 0.8 | 1.0 | 1.0 | 0.8 | 1.0 | 0.7 |
| 3 | Graphic | Graphic | 0.5 | 0.5 | 1.0 | 0.9 | 0.9 | 1.0 | 0.8 | 1.0 |
| 3 | Sound | Sound | 0.4 | 0.6 | 0.9 | 0.8 | 0.8 | 0.9 | 0.9 | 0.9 |

Across the nine the technology factors sum to 4.0 and the design factors to 5.0, so a game
that spread its time evenly would generate 25 percent more design than technology. That is
the reason the design-leaning genres are the easier ones to hit.

The id is what the code matches on; the shown name is only a label. A second genre blends
each weight as `(2*first + second)/3`, so a mixed game can sit between the table's values.

That blending thins out the 0.9 band, which is the real trade in a mixed genre. Strategy on
its own counts six missions at 0.9 or better and RPG counts six; blend them and only three
survive, Gameplay, Level Design and World Design, and Strategy with Adventure leaves the same
three. Fewer missions carry a rule, so most sliders go free, but the focus bonus still wants
two of them above 40 percent and there are now only three to pick from.

**Topic overrides on mission weights.** Nine of the 66 topics replace individual mission
weights. `topic.missionOverrides` is six rows, one per genre in the order above, each nine
entries long, one per mission. A zero means "keep the mission's own weight", anything else
replaces it.

```
var m=Missions.DevMissions.indexOf(d);
if(-1!=m) for(var l=b.topic.missionOverrides,g=0;g<l.length;g++){var n=l[g][m];n&&(k[g]=n)}
```

`indexOf` supplies the column, the mission's position among the nine, while the row is the
genre the loop is on. It matches the mission object itself, not its id, so a mission object
that is not the canonical one scores as if the topic had no overrides at all, silently. The
line before it repairs the common case: an object with no `genreWeightings` of its own is
looked up again by id, which is why the game's own feature-log entries work. A copy that
carries `genreWeightings` is the one that breaks, because then nothing repairs it.

| Topic | Genres it overrides |
| --- | --- |
| Sports | Action, Adventure, RPG, Simulation, Strategy |
| Racing | Action, Adventure, Simulation |
| Mystery | Action, Simulation, Strategy |
| Horror | Action, Adventure |
| Detective | Action, Simulation, Strategy |
| Cyberpunk | Action, Adventure, Simulation, Strategy, Casual |
| Law | Action, Simulation, Casual |
| Music | all six |
| Rythm | all six |

The game spells that last topic `Rythm`. Overrides are keyed by genre only; the target
audience never changes a mission weight.

**The rest of `s`.**

| Condition | Change |
| --- | --- |
| Same topic, genre and second genre as the previous release, and not an expansion | `-0.4`, `t += 1` |
| Sequel or expansion released within 40 weeks of the original | `-0.4`, `t += 1` |
| Same engine as the original, and not an expansion | `-0.1`, `t += 1` |
| A better engine than the original | `+0.2`, `u += 1` |
| MMO whose topic to genre weight is below 1.0 | `-0.15` |

The engine pair is an either-or: `usesSameEngineAsSequel && !isExtensionPack ? -0.1 :
hasBetterEngineThanSequel && +0.2`. Carrying the same engine forward blocks the bonus.
The MMO penalty is the one entry that moves neither counter.

An expansion pack goes down the same path as a sequel. `UI._showGameDefinition` sets
`sequelTo` for both, and `createPack` only adds locked settings on top, so an expansion
carries a sequel target like any other. That puts it in the better seat on this row: the
`-0.1` is barred to it by `!isExtensionPack`, while the `+0.2` is not, so an expansion built
on a newer engine than the game it expands collects the bonus and can never pay the penalty.

The MMO row reads the blended weight, second genre included, and the blend is
`(2*first + second)/3`. Since no single weight passes 1.0, that blend reaches 1.0 only when
both genres sit at 1.0, so a mixed-genre MMO needs two great combinations and not one. A
1.0 paired with a 0.9 blends to 0.9667 and takes the penalty.

A perfect run reaches `s = 0.5`, so `1 + s = 1.5`, and 1.3 without the sequel bonus.

### 2. Base score

```
l=(p+q)/2/General.getGameSizePointsFactor(g);
l=(l+l*s)*q; l*=v; l*=A; l*=r; r=GameTrends.getCurrentTrendFactor(g); l*=r;
```

Reading the reused names back out, that is

```
base = (design + technology) / 2 / sizeFactor
     * (1 + s) * platformGenre * topicAudience * bugs * techSpread * trend
```

Size factors are 1.0 small, 1.2 medium, 1.4 large, 1.8 AAA.

**Platform to genre**, `Platforms.getGenreWeighting`, normalises each platform's weight
(1.0 becomes 1.1, 0.9 becomes 1.05, 0.8 stays 1.0, 0.7 becomes 0.95, 0.6 becomes 0.9) and
then blends across platforms with a running `d *= 0.7`:

- one platform: its full weight
- two: 70 percent of the first plus 30 percent of the second
- three: 70, 49, and minus 19 percent

The share is negative from the third platform on, and it lands on whichever platform is
last in `g.platforms`. A third platform that fits the genre well therefore lowers the
score. That is in the game. The in-game screen offers three platform slots and no more:
`UI._updatePickPlatformButtonStates` at line 865 loops `for(...,f=0;3>f;f++)`.

**Topic to audience** is the raw table value, not normalised.

**Bugs**: with no bugs the factor is exactly 1 and the branch is skipped. With bugs,
`A = 1 - 0.8 * clamp(100/(technology+design)*bugs, 0, 100)/100`, so it floors at 0.2.

**Tech spread**: with more than one platform, `1 - (highest - lowest)/20` over the
platforms' tech levels. The shipped platforms carry levels 1 to 7, so across those the
widest spread is 6 and the factor stays at 0.70 or above. One platform leaves it at exactly
1. A console the player builds is not bound by that: its `techLevel` is the average of its
parts' levels, which run 0 to 7, and its id is not `PC`, so it is neither skipped nor
rounded. With one of those in the list the spread can pass 6 and the factor can fall below
0.70.
PC is skipped by an explicit `"PC"==id` test in the loop. It also happens to carry no
`techLevel` field, but that is incidental, not the reason.

**Trend**: 1.2 when the game matches a genre trend, an audience trend, or a new-topic trend,
and the new-topic case needs a topic that has never appeared in the game log at all. During
a strange-combinations trend it is 0.85 for a perfect topic-genre pair, 1.1 for 0.9, 1.2 for
0.8, and 1.4 for anything lower. That lookup passes only the first genre, so a second genre
can never produce a value in between. Any other trend, or none, leaves it at 1.

### 3. Against the top score

```
B=a(d); z=l/B;
```

`a(d)` is the target the game holds you to. With no top score on record it returns 20.
Otherwise:

```
yearFactor = year <= 6 ? 1.15 : year > 23 ? 1.10 : 1.20
target     = floor(lastTopScore + lastTopScoreIncrease * yearFactor)
warmup     = 6 + 9 * getGameSizeDurationFactor(lastTopScoreGameSize)
no week on record, or currentWeek >= lastTopScoreWeek + warmup  ->  target
otherwise  ->  floor(previousTopScore + (target - previousTopScore) * weeksElapsed / warmup)
```

So the divisor steps up every time you beat it, and inside the warm-up window it ramps
there one week at a time instead of jumping. The warm-up is the time to build another game
of the last record-setting size: 15 weeks after a small game, 60 after an AAA. The result
is always an integer, and by late game it sits in the hundreds.

The increase itself is set when a record is beaten: `lastTopScoreIncrease` becomes
`max(newScore - lastTopScore, 0.1 * currentTarget)`, and from office level 2 upward it is
capped at 20 percent of `lastTopScore`. On the very first record there is no previous
score, so it is `max(newScore - 20, 2)`.

`previousTopScore`, the floor the ramp starts from, is rewritten in the same step and
nowhere else:

```
l = max(lastTopScore, 20)
previousTopScore = min(l, currentTarget)
previousTopScore += abs(newScore - previousTopScore) / 3
if (previousTopScore > newScore) previousTopScore = newScore
```

So it lands a third of the way from the smaller of the old record and the old target up
towards the new base score, and never above that score. The `abs` makes no difference to the
result, because the line after it caps anything that overshoots.

Two penalties then land on the ratio, while it is still `l / topScore` and not yet
multiplied by ten:

- At 0.6 or above, if either the topic to genre weight or the topic to audience weight is
  0.7 or lower, everything above 0.6 is halved.
- Above 0.7, the first platform whose normalised audience weight is 0.8 or lower multiplies
  the base score by its raw weight, and the loop stops there. It checks the normalised value
  and multiplies by the raw one. `Platforms.getPlatformsAudienceWeighting` returns the raw
  number only when its third argument is truthy, and falls back to 0.8 raw or 1 normalised
  when the audience or the weight array is missing. `Platforms.getNormalizedAudienceWeighting`
  is `a >= 0.8 ? a+0.2 : a >= 0.7 ? a+0.1 : a+0.05`, so raw 1.0, 0.9 and 0.8 normalise to
  1.2, 1.1 and 1.0, while 0.7 becomes 0.8 and 0.6 becomes 0.65. The gate therefore admits
  exactly the platforms whose raw weight is 0.7 or 0.6, and across all 91 shipped platform
  entries those are the only raw values below 0.8. The multiplier is only ever 0.7 or 0.6.
  Its last line, and the matching line in
  `General.getAudienceWeighting`, is `throw"unknown audience: "+genre`, where `genre` is not
  a parameter and not declared anywhere in the file, so an unknown audience raises a
  ReferenceError instead of that message. No shipped audience reaches it.

Then `p=!1` and `z = clamp(10 * z, 1, 10)`.

That `p=!1` matters more than it looks. `p` is still holding the topic to genre weight at
this point, a number between 0.6 and 1.0, and the random ceiling further down fires on
`p && ...`. Without this one assignment the demotion at 9 and above would be unconditional.

### 4. The rescue bracket

A floor for bad games that were at least made thoughtfully. It needs all of:
`lastTopScore > 0`, `z <= 5.2 - 0.2 * platformCount`, `u > 0`, `u > t`, and a team
contribution of 0.8 or better.

It starts at 6 and subtracts: one point for each step of `abs(optimal - count)` beyond the
first, so being under the optimal team size costs exactly as much as being over it, half a point
per new hire, `t/2` minus `u/2`, 0.5 when the bug factor is under 0.9, the shortfall when
the platform-genre or topic-audience weight is 0.8 or lower, twice the platform tech spread,
and one random draw. The result is capped at 7.7 and only replaces the score if it is higher.

The optimal team size is 1 for a small game, 3 medium, 5 large, 6 AAA.

Two traps here. The gate is `lastTopScore > 0`, not the top-score achievement count: the
ceiling demotion below sets `lastTopScore` without touching that counter. And
`0.9>A ? r-=0.5 : 0.6>=A && (r-=1)` can never reach its second branch, because a bug factor
of 0.6 or less is already under 0.9. Both are reproduced as written.

**The quiet downward re-anchor.** Still inside the rescue block, after the floor has been
applied:

```
if(3<d.gameLog.length){u=!0;
  for(r=1;3>=r;r++) if(t=d.gameLog[d.gameLog.length-r],
    t.score>5.2-0.2*t.platforms.length && !t.flags.scoreWithoutBrackets){u=!1;break}
  u&&(d.lastTopScore=l,g.flags.topScoreDecreased=!0)}
```

The flag starts true and is cleared the moment any of the last three releases cleared its
own threshold on its own merit, without having been rescued. So the re-anchor fires only
when none of the last three did, and it drops `lastTopScore` to the current game's base
score. A long run of weak games therefore lowers the divisor and makes the next good score
easier. Nothing in the interface mentions it.

### 5. Technical expertise

`u = f(d,g)/10`, which is 1.0 unless one of these applies:

- small game released from office level 2 or above: 0.9
- medium game with 100000 fans or fewer: 0.9
- large game: `(10 - clamp(3 - techLevel, 0, 3))/10`
- AAA: `(10 - clamp(5 - techLevel, 0, 3) - 0.6*clamp(3 - experts, 0, 3))/10`

Office level is `company.currentLevel`, the office you have moved into: 1 garage, 2 small
office, 3 big office, 4 corporate. On this factor alone a small game scores better from the
garage than from any office, which is worth knowing and is not the whole story: level 1 also
caps the staff at one and skips the 20 percent cap on the top-score increase, and both of
those pull the other way. A medium game is penalised until the company passes 100000 fans.

`techLevel` is a different field on a different object. It is `game.flags.techLevel`, set at
line 912 as the average tech level of the game's selected features. Only the thirteen
graphics engines carry a tech level, and they sit in one radio group, so exactly one is
selected and the value is that engine's level, a whole number from 0 to 7:

| Engine | Level | Engine | Level |
| --- | --- | --- | --- |
| Text Based | 0 | 3D Graphics V1 | 1 |
| 2D Graphics V1 | 1 | 3D Graphics V2 | 2 |
| 2D Graphics V2 | 2 | 3D Graphics V3 | 3 |
| 2D Graphics V3 | 2 | 3D Graphics V4 | 4 |
| 2D Graphics V4 | 3 | 3D Graphics V5 | 5 |
| 2D Graphics V5 | 3 | 3D Graphics V6 | 6 |
| | | 3D Graphics V7 | 7 |

So a large game needs level 3 or better, which 2D Graphics V4 and V5 reach as well as
3D Graphics V3 and up, and an AAA game needs level 5, which only 3D Graphics V5, V6 and V7
reach. It reaches the
score for large and AAA games only, so on small and medium projects the engine features
you ship make no difference to the review at all.

It is also not the custom engine's own `techLevel`, which is an average over engine parts.
That one never reaches the score: it only sets `hasBetterEngineThanSequel` and
`isNewBetterEngine`, and the second of those is written but read nowhere in the file.
Because it is an average it can be fractional, so an engine built with an older graphics
version alongside a newer one sits between two whole levels. A player who wants the `+0.2`
sequel bonus again and again can climb in those fractions instead of whole levels.

`experts` is the count of dev missions weighted 0.9 or better for this game that have a
staff member whose `flags.expert` matches. It cannot exceed the number of such missions.
Two or more also sets `psEnabled`, which only affects the reviewer transform. The count is
computed before the size branches, so `psEnabled` is set whatever size the game is.

How a character gets that flag is a training of its own, one per dev mission, built in a
loop over the nine so there is exactly one specialisation per mission:

```
canSee: 7<=a.getLevel() && !a.flags.expert
canUse: 500*a.technologyFactor > Math.round(900*mission.technologyFactor) &&
        500*a.designFactor     > Math.round(900*mission.designFactor)
cost: 5E6, pointsCost: 200
```

It shows up only at character level 7 or above, and only while the character carries no
expert flag yet, so one character specialises once and never again. The requirement is 900
times the mission's own factor on each side, which is why every pair below sums to 900.

| Stage | Mission id | Shown as | Design | Technology |
| --- | --- | --- | --- | --- |
| 1 | Engine | Engine | 180 | 720 |
| 1 | Gameplay | Gameplay | 720 | 180 |
| 1 | Story/Quests | Story/Quests | 720 | 180 |
| 2 | Dialogs | Dialogues | 810 | 90 |
| 2 | Level Design | Level Design | 360 | 540 |
| 2 | AI | Artificial Intelligence | 180 | 720 |
| 3 | World Design | World Design | 540 | 360 |
| 3 | Graphic | Graphic | 450 | 450 |
| 3 | Sound | Sound | 540 | 360 |

The figures the item's own name advertises are those rounded values, while the gate compares
the unrounded `500 * factor` and compares it with a strict greater-than, so a character
sitting exactly on the advertised number does not qualify. Skill points on screen are
`floor(500 * factor)`, so the 500 in that gate is the on-screen figure, and the highest
training courses carry `maxP: 900`. The player's own character starts at `dF` and `tF` of
0.6, which is 300 design and 300 technology on screen, so every specialisation is a long way
off at the start.

Which mission to specialise in is decided by how many genres count it. A specialist only
counts where the mission's weight for that genre is 0.9 or better, so the nine split like
this:

| Mission | Genres that count it | The ones that do not |
| --- | --- | --- |
| Level Design | 5 | Adventure |
| Graphic | 5 | Strategy |
| Gameplay | 5 | Adventure |
| Sound | 4 | Adventure, RPG |
| World Design | 3 | Action, Simulation, Casual |
| Engine | 3 | Adventure, RPG, Casual |
| AI | 3 | Adventure, RPG, Casual |
| Story/Quests | 2 | Action, Simulation, Strategy, Casual |
| Dialogs | 2 | Action, Simulation, Strategy, Casual |

Three share the top, and Graphic is not the safe pick it looks: it is the one of those three
that fails on Strategy.

`flags.expert` is not `flags.designSpecialist`. The second one comes from a different
training, gated on `4 == company.currentLevel` and 700 design skill points, and it is what
opens the research and development lab. The review counts `flags.expert` only, so three
design specialists satisfy nothing on the AAA branch.

That flag does work away from the review as well, which is easy to miss because nothing in
`Reviews` hints at it. `General.getResponsibleStaffFactor` builds the multiplier for whoever
leads a mission and adds `0.15 * factor` to it when `flags.expert` matches that mission, the
factor being the member's design or technology factor depending on the side being counted. An
expert leading their own mission therefore generates more of both than the same character
would without the flag.

The same multiplier is where overwork lands. `General.getEffectiveWorkload` is
`100/(300/optimalTeamSize) * workload`, and the optimal sizes are 1, 3, 5 and 6, so the same
assignment burns a member at one times on a medium game, five thirds on a large one and twice
on an AAA. Past 100 the factor is cut by `0.75 * excess`, and below it raised by
`0.25 * shortfall`, so spreading the work matters more the bigger the game.

### 6. Random ceilings

At 9 or above, the score is usually pulled back down:

```
9<=z && (0.1>s && 0.8>d.getRandom() ? p=!0
                                    : (w=Reviews.getNewStaff(g), 0<w.length && (p=!0,...)),
         p && (z = newStaffIds.length ? 8.15+0.95/newStaffIds.length*d.getRandom()
                                      : 8.45+0.65*d.getRandom(),
               0.1>d.getRandom() && (z=9+0.25*d.getRandom()), b(d,l)));
```

With a quality factor under 1.1 there is an 80 percent chance of landing in 8.45 to 9.10.
Failing that, new staff on the team drops it into 8.15 to 9.10. Either way a further 10
percent chance lifts it to 9.00 to 9.25. The `&&` short-circuits, so the draw only happens
when `s` is under 0.1.

Which of the two bands you land in is decided by the branch, not by the team. `newStaffIds`
is written in exactly one place in the whole file, the else-branch of that ternary. So when
the first branch fires, the `8.45 + 0.65*rand` band applies however many fresh hires worked
on the game, because the field was never set. A reading that picks the band from the new
staff count alone gets this wrong.

New staff means `0.2 <= gamesContributed <= 2` among the staff who contributed to this game.

Then the early-game cap, only while the top-score count is under 2 and the year under 4:
exactly 10 loses 1.05 to 1.50, 9 or above loses 1.05 to 1.25, and anything over 8.5 loses
0.4 to 0.6. Early 10 out of 10 is therefore out of reach, and the practical ceiling is
about 9.25.

Finally, `9<=z` raises the top-score count, and a score that is not 10 on the third
top-score achievement is forced to 10. In practice that fires when the count was 2 going in.

That last line runs after the technical expertise factor, which is what makes the third top
score worth timing. A small game made from office level 2 or above is multiplied by 0.9 and
so cannot exceed 9.0 on the ordinary path, but 9.0 still trips `9<=z`, so it can be the third
top score, and then the forcing overwrites it with 10 outright. The same holds for a medium
game under 100000 fans. The cap limits what the game can earn, not what this one line can
hand it.

`g.score=z` is stored raw. There is no final clamp, so a score below 1 is possible and real.
Every reader clamps on its own: the reviewer transform does `Math.floor(b).clamp(1,10)` and
the sales code does `g.score.clamp(1,10)`.

## Sliders and time share

The calculator's slider numbers are the in-game slider positions. The game turns them into
time shares at line 928:

```
UI._getSelectedFeaturePercentages=function(){
  var a=UI._getSelectedSliderValues(), b=a.sum();
  return 0==b ? [100/3,100/3,100/3] : a.map(function(a){return a/(b/70)+10})
};
```

Each of the three missions in a stage gets a 10 percent floor plus a share of the remaining
70, so every share lands between 10 and 80 and the three always sum to 100. All sliders at
zero gives an even third each, and so does all of them at maximum. A stage set to 100, 100
and 0 does not produce 100, 100 and 0: it produces 45, 45 and 10.

Reading that backwards gives the slider values the thresholds sit at. With `o` as the other
two sliders added together, a mission clears the 20 percent floor once its own slider passes
`o/6`, and reaches the 40 percent focus threshold once it is at least `0.75 * o`. So against
sliders of 100 and 0, 16 leaves a mission forgotten and 17 saves it, and 75 earns the focus
bonus where 74 does not. Against 100 and 100 those move to 34 and 150, and the second is out
of reach.

That is the number the review code reads, which makes the practical rule per stage:

- one mission weighted 0.9 or better needs a share of 40 or more to earn the focus bonus
- any mission weighted 0.9 or better must stay above 20, or it counts as forgotten
- any mission weighted below 0.8 must stay under 40, or it counts as odd focus
- the shares also set how much of the stage's points come from each mission's tech and
  design mix, so they have to serve the golden ratio at the same time

A fourth demand lands on the same three shares and never touches the review.
`General.getFeatureEfficiencyFromMissionFocus` gives a mission's engine features their full
effect only once its share reaches `5 * sum(v)` percent, where `v` is each feature's own
value, scaled by 0.7 for a large game and 0.4 for an AAA one and left alone below those.
Short of that the feature still works, at `share / (5 * sum(v) * sizeCoefficient)` of its
effect. The graphics parts carry `v` at twice their tech level, so 3D Graphics V3, V4 and V5
want 30, 40 and 50 percent of their stage on a small or medium game, 21, 28 and 35 on a
large one, and 12, 16 and 20 on an AAA. Adding the part whose id is `Stereoscopic 3D` and
whose name on screen is Advanced Stereoscopic 3D, `v` 4, to V5 raises those three to 70, 49
and 28. A stage can only reach 80, so the 70 is close to the ceiling and the AAA column is
the easy one.

Hit the focus bonus in two stages and `s` gains 0.2, which is worth more than any other
single term in the quality factor.

The percentage becomes a duration at line 326 and is divided back out in `rateGame`:

```
duration = 3*Missions.BASE_DURATION/100*percentage * sizeFactor * platformFactor
share    = duration / sizeFactor / platformFactor / (3*Missions.BASE_DURATION)
```

The factors cancel mathematically but not in floating point, so a slider set that lands on
exactly 40.000 or 20.000 percent can fall either side of the comparison. The calculator runs
the same chain rather than the shortcut, down to building the platform factor with the same
repeated multiplication: `Math.pow(1.45, n-1)` differs from the game's loop in the last bit
from four platforms up, and that was enough to flip a focus threshold at eleven platforms.
`tests/slider-boundary.mjs` walks every slider triple that hits a boundary, and
`tests/score-parity.mjs` repeats the threshold triples at every platform count from 1 to 29.

One wrinkle the calculator does not model. `General.getMultiPlatformDurationFactor` halves
the step when the engine carries a `MultiPlatformOptimized` part, so each platform beyond
the first multiplies by 1.225 instead of 1.45. The halving is skipped when the function is
called with a second argument, which is what `General.getMultiPlatformCostFactor` does so it
can apply the 0.5 itself. The review path always calls it with one argument. The same factor is used to build the duration and to divide
it back out, so the share is the same number mathematically and only the floating-point
residue differs. Checked exhaustively over every slider triple at one to four platforms and
all four game sizes, that residue never flips a 0.4 or 0.2 comparison, and three platforms
is all the game lets you pick. From fifteen platforms up it does flip, which no save can
reach.

## The four reviewer scores

`Reviews.getReviews` turns one score into the four numbers on the review screen.

```
var g=Math.floor(b).clamp(1,10); 9.5<=b&&(g=10);
for(...;4>t;t++){
  if(5===g||6===g) u=0.05>GameManager.company.getRandom()?2:1;
  var r=1==Math.randomSign()?0:u*Math.randomSign(), v=(g+r).clamp(1,10);
  ...
}
```

The spread size `u` is 1 for every base score except 5 and 6, and for those two it is
re-drawn for each reviewer with a 5 percent chance of 2. Read the `||` as binding looser
than the `&&` and you get the wrong rule: it is not "5 always spreads by 2 and 6 only
sometimes", both get the same 5 percent.

Each reviewer then draws `r = 1==Math.randomSign() ? 0 : u*Math.randomSign()` and shows
`clamp(g+r, 1, 10)`. The first sign decides whether there is any deviation at all, and the
second only gets drawn when the first came up negative, which matters if you are matching
the random stream.

When the fourth reviewer would make it four tens in a row, the game steps in: with
`psEnabled` and a floor of exactly 10 there is a 40 percent chance of an 11 out of 10, which
nothing clamps, and without it the fourth is knocked down to 9 unless the floor is 10 and a
20 percent roll saves it.

Two details decide whether an 11 is even on the table. `psEnabled` is two or more experts,
set by `2<=c` further up, not three. And the floor it tests is `Math.floor(b)`, the raw final
score, not the `g` the reviewers are drawn from. Those two part ways between 9.5 and 10: `g`
is already 10 there through the `9.5<=b` line, so four tens can show, while `Math.floor(b)`
is still 9, so the eleventh point is refused. An 11 needs a final score of a full 10.

Those four numbers change almost nothing. Every read of `game.reviews` in the file is the
review screen itself, the save and load pair, a news story that quotes the highest of the
four, the average printed beside a game in the game list, and two achievements, one needing
an average of exactly 10 and one needing an average above 10, which only the 11 out of 10
can reach. Sales and the top score both read `game.score`, the single number behind them. So
a lucky or unlucky spread across the four reviewers changes what the screen says and can
cost an achievement, and it moves no money.

## Questions players actually ask

**Does the game's name change the score?** No. The title only reaches the flavour text, and
only when the game has no custom name: a floored score above 3 and below 7 has a 10 percent
chance of an insult about the name, and 7 or above the same chance of a compliment despite
it. The company name is never read by `Reviews.rateGame` at all.

**Do I have to rotate genres?** Only away from an exact repeat. The check is the single most
recent release and all three fields must match:

```
q=d.gameLog.last();
q && !g.flags.isExtensionPack && q.genre===g.genre
  && q.secondGenre===g.secondGenre && q.topic===g.topic   ->  s -= 0.4
```

So Dungeon-Action, Thief-RPG, Hunting-Simulation, Dungeon-Action is fine: the triple never
repeats back to back. There is no wider "too many action games" penalty anywhere in the
review code.

**Does the topic matter?** More than this page said until the Success Guide's comment thread
sent me back to the points code. It matters in four places, and the first one is not in
`Reviews` at all.

The design and technology a game produces are multiplied by the topic to genre weight before
they ever reach the review. The last line of the points function is `return n*l`, and `l` is
`GameGenre.getGenreWeighting(game.topic.genreWeightings, game.genre, game.secondGenre)`, the
same 0.6 to 1.0 number the review later calls `p`. A pair sitting at 0.6 therefore generates
40 percent fewer points than one at 1.0 off identical sliders, and then the review applies
`p` again at the halving gate. A bad topic and genre pair is charged for twice.

The mission's own genre weight is in there too, but only on one term.
`Missions.getGeneralFactor` returns `Missions.getGenreWeighting(mission, game, game)` times
the mission's level bonus, and that multiplies `Missions.BASE_POINTS` alone. The engine tech
term `getGameBasePoints(game)/9` and the feature bonus are added after it, so neither is
scaled by the mission weight. The feature bonus has its own gate instead, the
`5 * sum(v)` time share above.

The other three places are the ones this page already had: `p` sets the great or terrible
combination message, a `p` of 0.7 or lower halves everything the ratio earned above 0.6, and
nine topics rewrite mission weights outright.

## Easy to misread in the source

Each of these has been got wrong before, in a guide or in a set of notes.

- `MULTIPLATFORM_WEIGHTING` is 0.7 and blends genre weights across platforms.
  `MULTIPLATFORM_DURATION_FACTOR` is 1.45 and stretches mission durations. They are two
  separate constants and neither one does the other's job.
- Mission overrides are keyed by genre, never by audience. There is no audience-specific
  mission weight anywhere in the file.
- The bug factor is `1 - 0.8*clamp(100/(T+D)*bugs,0,100)/100`. Writing the division the
  other way round gives a number that looks plausible and is wrong.
- `company.currentLevel` is the office tier and `game.flags.techLevel` is the graphics
  engine level. The small-game branch reads the first, the large and AAA branches read the
  second.
- The reviewer spread rule is `if(5===g||6===g)` and then a 5 percent draw, not a condition
  that treats 5 and 6 differently.
- The downward re-anchor fires when none of the last three games cleared its threshold
  unaided, not when all three did.

## What the published guides get wrong

Checked against the code, with the check kept in `tests/`:

- The odd-focus penalty is not "at least twice". The code tests for exactly two. Three or
  more low-weight missions above 40 percent cost nothing.
- The strange-combinations trend cannot give 1.4 through a mixed second genre. The lookup
  is called with the first genre only, so the value is always one of 0.85, 1.1, 1.2 or 1.4.
  The published trick of pairing a 1.0 main genre with a 0.9 second to average 0.97 and fall
  through to 1.4 does nothing: the second genre is never passed to that lookup.
- A large game does not need 3D Graphics V3. It needs tech level 3, and 2D Graphics V4 and
  V5 carry level 3 as well. The AAA claim is exact: only 3D Graphics V5 and up reach 5.
- The quality terms are not separate multipliers. The balance bonus, the focus bonus, the
  sequel terms and every penalty add into one number `s`, and the base score is multiplied
  by `1 + s` exactly once, so `+0.2` and `-0.15` together are `+0.05` and not `1.2 * 0.85`.
  The five factors after it, platform to genre, topic to audience, bugs, tech spread and
  trend, are the ones that multiply separately.
- The first target high score is not `20 + max(base - 20, 2) * yearFactor`. It is
  `floor(base + max(base - 20, 2) * yearFactor)`. At a base of 50 the game gives 84, not 54.5.

What the guides get right, confirmed the same way: the base score formula and its term
order, the size factors, the golden-ratio bands and the 30-point cutoff, the 40 and 20
percent focus thresholds, the multi-platform 70 / 49 / minus 19 blend, the bug and tech
spread formulas, the halving rule, the platform audience override, every branch of the
technical expertise factor, the random ceilings and the early-game cap. The six per-genre
slider recommendations all score the maximum focus bonus, and the claim that a Casual
dialogue slider of 74 is safe while 75 trips the penalty is exact.

The Reddit guide's part 3 covers the research and development lab, the hardware lab, AAA and
MMO. Those sit off the review path, so no test in `tests/` guards what follows. Each line was
read straight out of `codeNw.js`:

- The research and development lab does not open in a large office. `unlockRnDLab` triggers on
  `4 === company.currentLevel`, the top tier, whose own level-up text calls it the new
  headquarters, and it also wants a character carrying `designSpecialist`. Opening it costs
  2.5M. The design specialist training that gates it is itself visible at level 4 only.
- The prose has owning that lab unlock AAA, where the guide's own project table has it right.
  `Research.AAA.canResearch` looks for a game in the log with `10 === score` and
  `"large" === gameSize`, so a large game that scored a straight ten. The hardware lab adds
  `customHardwareResearched` and a character carrying `technologySpecialist` to that same
  level 4 requirement.
- The project table prices both AAA lab projects at 2000 research points. Both carry
  `pointsCost: 1E3`. `AAAMarketingCampaign` and `AAACustomHardware` cost 1000 each, and each
  wants a current game whose `gameSize` is `aaa`, the hardware one also wanting `hwLabUnlocked`.
- A comment under part 3 puts the cost of mixing tech levels across platforms on the
  technical expertise factor. It lands on the tech spread factor instead, which is the
  separate `1 - (highest - lowest)/20` term above. The comment is right that a custom console
  takes its level from its graphics engine and that PC does not count, though PC is skipped by
  an explicit `"PC"==id` test rather than by having no level.
- The 40 week expansion gap is not measured against the previous expansion. `Reviews.rateGame`
  reads `g.sequelTo`, the game this one was declared a sequel or expansion to, and raises
  `sequelsTooClose` when that game's `releaseWeek` falls inside 40 weeks of the current week.
  Point every expansion at the base game and the gap is measured against the base game.

What part 3 gets right, read the same way: AAA wanting tech level 5 and three experts, the MMO
penalty when the topic to genre weight is under 1.0, the level 7 and 900 point specialisation
requirements, the 700 skill points for the lab specialist, and the 3M monthly ceiling on lab
spending. Its project table holds up on nine of its eleven rows, the two AAA prices being the
exception, and the gates it lists for AAA Games, Own Convention and Hardware are exact. Two things it leaves out. `getMaxRndBudget` starts that ceiling at 3M but drops it by
100000 for every design specialist past the first and floors it at 500000. And
`Research.ownConvention` wants 1000000 fans, or year 23 or later, before the convention it
describes timing for can be researched at all.

Part 2 of the same guide walks the review algorithm itself and gets most of it right, which
makes the places it slips worth naming:

- The random ceiling does not wait for a quality factor under 0.1. Part 2 writes that
  threshold twice, and by its own definition the quality factor starts at 1, so as written
  the branch could never fire at all. The code tests `0.1 > s`, the bonus total on its own,
  which is a quality factor under 1.1. That branch therefore catches any game at 9 or above
  that did not collect 0.1 of bonuses, which is the common case, not a rare one.
- The 0.9 on a medium game carries no publishing deal and no office level. The test is
  `"medium" === gameSize && 1E5 >= fans` and nothing else, so a self-published medium game
  under 100000 fans takes it too.
- Part 2 guesses that the platform to audience multipliers were meant to be 0.8 and 0.65 and
  that a true and a false were swapped. They were not. 0.8 and 0.65 are what
  `getNormalizedAudienceWeighting` returns for raw 0.7 and raw 0.6, which is the gate's side
  of the same pair. The third argument does exactly what it reads as: it asks for the raw
  number instead of the normalised one.
- The two claims corrected further up, the first target high score and the 1.4 reached
  through a mixed second genre, both come from part 2. It is where they entered circulation.
- Part 2 repeats the "at least twice" reading of the odd-focus penalty, which the first entry
  in this list already answers.

What part 2 gets right, which is most of it: the base score formula and its term order, the
size factors, the quality factor bands and the 30 point cutoff, the focus thresholds and
their MMO doubling, the one, two and three platform blend down to the negative third share,
the bug formula, the tech spread formula, the trend values including every strange
combinations band, the halving rule and that it stops at the first platform it catches, the
year factors, the increase formula with its 20 percent cap from office level 2, every
early-game cap range, the third top score forced to 10, and the 0.06 per missing specialist
on the AAA branch. Its reading of `previousTopScore` is right too, bar the floor at 20.

The same author's wiki page, Success Guild updated for 1.7.8, carries that whole guide again
with later additions. Its tables are the part the code backs hardest. The design aspect table
reproduces from `genreWeightings` on all 54 cells with both target columns; the ratio bracket
table reproduces from the golden-ratio formula for all six genres, one cell rounded up rather
than down; and the priority override table names the same nine topics and the same genre rows
as the override table above. Two of its additions do not hold:

- Cycling genres on MMO expansions to dodge the repeat penalty is not needed. That penalty
  carries `!g.flags.isExtensionPack`, so an expansion never triggers it however many times the
  topic and genre repeat. What it does still catch is an ordinary game released straight after
  one that shares its topic and genre pair.
- A 10 on a small game is not out of reach once you leave the garage. The 0.9 caps the
  ordinary path at 9.0, but 9.0 still counts as a top score, and the third top score is forced
  to 10 after the factor has already been applied.
- The wiki page adds a section on reaching an 11 out of 10 and puts the expert requirement at
  three. It is two. `psEnabled` comes from `2<=c`, the same count the AAA branch reads but at
  a lower bar. Its other claim in that section is right, and sharper than it looks: the 11
  tests `Math.floor(b)`, so a final score between 9.5 and 10 shows four tens and still cannot
  reach eleven.
- It also says an expansion cannot be a sequel and so cannot take the `+0.2`. Both halves are
  wrong. Expansions run through the same `sequelTo` assignment, and the engine row bars them
  only from the penalty.

What it adds and gets right: that a mixed-genre MMO wants two great combinations rather than
one, that the player's own character starts at 300 and 300, and the slider figures around both
thresholds, 16 against 17 on the forgotten floor and 74 against 75 on the Casual dialogue
penalty, both of which fall out of the `o/6` and `0.75 * o` rules above.

The wiki's older Success Guide, the one all three of the above are built on, is where the
multiplying quality terms in the first entry of this list come from. It writes the additive
form correctly and then works an example the other way round, arguing that a `+20` and a
`-15.4` give 1.52 percent rather than 4.6. The additive form it wrote first is the right one.
Four more of its claims do not survive the code:

- Its slider set for Strategy forgets World Design. The same three stages, 100/50/0 then
  0/50/100 then 0/100/50, are given for Action, Simulation and Strategy. World Design is
  weighted 0.8 for Action and Simulation and so costs nothing at a 10 percent share, but it
  is 1.0 for Strategy, which makes it a forgotten mission at `-0.15`. Those sliders earn
  `+0.20` in the other two genres and a net `+0.05` in Strategy.
- Its conclusion table puts Strategy's ideal balance at 1.6 with the same 1.46 and 9.6
  percent as Simulation above it. Strategy's golden ratio is 1.4. The row was copied.
- It calls a Graphics specialist useful everywhere. Graphic is 0.8 for Strategy, which is the
  one genre that does not count it, as the table above shows.
- It names Simulation with Adventure as the multi-genre pair closest to balance, at 1.02.
  That pair is 1.200. The one that reaches exactly 1.000 is RPG with Action second, which the
  guide never mentions.

What it gets right is the hard part. Its target score approximation, `Top_Score` plus the
greater of the last increase and 12 percent, with a 20 percent ceiling outside the garage, is
`0.1 * target * yearFactor` written out, and 0.12 is that with the 1.2 of years 7 to 23. Its
balance delta formula is the game's own, and its worked example showing a technology genre
charged 40 percent where a design genre is charged 20 on a mirrored point split is exactly
the asymmetry above. Its nine design and technology splits are the mission table. And a reply
in its comments, that a quality bonus raises the stored top score along with the game score
because the top score is the base score after every multiplier, is right and is why a run of
high-quality games makes the next one harder.

One of its comments overreaches. It has the bonus from an engine feature scaled by the
mission's genre weight, so that Better AI would pay 9 to 7 more in Strategy than in Adventure.
The feature bonus is added after `Missions.getGeneralFactor` has already been applied and is
never multiplied by it. What scales the feature bonus is the time share rule, and what scales
the whole total is the topic to genre weight.

The page itself is damaged where it matters most. Its Technical Expertise section has lost the
line for a small game, which now reads as a fragment, and the AAA formula after "An AAA game
has" is simply missing.

The wiki's Game Development Based on Experience page for 1.6.11 is the most accurate of the
set on everything it counts, and its legend is the clearest statement anywhere of the bands
at the top of this page. Three things in it do not hold:

- It names Startups among the topics with more terrible pairs than great ones. There is no
  Startups topic. The game ships 66 and none of them is called that.
- It calls topics with more terrible pairs than great ones very few, and lists six. There are
  seventeen, and the list misses Transport, which is the worst in the game at four against
  two, along with Abstract, Comedy, Dance, Evolution, Government, Technology, Construction,
  Expedition, Law, Mad Science and Wild West.
- A comment on it from 2025 reports that Action's stage 3 requirements have been swapped to
  `+++ ++ ~`. They have not. World Design, Graphic and Sound read 0.8, 1.0 and 0.9 for Action,
  which is what the page's own table says. Whatever the reporter was reading, it was not the
  game.

Everything else it states in numbers checks out. Dungeon, Airplane and Fantasy each carry
four great pairs and one terrible one. Game Dev and Superheroes each carry three terrible
against one great, and Romance, Hospital and Surgery two against one. Its legend thresholds
are the review's own tests. Its claim that Strategy or RPG alone leaves six important fields
while Strategy with Adventure or RPG leaves three is exact. Its staff burn rates of one, five
thirds and two for medium, large and AAA are `100/(300/optimalTeamSize)` to the digit. A
comment on it from 2025 quotes the Thief topic's two weight arrays out of the source and both
are correct today, and another from 2021 reporting Farming with Casual as good rather than
great is right: that pair is 0.9.

## How the calculator is held to this

`tests/` runs the game's own code against the page:

- `data-parity.mjs` checks all 66 topics, 29 platforms and 9 missions, with weights, audience
  weights, mission overrides, tech levels, release and retirement dates and market sizes.
- `score-parity.mjs` scores randomised setups with the game's `Reviews.rateGame` and with the
  page, sharing one random stream, and requires the two to be identical bit for bit.
- `reviewer-parity.mjs` does the same for the four reviewer scores.
- `slider-boundary.mjs` sweeps every slider triple that lands exactly on a focus threshold.
- `self-contained.mjs` loads the page in a browser with the network off, then puts it into the
  states a player can reach that once broke it: every genre or audience locked, a saved form
  state of the wrong shape, an in-game month or week typed past its limit.
- `text-length.mjs` holds the repository to the 248 character limit and the punctuation rules.
- `release-consistency.mjs` checks the version, the changelog section and the workflow agree.

Run them with `npm test`. `tests/lib/oracle.mjs` is the piece that lifts `Reviews.rateGame`
out of `codeNw.js` and runs it. It makes three kinds of change to that source, all named in
the file: five probe insertions that only copy intermediates onto a global, one replacement
of the review-message loop inside `getReviews`, and a stub for `getReviews` on the score
path. Every anchor is unique in the whole file, and the loader fails loudly if one
disappears, so a future version of the game cannot quietly slip past the tests.

The message-loop replacement does change how many random draws `getReviews` consumes, because
the real loop draws at least once per reviewer. The reviewer test is therefore exact against
`getReviews` with that loop removed, not against the game's own draw sequence for a given
save seed. The score path is unaffected: `getReviews` runs after `g.score` is set.

`tests/mutation.mjs` plants 60 deliberate faults in a copy of the page, one at a time, and
requires the differential tests to catch every one. Without it a passing suite only shows
that nothing fired, not that anything could.
