# What this folder is

Notes kept for whoever works on this repository next, so nobody has to re-derive them.

`codeNw-review-algorithm.md` is the one that matters. It is a map of `codeNw.js`, the Game
Dev Tycoon game script that ships with the game. That file is the single source of truth for
every number this calculator predicts. It is minified into about 1900 lines of roughly 500
characters each, with one-letter variables that get reused for different things inside the
same function, so reading it cold costs hours. The map saves those hours.

Rules that hold for this project:

- `codeNw.js` always wins. Where a wiki, a forum guide or this calculator disagrees with it,
  the game code is right and the other thing is wrong. Fix the other thing.
- Never change `codeNw.js`. It is the game's file, not ours. It is in the repository only so
  the tests have something to check against.
- Never transcribe a formula by hand into a test. The tests in `tests/` lift the game's own
  source text into a sandbox and run it. A test that re-typed the formula would only prove
  that the typist and the calculator made the same mistake.
- `GameDevTycoon_Calculator.html` is the whole program. One file, no downloads, works from
  a local drive with the network off. Keep it that way.
