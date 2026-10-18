# The review algorithm in codeNw.js

Everything below was read out of `codeNw.js` in this repository. Line numbers are that file.
Quoted code is the game's own minified text, copied, not retyped.

## Finding your way around the file

The file is minified: about 1900 lines of roughly 500 characters, no comments, one-letter
variable names that are reused for different values inside the same function. Two habits
make it workable:

- `grep -n -o ".\{0,200\}SOMETHING.\{0,300\}" codeNw.js` to read around a name.
- `sed -n '478,495p' codeNw.js` to read a whole function once you know where it starts.

Watch for reuse. In `Reviews.rateGame` the variable `l` is the MMO factor, then the base
score, then a loop index. `p` is design points, then the topic-to-genre weight, then a
boolean. `B` is the staff count, then a tech level. Track the value, not the name.

## Where things live

| What | Line | Name in the file |
| --- | --- | --- |
| Tuning constants | 10 | `GameFlags={...}` |
| Golden ratios, genre weights | 247 | `GameGenre.getGoldenRatio`, `GameGenre.getGenreWeighting` |
| Trend factor | 249 | `GameTrends.getCurrentTrendFactor` |
| Duration of a mission | 326 | `General.getDuration` |
| Size factors | 328, 327 | `General.getGameSizePointsFactor`, `getGameSizeDurationFactor` |
| Topic to audience weight | 331 | `General.getAudienceWeighting` |
| Optimal team size | 334 | `General.getOptimalTeamSize` |
| Platform weight normalising | 426 | `Platforms.getNormalizedGenreWeighting` |
| Platform table | 427 onward | `var a=[{id:"PC"...]` then `Platforms.allPlatforms.addRange(...)` |
| Multi-platform blend | 451 | `Platforms.getGenreWeighting`, `getAudienceWeighting` |
| Topic table, 66 topics | 454 | `Topics.topics=[...]` |
| Mission table, 9 missions | 418 | `Missions.Stage1Missions` and Stage2, Stage3 |
| The review module | 473 to 495 | `var Reviews={}` then one IIFE |
| The score itself | 478 | `Reviews.rateGame=function(d)` |
| Four reviewer scores | 493 | `Reviews.getReviews` |
| Slider to time share | 928 | `UI._getSelectedFeaturePercentages` |
| The game's tech level | 912 | `b.flags.techLevel=b.features.filter(...).average(...)` |

The platform table is built in pieces. `var a=[...]` holds the first five, then
`Platforms.allPlatforms.addRange([...])` appends the rest. Reading only the first literal
gets you five platforms out of twenty-nine.

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

`p` is design, `q` is technology. Golden ratios: Action 1.8, Adventure 0.4, RPG 0.6,
Simulation 1.6, Strategy 1.4, Casual 0.5. A second genre blends as
`(2*first + second)/3`. Within 25 percent gives `+0.1`, past 50 percent gives `-0.1`, and
the band between gives nothing. Only the bonus raises the good-flag counter `u`.

**Mission focus.** Each of the 9 dev missions has a share of its stage's time. The game
compares that share against the mission's genre weight for this game.

```
0.9 <= Missions.getGenreWeighting(a,g) && 0.4 <= b    good focus
0.8 >  Missions.getGenreWeighting(a,g) && 0.4 <= b    odd focus
0.9 <= Missions.getGenreWeighting(a,g) && 0.2 >= b    forgotten
```

Two or more good: `s += 0.2`, and `u` rises by how many. Exactly one: `s += 0.1`, `u += 1`.
None at all: `s -= 0.15 * mmoFactor`, where the MMO factor is 2 for an MMO and 1 otherwise.

Odd focus is counted with `2===A.length` and `1===A.length`, not "two or more". Three odd
missions therefore cost nothing at all. That is the game's behaviour, not a typo to fix.

Each forgotten mission costs `0.15 * mmoFactor` and raises the bad-flag counter `t`.

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

The third platform's share really is negative, so a third platform that fits well lowers
the score. That is in the game.

**Topic to audience** is the raw table value, not normalised.

**Bugs**: `A = 1 - 0.8 * clamp(100/(technology+design)*bugs, 0, 100)/100`.

**Tech spread**: with more than one platform, `1 - (highest - lowest)/20` over the
platforms' tech levels. PC is skipped by an explicit `"PC"==id` test in the loop. It also
happens to carry no `techLevel` field, but that is incidental, not the reason.

**Trend**: 1.2 when the game matches a genre, new-topic or audience trend. During a
strange-combinations trend it is 0.85 for a perfect topic-genre pair, 1.1 for 0.9, 1.2 for
0.8, and 1.4 for anything lower. That lookup passes only the first genre, so a second genre
can never produce a value in between.

### 3. Against the top score

```
B=a(d); z=l/B;
```

`a(d)` is the target the game holds you to. With no top score on record it returns 20.
Otherwise it is `Math.floor(lastTopScore + lastTopScoreIncrease * yearFactor)`, where the
year factor is 1.15 up to year 6, 1.2 through year 23, and 1.1 after that. Inside the
window needed to build another game of the last size, it ramps from the previous top score
instead. The result is always an integer.

