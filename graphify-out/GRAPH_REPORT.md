# Graph Report - seekerblog  (2026-08-17)

## Corpus Check
- 4 files · ~81,400 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 45 nodes · 97 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cca89e87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `arm()` - 10 edges
2. `hardStop()` - 10 edges
3. `resumeFromVisible()` - 8 edges
4. `activate()` - 7 edges
5. `setState()` - 6 edges
6. `consumeWave()` - 5 edges
7. `consume()` - 5 edges
8. `step()` - 5 edges
9. `sync()` - 5 edges
10. `acquireCamera()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `buildRow()` --calls--> `sync()`  [INFERRED]
  seekerblog-continuous.js → seekerblog-textsize.js
- `fire()` --calls--> `step()`  [INFERRED]
  seekerblog-gesture.js → seekerblog-textsize.js
- `consumeWave()` --calls--> `step()`  [INFERRED]
  seekerblog-gesture.js → seekerblog-textsize.js

## Import Cycles
- None detected.

## Communities (8 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.36
Nodes (10): activate(), buildOverlay(), clearPaging(), hideBar(), layoutPages(), onMqChange(), sheetIsOpen(), showBar() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.62
Nodes (6): clampVal(), get(), set(), step(), sync(), wire()

### Community 2 - "Community 2"
Cohesion: 0.53
Nodes (5): acquireCamera(), buildUI(), ensureVideoEl(), userDisarm(), $()

### Community 3 - "Community 3"
Cohesion: 0.47
Nodes (6): acquireWakeLock(), arm(), loadEngine(), releaseTracks(), releaseWakeLock(), resumeFromVisible()

### Community 4 - "Community 4"
Cohesion: 0.50
Nodes (5): consume(), consumeWave(), fire(), flashFired(), readerRelativeWaveDelta()

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (3): buildRow(), roll(), syncSectionSeg()

### Community 6 - "Community 6"
Cohesion: 0.50
Nodes (4): hardStop(), onPageHide(), setState(), tick()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `step()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `consumeWave()` connect `Community 4` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Why does `sync()` connect `Community 1` to `Community 5`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._