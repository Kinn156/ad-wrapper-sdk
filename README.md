# Universal Ad Wrapper SDK v2.0.0 - Enterprise Edition

A lightweight, zero-dependency client-side JavaScript Ad Wrapper SDK with multi-provider support, intelligent environment detection, obfuscated platform keys, robust failure fallback handling, and enterprise-grade security features.

## 🚀 Features

### Core Functionality
- **Multi-Provider Support**: Google Publisher Tag (GPT), Unity Ads, AppLovin, A-Ads, and custom HTML tags
- **10% Platform Takeover**: Probabilistic routing for platform monetization
- **Environment Detection**: Automatic detection of mobile, tablet, and desktop environments
- **Fallback Mechanism**: Intelligent retry system with configurable fallback providers
- **Obfuscated Keys**: Base64-encoded platform master keys for security
- **Instance-Based State**: Multiple ad slots can operate independently without state conflicts

### Security & Reliability
- **Key Obfuscation**: Platform keys stored as Base64 to prevent plain-text searching
- **Environment-Aware Routing**: Unity Ads for mobile/tablet, A-Ads for desktop
- **Failure Handling**: Comprehensive error handling with automatic fallback
- **Retry Logic**: Configurable maximum retry attempts (default: 2)
- **Clean DOM Management**: Prevents conflicts between different ad providers
- **Sandboxed Iframes**: Custom HTML rendered in isolated sandboxed iframes
- **Script Deduplication**: Prevents duplicate SDK script injections
- **Request Timeouts**: Configurable timeout safeguards for external requests
- **Consent Management**: GDPR and US Privacy consent string support

## 📦 Installation

Include the minified SDK in your HTML via jsDelivr CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.0.0/dist/ad-wrapper.min.js"></script>
```

### ES5 Constructor Pattern (v2.0.0)

For multiple ad slots, create isolated instances:

```javascript
const adSlot1 = new AdWrapper();
adSlot1.init({ containerId: 'ad-slot-1', developerConfig: {...} });

