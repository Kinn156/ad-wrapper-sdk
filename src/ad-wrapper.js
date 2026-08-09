(function(window) {
  'use strict';

  var PLATFORM_MASTER_KEYS = Object.freeze({
    unityAppId: atob("ODAwMTEwOTcy"),
    webZoneId: atob("MjQ1MDIzMw==")
  });

  var TAKEOVER_RATE = Object.freeze(0.10);
  var FALLBACK_ENABLED = true;
  var MAX_RETRY_ATTEMPTS = 2;
  var DEFAULT_TIMEOUT = 5000;

  window.__adWrapperLoadedScripts = window.__adWrapperLoadedScripts || {};
  window.__adWrapperScriptCallbacks = window.__adWrapperScriptCallbacks || {};

  function AdWrapper() {
    this.config = null;
    this.container = null;
    this.initialized = false;
    this.environment = null;
    this.currentAttempt = 0;
    this.lastProvider = null;
    this.timeout = DEFAULT_TIMEOUT;
    this.pendingTimeouts = [];
    this.consent = {
      gdprApplies: false,
      tcString: '',
      uspString: ''
    };
    this.uniqueId = 'adw-' + Math.random().toString(36).substr(2, 9);
    this.activeRequestId = 0;
    this.activeSession = null;
  }

  AdWrapper.prototype.init = function(config) {
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
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    if (config.consent) {
      this.consent.gdprApplies = config.consent.gdprApplies || false;
      this.consent.tcString = config.consent.tcString || '';
      this.consent.uspString = config.consent.uspString || '';
    }
    
    return true;
  };

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

  AdWrapper.prototype.loadAd = function() {
    if (!this.initialized) {
      console.error('[AdWrapper] Not initialized. Call init() first.');
      return false;
    }

    var session = {
      id: ++this.activeRequestId,
      attempt: 0,
      history: [],
      timeoutHandle: null,
      completed: false
    };
    
    this.activeSession = session;
    this.currentAttempt = 0;
    this.executeAdRequest(session);
    return true;
  };

  AdWrapper.prototype.executeAdRequest = function(session) {
    if (!session || session.completed) {
      return;
    }
    
    var isTakeover = Math.random() < TAKEOVER_RATE;

    if (isTakeover) {
        this.loadPlatformAd(session);
      } else {
        this.loadDeveloperAd(session);
      }
  };

  AdWrapper.prototype.loadPlatformAd = function(session) {
    if (!session || session.completed) {
      return;
    }
    
    var provider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
    var platformKey = this.environment === 'mobile' || this.environment === 'tablet' 
      ? PLATFORM_MASTER_KEYS.unityAppId 
      : PLATFORM_MASTER_KEYS.webZoneId;

    this.lastProvider = 'platform_' + provider;
    session.history.push('platform_' + provider);

    if (provider === 'unity') {
      this.loadUnityAd(platformKey, true, session);
    } else {
      this.loadAAdsAd(platformKey, true, session);
    }
  };

  AdWrapper.prototype.loadDeveloperAd = function(session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!this.config.developerConfig) {
      console.error('[AdWrapper] No developer configuration provided');
      if (FALLBACK_ENABLED) {
        this.triggerFallback('no_developer_config', session);
      }
      return false;
    }

    var provider = this.config.developerConfig.provider;
    var keys = this.config.developerConfig.keys || {};
    
    if (provider === 'google') {
      provider = 'gpt';
    }
    
    this.lastProvider = 'developer_' + provider;
    session.history.push('developer_' + provider);

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
        console.error('[AdWrapper] Unknown provider: ' + provider);
        if (FALLBACK_ENABLED) {
          this.triggerFallback('unknown_provider', session);
        }
    }
  };

  AdWrapper.prototype.loadUnityAd = function(gameId, isPlatform, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!gameId) {
      console.error('[AdWrapper] Unity Game ID is required');
      if (FALLBACK_ENABLED && isPlatform) {
        this.triggerFallback('missing_unity_id', session);
      }
      return false;
    }

    this.clearContainer();

    var scriptUrl = 'https://cdp.unity3d.com/sdk/web/UnityAds.min.js';
    var self = this;

    if (window.__adWrapperLoadedScripts[scriptUrl] === 'loaded') {
      this.executeUnityAdLoad(gameId, isPlatform, session);
    } else if (window.__adWrapperLoadedScripts[scriptUrl] === 'loading') {
      if (!window.__adWrapperScriptCallbacks[scriptUrl]) {
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
      }
      window.__adWrapperScriptCallbacks[scriptUrl].push(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeUnityAdLoad(gameId, isPlatform, session);
        }
      });
    } else {
      window.__adWrapperLoadedScripts[scriptUrl] = 'loading';
      window.__adWrapperScriptCallbacks[scriptUrl] = [];
      
      var unityScript = document.createElement('script');
      unityScript.src = scriptUrl;
      unityScript.async = true;
      
      unityScript.onload = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'loaded';
        var callbacks = window.__adWrapperScriptCallbacks[scriptUrl] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
        if (session === self.activeSession && !session.completed) {
          self.executeUnityAdLoad(gameId, isPlatform, session);
        }
      };

      unityScript.onerror = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'error';
        console.error('[AdWrapper] Failed to load Unity Ads SDK');
        if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
          self.triggerFallback('unity_sdk_load_error', session);
        }
      };

      document.head.appendChild(unityScript);
    }

    var placeholder = document.createElement('div');
    placeholder.id = this.uniqueId + '-unity';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = '#f0f0f0';
    placeholder.innerHTML = '<div style="color: #666;">Unity Ad Loading...</div>';
    this.container.appendChild(placeholder);
  };

  AdWrapper.prototype.executeUnityAdLoad = function(gameId, isPlatform, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] Unity Ads initialization timeout');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('unity_init_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;
    this.pendingTimeouts.push(timeoutId);

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
            if (FALLBACK_ENABLED) {
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
        if (FALLBACK_ENABLED) {
          self.triggerFallback('unity_init_error', session);
        }
      });
    } else {
      clearTimeout(timeoutId);
      console.error('[AdWrapper] Unity Ads SDK not available');
      if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
        self.triggerFallback('unity_sdk_unavailable', session);
      }
    }
  };

  AdWrapper.prototype.loadGoogleAd = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!keys.googleAdSlot) {
      console.error('[AdWrapper] Google Ad Slot is required');
      if (FALLBACK_ENABLED) {
        this.triggerFallback('missing_google_slot', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

    if (!window.googletag) {
      if (window.__adWrapperLoadedScripts[scriptUrl] === 'loaded') {
        window.googletag = window.googletag || {};
        window.googletag.cmd = window.googletag.cmd || [];
        this.executeGoogleAd(keys.googleAdSlot, session);
      } else if (window.__adWrapperLoadedScripts[scriptUrl] === 'loading') {
        if (!window.__adWrapperScriptCallbacks[scriptUrl]) {
          window.__adWrapperScriptCallbacks[scriptUrl] = [];
        }
        window.__adWrapperScriptCallbacks[scriptUrl].push(function() {
          if (session === self.activeSession && !session.completed) {
            window.googletag = window.googletag || {};
            window.googletag.cmd = window.googletag.cmd || [];
            self.executeGoogleAd(keys.googleAdSlot, session);
          }
        });
      } else {
        window.__adWrapperLoadedScripts[scriptUrl] = 'loading';
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
        
        var gptScript = document.createElement('script');
        gptScript.src = scriptUrl;
        gptScript.async = true;
        gptScript.onload = function() {
          window.__adWrapperLoadedScripts[scriptUrl] = 'loaded';
          var callbacks = window.__adWrapperScriptCallbacks[scriptUrl] || [];
          for (var i = 0; i < callbacks.length; i++) {
            callbacks[i]();
          }
          window.__adWrapperScriptCallbacks[scriptUrl] = [];
          if (session === self.activeSession && !session.completed) {
            window.googletag = window.googletag || {};
            window.googletag.cmd = window.googletag.cmd || [];
            self.executeGoogleAd(keys.googleAdSlot, session);
          }
        };
        gptScript.onerror = function() {
          window.__adWrapperLoadedScripts[scriptUrl] = 'error';
          console.error('[AdWrapper] Failed to load Google GPT SDK');
          if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
            self.triggerFallback('google_sdk_load_error', session);
          }
        };
        document.head.appendChild(gptScript);
      }
    } else {
      this.executeGoogleAd(keys.googleAdSlot, session);
    }
  };

  AdWrapper.prototype.executeGoogleAd = function(adSlot, session) {
    var self = this;
    var uniqueContainerId = this.uniqueId + '-gpt';
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] Google GPT display timeout');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('google_display_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;
    this.pendingTimeouts.push(timeoutId);

    window.googletag.cmd.push(function() {
      try {
        if (session !== self.activeSession || session.completed) {
          clearTimeout(timeoutId);
          return;
        }
        clearTimeout(timeoutId);
        var slot = window.googletag.defineSlot(adSlot, [[300, 250], [728, 90]], uniqueContainerId)
          .addService(window.googletag.pubads());
        window.googletag.enableServices();
        window.googletag.display(uniqueContainerId);
        self.onAdSuccess('gpt', session);
      } catch (error) {
        if (session === self.activeSession && !session.completed) {
          clearTimeout(timeoutId);
          console.error('[AdWrapper] Google Ad display error:', error);
          if (FALLBACK_ENABLED) {
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

  AdWrapper.prototype.loadAppLovinAd = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!keys.applovinZoneId) {
      console.error('[AdWrapper] AppLovin Zone ID is required');
      if (FALLBACK_ENABLED) {
        this.triggerFallback('missing_applovin_zone', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://cdn.applovin.com/ads/applovin-max-web-sdk.js';
    var uniqueContainerId = this.uniqueId + '-applovin';

    if (window.__adWrapperLoadedScripts[scriptUrl] === 'loaded') {
      this.executeAppLovinAdLoad(keys.applovinZoneId, uniqueContainerId, session);
    } else if (window.__adWrapperLoadedScripts[scriptUrl] === 'loading') {
      if (!window.__adWrapperScriptCallbacks[scriptUrl]) {
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
      }
      window.__adWrapperScriptCallbacks[scriptUrl].push(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeAppLovinAdLoad(keys.applovinZoneId, uniqueContainerId, session);
        }
      });
    } else {
      window.__adWrapperLoadedScripts[scriptUrl] = 'loading';
      window.__adWrapperScriptCallbacks[scriptUrl] = [];
      
      var applovinScript = document.createElement('script');
      applovinScript.src = scriptUrl;
      applovinScript.async = true;
      applovinScript.onload = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'loaded';
        var callbacks = window.__adWrapperScriptCallbacks[scriptUrl] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
        if (session === self.activeSession && !session.completed) {
          self.executeAppLovinAdLoad(keys.applovinZoneId, uniqueContainerId, session);
        }
      };
      applovinScript.onerror = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'error';
        console.error('[AdWrapper] Failed to load AppLovin SDK');
        if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
          self.triggerFallback('applovin_sdk_load_error', session);
        }
      };
      document.head.appendChild(applovinScript);
    }

    var adContainer = document.createElement('div');
    adContainer.id = uniqueContainerId;
    adContainer.style.width = '100%';
    adContainer.style.height = '100%';
    this.container.appendChild(adContainer);
  };

  AdWrapper.prototype.executeAppLovinAdLoad = function(zoneId, uniqueContainerId, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] AppLovin initialization timeout');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('applovin_init_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;
    this.pendingTimeouts.push(timeoutId);

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
            console.error('[AdWrapper] AppLovin initialization error:', error);
            if (FALLBACK_ENABLED) {
              self.triggerFallback('applovin_init_error', session);
            }
          }
        });
      } catch (error) {
        if (session === self.activeSession && !session.completed) {
          clearTimeout(timeoutId);
          console.error('[AdWrapper] AppLovin SDK error:', error);
          if (FALLBACK_ENABLED) {
            self.triggerFallback('applovin_sdk_error', session);
          }
        }
      }
    } else {
      clearTimeout(timeoutId);
      console.error('[AdWrapper] AppLovin MAX SDK not available');
      if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
        self.triggerFallback('applovin_sdk_unavailable', session);
      }
    }
  };

  AdWrapper.prototype.loadAAdsAd = function(zoneId, isPlatform, session) {
    if (!session || session.completed) {
      return false;
    }
    
    if (!zoneId) {
      console.error('[AdWrapper] A-Ads Zone ID is required');
      if (FALLBACK_ENABLED && isPlatform) {
        this.triggerFallback('missing_aads_zone', session);
      }
      return false;
    }

    this.clearContainer();

    var self = this;
    var scriptUrl = 'https://a-ads.com/ads.js';
    var uniqueContainerId = this.uniqueId + '-aads';

    if (window.__adWrapperLoadedScripts[scriptUrl] === 'loaded') {
      this.executeAAdsAdLoad(zoneId, uniqueContainerId, session);
    } else if (window.__adWrapperLoadedScripts[scriptUrl] === 'loading') {
      if (!window.__adWrapperScriptCallbacks[scriptUrl]) {
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
      }
      window.__adWrapperScriptCallbacks[scriptUrl].push(function() {
        if (session === self.activeSession && !session.completed) {
          self.executeAAdsAdLoad(zoneId, uniqueContainerId, session);
        }
      });
    } else {
      window.__adWrapperLoadedScripts[scriptUrl] = 'loading';
      window.__adWrapperScriptCallbacks[scriptUrl] = [];
      
      var aAdsScript = document.createElement('script');
      aAdsScript.src = scriptUrl;
      aAdsScript.async = true;
      aAdsScript.onload = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'loaded';
        var callbacks = window.__adWrapperScriptCallbacks[scriptUrl] || [];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        window.__adWrapperScriptCallbacks[scriptUrl] = [];
        if (session === self.activeSession && !session.completed) {
          self.executeAAdsAdLoad(zoneId, uniqueContainerId, session);
        }
      };
      aAdsScript.onerror = function() {
        window.__adWrapperLoadedScripts[scriptUrl] = 'error';
        console.error('[AdWrapper] Failed to load A-Ads SDK');
        if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
          self.triggerFallback('aads_sdk_load_error', session);
        }
      };
      document.head.appendChild(aAdsScript);
    }

    var placeholder = document.createElement('div');
    placeholder.id = this.uniqueId + '-aads-placeholder';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = '#f0f0f0';
    placeholder.innerHTML = '<div style="color: #666;">A-Ad Loading...</div>';
    this.container.appendChild(placeholder);
  };

  AdWrapper.prototype.executeAAdsAdLoad = function(zoneId, uniqueContainerId, session) {
    var self = this;
    var timeoutId = setTimeout(function() {
      if (session === self.activeSession && !session.completed) {
        console.error('[AdWrapper] A-Ads display timeout');
        if (FALLBACK_ENABLED) {
          self.triggerFallback('aads_display_timeout', session);
        }
      }
    }, this.timeout);
    session.timeoutHandle = timeoutId;
    this.pendingTimeouts.push(timeoutId);

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
        console.error('[AdWrapper] A-Ads global not available');
        if (session === self.activeSession && !session.completed && FALLBACK_ENABLED) {
          self.triggerFallback('aads_global_unavailable', session);
        }
      }
    } catch (error) {
      if (session === self.activeSession && !session.completed) {
        clearTimeout(timeoutId);
        console.error('[AdWrapper] A-Ads display error:', error);
        if (FALLBACK_ENABLED) {
          self.triggerFallback('aads_display_error', session);
        }
      }
    }
  };

  AdWrapper.prototype.loadCustomTag = function(keys, session) {
    if (!session || session.completed) {
      return false;
    }
    
    this.clearContainer();

    var customHtml = keys.customHtml || '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#666;">Custom Ad Placeholder</div>';
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
    
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(safeHtml);
    doc.close();

    this.onAdSuccess('custom', session);
  };

  AdWrapper.prototype.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
  };

  AdWrapper.prototype.triggerFallback = function(failureReason, session) {
    if (!session || session.completed) {
      return;
    }
    
    this.clearPendingTimeouts();
    session.attempt++;
    session.history.push('fallback_' + failureReason);

    console.warn('[AdWrapper] Ad load failed: ' + failureReason);
    console.warn('[AdWrapper] Fallback attempt: ' + session.attempt + '/' + MAX_RETRY_ATTEMPTS);

    if (session.attempt <= MAX_RETRY_ATTEMPTS) {
      this.executeFallback(failureReason, session);
    } else {
      console.error('[AdWrapper] Max retry attempts reached. Showing fallback placeholder.');
      this.showFallbackPlaceholder(failureReason, session);
      session.completed = true;
    }
  };

  AdWrapper.prototype.clearPendingTimeouts = function() {
    for (var i = 0; i < this.pendingTimeouts.length; i++) {
      clearTimeout(this.pendingTimeouts[i]);
    }
    this.pendingTimeouts = [];
  };

  AdWrapper.prototype.executeFallback = function(failureReason, session) {
    if (!session || session.completed) {
      return false;
    }
    
    // Determine what was the last attempted provider
    var lastProvider = this.lastProvider || '';
    var wasPlatformAd = lastProvider.indexOf('platform_') === 0;
    var wasDeveloperAd = lastProvider.indexOf('developer_') === 0;
    var wasFallbackAd = lastProvider.indexOf('fallback_') === 0;
    
    var fallbackProvider = null;
    var fallbackKeys = null;
    var isPlatform = false;
    
    // Hierarchy: Platform -> Developer -> FallbackProvider -> Platform (last resort)
    if (wasPlatformAd) {
      // Platform ad failed, try developer provider
      if (this.config.developerConfig && this.config.developerConfig.provider) {
        fallbackProvider = this.config.developerConfig.provider;
        fallbackKeys = this.config.developerConfig.keys || {};
        console.log('[AdWrapper] Fallback: Platform -> Developer (' + fallbackProvider + ')');
      } else {
        // No developer config, try platform again with different provider
        isPlatform = true;
        fallbackProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'a-ads' : 'unity';
        fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
          ? PLATFORM_MASTER_KEYS.webZoneId 
          : PLATFORM_MASTER_KEYS.unityAppId;
        console.log('[AdWrapper] Fallback: Platform -> Platform (' + fallbackProvider + ')');
      }
    } else {
      // Developer or fallback ad failed
      if (this.config.developerConfig && this.config.developerConfig.fallbackProvider) {
        fallbackProvider = this.config.developerConfig.fallbackProvider;
        fallbackKeys = this.config.developerConfig.fallbackKeys || {};
        console.log('[AdWrapper] Fallback: Developer -> FallbackProvider (' + fallbackProvider + ')');
      } else {
        // No fallback provider, try platform as last resort
        isPlatform = true;
        fallbackProvider = this.environment === 'mobile' || this.environment === 'tablet' ? 'unity' : 'a-ads';
        fallbackKeys = this.environment === 'mobile' || this.environment === 'tablet' 
          ? PLATFORM_MASTER_KEYS.unityAppId 
          : PLATFORM_MASTER_KEYS.webZoneId;
        console.log('[AdWrapper] Fallback: Developer -> Platform (' + fallbackProvider + ')');
      }
    }
    
    if (!fallbackProvider) {
      console.error('[AdWrapper] No fallback provider available');
      this.showFallbackPlaceholder('no_fallback_available', session);
      session.completed = true;
      return false;
    }

    if (fallbackProvider === 'google') {
      fallbackProvider = 'gpt';
    }

    this.lastProvider = isPlatform ? 'platform_' + fallbackProvider : 'fallback_' + fallbackProvider;
    session.history.push(this.lastProvider);

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

  AdWrapper.prototype.showFallbackPlaceholder = function(failureReason, session) {
    if (session && session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      var timeoutIndex = this.pendingTimeouts.indexOf(session.timeoutHandle);
      if (timeoutIndex > -1) {
        this.pendingTimeouts.splice(timeoutIndex, 1);
      }
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
    
    placeholder.innerHTML = 
      '<div style="color: #c62828; font-weight: bold; margin-bottom: 10px;">Advertisement Unavailable</div>' +
      '<div style="color: #666; font-size: 12px; text-align: center;">Failed to load ad after multiple attempts.<br>Error: ' + failureReason + '</div>';
    
    this.container.appendChild(placeholder);
  };

  AdWrapper.prototype.onAdSuccess = function(provider, session) {
    if (!session || session.completed) {
      return;
    }
    
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      var timeoutIndex = this.pendingTimeouts.indexOf(session.timeoutHandle);
      if (timeoutIndex > -1) {
        this.pendingTimeouts.splice(timeoutIndex, 1);
      }
      session.timeoutHandle = null;
    }
    
    session.completed = true;
    session.history.push('success_' + provider);
    console.log('[AdWrapper] Ad loaded successfully with provider: ' + provider);
  };

  AdWrapper.prototype.clearContainer = function() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  };

  AdWrapper.prototype.obfuscateKey = function(key) {
    if (!key || key.length < 4) return '***';
    return key.substring(0, 2) + '***' + key.substring(key.length - 2);
  };

  AdWrapper.prototype.getEnvironment = function() {
    return this.environment;
  };

  AdWrapper.prototype.getTakeoverRate = function() {
    return TAKEOVER_RATE;
  };

  AdWrapper.prototype.setTakeoverRate = function(rate) {
    if (rate >= 0 && rate <= 1) {
      TAKEOVER_RATE = rate;
    } else {
      console.error('[AdWrapper] Invalid takeover rate. Must be between 0 and 1');
    }
  };

  AdWrapper.prototype.isFallbackEnabled = function() {
    return FALLBACK_ENABLED;
  };

  AdWrapper.prototype.setFallbackEnabled = function(enabled) {
    FALLBACK_ENABLED = enabled;
  };

  AdWrapper.prototype.getMaxRetryAttempts = function() {
    return MAX_RETRY_ATTEMPTS;
  };

  AdWrapper.prototype.setMaxRetryAttempts = function(attempts) {
    if (attempts >= 0 && attempts <= 5) {
      MAX_RETRY_ATTEMPTS = attempts;
    } else {
      console.error('[AdWrapper] Invalid retry attempts. Must be between 0 and 5');
    }
  };

  AdWrapper.prototype.getTimeout = function() {
    return this.timeout;
  };

  AdWrapper.prototype.setTimeout = function(timeout) {
    if (timeout >= 1000 && timeout <= 30000) {
      this.timeout = timeout;
    } else {
      console.error('[AdWrapper] Invalid timeout. Must be between 1000 and 30000ms');
    }
  };

  AdWrapper.prototype.getConsent = function() {
    return this.consent;
  };

  AdWrapper.prototype.setConsent = function(consent) {
    if (consent) {
      this.consent.gdprApplies = consent.gdprApplies || false;
      this.consent.tcString = consent.tcString || '';
      this.consent.uspString = consent.uspString || '';
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdWrapper;
  } else {
    window.AdWrapper = AdWrapper;
  }
  
  window.AdWrapperSingleton = new AdWrapper();

})(typeof window !== 'undefined' ? window : global);
