const blockTracker = {
  ads: 0,
  trackers: 0,
  miners: 0,
};

let observerTimeout = null;
const OBSERVER_DELAY = 1000;
let domObserver = null;

const MINER_SCRIPTS = [
  'coinhive',
  'coin-hive',
  'crypto-loot',
  'cryptaloot',
  'jsecoin',
  'webminepool',
  'monerominer',
  'deepminer',
  'authedmine',
  'minemytraffic'
];

const SUSPICIOUS_KEYWORDS = [
  'cryptonight',
  'monero',
  'wasm_exec',
  'WebAssembly.instantiate',
  'cnHashing'
];

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  console.log("[AdBlock Pro] Content script initializing...");
  chrome.storage.local.get(["isEnabled", "whitelist"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }

    const isEnabled = result.isEnabled !== false;
    console.log("[AdBlock Pro] Extension enabled:", isEnabled);

    if (isEnabled) {
      const whitelist = result.whitelist || [];
      const hostname = window.location.hostname;
      const isWhitelisted = whitelist.some((domain) => hostname.includes(domain));

      if (isWhitelisted) {
        console.log("[AdBlock Pro] Site is whitelisted:", hostname);
        return;
      }

      blockAds();
      blockTrackers();
      blockMiners();
      observeDOMChanges();
      injectScript();
      console.log("[AdBlock Pro] Protection active");
    } else {
      console.log("[AdBlock Pro] Protection disabled");
    }
  });
}

function injectScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected-script.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.error("[AdBlock Pro] Error injecting script:", e);
  }
}

function blockAds() {
  console.log("[AdBlock Pro] Blocking ads...");
  let blockedCount = 0;

  const scripts = document.querySelectorAll("script");
  scripts.forEach((script) => {
    if (!script.src) return;

    const src = script.src.toLowerCase();

    const isAd =
      src.includes("doubleclick") ||
      src.includes("pagead") ||
      src.includes("googleads") ||
      src.includes("adsbygoogle") ||
      src.includes("amazon-adsystem") ||
      src.includes("taboola") ||
      src.includes("outbrain") ||
      src.includes("/ads/") ||
      src.includes("/ad.js") ||
      src.includes("/ads.js");

    if (isAd) {
      script.remove();
      notifyBlock(script.src, "ad");
      blockedCount++;
    }
  });

  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    const src = (iframe.src || "").toLowerCase();
    const id = (iframe.id || "").toLowerCase();
    const className = (iframe.className || "").toLowerCase();

    const isAd =
      src.includes("doubleclick") ||
      src.includes("pagead") ||
      src.includes("googleads") ||
      src.includes("/ads/") ||
      id.includes("ad") ||
      id.includes("google_ads") ||
      className.includes("ad");

    if (isAd) {
      iframe.remove();
      notifyBlock(iframe.src || "iframe-ad", "ad");
      blockedCount++;
    }
  });

  const adSelectors = `
    [class*='ad-'], [class*='-ad-'], [class*='_ad_'],
    [id*='ad-'], [id*='-ad-'], [id*='_ad_'],
    [class*='banner'], [id*='banner'],
    [class*='advert'], [id*='advert'],
    .advertisement, .advert, .ads,
    .ad-container, .ad-slot, .ad-unit,
    [data-ad-slot], [data-advertisement],
    ins.adsbygoogle
  `;

  try {
    const elements = document.querySelectorAll(adSelectors);
    elements.forEach((el) => {
      if (el && el.offsetHeight > 10 && el.offsetWidth > 10) {
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
        blockedCount++;
      }
    });
  } catch (e) {
    console.error("[AdBlock Pro] Error blocking ads:", e);
  }

  if (blockedCount > 0) {
    console.log("[AdBlock Pro] Blocked", blockedCount, "ad elements");
  }
}

function blockTrackers() {
  console.log("[AdBlock Pro] Blocking trackers...");

  const scripts = document.querySelectorAll("script");
  scripts.forEach((script) => {
    if (!script.src) return;
    const src = script.src.toLowerCase();

    const isTracker =
      src.includes("google-analytics") ||
      src.includes("analytics.google") ||
      src.includes("gtag") ||
      src.includes("facebook.com/tr") ||
      src.includes("segment.com") ||
      src.includes("mixpanel") ||
      src.includes("amplitude") ||
      src.includes("tracking");

    if (isTracker) {
      script.remove();
      notifyBlock(script.src, "tracker");
      blockTracker.trackers++;
    }
  });

  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    const src = (img.src || "").toLowerCase();
    const isTracker = src.includes("facebook") || src.includes("track");

    if (isTracker && (src.includes("1x1") || img.width === 1 || img.height === 1)) {
      img.style.display = "none";
      blockTracker.trackers++;
    }
  });
}

function blockMiners() {
  console.log("[AdBlock Pro] Blocking crypto miners...");

  const scripts = document.querySelectorAll("script");
  scripts.forEach((script) => {
    if (!script.src) {
      const content = script.textContent || script.innerHTML;
      const hasSuspiciousCode = SUSPICIOUS_KEYWORDS.some(keyword => 
        content.includes(keyword)
      );
      
      if (hasSuspiciousCode) {
        console.log("[AdBlock Pro] Blocked suspicious miner script (inline)");
        script.remove();
        notifyBlock("inline-miner-script", "miner");
        blockTracker.miners++;
      }
      return;
    }

    const src = script.src.toLowerCase();
    const isMiner = MINER_SCRIPTS.some(miner => src.includes(miner));

    if (isMiner) {
      script.remove();
      notifyBlock(script.src, "miner");
      blockTracker.miners++;
      console.log("[AdBlock Pro] Blocked crypto miner:", script.src);
    }
  });
}

function observeDOMChanges() {
  if (domObserver) {
    domObserver.disconnect();
  }

  domObserver = new MutationObserver((mutations) => {
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    observerTimeout = setTimeout(() => {
      let hasNewAds = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === "SCRIPT" && node.src && isAdScript(node.src)) {
                node.remove();
                notifyBlock(node.src, "ad");
                hasNewAds = true;
              } else if (node.tagName === "IFRAME" && node.src && isAdScript(node.src)) {
                node.remove();
                notifyBlock(node.src, "ad");
                hasNewAds = true;
              } else if (node.classList) {
                const hasAdClass = Array.from(node.classList).some((cls) => 
                  cls.toLowerCase().includes("ad")
                );
                if (hasAdClass && node.offsetHeight > 10) {
                  node.style.display = "none";
                  hasNewAds = true;
                }
              }
            }
          });
        }
      }

      if (hasNewAds) {
        blockAds();
      }
    }, OBSERVER_DELAY);
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[AdBlock Pro] DOM observer active");
}

function isAdScript(url) {
  const lower = url.toLowerCase();
  return (
    lower.includes("doubleclick") ||
    lower.includes("pagead") ||
    lower.includes("googleads") ||
    lower.includes("amazon-adsystem") ||
    lower.includes("taboola") ||
    lower.includes("outbrain")
  );
}

function notifyBlock(url, type) {
  chrome.runtime.sendMessage(
    {
      action: "blockAd",
      url: url,
      type: type,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[AdBlock Pro] Error sending message:", chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        console.log("[AdBlock Pro] Notified background of block:", url);
      }
    }
  );
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.isEnabled) {
    console.log("[AdBlock Pro] Extension toggled, reloading page");
    if (domObserver) {
      domObserver.disconnect();
    }
    location.reload();
  }
});
