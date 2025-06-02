# Subtitle Duplicate Issue Analysis & Fix

## Problem Identified
AI-generated captions show duplicates due to:
1. Imprecise timing-based merging
2. Inadequate text similarity detection  
3. Multiple processing paths for AI vs manual captions

## Current Issues in subtitle_processing_workflow.ts

### Issue 1: Timing Precision
```typescript
// Current logic allows duplicates with slight timing differences
if (nextBeginMs <= currentEndMs + this.TIME_LEEWAY_MS) {
    // Merge logic here
}
```

### Issue 2: Incomplete Text Merging
The `attemptTextMerge` method doesn't catch all AI caption patterns:
- Progressive text reveals: "Hello" → "Hello world" → "Hello world, how are you"
- Punctuation variations: "How are you" vs "How are you?"
- Casing differences: "HELLO" vs "Hello"

### Issue 3: Database Constraint Gaps
Current constraint: `UNIQUE(video_id, phrase_text, start_time_seconds)`
- Allows duplicates with different start times
- Doesn't account for normalized text comparison

## Recommended Fixes

### Fix 1: Enhanced Duplicate Detection
Add pre-insertion duplicate checking with normalized text comparison.

### Fix 2: Improved Merging Algorithm  
Implement fuzzy text matching for better AI caption merging.

### Fix 3: Database Constraint Enhancement
Add constraint for normalized text to prevent similar duplicates.

### Fix 4: Processing Status Tracking
Add flags to distinguish AI vs manual caption processing paths.
