# Ad Wrapper SDK - Easy Ad Integration

A simple way to display ads from multiple networks (Google AdSense, Unity Ads, AppLovin) on your website with automatic fallback if one network fails.

## 🚀 Quick Start (30-Second Setup)

**Option 1: Auto-Initialize (Easiest)**

Just add this single line to your website's HTML:

```html
<div id="my-ad-slot" style="width: 300px; height: 250px;"></div>

<script 
  src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js"
  data-container-id="my-ad-slot"
  data-provider="google"
  data-adsense-client="ca-pub-1234567890123456"
  data-adsense-slot="/1234567890/your-ad-slot">
</script>
```

That's it! The ad will automatically load when the page loads.

**Option 2: Manual Initialize**

Add the SDK script and empty div:

```html
<div id="my-ad-slot" style="width: 300px; height: 250px;"></div>
<script src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js"></script>
```

Then add this small script:

```html
<script>
  const adWrapper = new AdWrapper();
  adWrapper.init({
    containerId: "my-ad-slot",
    developerConfig: {
      provider: "google",
      keys: {
        googleAdSlot: "/12345/your-ad-slot"
      }
    }
  });
  adWrapper.loadAd();
</script>
```

---

## 🔑 How to Add Your Network IDs

Replace the placeholder IDs with your actual network IDs:

### Google AdSense (Auto-Initialize)
```html
<script 
  data-container-id="my-ad-slot"
  data-provider="google"
  data-adsense-client="ca-pub-1234567890123456"
  data-adsense-slot="/1234567890/your-ad-slot"
  src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js">
</script>
```

### Unity Ads (Auto-Initialize)
```html
<script 
  data-container-id="my-ad-slot"
  data-provider="unity"
  data-unity-game-id="YOUR_UNITY_GAME_ID"
  data-unity-placement="YOUR_PLACEMENT_ID"
  src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js">
</script>
```

### AppLovin (Auto-Initialize)
```html
<script 
  data-container-id="my-ad-slot"
  data-provider="applovin"
  data-applovin-sdk-key="YOUR_APPLOVIN_ZONE_ID"
  src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js">
</script>
```

---

## 📋 Ready-to-Copy Examples

### Basic Single Network Setup (Auto-Initialize)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <h1>Welcome to My Site</h1>
  
  <!-- Ad Container -->
  <div id="my-ad" style="width: 300px; height: 250px;"></div>
  
  <!-- Auto-Initialize SDK with Google AdSense -->
  <script 
    data-container-id="my-ad"
    data-provider="google"
    data-adsense-client="ca-pub-1234567890123456"
    data-adsense-slot="/1234567890/your-ad-slot"
    src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js">
  </script>
</body>
</html>
```

### Multi-Network Setup (Auto-Initialize with Fallback)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <h1>Welcome to My Site</h1>
  
  <!-- Ad Container -->
  <div id="main-ad" style="width: 300px; height: 250px;"></div>
  
  <!-- Auto-Initialize with Fallback (Google → Unity) -->
  <script 
    data-container-id="main-ad"
    data-provider="google"
    data-adsense-client="ca-pub-1234567890123456"
    data-adsense-slot="/1234567890/your-ad-slot"
    data-fallback-provider="unity"
    data-fallback-unity-game-id="YOUR_UNITY_GAME_ID"
    src="https://cdn.jsdelivr.net/gh/Kinn156/ad-wrapper-sdk@v2.2.8/dist/ad-wrapper.min.js">
  </script>
</body>
</html>
```

---

## 📊 Configuration Reference

### Data Attributes (Auto-Initialize)

| Attribute | What It Does | Required | Example |
|-----------|--------------|----------|---------|
| `data-container-id` | ID of the div where ad appears | ✅ Yes | `"my-ad"` |
| `data-provider` | Which ad network to use | ✅ Yes | `"google"`, `"unity"`, `"applovin"` |
| `data-adsense-client` | Your Google AdSense publisher ID | For Google | `"ca-pub-1234567890"` |
| `data-adsense-slot` | Your Google AdSense slot ID | For Google | `"/12345/your-slot"` |
| `data-unity-game-id` | Your Unity Ads Game ID | For Unity | `"1234567"` |
| `data-unity-placement` | Your Unity Placement ID (optional) | For Unity | `"Banner"` |
| `data-applovin-sdk-key` | Your AppLovin Zone ID | For AppLovin | `"abc123xyz"` |
| `data-fallback-provider` | Backup network if main fails | Optional | `"unity"` |
| `data-fallback-unity-game-id` | Unity Game ID for fallback | Optional | `"1234567"` |
| `data-fallback-adsense-slot` | Google slot ID for fallback | Optional | `"/12345/your-slot"` |
| `data-fallback-applovin-zone` | AppLovin zone ID for fallback | Optional | `"abc123xyz"` |
| `data-timeout` | Request timeout in milliseconds | Optional | `"5000"` |
| `data-disable-fallback` | Disable fallback if set to "true" | Optional | `"true"` |

---

## 🛠️ Troubleshooting Tips

### 1. Check Browser Console
- Right-click on your webpage and select "Inspect"
- Go to the "Console" tab
- Look for any red error messages
- Common issues: Invalid network IDs, missing container div

### 2. Validate Your ID Formats
- **Google AdSense**: Should look like `ca-pub-1234567890123456` (client) and `/1234567890/your-slot-name` (slot)
- **Unity Ads**: Should be a number like `1234567`
- **AppLovin**: Should be your zone ID string from AppLovin dashboard

### 3. Test Mode
- Start with just one network to make sure it works
- Once basic setup works, add fallback networks
- Make sure your container div has a defined width and height
- Check that `data-container-id` matches your div ID exactly

---

## 💡 How It Works

1. **Auto-Initialize**: The SDK automatically starts when the page loads (if using data attributes)
2. **Main Network**: The SDK tries to load an ad from your primary network
3. **Automatic Fallback**: If the primary network fails, it automatically tries your backup network
4. **Smart Detection**: The SDK automatically detects if the user is on mobile or desktop
5. **Clean Display**: Ads are displayed in secure containers that protect your site

---

## 🆘 Need Help?

- Check your browser console for error messages
- Make sure your network IDs are correct
- Ensure your ad container div has the right ID
- Verify your website allows third-party scripts
- Try the manual initialization method if auto-initialize doesn't work

---

**Version**: 2.2.9  
**Last Updated**: 2026-08-16  
**New**: Auto-initialization with data attributes support