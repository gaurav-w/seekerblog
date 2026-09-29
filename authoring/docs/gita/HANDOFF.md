# Smaller-model handoff

Select the desired model/reasoning level in the app (for example, Terra with High reasoning), then give it the prompt below. No new chat or model change is required by the implementation itself.

## Copy-and-fill prompt

```text
Implement Bhagavad Gita Chapter [N] in this repository using the approved
Chapter 3 reader design. Work only on this chapter.

Recording: [exact local path or supplied YouTube video URL]
Additional instructions: [any chapter-specific changes, otherwise none]

Read GITA-CHAPTERS.md, docs/gita/WORKFLOW.md, and docs/gita/TEST-CASES.md.
Consult docs/gita/CHAPTER-3-RECORD.md for the previous failures and fixes.
Inspect repository instructions and current git changes before editing.

Use Gita Press meanings, following Swami Ramsukhdas's Sadhak-Sanjivani
unless I name another Gita Press edition. Do not use ISKCON. Verify the
chapter's verse count, Sanskrit, and source interpretation. Include Hindi
and English full meanings and small optional bilingual captions under
every displayed Sanskrit word group.

If I supply a YouTube URL instead of a local file, use Kevin Watt's
yt-dlp MCP: verify video metadata, then use ytdlp_download_audio with
that URL. Use the returned file path; convert to MP3 only if needed.
Download video only if its visuals are needed. Do not download a playlist.
Reuse an existing supplied recording when available. Timestamped VTT may
help locate passages; plain transcripts do not provide word timing.

Use the actual supplied recording for timing. Transcribe for anchors,
force-align authoritative Sanskrit line by line, and produce one MP3 clip
per shloka with clip-relative word cues. Preserve joined-word groups.
Keep audio unset until Play; never download the master in the reader.

The existing reader, audio scripts, and browser suite have Chapter 3
constants. Adapt configuration deliberately before running them for this
chapter. Do not invent unsupported command flags, overwrite Chapter 3,
reuse its timing overrides, or share alignment caches between chapters.

Complete the implementation and run the applicable tests. Reuse the
approved design without asking me to approve it again. Ask only for a
missing essential input that cannot be established from the repository
or supplied material, while continuing independent work.

Open the local preview and write docs/gita/CHAPTER-[N]-RECORD.md with
sources, audio hash, exact reproducible commands, overrides, test results,
and listening-review status. State what was not verified. Preserve
unrelated changes. Do not deploy or generate additional chapters.
```

## Work checkpoints

1. **Inputs confirmed:** requested chapter/count, edition/author, recording path/hash/duration, existing work accounted for.
2. **Content ready:** all Sanskrit and bilingual full/word meanings checked; no temporary placeholders.
3. **Tools configured:** paths, globals, hashes, cache directories, verse counts, overrides, and tests adapted without breaking Chapter 3.
4. **Audio ready:** transcript inspected, gaps repaired, line alignment reviewed, clips built, JS/JSON generated together, validator passes.
5. **Reader ready:** language/captions, highlights, navigation, lazy loading, repeat/auto-next and deep links function.
6. **Verified and handed off:** test matrix recorded, preview inspected, source and review limitations reported.

If interrupted, record the last completed checkpoint, changed files, command still running (if any), scratch/cache locations, source hash, failed verse IDs, and the next exact command. Do not restart expensive transcription just because a new model took over. Validate cached inputs first.

## Chapter report template

```markdown
# Chapter N implementation record

Date:
Requested scope:
Expected verse count and verification source:
Edition/author and source URLs:
Editorial decisions or ambiguous terms checked:

## Audio and alignment
User-supplied filename/path:
Source video URL/ID and downloaded filename (if applicable):
Download tool/result and conversion command (if applicable):
Repository master path:
SHA-256:
Duration/codec:
Included/excluded invocation, speaker announcements, and closing material:
Tools/models/settings:
Scratch/cache paths and invalidation performed:
Repairs/overrides and reasons:
Exact build commands:
Clip count and output paths:
Review status (machine-aligned / describe actual manual review):

## Implementation
Files/configuration changed:
Chapter-specific constants removed or adapted:
Shared-file changes and Chapter 3 regression evidence:
Preview URL:

## Verification
Commands and exit results:
Test IDs: PASS / FAIL / NOT RUN, with evidence:
Visual review: verses, languages, viewports, captions on/off:
Listening review: exact verses/times reviewed, by whom, unresolved issues:
Known limitations and next action:
Working-tree/commit/deployment state:
```

Completion reports should be concise but factual. “All tests passed” is insufficient without naming the suite and scope. Machine alignment plus structural/browser tests must not be presented as a full human listening audit.
