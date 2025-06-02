# SUBTITLE DUPLICATION FIX
# Apply this patch to subtitle_processing_workflow.ts to fix AI caption duplicates

## 🎯 CORE ISSUE IDENTIFIED

The duplicate subtitles problem occurs because:

1. **Insufficient Timing Tolerance**: AI captions have millisecond precision but merging uses fixed 750ms window
2. **Weak Text Similarity Detection**: Current logic misses progressive reveals and punctuation variations  
3. **No Pre-insertion Duplicate Check**: Database constraint only prevents exact matches

## 🔧 REQUIRED CHANGES

### 1. Replace the `cleanAndMergeSubtitles` method with enhanced version:

```typescript
// IMPROVED: Better merging for AI captions
private cleanAndMergeSubtitles(parsedSubs: SubtitleEntry[]): SubtitleEntry[] {
  if (parsedSubs.length === 0) return [];

  // Sort by time
  parsedSubs.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.end - b.end;
  });

  const cleanedSubs: SubtitleEntry[] = [];
  let currentSub = { ...parsedSubs[0] };

  for (let i = 1; i < parsedSubs.length; i++) {
    const nextSub = parsedSubs[i];
    
    // Enhanced timing check: more flexible for AI captions
    const currentEndMs = currentSub.end * 1000;
    const nextBeginMs = nextSub.start * 1000;
    const withinTimeWindow = nextBeginMs <= currentEndMs + 2000; // Increased to 2 seconds
    
    // Enhanced text similarity check
    const textSimilarity = this.calculateTextSimilarity(currentSub.text, nextSub.text);
    const shouldMerge = withinTimeWindow && (textSimilarity > 0.7 || this.isProgressiveReveal(currentSub.text, nextSub.text));
    
    if (shouldMerge) {
      const mergedText = this.smartTextMerge(currentSub.text, nextSub.text);
      currentSub = {
        start: Math.min(currentSub.start, nextSub.start),
        end: Math.max(currentSub.end, nextSub.end),
        text: mergedText
      };
    } else {
      cleanedSubs.push(currentSub);
      currentSub = { ...nextSub };
    }
  }
  
  cleanedSubs.push(currentSub);
  return cleanedSubs;
}
```
