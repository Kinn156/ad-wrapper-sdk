(function(window) {
  'use strict';

  var PLATFORM_MASTER_KEYS = Object.freeze({
    unityAppId: atob("ODAwMTEwOTcy"),
    webZoneId: atob("MjQ1MDIzMw==")
  });

  var TAKEOVER_RATE = Object.freeze(0.10);
  var FALLBACK_ENABLED = true;
  var MAX_RETRY_ATTEMPTS = 2;

  var AdWrapper = {
    config: null,
    container: null,
    initialized: false,
    environment: null,
    currentAttempt: 0,
    lastProvider: null,

    init: function(config) {
      if (!config || !config.containerId) {
        console.error('[AdWrapper] Invalid configuration: containerId is required');
        return false;
      }

      this.config = config;
      this.container = document.getElementById(config.containerId);

      if (!this.container) {
        console.error('[AdWrapper] Container element not found: ' + config.containerId);
        return false;
      }

      this.environment = this.detectEnvironment();
      this.initialized = true;
      
      
      return true;
    },

    detectEnvironment: function() {
      var userAgent = navigator.userAgent || navigator.vendor || window.opera;
      
      var tabletRegex = /iPad|Android(?!.*Mobile)|Tablet/i;
      var mobileRegex = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
      
      if (tabletRegex.test(userAgent)) {
        return 'tablet';
      }
      
      if (mobileRegex.test(userAgent)) {
        return 'mobile';
      }
      
      return 'desktop';
    },

    loadAd: function() {
      if (!this.initialized) {
        console.error('[AdWrapper] Not initialized. Call init() first.');
        return false;
      }

      this.currentAttempt = 0;
      this.executeAdRequest();
      return true;
    },

    executeAdRequest: function() {
      var isTakeover = Math.random() < TAKEOVER_RATE;

      if (isTakeover) {
          this.loadPlatformAd();
      } else {
        this.loadDeveloperAd();
      }
    },

    loadPlatformAd: function() {
      var provider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
      var platformKey = this.environment === 'mobile' || this.environment === 'tablet' 
        ? PLATFORM_MASTER_KEYS.unityAppId 
        : PLATFORM_MASTER_KEYS.webZoneId;


      this.lastProvider = 'platform_' + provider;

      if (provider === 'unity') {
        this.loadUnityAd(platformKey, true);
      } else {
        this.loadAAdsAd(platformKey, true);
      }
    },

    loadDeveloperAd: function() {
      if (!this.config.developerConfig) {
        console.error('[AdWrapper] No developer configuration provided');
        if (FALLBACK_ENABLED) {
          this.triggerFallback('no_developer_config');
        }
        return false;
      }

      var provider = this.config.developerConfig.provider;
      var keys = this.config.developerConfig.keys || {};
      this.lastProvider = 'developer_' + provider;

      switch (provider) {
        case 'unity':
          this.loadUnityAd(keys.unityGameId, false);
          break;
        case 'google':
          this.loadGoogleAd(keys);
          break;
        case 'applovin':
          this.loadAppLovinAd(keys);
          break;
        case 'a-ads':
          this.loadAAdsAd(keys.aAdsZoneId, false);
          break;
        case 'custom_tag':
          this.loadCustomTag(keys);
          break;
        default:
          console.error('[AdWrapper] Unknown provider: ' + provider);
          if (FALLBACK_ENABLED) {
            this.triggerFallback('unknown_provider');
          } else {
            this.loadCustomTag(keys);
          }
      }
    },

    loadUnityAd: function(gameId, isPlatform) {
      if (!gameId) {
        console.error('[AdWrapper] Unity Game ID is required');
        if (FALLBACK_ENABLED && isPlatform) {
          this.triggerFallback('missing_unity_id');
        }
        return false;
      }

      this.clearContainer();

      var unityScript = document.createElement('script');
      unityScript.src = 'https://cdp.unity3d.com/sdk/web/UnityAds.min.js';
      unityScript.async = true;
      
      var self = this;
      unityScript.onload = function() {
        if (window.UnityAds) {
          window.UnityAds.initialize(gameId, function() {
            window.UnityAds.show(function() {
              self.onAdSuccess('unity');
            }, function(error) {
              console.error('[AdWrapper] Unity Ad error:', error);
              if (FALLBACK_ENABLED) {
                self.triggerFallback('unity_ad_error');
              }
            });
          }, function(error) {
            console.error('[AdWrapper] Unity Ads initialization error:', error);
            if (FALLBACK_ENABLED) {
              self.triggerFallback('unity_init_error');
            }
          });
        } else {
          console.error('[AdWrapper] Unity Ads SDK not available');
          if (FALLBACK_ENABLED) {
            self.triggerFallback('unity_sdk_unavailable');
          }
        }
      };

      unityScript.onerror = function() {
        console.error('[AdWrapper] Failed to load Unity Ads SDK');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('unity_sdk_load_error');
        }
      };

      document.head.appendChild(unityScript);

      var placeholder = document.createElement('div');
      placeholder.id = 'unity-ad-container';
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.backgroundColor = '#f0f0f0';
      placeholder.innerHTML = '<div style="color: #666;">Unity Ad Loading...</div>';
      this.container.appendChild(placeholder);
    },

    loadGoogleAd: function(keys) {
      if (!keys.googleAdSlot) {
        console.error('[AdWrapper] Google Ad Slot is required');
        if (FALLBACK_ENABLED) {
          this.triggerFallback('missing_google_slot');
        }
        return false;
      }

      this.clearContainer();

      var self = this;
      if (!window.googletag) {
        var gptScript = document.createElement('script');
        gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
        gptScript.async = true;
        gptScript.onload = function() {
          window.googletag = window.googletag || {};
          window.googletag.cmd = window.googletag.cmd || [];
          self.executeGoogleAd(keys.googleAdSlot);
        };
        gptScript.onerror = function() {
          console.error('[AdWrapper] Failed to load Google GPT SDK');
          if (FALLBACK_ENABLED) {
            self.triggerFallback('google_sdk_load_error');
          }
        };
        document.head.appendChild(gptScript);
      } else {
        this.executeGoogleAd(keys.googleAdSlot);
      }
    },

    executeGoogleAd: function(adSlot) {
      var self = this;
      window.googletag.cmd.push(function() {
        try {
          var slot = window.googletag.defineSlot(adSlot, [[300, 250], [728, 90]], 'google-ad-container')
            .addService(window.googletag.pubads());
          window.googletag.enableServices();
          window.googletag.display('google-ad-container');
          self.onAdSuccess('google');
        } catch (error) {
          console.error('[AdWrapper] Google Ad display error:', error);
          if (FALLBACK_ENABLED) {
            self.triggerFallback('google_display_error');
          }
        }
      });

      var adContainer = document.createElement('div');
      adContainer.id = 'google-ad-container';
      adContainer.style.width = '100%';
      adContainer.style.height = '100%';
      this.container.appendChild(adContainer);
    },

    loadAppLovinAd: function(keys) {
      if (!keys.applovinZoneId) {
        console.error('[AdWrapper] AppLovin Zone ID is required');
        if (FALLBACK_ENABLED) {
          this.triggerFallback('missing_applovin_zone');
        }
        return false;
      }

      this.clearContainer();

      var self = this;
      var applovinScript = document.createElement('script');
      applovinScript.src = 'https://cdn.applovin.com/ads/applovin-max-web-sdk.js';
      applovinScript.async = true;
      applovinScript.onload = function() {
        if (window.AppLovinMAX) {
          try {
            window.AppLovinMAX.initialize(keys.applovinZoneId, function() {
              window.AppLovinMAX.showBanner(keys.applovinZoneId, 'applovin-ad-container');
              self.onAdSuccess('applovin');
            }, function(error) {
              console.error('[AdWrapper] AppLovin initialization error:', error);
              if (FALLBACK_ENABLED) {
                self.triggerFallback('applovin_init_error');
              }
            });
          } catch (error) {
            console.error('[AdWrapper] AppLovin SDK error:', error);
            if (FALLBACK_ENABLED) {
              self.triggerFallback('applovin_sdk_error');
            }
          }
        } else {
          console.error('[AdWrapper] AppLovin MAX SDK not available');
          if (FALLBACK_ENABLED) {
            self.triggerFallback('applovin_sdk_unavailable');
          }
        }
      };
      applovinScript.onerror = function() {
        console.error('[AdWrapper] Failed to load AppLovin SDK');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('applovin_sdk_load_error');
        }
      };
      document.head.appendChild(applovinScript);

      var adContainer = document.createElement('div');
      adContainer.id = 'applovin-ad-container';
      adContainer.style.width = '100%';
      adContainer.style.height = '100%';
      this.container.appendChild(adContainer);
    },

    loadAAdsAd: function(zoneId, isPlatform) {
      if (!zoneId) {
        console.error('[AdWrapper] A-Ads Zone ID is required');
        if (FALLBACK_ENABLED && isPlatform) {
          this.triggerFallback('missing_aads_zone');
        }
        return false;
      }

      this.clearContainer();

      var self = this;
      var aAdsScript = document.createElement('script');
      aAdsScript.src = 'https://a-ads.com/ads.js';
      aAdsScript.async = true;
      aAdsScript.onload = function() {
        try {
          var adContainer = document.createElement('div');
          adContainer.id = 'a-ads-ad-container';
          adContainer.style.width = '100%';
          adContainer.style.height = '100%';
          adContainer.setAttribute('data-aads-zone', zoneId);
          self.container.appendChild(adContainer);
          
          if (window.aads) {
            window.aads.show(zoneId, 'a-ads-ad-container');
            self.onAdSuccess('a-ads');
          } else {
            console.error('[AdWrapper] A-Ads global not available');
            if (FALLBACK_ENABLED) {
              self.triggerFallback('aads_global_unavailable');
            }
          }
        } catch (error) {
          console.error('[AdWrapper] A-Ads display error:', error);
          if (FALLBACK_ENABLED) {
            self.triggerFallback('aads_display_error');
          }
        }
      };
      aAdsScript.onerror = function() {
        console.error('[AdWrapper] Failed to load A-Ads SDK');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('aads_sdk_load_error');
        }
      };
      document.head.appendChild(aAdsScript);

      var placeholder = document.createElement('div');
      placeholder.id = 'a-ads-placeholder';
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.backgroundColor = '#f0f0f0';
      placeholder.innerHTML = '<div style="color: #666;">A-Ad Loading...</div>';
      this.container.appendChild(placeholder);
    },

    loadCustomTag: function(keys) {
      this.clearContainer();

      var customHtml = keys.customHtml || '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#666;">Custom Ad Placeholder</div>';
      var iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';

      var doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(customHtml);
      doc.close();

      this.container.appendChild(iframe);
      this.onAdSuccess('custom');
    },

    triggerFallback: function(failureReason) {
      this.currentAttempt++;

      console.warn('[AdWrapper] Ad load failed: ' + failureReason);
      console.warn('[AdWrapper] Fallback attempt: ' + this.currentAttempt + '/' + MAX_RETRY_ATTEMPTS);

      if (this.currentAttempt <= MAX_RETRY_ATTEMPTS) {
        this.executeFallback(failureReason);
      } else {
        console.error('[AdWrapper] Max fallback attempts reached. Showing fallback placeholder.');
        this.showFallbackPlaceholder(failureReason);
      }
    },

    executeFallback: function(failureReason) {

      if (this.lastProvider && this.lastProvider.startsWith('platform_')) {
        this.loadDeveloperAd();
      } else if (this.config.developerConfig && this.config.developerConfig.fallbackProvider) {
        var fallbackProvider = this.config.developerConfig.fallbackProvider;
        var fallbackKeys = this.config.developerConfig.fallbackKeys || {};
        
        switch (fallbackProvider) {
          case 'unity':
            this.loadUnityAd(fallbackKeys.unityGameId, false);
            break;
          case 'google':
            this.loadGoogleAd(fallbackKeys);
            break;
          case 'applovin':
            this.loadAppLovinAd(fallbackKeys);
            break;
          case 'a-ads':
            this.loadAAdsAd(fallbackKeys.aAdsZoneId, false);
            break;
          case 'custom_tag':
            this.loadCustomTag(fallbackKeys);
            break;
          default:
            this.showFallbackPlaceholder(failureReason);
        }
      } else {
        this.loadPlatformAd();
      }
    },

    showFallbackPlaceholder: function(failureReason) {
      this.clearContainer();
      
      var placeholder = document.createElement('div');
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.display = 'flex';
      placeholder.style.flexDirection = 'column';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.backgroundColor = '#fce4e4';
      placeholder.style.border = '2px solid #f44336';
      placeholder.style.borderRadius = '4px';
      placeholder.style.padding = '20px';
      placeholder.style.boxSizing = 'border-box';
      
      placeholder.innerHTML = 
        '<div style="color: #c62828; font-weight: bold; margin-bottom: 10px;">Advertisement Unavailable</div>' +
        '<div style="color: #666; font-size: 12px; text-align: center;">Failed to load ad after multiple attempts.<br>Error: ' + failureReason + '</div>';
      
      this.container.appendChild(placeholder);
    },

    onAdSuccess: function(provider) {
      this.currentAttempt = 0;
    },

    clearContainer: function() {
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }
    },

    obfuscateKey: function(key) {
      if (!key || key.length < 4) return '***';
      return key.substring(0, 2) + '***' + key.substring(key.length - 2);
    },

    getEnvironment: function() {
      return this.environment;
    },

    getTakeoverRate: function() {
      return TAKEOVER_RATE;
    },

    setTakeoverRate: function(rate) {
      if (rate >= 0 && rate <= 1) {
        TAKEOVER_RATE = rate;
      } else {
        console.error('[AdWrapper] Invalid takeover rate. Must be between 0 and 1');
      }
    },

    isFallbackEnabled: function() {
      return FALLBACK_ENABLED;
    },

    setFallbackEnabled: function(enabled) {
      FALLBACK_ENABLED = enabled;
    },

    getMaxRetryAttempts: function() {
      return MAX_RETRY_ATTEMPTS;
    },

    setMaxRetryAttempts: function(attempts) {
      if (attempts >= 0 && attempts <= 5) {
        MAX_RETRY_ATTEMPTS = attempts;
      } else {
        console.error('[AdWrapper] Invalid retry attempts. Must be between 0 and 5');
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdWrapper;
  } else {
    window.AdWrapper = AdWrapper;
  }

})(typeof window !== 'undefined' ? window : global);
