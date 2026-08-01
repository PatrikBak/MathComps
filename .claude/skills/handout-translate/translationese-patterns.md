# Translationese patterns

What a source-shaped translation looks like when it comes back from a slice agent. Use this to recognize a bad slice, and to seed the "what to watch for" line in an agent's prompt. Add to it whenever a native-voice audit surfaces a pattern that repeats.

## Contents

- SK → CS
- SK → EN
- What it is not

## SK → CS

- **False friends.** Slovak words that exist in Czech carrying another meaning: `lacno`, `úloha` for *role*.
- **Diacritic traps.** SK `naraz` is CS `naráz` (the repo has 10 SK `naraz`, 0 with the long *á*). Not a false friend — the word means the same thing in both, it is just spelled with a long vowel in Czech.
- **Slovak government on Czech verbs.** `vybízí dosadit`, `abychom uměli`, `nutí $a=0$`.
- **Spoken register in written math.** `Pokud …, tak …` where written Czech math wants `pak`.
- **Vocalized prepositions.** SK `ku`, `so`, `zo`, `vo` map to CS `ke`, `se`, `ze`, `ve` — and being two letters, they take a plain space, not a tie (see the tie rule in `handout-editor`).

## SK → EN

- **Calqued nouns.** `summand` for `sčítanec`.
- **Calqued connectives.** "thanks to" as a causal connective in a proof.
- **Wrong modal sense.** "must not" for logical impossibility rather than prohibition.
- **Missing preposition.** "denote $a=f(1)$" without a `by`.
- **Dangling participles from instrumental clauses.** `Dosadením …, ľavá strana …` → "Substituting …, the left-hand side cancels", where the side did not do the substituting.

## What it is not

None of these is a mistranslation. Every one is faithful to the source and grammatical in the target, which is why a source-comparing reviewer approves them and only a blind native reader flags them.
