;(() => {
  console.log("[AdBlock Pro] Injected protection script initializing...");

  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push = () => {
    console.log("[AdBlock Pro] Blocked adsbygoogle.push()");
    return;
  };

  window.ga = () => {
    console.log("[AdBlock Pro] Blocked ga()");
    return;
  };
  window.gtag = () => {
    console.log("[AdBlock Pro] Blocked gtag()");
    return;
  };

  window.fbq = () => {
    console.log("[AdBlock Pro] Blocked fbq()");
    return;
  };

  window._gaq = [];
  window.dataLayer = window.dataLayer || [];

  window.analytics = {
    track: () => console.log("[AdBlock Pro] Blocked Segment track()"),
    page: () => console.log("[AdBlock Pro] Blocked Segment page()"),
    identify: () => console.log("[AdBlock Pro] Blocked Segment identify()"),
  };

  const CRYPTO_MINER_OBJECTS = [
    'CoinHive',
    'CRLT',
    'JSEcoin',
    'Miner',
    'EtherMiner',
    'Client'
  ];

  CRYPTO_MINER_OBJECTS.forEach(obj => {
    Object.defineProperty(window, obj, {
      get: function() {
        console.log(`[AdBlock Pro] Blocked crypto miner object: ${obj}`);
        return undefined;
      },
      set: function() {
        console.log(`[AdBlock Pro] Prevented crypto miner object assignment: ${obj}`);
      }
    });
  });

  const blockedDomains = [
    "doubleclick",
    "pagead",
    "googleads",
    "adsbygoogle",
    "facebook.com/tr",
    "analytics.google",
    "google-analytics",
    "segment.com",
    "mixpanel.com",
    "taboola.com",
    "outbrain.com",
    "amazon-adsystem.com",
    "googlesyndication.com",
    "googleadservices.com",
    "coinhive.com",
    "coin-hive.com",
    "crypto-loot.com",
    "jsecoin.com",
    "webminepool.com",
    "monerominer.rocks",
    "cryptaloot.pro",
    "deepminer.net",
    "authedmine.com",
    "minemytraffic.com"
  ];

  function isBlockedUrl(url) {
    if (!url) return false;
    const urlString = typeof url === "string" ? url : url.toString();
    return blockedDomains.some((domain) => urlString.toLowerCase().includes(domain));
  }

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0];
    if (typeof url === "string" || url instanceof URL || url instanceof Request) {
      const urlToCheck = url instanceof Request ? url.url : url;
      if (isBlockedUrl(urlToCheck)) {
        console.log("[AdBlock Pro] Blocked fetch to:", urlToCheck);
        return Promise.reject(new Error("Blocked by AdBlock Pro"));
      }
    }
    return originalFetch.apply(this, args);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlockedUrl(url)) {
      console.log("[AdBlock Pro] Blocked XMLHttpRequest to:", url);
      this.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
          Object.defineProperty(this, "status", { value: 0 });
          Object.defineProperty(this, "responseText", { value: "" });
        }
      });
      return;
    }
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  const originalWindowOpen = window.open;
  window.open = function (url, ...args) {
    if (url && isBlockedUrl(url)) {
      console.log("[AdBlock Pro] Blocked popup to:", url);
      return null;
    }
    if (!args[0] && url) {
      console.log("[AdBlock Pro] Blocked suspicious popup");
      return null;
    }
    return originalWindowOpen.apply(this, [url, ...args]);
  };

  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (isBlockedUrl(url)) {
      console.log("[AdBlock Pro] Blocked WebSocket connection to:", url);
      throw new Error("Blocked by AdBlock Pro");
    }
    return new originalWebSocket(url, protocols);
  };

  console.log("[AdBlock Pro] Protection script loaded successfully");
})();
