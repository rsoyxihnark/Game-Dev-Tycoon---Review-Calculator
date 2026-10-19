# Changelog

## 1.0.18

- Fixed the golden ratio row claiming a perfect balance while your Design and Technology points are still under 30
- Fixed the Topic & Genre Library saying you can still pick a locked topic or genre in Game Setup, where locking takes it out of the dropdown
- Fixed the topic, genre and audience chips naming a Pick a game for me button the calculator does not have

## 1.0.17

- Fixed Perfect Combos applying a different game than the row you clicked, whenever a filter narrowed the table below the best tier
- Fixed changing the in-game date replacing a game you had just applied from Perfect Combos
- Pick best for me now says when the game it applied came from the Perfect Combos table rather than its own best tier
- Fixed the Reviewer score distribution filling back in after the score had gone blank, so it no longer charts a rejected setup
- Fixed REPORT ISSUE losing its own label for good when you click it twice
- Fixed the advice offering a platform that is not on the market at your in-game date
- Fixed the advice telling you to switch to an audience you have locked in the Topic & Genre Library
- Fixed the advice offering topics you have locked in the Topic & Genre Library as the fix for a weak topic and genre pair
- Fixed the advice ranking platforms on the main genre alone when a second genre is set, which is not the q the calculator scores
- The advice now says when no platform on the market can close the q gap, instead of naming one that is no better
- Design points, Technology points, Bugs, Fans and Recently-hired staff now snap back when you type past what the calculator accepts
- Fixed the storage warning calling your topic, genre and audience locks undefined when storage is full or switched off
- Fixed a stray full stop in the topic and audience warnings, where the halved score is explained

## 1.0.16

- Fixed Back-solve from a past game answering 20 for a mid-range score, when the right topScore was in the hundreds
- Back-solve from a past game now says when your score sits at the top or the bottom of the 1 to 10 range, where a wide span of topScore values fits it equally

## 1.0.15

- Fixed the AAA warning saying the size needs the corporate office, when AAA Games unlocks off a large game that scored a straight 10
- The calculator now warns when a second genre is set before year 12 month 9, which is the earliest Multi Genre can be researched
- The calculator now warns when more than one platform is picked before year 17 month 3, which is the earliest Multi Platform can be researched

## 1.0.14

- The calculator now warns when a trend is set on a garage company, because Game Dev Tycoon only starts a trend from office level 2 up
- The calculator now warns when the strangeCombos trend row does not match the topic and genre you picked, since the game reads that fit itself

## 1.0.13

- The calculator now warns when a large or AAA game is set on Gameling, Vena Gear, grPhone, PPS or GS, which Game Dev Tycoon refuses in Game Setup
- The calculator now warns when MMO is ticked on a small or medium game, which Game Dev Tycoon refuses in Game Setup

## 1.0.12

- Recently-hired staff now says your own character never counts as a fresh hire, whatever it has shipped

## 1.0.11

- Fixed the Calculator marking a mission weighted 0.8 with a minus, where Game Dev Tycoon marks it with a plus
- Fixed the Calculator leaving a mission weight unmarked when a second genre blends it just under 0.8, which still takes the odd-focus penalty
- Fixed the rescue warning and the copied report calling the pity-floor a 6 to 7.7 band, when your team size, recent hires, bugs and weak fits move it well below 6

## 1.0.10

- Fixed the Slider Suggester telling you its own RPG, Strategy and Casual sliders miss the balance bonus, when those sliders earn the +0.1
- Fixed the Slider Suggester warning of the unbalanced penalty on its own Action sliders, which the game does not penalise
- Fixed the Slider Suggester legend giving the 20 % and 40 % thresholds as slider numbers, when they are shares of the stage
- Fixed the Slider Suggester legend putting the odd-focus line at a weight of 0.7, when anything under 0.8 takes it
- Fixed the warning marker on a Slider Suggester mission card missing a mixed-genre weight between 0.7 and 0.8

