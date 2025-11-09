const AD_PATTERNS = [/ads?\//i, /advert/i, /banner/i, /pagead/i, /doubleclick/i];

const TRACKER_PATTERNS = [
  /analytics/i,
  /google-analytics/i,
  /gtag/i,
  /tracking/i,
  /facebook.*pixel/i,
  /segment/i,
  /mixpanel/i,
];

const MINER_PATTERNS = [
  /coinhive/i,
  /crypto-loot/i,
  /jsecoin/i,
  /webminepool/i,
  /monerominer/i,
  /cryptaloot/i,
  /deepminer/i,
  /authedmine/i
];

const blockedSites = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log("[AdBlock Pro] Extension installed v2.0");
  const now = new Date();
  chrome.storage.local.set({
    stats: {
      blocked: 0,
      trackers: 0,
      miners: 0,
      sites: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    isEnabled: true,
    blocked: [],
    whitelist: [],
    fraudulentSites: [],
    lastReset: {
      day: now.toDateString(),
      week: getWeekNumber(now),
      month: now.getMonth(),
      year: now.getFullYear(),
    },
  });
});

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function checkAndResetStats() {
  chrome.storage.local.get(["stats", "lastReset"], (result) => {
    if (!result.lastReset) return;

    const now = new Date();
    const stats = result.stats || {};
    const lastReset = result.lastReset;
    let needsUpdate = false;

    if (lastReset.day !== now.toDateString()) {
      stats.daily = 0;
      lastReset.day = now.toDateString();
      needsUpdate = true;
    }

    const currentWeek = getWeekNumber(now);
    if (lastReset.week !== currentWeek) {
      stats.weekly = 0;
      lastReset.week = currentWeek;
      needsUpdate = true;
    }

    if (lastReset.month !== now.getMonth() || lastReset.year !== now.getFullYear()) {
      stats.monthly = 0;
      lastReset.month = now.getMonth();
      lastReset.year = now.getFullYear();
      needsUpdate = true;
    }

    if (needsUpdate) {
      chrome.storage.local.set({ stats, lastReset });
    }
  });
}

setInterval(checkAndResetStats, 3600000);
checkAndResetStats();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[AdBlock Pro] Message received:", request.action);

  if (request.action === "getStats") {
    checkAndResetStats();
    chrome.storage.local.get(["stats", "blocked", "isEnabled"], (result) => {
      sendResponse({
        stats: result.stats || {
          blocked: 0,
          trackers: 0,
          miners: 0,
          sites: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
        },
        blocked: result.blocked || [],
        isEnabled: result.isEnabled !== false,
      });
    });
    return true;
  }

  if (request.action === "blockAd") {
    logBlocked(request.url, request.type);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "toggle") {
    const isEnabled = request.enabled;
    console.log("[AdBlock Pro] Toggling to:", isEnabled);

    (async () => {
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ isEnabled }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: isEnabled ? ["ruleset_main"] : [],
          disableRulesetIds: isEnabled ? [] : ["ruleset_main"],
        });

        console.log("[AdBlock Pro] Rulesets updated, enabled:", isEnabled);
        if (!isEnabled) {
          chrome.action.setBadgeText({ text: "" });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error("[AdBlock Pro] Error toggling:", error);
        sendResponse({ success: false, error: error.message || String(error) });
      }
    })();

    return true;
  }

  if (request.action === "resetStats") {
    const now = new Date();
    chrome.storage.local.set({
      stats: {
        blocked: 0,
        trackers: 0,
        miners: 0,
        sites: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
      },
      blocked: [],
      lastReset: {
        day: now.toDateString(),
        week: getWeekNumber(now),
        month: now.getMonth(),
        year: now.getFullYear(),
      },
    });
    sendResponse({ success: true });
    return true;
  }

  sendResponse({ success: false });
  return true;
});

function logBlocked(url, type = "ad") {
  chrome.storage.local.get(["stats", "blocked", "whitelist", "isEnabled"], (result) => {
    const isEnabled = result.isEnabled !== false;
    if (!isEnabled) {
      console.log("[AdBlock Pro] Blocking disabled, not logging");
      return;
    }

    const whitelist = result.whitelist || [];
    const stats = result.stats || {
      blocked: 0,
      trackers: 0,
      miners: 0,
      sites: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
    };
    let blocked = result.blocked || [];

    try {
      const urlObj = new URL(url);
      const isWhitelisted = whitelist.some((domain) => urlObj.hostname.includes(domain));
      if (isWhitelisted) {
        console.log("[AdBlock Pro] URL in whitelist, not blocking:", url);
        return;
      }

      const domain = urlObj.hostname;
      if (!blockedSites.has(domain)) {
        blockedSites.add(domain);
        stats.sites++;
      }
    } catch (e) {
      console.log("[AdBlock Pro] Error parsing URL:", url, e);
    }

    const isTrackerUrl = isTracker(url);
    const isAdUrl = isAd(url);
    const isMinerUrl = isMiner(url);

    if (type === "tracker" || isTrackerUrl) {
      stats.trackers++;
    }

    if (type === "miner" || isMinerUrl) {
      stats.miners++;
      stats.blocked++;
      stats.daily++;
      stats.weekly++;
      stats.monthly++;
    } else if (type === "ad" || isAdUrl) {
      stats.blocked++;
      stats.daily++;
      stats.weekly++;
      stats.monthly++;
    }

    blocked.push({ url, timestamp: Date.now(), type });

    if (blocked.length > 100) blocked = blocked.slice(-100);

    chrome.storage.local.set({ stats, blocked });
    console.log("[AdBlock Pro] Blocked:", url, "Type:", type);

    updateBadge();
  });
}

function isTracker(url) {
  return TRACKER_PATTERNS.some((pattern) => pattern.test(url));
}

function isAd(url) {
  return AD_PATTERNS.some((pattern) => pattern.test(url));
}

function isMiner(url) {
  return MINER_PATTERNS.some((pattern) => pattern.test(url));
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadge(activeInfo.tabId);
});

function updateBadge(tabId) {
  chrome.storage.local.get(["stats", "isEnabled"], (result) => {
    const stats = result.stats || { blocked: 0 };
    const isEnabled = result.isEnabled !== false;

    if (isEnabled && stats.blocked > 0) {
      const options = { text: stats.blocked.toString() };
      if (tabId) options.tabId = tabId;
      chrome.action.setBadgeText(options);
      chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
    } else {
      const options = { text: "" };
      if (tabId) options.tabId = tabId;
      chrome.action.setBadgeText(options);
    }
  });
}
