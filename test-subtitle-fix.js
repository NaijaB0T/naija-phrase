// Test script to verify subtitle duplication fix
// Run this after deploying the fix to test if duplicates are prevented

const testVideoId = 1; // Replace with actual video ID that had duplicates

// Function to check for duplicates in the database
async function checkForDuplicates(videoId) {
  console.log(`Checking for duplicates in video ${videoId}...`);
  
  const response = await fetch('/api/admin/check-duplicates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId })
  });
  
  const result = await response.json();
  
  if (result.duplicates && result.duplicates.length > 0) {
    console.log('❌ Duplicates found:');
    result.duplicates.forEach(dup => {
      console.log(`- "${dup.phrase_text}" (appears ${dup.count} times)`);
    });
  } else {
    console.log('✅ No duplicates found!');
  }
  
  return result;
}

// Function to test text similarity calculation
function testTextSimilarity() {
  const testCases = [
    ["Hello", "Hello world", "Should detect progressive reveal"],
    ["Why did you even come back?", "Why did you even come back? She said", "Progressive reveal"],
    ["Hello", "Hello", "Exact match"],
    ["Hello!", "Hello?", "Same text, different punctuation"],
    ["Completely different", "Nothing similar", "No similarity"]
  ];
  
  console.log('\n🧪 Testing text similarity logic:');
  testCases.forEach(([text1, text2, description]) => {
    // This would use the same logic as in the workflow
    const similarity = calculateSimilarity(text1, text2);
    console.log(`${description}: "${text1}" vs "${text2}" = ${(similarity * 100).toFixed(1)}%`);
  });
}

function calculateSimilarity(text1, text2) {
  const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;
  
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  const maxLength = Math.max(words1.length, words2.length);
  
  return maxLength > 0 ? commonWords.length / maxLength : 0;
}

// Run tests
console.log('🚀 Starting subtitle duplication fix verification...');
testTextSimilarity();

// Uncomment to check actual database (requires API endpoint)
// checkForDuplicates(testVideoId);