Two penalties then land on the ratio:

- At 0.6 or above, if either the topic to genre weight or the topic to audience weight is
  0.7 or lower, everything above 0.6 is halved.
- Above 0.7, the first platform whose normalised audience weight is 0.8 or lower multiplies
  the base score by its raw weight, and the loop stops there. It checks the normalised value
  and multiplies by the raw one.

Then `z = clamp(10 * z, 1, 10)`.

### 4. The rescue bracket

A floor for bad games that were at least made thoughtfully. It needs all of:
`lastTopScore > 0`, `z <= 5.2 - 0.2 * platformCount`, `u > 0`, `u > t`, and a team
contribution of 0.8 or better.

It starts at 6 and subtracts: one point for each step of `abs(optimal - count)` beyond the
first, so being under the optimal team size costs exactly as much as being over it, half a point
per new hire, `t/2` minus `u/2`, 0.5 when the bug factor is under 0.9, the shortfall when
the platform-genre or topic-audience weight is 0.8 or lower, twice the platform tech spread,
and one random draw. The result is capped at 7.7 and only replaces the score if it is higher.

Two traps here. The gate is `lastTopScore > 0`, not the top-score achievement count: the
ceiling demotion below sets `lastTopScore` without touching that counter. And
`0.9>A ? r-=0.5 : 0.6>=A && (r-=1)` can never reach its second branch, because a bug factor
of 0.6 or less is already under 0.9. Both are reproduced as written.

### 5. Technical expertise

`u = f(d,g)/10`, which is 1.0 unless one of these applies:

- small game released from office level 2 or above: 0.9
- medium game with 100000 fans or fewer: 0.9
- large game: `(10 - clamp(3 - techLevel, 0, 3))/10`
- AAA: `(10 - clamp(5 - techLevel, 0, 3) - 0.6*clamp(3 - experts, 0, 3))/10`

`techLevel` here is `game.flags.techLevel`, set at line 912 as the average tech level of the
game's selected features. Only the thirteen graphics engines carry a tech level, and they
sit in one radio group, so exactly one is selected and the value is that engine's level, a
whole number from 0 to 7. It is not the custom engine's own `techLevel`, which is an average
over engine parts. That one never reaches the score: it only sets
`hasBetterEngineThanSequel` and `isNewBetterEngine`, and the second of those is written but
read nowhere in the file.

`experts` is the count of dev missions weighted 0.9 or better for this game that have a
staff member whose `flags.expert` matches. It cannot exceed the number of such missions.
Two or more also sets `psEnabled`, which only affects the reviewer transform.

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

Then the early-game cap, only while the top-score count is under 2 and the year under 4:
exactly 10 loses 1.05 to 1.50, 9 or above loses 1.05 to 1.25, and anything over 8.5 loses
0.4 to 0.6.

Finally, `9<=z` raises the top-score count, and a score that is not 10 on the third
top-score achievement is forced to 10. In practice that fires when the count was 2 going in.

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
70. All sliders at zero gives an even third each, and so does all of them at maximum.

That percentage becomes a duration at line 326 and is divided back out in `rateGame`:

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

## The four reviewer scores

`Reviews.getReviews` turns one score into the four numbers on the review screen.

```
var g=Math.floor(b).clamp(1,10); 9.5<=b&&(g=10);
```

Each reviewer then draws `r = 1==Math.randomSign() ? 0 : u*Math.randomSign()` and shows
`clamp(g+r, 1, 10)`. The first sign decides whether there is any deviation at all, and the
second only gets drawn when the first came up negative, which matters if you are matching
the random stream. For a base of 5 or 6 there is a 5 percent chance the deviation is 2.

When the fourth reviewer would make it four tens in a row, the game steps in: with
`psEnabled` and a floor of exactly 10 there is a 40 percent chance of an 11 out of 10,
and without it the fourth is knocked down to 9 unless the floor is 10 and a 20 percent roll
saves it.

## What the published guides get wrong

Checked against the code, with the check kept in `tests/`:

- The odd-focus penalty is not "at least twice". The code tests for exactly two. Three or
  more low-weight missions above 40 percent cost nothing.
- The strange-combinations trend cannot give 1.4 through a mixed second genre. The lookup
  is called with the first genre only, so the value is always one of 0.85, 1.1, 1.2 or 1.4.
- The first target high score is not `20 + max(base - 20, 2) * yearFactor`. It is
  `floor(base + max(base - 20, 2) * yearFactor)`. At a base of 50 the game gives 84, not 54.5.

What the guides get right, confirmed the same way: the base score formula and its term
order, the size factors, the golden-ratio bands and the 30-point cutoff, the 40 and 20
percent focus thresholds, the multi-platform 70 / 49 / minus 19 blend, the bug and tech
spread formulas, the halving rule, the platform audience override, every branch of the
technical expertise factor, the random ceilings and the early-game cap. The six per-genre
slider recommendations all score the maximum focus bonus, and the claim that a Casual
dialogue slider of 74 is safe while 75 trips the penalty is exact.

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
