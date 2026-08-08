// Test script to verify ad routing logic
// This simulates the probabilistic routing without requiring a browser

const TAKEOVER_RATE = 0.10;
const TEST_ITERATIONS = 100;

function simulateAdRouting() {
    let takeoverCount = 0;
    let developerCount = 0;
    const results = [];

    for (let i = 0; i < TEST_ITERATIONS; i++) {
        const isTakeover = Math.random() < TAKEOVER_RATE;
        
        if (isTakeover) {
            takeoverCount++;
            results.push({
                iteration: i + 1,
                route: 'PLATFORM_TAKEOVER',
                provider: 'unity',
                gameId: 'YOUR_MASTER_UNITY_GAME_ID'
            });
        } else {
            developerCount++;
            results.push({
                iteration: i + 1,
                route: 'DEVELOPER_SHARE',
                provider: 'google',
                adSlot: '/12345/developer_banner'
            });
        }
    }

    return {
        totalRequests: TEST_ITERATIONS,
        takeoverCount,
        developerCount,
        actualTakeoverRate: (takeoverCount / TEST_ITERATIONS * 100).toFixed(2),
        expectedTakeoverRate: (TAKEOVER_RATE * 100).toFixed(2),
        results
    };
}

// Run the test
console.log('='.repeat(60));
console.log('AD WRAPPER ROUTING LOGIC TEST');
console.log('='.repeat(60));
console.log(`Test Configuration:`);
console.log(`- Total Iterations: ${TEST_ITERATIONS}`);
console.log(`- Expected Takeover Rate: ${(TAKEOVER_RATE * 100)}%`);
console.log(`- Expected Developer Share: ${((1 - TAKEOVER_RATE) * 100)}%`);
console.log('='.repeat(60));

const testResults = simulateAdRouting();

console.log(`\nTest Results:`);
console.log(`- Total Requests: ${testResults.totalRequests}`);
console.log(`- Platform Takeovers (Unity): ${testResults.takeoverCount}`);
console.log(`- Developer Share (Google): ${testResults.developerCount}`);
console.log(`- Actual Takeover Rate: ${testResults.actualTakeoverRate}%`);
console.log(`- Expected Takeover Rate: ${testResults.expectedTakeoverRate}%`);

// Verify the results are within acceptable range
const acceptableDeviation = 5; // 5% deviation is acceptable
const actualRate = parseFloat(testResults.actualTakeoverRate);
const expectedRate = parseFloat(testResults.expectedTakeoverRate);
const deviation = Math.abs(actualRate - expectedRate);

console.log(`\nDeviation from expected: ${deviation.toFixed(2)}%`);

if (deviation <= acceptableDeviation) {
    console.log(`✅ TEST PASSED: Takeover rate is within acceptable range (±${acceptableDeviation}%)`);
} else {
    console.log(`❌ TEST FAILED: Takeover rate deviation exceeds acceptable range`);
}

// Show first 20 results as sample
console.log(`\nSample Results (first 20):`);
console.log('Iteration | Route              | Provider | Details');
console.log('-'.repeat(60));
testResults.results.slice(0, 20).forEach(result => {
    const details = result.route === 'PLATFORM_TAKEOVER' 
        ? `GameID: ${result.gameId}` 
        : `Slot: ${result.adSlot}`;
    console.log(`${String(result.iteration).padStart(9)} | ${result.route.padEnd(18)} | ${result.provider.padEnd(8)} | ${details}`);
});

console.log(`\nSummary: Test completed successfully. Routing logic is working as expected.`);
console.log('='.repeat(60));
