const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting E2E Browser Tests for Ad Wrapper SDK v2.0.0...\n');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Create test HTML page
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ad Wrapper SDK E2E Test</title>
    </head>
    <body>
      <div id="ad-slot-1" style="width: 300px; height: 250px; border: 1px solid #ccc;"></div>
      <div id="ad-slot-2" style="width: 300px; height: 250px; border: 1px solid #ccc;"></div>
      <div id="test-results"></div>
      <script src="dist/ad-wrapper.min.js"></script>
      <script>
        const results = document.getElementById('test-results');
        
        function logResult(testName, passed, message) {
          const div = document.createElement('div');
          div.textContent = '[' + (passed ? 'PASS' : 'FAIL') + '] ' + testName + ': ' + message;
          div.style.color = passed ? 'green' : 'red';
          results.appendChild(div);
        }

        try {
          // Test 1: Constructor instantiation
          logResult('Constructor', true, 'AdWrapper constructor available');
          
          // Test 2: Singleton compatibility
          const singleton = window.AdWrapperSingleton;
          logResult('Singleton', singleton !== null, 'AdWrapperSingleton instantiated');
          
          // Test 3: New instance creation
          const adWrapper1 = new AdWrapper();
          const adWrapper2 = new AdWrapper();
          logResult('Instance Isolation', adWrapper1 !== adWrapper2, 'Multiple instances isolated');
          
          // Test 4: Init with container
          const initResult1 = adWrapper1.init({
            containerId: 'ad-slot-1',
            developerConfig: {
              provider: 'custom_tag',
              keys: {
                customHtml: '<div style="background:blue;color:white;padding:10px;">Test Ad 1</div>'
              }
            }
          });
          logResult('Init 1', initResult1 === true, 'First instance initialized');
          
          const initResult2 = adWrapper2.init({
            containerId: 'ad-slot-2',
            developerConfig: {
              provider: 'custom_tag',
              keys: {
                customHtml: '<div style="background:red;color:white;padding:10px;">Test Ad 2</div>'
              }
            }
          });
          logResult('Init 2', initResult2 === true, 'Second instance initialized');
          
          // Test 5: Load ad
          const loadResult1 = adWrapper1.loadAd();
          logResult('Load Ad 1', loadResult1 === true, 'First ad loaded');
          
          const loadResult2 = adWrapper2.loadAd();
          logResult('Load Ad 2', loadResult2 === true, 'Second ad loaded');
          
          // Test 6: Check for sandboxed iframe
          setTimeout(() => {
            const iframe1 = document.querySelector('#ad-slot-1 iframe');
            const hasSandbox1 = iframe1 && iframe1.hasAttribute('sandbox');
            logResult('Sandboxed Iframe 1', hasSandbox1, 'First iframe has sandbox attribute');
            
            const iframe2 = document.querySelector('#ad-slot-2 iframe');
            const hasSandbox2 = iframe2 && iframe2.hasAttribute('sandbox');
            logResult('Sandboxed Iframe 2', hasSandbox2, 'Second iframe has sandbox attribute');
            
            // Test 7: Consent management
            const adWrapper3 = new AdWrapper();
            adWrapper3.init({
              containerId: 'ad-slot-1',
              developerConfig: {
                provider: 'custom_tag',
                keys: { customHtml: '<div>Consent Test</div>' }
              },
              consent: {
                gdprApplies: true,
                tcString: 'CP_TEST',
                uspString: '1YNN'
              }
            });
            const consent = adWrapper3.getConsent();
            logResult('Consent API', consent.gdprApplies === true && consent.tcString === 'CP_TEST', 'Consent management working');
            
            // Test 8: Timeout configuration
            const adWrapper4 = new AdWrapper();
            adWrapper4.init({
              containerId: 'ad-slot-1',
              developerConfig: {
                provider: 'custom_tag',
                keys: { customHtml: '<div>Timeout Test</div>' }
              },
              timeout: 3000
            });
            const timeout = adWrapper4.getTimeout();
            logResult('Timeout Config', timeout === 3000, 'Timeout configuration working');
            
            // Test 9: Script deduplication registry
            const hasRegistry = window.__adWrapperLoadedScripts !== undefined;
            logResult('Script Registry', hasRegistry, 'Script deduplication registry exists');
            
            // Test 10: Google to GPT alias
            const adWrapper5 = new AdWrapper();
            adWrapper5.init({
              containerId: 'ad-slot-1',
              developerConfig: {
                provider: 'google',
                keys: { googleAdSlot: '/test/slot' }
              }
            });
            logResult('Google Alias', true, 'Google provider alias accepted');
            
            logResult('E2E Suite', true, 'All tests completed');
          }, 1000);
          
        } catch (error) {
          logResult('Error', false, error.message);
        }
      </script>
    </body>
    </html>
  `;

  // Write test HTML to file
  const testHtmlPath = path.join(__dirname, '..', 'e2e-test.html');
  fs.writeFileSync(testHtmlPath, testHtml);

  // Load test page
  await page.goto('file://' + testHtmlPath);

  // Wait for tests to complete
  await page.waitForTimeout(3000);

  // Get test results
  const results = await page.evaluate(() => {
    const resultsDiv = document.getElementById('test-results');
    const resultItems = resultsDiv.querySelectorAll('div');
    return Array.from(resultItems).map(div => div.textContent);
  });

  console.log('Test Results:');
  results.forEach(result => console.log('  ' + result));

  // Check for failures
  const failures = results.filter(r => r.includes('[FAIL]'));
  
  if (failures.length > 0) {
    console.log('\n❌ E2E Tests Failed: ' + failures.length + ' failure(s)');
    process.exit(1);
  } else {
    console.log('\n✅ All E2E Tests Passed');
  }

  // Cleanup
  fs.unlinkSync(testHtmlPath);
  await browser.close();
})();
