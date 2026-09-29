# Bhagavad Gita chapter implementation guide

Start here when the user asks to add another chapter. Chapter 3 is the approved working reference. Implement only the chapter(s) requested.

1. Read [the workflow](docs/gita/WORKFLOW.md) for requirements, exact steps, commands, data contracts, and known failure modes.
2. Use [the test cases](docs/gita/TEST-CASES.md) as the acceptance checklist. It distinguishes existing automation from checks still requiring listening or visual review.
3. Use [the handoff prompt and completion template](docs/gita/HANDOFF.md) for a smaller model such as Terra at High reasoning.
4. Consult [the Chapter 3 record](docs/gita/CHAPTER-3-RECORD.md) for what was built, what actually passed, and what remains unverified.

**Important:** the reader, alignment scripts, and browser suite currently contain Chapter 3 constants. They are not yet a generic chapter generator. Only `scripts/validate-gita-chapter.cjs` is chapter-parameterized. Do not run a hypothetical `--chapter` flag on the other scripts or overwrite Chapter 3 to build a different chapter.

Existing supporting notes: [audio](scripts/GITA-AUDIO.md), [text sources](scripts/GITA-TEXT.md).