## 1.0.9

- Fixed the Perfect Combos T↔A column not saying a fit of 0.7 or below halves the score above 0.6, which the T↔G column already said
- Fixed the Perfect Combos note saying fits of 0.0 are left out, when no fit in the game is ever below 0.6
- Fixed the Perfect Combos P↔G and P↔A tooltip giving the range as 0.0 to 1.0, when it is 0.6 to 1.0
- The verified badge now carries the date of the latest check against the game's own code

## 1.0.8

- Fixed "Where does the score come from?" saying only a poor Topic/Genre fit halves the score above 0.6, when a poor Topic/Audience fit does it too
- Fixed "Where does the score come from?" leaving out the slider bonus for one well-fitting mission and the penalty for none at all
- Fixed "Where does the score come from?" saying an MMO only doubles the odd-slider penalty, when it doubles every slider penalty
- Fixed "Where does the score come from?" saying a score of 9 can still be dropped at random when nobody was hired recently
- Fixed "Where does the score come from?" saying the fourth reviewer can still be marked down with two matched experts on the game
- Fixed GOLDEN-RATIO BREAKER appearing on games the game itself does not penalise, and staying away from ones it does
- Fixed "What's wrong & how to fix it" asking for five engine parts on an AAA game, when it is one graphics engine at level 5
- Fixed "What's wrong & how to fix it" overstating what a missing AAA expert costs by ten times

## 1.0.7

- Fixed the notes saying an AAA game needs 2 experts, when 3 are needed to avoid the score penalty
- Fixed the Topic & Genre Library saying only 0.6 and below is penalised, when 0.7 is penalised too
- Fixed the Topic & Genre Library listing three of the five values a Topic/Genre or Topic/Audience fit can take
- Fixed the notes saying every unimportant slider above 40% costs the same, when three or more cost nothing
- Fixed the notes pointing you at a file the download does not contain
- The notes now say that an expansion pack never takes the same topic and genre penalty

## 1.0.6

- Fixed the score freezing on its last value when every genre or every audience was locked in the Topic & Genre Library
- Fixed the Game Setup genre dropdown going blank with no explanation when every genre was locked
- The score now says to open the Topic & Genre Library when no genre or no audience is unlocked
- Fixed the "no topics unlocked" and "no audiences unlocked" messages pointing at a tab that does not exist
- Fixed the platform list offering platforms the grid still had disabled after typing an in-game month or week past its limit
- Fixed Auto-suggest optimal filling in the wrong slider values when every genre was locked
- Fixed the Slider Suggester showing a blank genre after opening its tab with every genre locked
- Fixed REPORT ISSUE saying COPIED when the clipboard was blocked and nothing had been copied
- Fixed the copied report printing an in-game month or week the score was not calculated for
- Fixed RESET doing nothing after a damaged saved form state, which left no way to clear it

## 1.0.5

- A new tick box under Reference topScore says a past game set a top score the numbers above do not show, which opens the low-score pity floor.
- The calculator now warns when you pick more than three platforms, which no real Game Dev Tycoon release can do.
- The calculator now warns when Recently-hired staff is larger than Team size, which the game never counts.

## 1.0.4

- Fixed the predicted score on games released for more than ten platforms at once, where a focus bonus could be counted or missed by mistake.
- The strange-combinations trend now says it reads your main genre only, so a second genre no longer sends you to the wrong option.

## 1.0.3

- The calculator now opens from your own drive with no internet connection.
- Fixed the Back-solve topScore window staying on screen with Cancel doing nothing.
- Fixed the score for a game made before your first top-rated game, where the low-score pity floor was skipped.
- Fixed the predicted score being pushed up to 1.00 when the game itself records it lower.
- Fixed the reviewer spread drawing its scores the wrong way round.
- Fixed Engine techLevel accepting values above 7, which no graphics engine in the game reaches.
- The expert count is now capped at the number of missions this topic and genre can actually have an expert on.
