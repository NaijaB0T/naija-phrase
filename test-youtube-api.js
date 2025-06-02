// Test script to verify YouTube API functionality
// Run this with: node test-youtube-api.js

const API_KEY = 'AIzaSyAbCsR3chs8dLhEhBrXDCqMtP1n9n83_aA'; // From wrangler.jsonc

async function testYouTubeAPI() {
    console.log('Testing YouTube Data API v3...\n');
    
    // Test with a known video that should have captions
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
    
    try {
        // Test 1: Check if the API key works
        console.log('Test 1: Checking API key validity...');
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
            console.error('❌ API key test failed:', searchResponse.status, await searchResponse.text());
            return false;
        }
        console.log('✅ API key is valid\n');
        
        // Test 2: Get captions list for a video
        console.log(`Test 2: Getting captions for video ${testVideoId}...`);
        const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${testVideoId}&key=${API_KEY}`;
        const captionsResponse = await fetch(captionsUrl);
        
        if (!captionsResponse.ok) {
            console.error('❌ Captions API test failed:', captionsResponse.status, await captionsResponse.text());
            return false;
        }
        
        const captionsData = await captionsResponse.json();
        console.log('✅ Captions API working');
        console.log(`Found ${captionsData.items.length} caption tracks:`);
        
        captionsData.items.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.snippet.name} (${item.snippet.language}) - ${item.snippet.trackKind}`);
        });
        
        // Test 3: Try to get a specific video's info (use a Davido video if you have one)
        // Replace this with an actual Davido video ID to test
        console.log('\nTest 3: Testing with a different video...');
        const davidoVideoId = 'YQq2StSwg_s'; // Example - replace with actual Davido video ID
        const davidoCaptionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${davidoVideoId}&key=${API_KEY}`;
        const davidoResponse = await fetch(davidoCaptionsUrl);
        
        if (davidoResponse.ok) {
            const davidoData = await davidoResponse.json();
            console.log(`✅ Davido video test: Found ${davidoData.items.length} caption tracks`);
            
            if (davidoData.items.length > 0) {
                davidoData.items.forEach((item, index) => {
                    console.log(`  ${index + 1}. ${item.snippet.name} (${item.snippet.language}) - ${item.snippet.trackKind}`);
                });
            } else {
                console.log('ℹ️  No captions found for this video - this might be why processing fails');
            }
        } else {
            console.log('⚠️  Could not check Davido video (video might not exist or be private)');
        }
        
        console.log('\n🎉 All tests completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Run the test
testYouTubeAPI().then(success => {
    if (success) {
        console.log('\n✅ YouTube API is working correctly');
        console.log('💡 If videos still fail, they might not have captions available');
    } else {
        console.log('\n❌ YouTube API has issues that need to be resolved');
    }
}).catch(error => {
    console.error('Test script error:', error);
});