const adSlot2 = new AdWrapper();
adSlot2.init({ containerId: 'ad-slot-2', developerConfig: {...} });
```

### Singleton Compatibility (Backwards Compatible)

For single ad slot usage, the singleton pattern still works:

```javascript
AdWrapperSingleton.init({ containerId: 'ad-slot-1', developerConfig: {...} });
```

## 🔧 Configuration

### Basic Setup

```javascript
const adWrapper = new AdWrapper();
adWrapper.init({
  containerId: "ad-slot-1",
  developerConfig: {
    provider: "gpt", // or "google" (alias), "unity", "applovin", "a-ads", "custom_tag"
    keys: {
      googleAdSlot: "/12345/developer_banner"
    }
  }
});
adWrapper.loadAd();
```

### Advanced Configuration with Fallback

```javascript
const adWrapper = new AdWrapper();
adWrapper.init({
  containerId: "ad-slot-1",
  developerConfig: {
    provider: "gpt",
    keys: {
      googleAdSlot: "/12345/developer_banner"
    },
    fallbackProvider: "custom_tag",
    fallbackKeys: {
      customHtml: '<div>Fallback Ad</div>'
    }
  },
  timeout: 5000, // Request timeout in milliseconds
  consent: {
    gdprApplies: true,
    tcString: "CPxxxx...",
    uspString: "1YNN"
  }
});
adWrapper.loadAd();
```

### Loading Ads

```javascript
// Load a single ad
adWrapper.loadAd();
```

## 🎯 Platform Takeover Configuration

The SDK automatically routes 10% of ad requests to platform ads using obfuscated keys:

- **Mobile/Tablet**: Unity Ads (Game ID: `800110972`)
- **Desktop**: A-Ads (Zone ID: `2450233`)

Platform keys are Base64-encoded in the source code:
- Unity ID: `ODAwMTEwOTcy` → `800110972`
- A-Ads Zone: `MjQ1MDIzMw==` → `2450233`

## 📱 Environment Detection

The SDK automatically detects the user's environment:

- **Mobile**: iPhones, Android phones, etc.
- **Tablet**: iPads, Android tablets
- **Desktop**: Desktop browsers

Platform provider selection:
- Mobile/Tablet → Unity Ads
- Desktop → A-Ads

## 🔄 Fallback Mechanism

The SDK implements a robust fallback system:

1. **Platform Ad Failure**: Falls back to developer configuration
2. **Developer Ad Failure**: Uses configured fallback provider
3. **No Fallback Config**: Falls back to platform ads
4. **Max Attempts Reached**: Shows fallback placeholder

### Configuring Fallback

```javascript
developerConfig: {
  provider: "google",
  keys: { googleAdSlot: "/12345/developer_banner" },
  fallbackProvider: "unity", // or "a-ads", "custom_tag"
  fallbackKeys: {
    unityGameId: "FALLBACK_UNITY_ID"
  }
}
```

## 🛠️ API Reference

### Configuration Methods

- `AdWrapper.init(config)` - Initialize the SDK
- `AdWrapper.loadAd()` - Load an ad request

### Environment Methods

- `AdWrapper.getEnvironment()` - Get detected environment (mobile/tablet/desktop)

### Configuration Methods

- `AdWrapper.getTakeoverRate()` - Get current takeover rate (default: 0.10)
- `AdWrapper.setTakeoverRate(rate)` - Set takeover rate (0.0 to 1.0)
- `AdWrapper.isFallbackEnabled()` - Check if fallback is enabled
- `AdWrapper.setFallbackEnabled(enabled)` - Enable/disable fallback
- `AdWrapper.getMaxRetryAttempts()` - Get max retry attempts
- `AdWrapper.setMaxRetryAttempts(attempts)` - Set max retry attempts (0-5)

## 🧪 Testing

### Automated Tests

Run the comprehensive test suite:

```bash
node test-environment-fallback.js
```

This tests:
- Base64 decoding verification
- Environment detection accuracy
- Platform provider selection
- Fallback logic scenarios
- Key obfuscation
- Takeover rate statistics

### Manual Testing

Open `index.html` in a browser to access the interactive test harness:

- **Load Single Ad**: Test individual ad requests
- **Run 100 Tests**: Automated batch testing with statistics
- **Test Fallback**: Simulate failure scenarios
- **Environment Display**: Shows detected environment
- **Live Statistics**: Real-time takeover/fallback tracking

## 📊 Supported Providers

### Google Publisher Tag (GPT)
```javascript
provider: "gpt", // or "google" for backwards compatibility
keys: {
  googleAdSlot: "/12345/developer_banner"
}
```

### Unity Ads
```javascript
provider: "unity",
keys: {
  unityGameId: "YOUR_UNITY_GAME_ID"
}
```

### AppLovin
```javascript
provider: "applovin",
keys: {
  applovinZoneId: "YOUR_APPLOVIN_ZONE"
}
```

### A-Ads
```javascript
provider: "a-ads",
keys: {
  aAdsZoneId: "YOUR_AADS_ZONE"
}
```

### Custom HTML
```javascript
provider: "custom_tag",
keys: {
  customHtml: "<div>Your custom ad HTML</div>"
}
```

## 🔐 Security Features

1. **Obfuscated Keys**: Platform master keys are Base64-encoded
2. **Key Masking**: Keys are partially obfuscated in console logs
3. **No External Dependencies**: Zero-dependency reduces attack surface
4. **DOM Isolation**: Ads loaded in isolated containers
5. **Sandboxed Iframes**: Custom HTML rendered in sandboxed iframes with restricted permissions
6. **Script Deduplication**: Global registry prevents duplicate SDK injections
7. **Request Timeouts**: Automatic fallback on slow or hung requests
8. **Consent Management**: GDPR and US Privacy string injection for compliance

## 📈 Statistics & Monitoring

The SDK provides detailed console logging:

- `[AdWrapper] PLATFORM TAKEOVER` - Platform ad routing
- `[AdWrapper] DEVELOPER SHARE` - Developer ad routing
- `[AdWrapper] Fallback attempt` - Fallback activation
- `[AdWrapper] Environment detected` - Environment detection

## 🚀 Building

Build the production bundle:

```bash
npm install
npm run build
```

Development build with source maps:

```bash
npm run dev
```

Run E2E tests:

```bash
npm run test:e2e
```

## 📝 File Structure

```
ADS AGGREGATOR/
├── src/
│   └── ad-wrapper.js          # Source code
├── dist/
│   └── ad-wrapper.min.js      # Production bundle
├── index.html                 # Test harness
├── test-environment-fallback.js  # Automated tests
├── test-routing.js            # Routing logic tests
├── package.json               # NPM configuration
└── README.md                  # Documentation
```

## ⚙️ Configuration Options

### Takeover Rate
Default: 10% (0.10)
```javascript
adWrapper.setTakeoverRate(0.15); // Set to 15%
```

### Fallback Enabled
Default: true
```javascript
adWrapper.setFallbackEnabled(false); // Disable fallback
```

### Max Retry Attempts
Default: 2
```javascript
adWrapper.setMaxRetryAttempts(3); // Set to 3 attempts
```

### Request Timeout
Default: 5000ms
```javascript
adWrapper.setTimeout(10000); // Set to 10 seconds
```

### Consent Management
```javascript
adWrapper.setConsent({
  gdprApplies: true,
  tcString: "CPxxxx...",
  uspString: "1YNN"
});
```

## 🌐 Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## 📄 License

MIT License - Feel free to use in your projects

## 🤝 Support

For issues or questions, please refer to the test harness and automated tests for usage examples.

---

**Version**: 2.0.0  
**Status**: Enterprise Ready ✅  
**Last Updated**: 2026-08-09  

## v2.0.0 Changes
- **Instance-based state**: Multiple ad slots can operate independently
- **Script deduplication**: Prevents duplicate SDK script injections
- **Request timeouts**: Configurable timeout safeguards (default: 5000ms)
- **Sandboxed iframes**: Custom HTML rendered in isolated sandboxed iframes
- **Consent management**: GDPR and US Privacy string support
- **GPT provider**: Renamed "google" to "gpt" with backwards compatibility alias
- **E2E testing**: Puppeteer-based headless browser test suite
