(function(window) {
  'use strict';

  // Platform keys for 10% takeover (encoded for security)
  var PLATFORM_MASTER_KEYS = Object.freeze({
    unityAppId: atob("ODAwMTEwOTcy"), // 800110972
    webZoneId: atob("MjQ1MDIzMw==")    // 2450233
  });

  var DEFAULT_TIMEOUT = 5000;

  // Global script loading state
  window.__adWrapperLoadedScripts = window.__adWrapperLoadedScripts || {};
  window.__adWrapperScriptCallbacks = window.__adWrapperScriptCallbacks || {};

  // Main SDK constructor
  function AdWrapper() {
    this.config = null;
    this.container = null;
    this.initialized = false;
    this.environment = null;
    this.timeout = DEFAULT_TIMEOUT;
    this.takeoverRate = 0.10;
    this.fallbackEnabled = true;
    this.maxRetryAttempts = 2;
    this.consent = {
      gdprApplies: false,
      tcString: '',
      uspString: ''
    };
    this.uniqueId = 'adw-' + Math.random().toString(36).substr(2, 9);
    this.activeRequestId = 0;
    this.activeSession = null;
    this.gptSlot = null;
  }

  // Extract data attributes from script tag or element
  AdWrapper.prototype.extractDataAttributes = function(element) {
    var attributes = {};
    if (!element) return attributes;

    var dataAttrs = element.attributes;
    for (var i = 0; i < dataAttrs.length; i++) {
      var attr = dataAttrs[i];
      if (attr.name.indexOf('data-') === 0) {
        var key = attr.name.substring(5); // Remove 'data-' prefix
        attributes[key] = attr.value;
      }
    }
    return attributes;
  };

  // Convert data attributes to SDK config format
  AdWrapper.prototype.dataAttributesToConfig = function(dataAttrs) {
    var config = {
      containerId: dataAttrs.containerId || null,
      developerConfig: {
        provider: dataAttrs.provider || 'google',
        keys: {}
      }
    };

    // Map data attributes to provider keys
    if (dataAttrs.adsenseClient) {
      config.developerConfig.provider = 'google';
      config.developerConfig.keys.googleAdSlot = dataAttrs.adsenseSlot || '/12345/default';
    }

    if (dataAttrs.unityGameId) {
      config.developerConfig.provider = 'unity';
      config.developerConfig.keys.unityGameId = dataAttrs.unityGameId;
    }

    if (dataAttrs.unityPlacement) {
      config.developerConfig.keys.unityPlacement = dataAttrs.unityPlacement;
    }

    if (dataAttrs.applovinSdkKey) {
      config.developerConfig.provider = 'applovin';
      config.developerConfig.keys.applovinZoneId = dataAttrs.applovinSdkKey;
    }

    // Add fallback configuration if provided
    if (dataAttrs.fallbackProvider) {
      config.developerConfig.fallbackProvider = dataAttrs.fallbackProvider;
      config.developerConfig.fallbackKeys = {};

      if (dataAttrs.fallbackUnityGameId) {
        config.developerConfig.fallbackKeys.unityGameId = dataAttrs.fallbackUnityGameId;
      }
      if (dataAttrs.fallbackAdsenseSlot) {
        config.developerConfig.fallbackKeys.googleAdSlot = dataAttrs.fallbackAdsenseSlot;
      }
      if (dataAttrs.fallbackApplovinZone) {
        config.developerConfig.fallbackKeys.applovinZoneId = dataAttrs.fallbackApplovinZone;
      }
    }

    // Add optional settings
    if (dataAttrs.timeout) {
      config.timeout = parseInt(dataAttrs.timeout, 10);
    }

    if (dataAttrs.disableFallback === 'true') {
      config.fallbackEnabled = false;
    }

    return config;
  };

  // Initialize SDK with configuration
  AdWrapper.prototype.init = function(config) {
    if (!config || !config.containerId) {
      console.error('[AdWrapper] Error: containerId is required. Add a div with an ID and reference it in your config.');
      return false;
    }

    // Clean up any active incomplete session
    if (this.activeSession && !this.activeSession.completed) {
      this.cleanupSession(this.activeSession);
      this.activeSession.completed = true;
    }
    
    // Reset consent to defaults
    this.consent = {
      gdprApplies: false,
      tcString: '',
      uspString: ''
    };

    this.config = config;
    this.container = document.getElementById(config.containerId);

    if (!this.container) {
      console.error('[AdWrapper] Error: Container element not found: ' + config.containerId);
      return false;
    }

    this.environment = this.detectEnvironment();
    this.initialized = true;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    if (config.consent) {
      this.consent.gdprApplies = config.consent.gdprApplies || false;
      this.consent.tcString = config.consent.tcString || '';
      this.consent.uspString = config.consent.uspString || '';
    }
    
    return true;
  };

  // Auto-initialize from data attributes
  AdWrapper.prototype.autoInit = function() {
    var script = document.currentScript;
    if (!script) {
      // Fallback: find script by src if currentScript not available
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('ad-wrapper.min.js') !== -1) {
          script = scripts[i];
          break;
        }
      }
    }

    if (!script) {
      console.warn('[AdWrapper] Could not find script tag for auto-initialization');
      return false;
    }

    var dataAttrs = this.extractDataAttributes(script);
    
    if (!dataAttrs.containerId) {
      console.warn('[AdWrapper] No data-container-id found. Add data-container-id="your-div-id" to the script tag.');
      return false;
    }

    var config = this.dataAttributesToConfig(dataAttrs);
    
    // Validate required IDs based on provider
    if (config.developerConfig.provider === 'google' && !dataAttrs.adsenseSlot) {
      console.warn('[AdWrapper] Warning: data-adsense-slot not provided. Using default slot.');
    }
    if (config.developerConfig.provider === 'unity' && !dataAttrs.unityGameId) {
      console.warn('[AdWrapper] Warning: data-unity-game-id not provided. Unity ads may not work.');
    }
    if (config.developerConfig.provider === 'applovin' && !dataAttrs.applovinSdkKey) {
      console.warn('[AdWrapper] Warning: data-applovin-sdk-key not provided. AppLovin ads may not work.');
    }

    if (this.init(config)) {
      this.loadAd();
      return true;
    }
    
    return false;
  };

  // Detect user's device type
  AdWrapper.prototype.detectEnvironment = function() {
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
  };

  // Load an ad request
  AdWrapper.prototype.loadAd = function() {
    if (!this.initialized) {
      console.error('[AdWrapper] Error: Not initialized. Call init() first.');
      return false;
    }

    // Cancel any incomplete session
    if (this.activeSession && !this.activeSession.completed) {
      this.cleanupSession(this.activeSession);
      this.activeSession.completed = true;
    }

    var session = {
      id: ++this.activeRequestId,
      attempt: 0,
      history: [],
      attemptedProviders: [],
      timeoutHandle: null,
      completed: false
    };
    
    this.activeSession = session;
    this.executeAdRequest(session);
    return true;
  };

  // Execute ad request (decide between platform or developer ad)
  AdWrapper.prototype.executeAdRequest = function(session) {
    if (!session || session.completed) {
      return;
    }
    
    var isTakeover = Math.random() < this.takeoverRate;

    if (isTakeover) {
        this.loadPlatformAd(session);
      } else {
        this.loadDeveloperAd(session);
      }
  };

  // Load platform ad (10% takeover)
  AdWrapper.prototype.loadPlatformAd = function(session) {
    if (!session || session.completed) {
      return;
    }
    
    var provider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
    var platformKey = this.environment === 'mobile' || this.environment === 'tablet' 
      ? PLATFORM_MASTER_KEYS.unityAppId 
      : PLATFORM_MASTER_KEYS.webZoneId;

    session.history.push('platform_' + provider);
    session.attemptedProviders.push(provider);

    if (provider === 'unity') {
      this.loadUnityAd(platformKey, true, session);
    } else {
      this.loadAAdsAd(platformKey, true, session);
    }
  };

  // Load developer-configured ad
  AdWrapper.prototype.loadDeveloperAd = function(session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!this.config.developerConfig) {
      console.error('[AdWrapper] Error: No developer configuration provided');
      if (this.fallbackEnabled) {
        this.triggerFallback('no_developer_config', session);
      }
      return false;
    }

    var provider = this.config.developerConfig.provider;
    var keys = this.config.developerConfig.keys || {};
    
    if (provider === 'google') {
      provider = 'gpt';
    }
    
    session.history.push('developer_' + provider);
    session.attemptedProviders.push(provider);

    switch (provider) {
      case 'unity':
        this.loadUnityAd(keys.unityGameId, false, session);
        break;
      case 'gpt':
        this.loadGoogleAd(keys, session);
        break;
      case 'applovin':
        this.loadAppLovinAd(keys, session);
        break;
      case 'a-ads':
        this.loadAAdsAd(keys.aAdsZoneId, false, session);
        break;
      case 'custom_tag':
        this.loadCustomTag(keys, session);
        break;
      default:
        console.error('[AdWrapper] Error: Unknown provider: ' + provider);
        if (this.fallbackEnabled) {
          this.triggerFallback('unknown_provider', session);
        }
    }
  };

  // Load Unity Ads
  AdWrapper.prototype.loadUnityAd = function(gameId, isPlatform, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!gameId) {
      console.error('[AdWrapper] Error: Unity Game ID is required');
      if (this.fallbackEnabled && isPlatform) {
        this.triggerFallback('missing_unity_id', session);
      }
      return false;
    }

    this.clearContainer();

    var scriptUrl = 'https://cdp.unity3d.com/sdk/web/UnityAds.min.js';
    var self = this;

    this.loadScript(scriptUrl)
      .then(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeUnityAdLoad(gameId, isPlatform, session);
        }
      })
      .catch(function(error) {
        console.error('[AdWrapper] Failed to load Unity Ads SDK:', error);
        if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
          self.triggerFallback('unity_sdk_load_error', session);
        }
      });

    var placeholder = document.createElement('div');
    placeholder.id = this.uniqueId + '-unity';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = '#f0f0f0';
    var loadingText = document.createElement('div');
    loadingText.style.color = '#666';
    loadingText.textContent = 'Loading ad...';
    placeholder.appendChild(loadingText);
    this.container.appendChild(placeholder);
  };

  // Execute Unity Ad load
  AdWrapper.prototype.executeUnityAdLoad = function(gameId, isPlatform, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] Unity Ads timeout');
        if (self.fallbackEnabled) {
          self.triggerFallback('unity_init_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;

    if (window.UnityAds) {
      window.UnityAds.initialize(gameId, function() {
        if (session !== self.activeSession || session.completed) {
          clearTimeout(timeoutId);
          return;
        }
        clearTimeout(timeoutId);
        window.UnityAds.show(function() {
          if (session === self.activeSession && !session.completed) {
            self.onAdSuccess('unity', session);
          }
        }, function(error) {
          if (session === self.activeSession && !session.completed) {
            console.error('[AdWrapper] Unity Ad error:', error);
            if (self.fallbackEnabled) {
              self.triggerFallback('unity_ad_error', session);
            }
          }
        });
      }, function(error) {
        if (session !== self.activeSession || session.completed) {
          clearTimeout(timeoutId);
          return;
        }
        clearTimeout(timeoutId);
        console.error('[AdWrapper] Unity Ads initialization error:', error);
        if (self.fallbackEnabled) {
          self.triggerFallback('unity_init_error', session);
        }
      });
    } else {
      clearTimeout(timeoutId);
      console.error('[AdWrapper] Unity Ads SDK not available');
      if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
        self.triggerFallback('unity_sdk_unavailable', session);
      }
    }
  };

  // Load Google AdSense
  AdWrapper.prototype.loadGoogleAd = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!keys.googleAdSlot) {
      console.error('[AdWrapper] Error: Google Ad Slot is required');
      if (this.fallbackEnabled) {
        this.triggerFallback('missing_google_slot', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

    if (!window.googletag) {
      this.loadScript(scriptUrl)
        .then(function() {
          if (session === self.activeSession && !session.completed) {
            window.googletag = window.googletag || {};
            window.googletag.cmd = window.googletag.cmd || [];
            self.executeGoogleAd(keys.googleAdSlot, session);
          }
        })
        .catch(function(error) {
          console.error('[AdWrapper] Failed to load Google GPT SDK:', error);
          if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
            self.triggerFallback('google_sdk_load_error', session);
          }
        });
    } else {
      this.executeGoogleAd(keys.googleAdSlot, session);
    }
  };

  // Execute Google Ad load
  AdWrapper.prototype.executeGoogleAd = function(adSlot, session) {
    var self = this;
    var uniqueContainerId = this.uniqueId + '-gpt';
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        if (session.gptRenderHandler && window.googletag && window.googletag.pubads) {
          try {
            window.googletag.pubads().removeEventListener('slotRenderEnded', session.gptRenderHandler);
            session.gptRenderHandler = null;
          } catch (e) {
            console.warn('[AdWrapper] Error removing GPT listener:', e);
          }
        }
        
        console.error('[AdWrapper] Google GPT timeout');
        if (self.fallbackEnabled) {
          self.triggerFallback('google_display_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;

    window.googletag.cmd.push(function() {
      try {
        if (session !== self.activeSession || session.completed) {
          clearTimeout(timeoutId);
          return;
        }
        clearTimeout(timeoutId);
        
        if (self.gptSlot && window.googletag.destroySlots) {
          window.googletag.destroySlots([self.gptSlot]);
          self.gptSlot = null;
        }
        
        var slot = window.googletag.defineSlot(adSlot, [[300, 250], [728, 90]], uniqueContainerId)
          .addService(window.googletag.pubads());
        
        session.gptSlot = slot;
        
        var renderHandler = function(event) {
          if (event.slot === session.gptSlot && session === self.activeSession && !session.completed) {
            window.googletag.pubads().removeEventListener('slotRenderEnded', renderHandler);
            session.gptRenderHandler = null;
            clearTimeout(session.timeoutHandle);
            
            if (event.isEmpty === true) {
              console.warn('[AdWrapper] Google GPT slot empty (no ad available)');
              if (self.fallbackEnabled) {
                self.triggerFallback('google_slot_empty', session);
              }
            } else {
              self.onAdSuccess('gpt', session);
            }
          }
        };
        session.gptRenderHandler = renderHandler;
        window.googletag.pubads().addEventListener('slotRenderEnded', renderHandler);
        
        window.googletag.enableServices();
        window.googletag.display(uniqueContainerId);
        self.gptSlot = slot;
      } catch (error) {
        if (session === self.activeSession && !session.completed) {
          clearTimeout(timeoutId);
          console.error('[AdWrapper] Google Ad error:', error);
          if (self.fallbackEnabled) {
            self.triggerFallback('google_display_error', session);
          }
        }
      }
    });

    var adContainer = document.createElement('div');
    adContainer.id = uniqueContainerId;
    adContainer.style.width = '100%';
    adContainer.style.height = '100%';
    this.container.appendChild(adContainer);
  };

  // Load AppLovin ad
  AdWrapper.prototype.loadAppLovinAd = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!keys.applovinZoneId) {
      console.error('[AdWrapper] Error: AppLovin Zone ID is required');
      if (this.fallbackEnabled) {
        this.triggerFallback('missing_applovin_zone', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://cdn.applovin.com/ads/applovin-max-web-sdk.js';
    var uniqueContainerId = this.uniqueId + '-applovin';

    this.loadScript(scriptUrl)
      .then(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeAppLovinAdLoad(keys.applovinZoneId, uniqueContainerId, session);
        }
      })
      .catch(function(error) {
        console.error('[AdWrapper] Failed to load AppLovin SDK:', error);
        if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
          self.triggerFallback('applovin_sdk_load_error', session);
        }
      });

    var adContainer = document.createElement('div');
    adContainer.id = uniqueContainerId;
    adContainer.style.width = '100%';
    adContainer.style.height = '100%';
    this.container.appendChild(adContainer);
  };

  // Execute AppLovin load
  AdWrapper.prototype.executeAppLovinAdLoad = function(zoneId, uniqueContainerId, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] AppLovin timeout');
        if (self.fallbackEnabled) {
          self.triggerFallback('applovin_init_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;

    if (window.AppLovinMAX) {
      try {
        window.AppLovinMAX.initialize(zoneId, function() {
          if (session !== self.activeSession || session.completed) {
            clearTimeout(timeoutId);
            return;
          }
          clearTimeout(timeoutId);
          window.AppLovinMAX.showBanner(zoneId, uniqueContainerId);
          self.onAdSuccess('applovin', session);
        }, function(error) {
          if (session === self.activeSession && !session.completed) {
            clearTimeout(timeoutId);
            console.error('[AdWrapper] AppLovin error:', error);
            if (self.fallbackEnabled) {
              self.triggerFallback('applovin_init_error', session);
            }
          }
        });
      } catch (error) {
        if (session === self.activeSession && !session.completed) {
          clearTimeout(timeoutId);
          console.error('[AdWrapper] AppLovin SDK error:', error);
          if (self.fallbackEnabled) {
            self.triggerFallback('applovin_sdk_error', session);
          }
        }
      }
    } else {
      clearTimeout(timeoutId);
      console.error('[AdWrapper] AppLovin SDK not available');
      if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
        self.triggerFallback('applovin_sdk_unavailable', session);
      }
    }
  };

  // Load A-Ads ad
  AdWrapper.prototype.loadAAdsAd = function(zoneId, isPlatform, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!zoneId) {
      console.error('[AdWrapper] Error: A-Ads Zone ID is required');
      if (this.fallbackEnabled && isPlatform) {
        this.triggerFallback('missing_aads_zone', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://a-ads.com/ads.js';
    var uniqueContainerId = this.uniqueId + '-aads';

    this.loadScript(scriptUrl)
      .then(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeAAdsAdLoad(zoneId, uniqueContainerId, session);
        }
      })
      .catch(function(error) {
        console.error('[AdWrapper] Failed to load A-Ads SDK:', error);
        if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
          self.triggerFallback('aads_sdk_load_error', session);
        }
      });

    var placeholder = document.createElement('div');
    placeholder.id = this.uniqueId + '-aads-placeholder';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = '#f0f0f0';
    var loadingText = document.createElement('div');
    loadingText.style.color = '#666';
    loadingText.textContent = 'Loading ad...';
    placeholder.appendChild(loadingText);
    this.container.appendChild(placeholder);
  };

  // Execute A-Ads load
  AdWrapper.prototype.executeAAdsAdLoad = function(zoneId, uniqueContainerId, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] A-Ads timeout');
        if (self.fallbackEnabled) {
          self.triggerFallback('aads_display_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;

    try {
      var adContainer = document.createElement('div');
      adContainer.id = uniqueContainerId;
      adContainer.style.width = '100%';
      adContainer.style.height = '100%';
      adContainer.setAttribute('data-aads-zone', zoneId);
      self.container.appendChild(adContainer);
      
      if (window.aads) {
        clearTimeout(timeoutId);
        window.aads.show(zoneId, uniqueContainerId);
        self.onAdSuccess('a-ads', session);
      } else {
        clearTimeout(timeoutId);
        console.error('[AdWrapper] A-Ads not available');
        if (session === self.activeSession && !session.completed && self.fallbackEnabled) {
          self.triggerFallback('aads_global_unavailable', session);
        }
      }
    } catch (error) {
      if (session === self.activeSession && !session.completed) {
        clearTimeout(timeoutId);
        console.error('[AdWrapper] A-Ads error:', error);
        if (self.fallbackEnabled) {
          self.triggerFallback('aads_display_error', session);
        }
      }
    }
  };

  // Load custom HTML ad
  AdWrapper.prototype.loadCustomTag = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    this.clearContainer();

    var customHtml = keys.customHtml || '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#666;">Ad Placeholder</div>';
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
    iframe.setAttribute('loading', 'lazy');
    
    var consentMeta = '';
    if (this.consent.gdprApplies) {
      var escapedTcString = this.escapeHtml(this.consent.tcString);
      consentMeta = '<meta name="gdpr-consent" content="' + escapedTcString + '">';
    }
    if (this.consent.uspString) {
      var escapedUspString = this.escapeHtml(this.consent.uspString);
      consentMeta += '<meta name="usp-consent" content="' + escapedUspString + '">';
    }

    var safeHtml = '<!DOCTYPE html><html><head>' + consentMeta + '</head><body style="margin:0;padding:0;">' + customHtml + '</body></html>';

    this.container.appendChild(iframe);
    iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(safeHtml);

    this.onAdSuccess('custom', session);
  };

  // Escape HTML for security
  AdWrapper.prototype.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
  };

  // Trigger fallback to next provider
  AdWrapper.prototype.triggerFallback = function(failureReason, session) {
    if (!session || session.completed) {
      return;
    }
    
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
    
    session.attempt++;
    session.history.push('fallback_' + failureReason);

    console.warn('[AdWrapper] Ad failed: ' + failureReason + ' - Trying fallback...');
    console.warn('[AdWrapper] Attempt: ' + session.attempt + '/' + this.maxRetryAttempts);

    if (session.attempt <= this.maxRetryAttempts) {
      this.executeFallback(failureReason, session);
    } else {
      console.error('[AdWrapper] All attempts failed. Showing placeholder.');
      this.showFallbackPlaceholder(failureReason, session);
      session.completed = true;
    }
  };

  // Execute fallback logic
  AdWrapper.prototype.executeFallback = function(failureReason, session) {
    if (!session || session.completed) {
      return false;
    }
    
    var lastProvider = session.history.length > 0 ? session.history[session.history.length - 1] : '';
    var wasPlatformAd = lastProvider.indexOf('platform_') === 0;
    var wasDeveloperAd = lastProvider.indexOf('developer_') === 0;
    
    var fallbackProvider = null;
    var fallbackKeys = null;
    var isPlatform = false;
    
    var isProviderAttempted = function(provider) {
      if (provider === 'google') provider = 'gpt';
      return session.attemptedProviders.indexOf(provider) !== -1;
    };
    
    if (wasPlatformAd) {
      if (this.config.developerConfig && this.config.developerConfig.provider) {
        var devProvider = this.config.developerConfig.provider;
        if (devProvider === 'google') devProvider = 'gpt';
        
        if (!isProviderAttempted(devProvider)) {
          fallbackProvider = this.config.developerConfig.provider;
          fallbackKeys = this.config.developerConfig.keys || {};
        } else {
          if (this.config.developerConfig.fallbackProvider && !isProviderAttempted(this.config.developerConfig.fallbackProvider)) {
            fallbackProvider = this.config.developerConfig.fallbackProvider;
            fallbackKeys = this.config.developerConfig.fallbackKeys || {};
          } else {
            isPlatform = true;
            var altPlatformProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'a-ads' : 'unity';
            if (!isProviderAttempted(altPlatformProvider)) {
              fallbackProvider = altPlatformProvider;
              fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
                ? PLATFORM_MASTER_KEYS.webZoneId 
                : PLATFORM_MASTER_KEYS.unityAppId;
            }
          }
        }
      } else {
        isPlatform = true;
        fallbackProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'a-ads' : 'unity';
        if (!isProviderAttempted(fallbackProvider)) {
          fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
            ? PLATFORM_MASTER_KEYS.webZoneId 
            : PLATFORM_MASTER_KEYS.unityAppId;
        }
      }
    } else {
      if (this.config.developerConfig && this.config.developerConfig.fallbackProvider) {
        if (!isProviderAttempted(this.config.developerConfig.fallbackProvider)) {
          fallbackProvider = this.config.developerConfig.fallbackProvider;
          fallbackKeys = this.config.developerConfig.fallbackKeys || {};
        } else {
          isPlatform = true;
          fallbackProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
          if (!isProviderAttempted(fallbackProvider)) {
            fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
              ? PLATFORM_MASTER_KEYS.unityAppId 
              : PLATFORM_MASTER_KEYS.webZoneId;
          }
        }
      } else {
        isPlatform = true;
        fallbackProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
        if (!isProviderAttempted(fallbackProvider)) {
          fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
            ? PLATFORM_MASTER_KEYS.unityAppId 
            : PLATFORM_MASTER_KEYS.webZoneId;
        }
      }
    }
    
    if (!fallbackProvider) {
      console.error('[AdWrapper] All providers failed');
      
      if (this.config.developerConfig && this.config.developerConfig.emergencyHouseAd) {
        var houseAd = this.config.developerConfig.emergencyHouseAd;
        if (houseAd.imageUrl && houseAd.clickUrl) {
          this.renderHouseAd(houseAd, session);
          return true;
        }
      }
      
      if (this.config.developerConfig && this.config.developerConfig.onAdFailedToLoad) {
        try {
          this.config.developerConfig.onAdFailedToLoad('all_providers_exhausted');
        } catch (callbackError) {
          console.error('[AdWrapper] Callback error:', callbackError);
        }
      }
      
      this.showFallbackPlaceholder('all_providers_exhausted', session);
      session.completed = true;
      return false;
    }

    if (fallbackProvider === 'google') {
      fallbackProvider = 'gpt';
    }

    var providerPrefix = isPlatform ? 'platform_' : 'fallback_';
    session.history.push(providerPrefix + fallbackProvider);
    session.attemptedProviders.push(fallbackProvider);

    switch (fallbackProvider) {
      case 'unity':
        this.loadUnityAd(fallbackKeys.unityGameId || fallbackKeys, isPlatform, session);
        break;
      case 'gpt':
        this.loadGoogleAd(fallbackKeys, session);
        break;
      case 'applovin':
        this.loadAppLovinAd(fallbackKeys, session);
        break;
      case 'a-ads':
        this.loadAAdsAd(fallbackKeys.aAdsZoneId || fallbackKeys, isPlatform, session);
        break;
      case 'custom_tag':
        this.loadCustomTag(fallbackKeys, session);
        break;
      default:
        console.error('[AdWrapper] Unknown fallback provider: ' + fallbackProvider);
        this.showFallbackPlaceholder('unknown_provider', session);
        session.completed = true;
    }
  };

  // Render emergency house ad
  AdWrapper.prototype.renderHouseAd = function(houseAd, session) {
    if (!session || session.completed) {
      return;
    }
    
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
    
    this.clearContainer();
    
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('sandbox', 'allow-popups allow-forms');
    
    var houseAdHtml = '<!DOCTYPE html><html><head><style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden;}a{text-decoration:none;display:block;}img{max-width:100%;max-height:100%;object-fit:contain;}</style></head><body>';
    houseAdHtml += '<a href="' + this.escapeHtml(houseAd.clickUrl) + '" target="_top">';
    houseAdHtml += '<img src="' + this.escapeHtml(houseAd.imageUrl) + '" alt="House Ad" />';
    houseAdHtml += '</a></body></html>';
    
    this.container.appendChild(iframe);
    iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(houseAdHtml);
    
    this.onAdSuccess('house_ad', session);
  };

  // Show fallback placeholder
  AdWrapper.prototype.showFallbackPlaceholder = function(failureReason, session) {
    if (session && session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
    
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
    
    var titleDiv = document.createElement('div');
    titleDiv.style.color = '#c62828';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '10px';
    titleDiv.textContent = 'Ad Unavailable';
    placeholder.appendChild(titleDiv);
    
    var messageDiv = document.createElement('div');
    messageDiv.style.color = '#666';
    messageDiv.style.fontSize = '12px';
    messageDiv.style.textAlign = 'center';
    messageDiv.textContent = 'Could not load ad. Error: ' + failureReason;
    placeholder.appendChild(messageDiv);
    
    this.container.appendChild(placeholder);
  };

  // Handle successful ad load
  AdWrapper.prototype.onAdSuccess = function(provider, session) {
    if (!session || session.completed) {
      return;
    }
    
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
    
    session.completed = true;
    session.history.push('success_' + provider);
    console.log('[AdWrapper] Ad loaded successfully: ' + provider);
  };

  // Clear ad container
  AdWrapper.prototype.clearContainer = function() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  };

  // Load external script with deduplication
  AdWrapper.prototype.loadScript = function(url) {
    var self = this;
    
    if (window.__adWrapperLoadedScripts[url] === 'loaded') {
      return Promise.resolve();
    }
    
    if (window.__adWrapperLoadedScripts[url] === 'loading') {
      return new Promise(function(resolve, reject) {
        if (!window.__adWrapperScriptCallbacks[url]) {
          window.__adWrapperScriptCallbacks[url] = [];
        }
        window.__adWrapperScriptCallbacks[url].push(function() {
          if (window.__adWrapperLoadedScripts[url] === 'loaded') {
            resolve();
          } else {
            reject(new Error('Script loading failed: ' + url));
          }
        });
      });
    }
    
    window.__adWrapperLoadedScripts[url] = 'loading';
    window.__adWrapperScriptCallbacks[url] = [];
    
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      var settled = false;
      
      var timeoutId = setTimeout(function() {
        if (settled) return;
        settled = true;
        
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        
        window.__adWrapperLoadedScripts[url] = 'error';
        var callbacks = window.__adWrapperScriptCallbacks[url] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[url] = [];
        reject(new Error('Script loading timeout: ' + url));
      }, 10000);
      
      script.onload = function() {
        if (settled) return;
        settled = true;
        
        clearTimeout(timeoutId);
        window.__adWrapperLoadedScripts[url] = 'loaded';
        var callbacks = window.__adWrapperScriptCallbacks[url] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[url] = [];
        resolve();
      };
      
      script.onerror = function() {
        if (settled) return;
        settled = true;
        
        clearTimeout(timeoutId);
        
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        
        window.__adWrapperLoadedScripts[url] = 'error';
        var callbacks = window.__adWrapperScriptCallbacks[url] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[url] = [];
        reject(new Error('Failed to load script: ' + url));
      };
      
      document.head.appendChild(script);
    });
  };

  // Get detected environment
  AdWrapper.prototype.getEnvironment = function() {
    return this.environment;
  };

  // Get takeover rate
  AdWrapper.prototype.getTakeoverRate = function() {
    return this.takeoverRate;
  };

  // Set takeover rate
  AdWrapper.prototype.setTakeoverRate = function(rate) {
    if (rate >= 0 && rate <= 1) {
      this.takeoverRate = rate;
    } else {
      console.error('[AdWrapper] Error: Invalid takeover rate. Must be between 0 and 1');
    }
  };

  // Check if fallback is enabled
  AdWrapper.prototype.isFallbackEnabled = function() {
    return this.fallbackEnabled;
  };

  // Enable/disable fallback
  AdWrapper.prototype.setFallbackEnabled = function(enabled) {
    this.fallbackEnabled = enabled;
  };

  // Get max retry attempts
  AdWrapper.prototype.getMaxRetryAttempts = function() {
    return this.maxRetryAttempts;
  };

  // Set max retry attempts
  AdWrapper.prototype.setMaxRetryAttempts = function(attempts) {
    if (attempts >= 0 && attempts <= 5) {
      this.maxRetryAttempts = attempts;
    } else {
      console.error('[AdWrapper] Error: Invalid retry attempts. Must be between 0 and 5');
    }
  };

  // Get timeout
  AdWrapper.prototype.getTimeout = function() {
    return this.timeout;
  };

  // Set timeout
  AdWrapper.prototype.setTimeout = function(timeout) {
    if (timeout >= 1000 && timeout <= 30000) {
      this.timeout = timeout;
    } else {
      console.error('[AdWrapper] Error: Invalid timeout. Must be between 1000 and 30000ms');
    }
  };

  // Get consent settings
  AdWrapper.prototype.getConsent = function() {
    return this.consent;
  };

  // Set consent settings
  AdWrapper.prototype.setConsent = function(consent) {
    if (consent) {
      this.consent.gdprApplies = consent.gdprApplies || false;
      this.consent.tcString = consent.tcString || '';
      this.consent.uspString = consent.uspString || '';
    }
  };

  // Clean up session
  AdWrapper.prototype.cleanupSession = function(session) {
    if (!session) return;
    
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
    
    if (session.gptRenderHandler && window.googletag && window.googletag.pubads) {
      try {
        window.googletag.pubads().removeEventListener('slotRenderEnded', session.gptRenderHandler);
        session.gptRenderHandler = null;
      } catch (e) {
        console.warn('[AdWrapper] Error removing GPT listener:', e);
      }
    }
  };

  // Destroy instance and clean up
  AdWrapper.prototype.destroy = function() {
    if (this.activeSession) {
      this.cleanupSession(this.activeSession);
      this.activeSession.completed = true;
      this.activeSession = null;
    }

    if (this.gptSlot && window.googletag && window.googletag.destroySlots) {
      window.googletag.destroySlots([this.gptSlot]);
      this.gptSlot = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.initialized = false;
    this.activeRequestId = 0;
  };

  // Export for Node.js or add to window
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdWrapper;
  } else {
    window.AdWrapper = AdWrapper;
  }
  
  // Create singleton for backwards compatibility
  window.AdWrapperSingleton = new AdWrapper();

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      var autoWrapper = new AdWrapper();
      if (autoWrapper.autoInit()) {
        console.log('[AdWrapper] Auto-initialized from data attributes');
      }
    });
  } else {
    // DOM already ready
    var autoWrapper = new AdWrapper();
    if (autoWrapper.autoInit()) {
      console.log('[AdWrapper] Auto-initialized from data attributes');
    }
  }

})(typeof window !== 'undefined' ? window : global);