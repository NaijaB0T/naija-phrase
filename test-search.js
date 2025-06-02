// Test script to check search functionality locally
// This helps debug search issues without deploying

async function testSearch() {
    console.log('Testing search functionality...\n');
    
    const testQueries = [
        'be there',
        'be there still',
        "I'",
        "I'll",
        "I'll be",
        'I will',
        'how to',
        'test',
        'a', // Single character
        'xx', // Two characters
        '', // Empty
        '"quoted"', // Quoted text
        'special!@#', // Special characters
    ];
    
    for (const query of testQueries) {
        try {
            console.log(`Testing query: "${query}"`);
            
            const response = await fetch(`http://127.0.0.1:8787/api/search?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                console.log(`❌ Error ${response.status}: ${response.statusText}`);
                continue;
            }
            
            const data = await response.json();
            console.log(`✅ Success: ${data.count} results${data.fallback ? ' (fallback)' : ''}`);
            
            if (data.results && data.results.length > 0) {
                console.log(`   First result: "${data.results[0].phrase_text.substring(0, 50)}..."`);
            }
            
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
        }
        
        console.log('');
    }
}

// Run tests
console.log('Make sure your local server is running on http://127.0.0.1:8787');
console.log('Run: npm run dev\n');

testSearch().then(() => {
    console.log('Search testing completed!');
}).catch(error => {
    console.error('Test script error:', error);
});
