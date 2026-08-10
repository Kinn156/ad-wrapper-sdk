const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting E2E Browser Tests for Ad Wrapper SDK v2.2.7...\n');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const testHtmlPath = path.join(__dirname, '..', 'e2e-test.html');
  let hasUncaughtError = false;

  // Capture page errors
  page.on('pageerror', (err) => {
    console.error('Browser Page Error:', err.message);
    hasUncaughtError = true;
  });

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Browser Console Error:', msg.text());
      hasUncaughtError = true;
    }
  });

  try {
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
          let testCount = 0;
          let passCount = 0;
          let failCount = 0;
          
          function logResult(testName, passed, message) {
            testCount++;
            if (passed) passCount++;
            else failCount++;
            
            const div = document.createElement('div');
            div.textContent = '[' + (passed ? 'PASS' : 'FAIL') + '] ' + testName + ': ' + message;
            div.style.color = passed ? 'green' : 'red';
            results.appendChild(div);
          }

          function assert(condition, testName, message) {
            if (!condition) {
              throw new Error(testName + ': ' + message);
            }
            logResult(testName, true, message);
          }

          try {
            // Test 1: Constructor instantiation
            assert(typeof AdWrapper === 'function', 'Constructor', 'AdWrapper constructor available');
            
            // Test 2: Singleton compatibility
            const singleton = window.AdWrapperSingleton;
            assert(singleton !== null && typeof singleton === 'object', 'Singleton', 'AdWrapperSingleton instantiated');
            
            // Test 3: New instance creation
            const adWrapper1 = new AdWrapper();
            const adWrapper2 = new AdWrapper();
            assert(adWrapper1 !== adWrapper2, 'Instance Isolation', 'Multiple instances isolated');
            
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
            assert(initResult1 === true, 'Init 1', 'First instance initialized');
            
            const initResult2 = adWrapper2.init({
              containerId: 'ad-slot-2',
              developerConfig: {
                provider: 'custom_tag',
                keys: {
                  customHtml: '<div style="background:red;color:white;padding:10px;">Test Ad 2</div>'
                }
              }
            });
            assert(initResult2 === true, 'Init 2', 'Second instance initialized');
            
            // Test 5: Load ad
            const loadResult1 = adWrapper1.loadAd();
            assert(loadResult1 === true, 'Load Ad 1', 'First ad loaded');
            
            const loadResult2 = adWrapper2.loadAd();
            assert(loadResult2 === true, 'Load Ad 2', 'Second ad loaded');
            
            // Test 6: Check for sandboxed iframe
            setTimeout(() => {
              const iframe1 = document.querySelector('#ad-slot-1 iframe');
              const hasSandbox1 = iframe1 && iframe1.hasAttribute('sandbox');
              assert(hasSandbox1, 'Sandboxed Iframe 1', 'First iframe has sandbox attribute');
              
              const sandboxAttr1 = iframe1 ? iframe1.getAttribute('sandbox') : '';
              assert(sandboxAttr1.includes('allow-scripts') && !sandboxAttr1.includes('allow-same-origin'), 
                    'Sandbox Restriction', 'Sandbox does not include allow-same-origin');
              
              const iframe2 = document.querySelector('#ad-slot-2 iframe');
              const hasSandbox2 = iframe2 && iframe2.hasAttribute('sandbox');
              assert(hasSandbox2, 'Sandboxed Iframe 2', 'Second iframe has sandbox attribute');
              
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
              assert(consent.gdprApplies === true && consent.tcString === 'CP_TEST', 
                    'Consent API', 'Consent management working');
            
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
              assert(timeout === 3000, 'Timeout Config', 'Timeout configuration working');
            
              // Test 9: Script deduplication registry
              const hasRegistry = window.__adWrapperLoadedScripts !== undefined;
              assert(hasRegistry, 'Script Registry', 'Script deduplication registry exists');
              
              // Test 10: Google to GPT alias
              const adWrapper5 = new AdWrapper();
              const initResult5 = adWrapper5.init({
                containerId: 'ad-slot-1',
                developerConfig: {
                  provider: 'google',
                  keys: { googleAdSlot: '/test/slot' }
                }
              });
              assert(initResult5 === true, 'Google Alias', 'Google provider alias accepted');
              
              // Test 11: RequestSession object creation
              const adWrapper6 = new AdWrapper();
              adWrapper6.init({
                containerId: 'ad-slot-1',
                developerConfig: {
                  provider: 'custom_tag',
                  keys: { customHtml: '<div>Session Test</div>' }
                }
              });
              adWrapper6.loadAd();
              assert(adWrapper6.activeSession !== null, 'RequestSession', 'Active session created');
              assert(adWrapper6.activeSession.id > 0, 'Session ID', 'Session has valid ID');
              // custom_tag is synchronous, so session should be completed immediately after load
              assert(adWrapper6.activeSession.completed === true, 'Session Completion', 'Synchronous provider marks session completed');
              
              // Test 12: Concurrent calls handling
              const adWrapper7 = new AdWrapper();
              adWrapper7.init({
                containerId: 'ad-slot-1',
                developerConfig: {
                  provider: 'custom_tag',
                  keys: { customHtml: '<div>Concurrent Test</div>' }
                }
              });
              adWrapper7.loadAd();
              const firstSessionId = adWrapper7.activeSession.id;
              adWrapper7.loadAd();
              const secondSessionId = adWrapper7.activeSession.id;
              assert(secondSessionId > firstSessionId, 'Concurrent Calls', 'Session ID increments on concurrent calls');
              
              // Test 13: destroy() method cleanup
              const adWrapper8 = new AdWrapper();
              adWrapper8.init({
                containerId: 'ad-slot-1',
                developerConfig: {
                  provider: 'custom_tag',
                  keys: { customHtml: '<div>Destroy Test</div>' }
                }
              });
              adWrapper8.loadAd();
              adWrapper8.destroy();
              assert(adWrapper8.activeSession === null, 'Destroy Method', 'Active session cleared after destroy');
              assert(adWrapper8.initialized === false, 'Destroy Initialized', 'Initialized flag reset after destroy');
              assert(adWrapper8.activeRequestId === 0, 'Destroy Request ID', 'Active request ID reset after destroy');
              
              logResult('E2E Suite', true, 'All tests completed (' + testCount + ' tests, ' + passCount + ' passed, ' + failCount + ' failed)');
            }, 1000);
            
          } catch (error) {
            logResult('Error', false, error.message);
            throw error;
          }
        </script>
      </body>
      </html>
    `;

    // Write test HTML to file
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
    
    if (failures.length > 0 || hasUncaughtError) {
      console.log('\n❌ E2E Tests Failed: ' + failures.length + ' failure(s)');
      if (hasUncaughtError) {
        console.log('❌ Uncaught browser errors detected');
      }
      process.exit(1);
    } else {
      console.log('\n✅ All E2E Tests Passed');
    }

  } finally {
    // Cleanup - always run regardless of test outcome
    if (fs.existsSync(testHtmlPath)) {
      fs.unlinkSync(testHtmlPath);
    }
    await browser.close();
  }
})();
