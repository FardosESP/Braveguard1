const toggleBtn = document.getElementById("toggleBtn");
const statusBadge = document.getElementById("statusBadge");
const controlDesc = document.getElementById("controlDesc");
const blockedCountEl = document.getElementById("blockedCount");
const trackersCountEl = document.getElementById("trackersCount");
const minersCountEl = document.getElementById("minersCount");
const sitesCountEl = document.getElementById("sitesCount");

let isLoadingStats = false;

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadBlocklist();
  loadWhitelist();
  setupEventListeners();

  setInterval(loadStats, 2000);
});

function loadStats() {
  if (isLoadingStats) return;
  isLoadingStats = true;

  chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
    isLoadingStats = false;

    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }

    if (!response) {
      console.log("[AdBlock Pro] No response from background");
      return;
    }

    const stats = response.stats || {
      blocked: 0,
      trackers: 0,
      miners: 0,
      sites: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
    };
    const isEnabled = response.isEnabled !== false;

    blockedCountEl.textContent = stats.blocked;
    trackersCountEl.textContent = stats.trackers;
    minersCountEl.textContent = stats.miners || 0;
    sitesCountEl.textContent = stats.sites;
    document.getElementById("totalToday").textContent = stats.daily;
    document.getElementById("totalWeek").textContent = stats.weekly;
    document.getElementById("totalMonth").textContent = stats.monthly;

    toggleBtn.checked = isEnabled;
    updateStatus(isEnabled);
  });
}

function loadBlocklist() {
  chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }
    if (!response) return;

    const blocked = Array.isArray(response.blocked) ? response.blocked : [];
    const container = document.getElementById("blocklistItems");

    if (blocked.length === 0) {
      container.innerHTML = '<div class="empty-state">Sin bloqueos en esta sesión</div>';
      return;
    }

    container.innerHTML = blocked
      .slice(-15)
      .reverse()
      .map((item, i) => {
        const url = typeof item === "string" ? item : item.url;
        const type = typeof item === "object" && item.type ? item.type : "ad";
        const displayUrl = url.length > 50 ? url.substring(0, 47) + "..." : url;
        const escapedUrl = escapeHTML(url);
        const actualIndex = blocked.length - 1 - i;
        const typeEmoji = type === "miner" ? "⛏️" : type === "tracker" ? "🎯" : "🚫";
        return `
      <div class="list-item">
        <span class="list-item-url" title="${escapedUrl}">${typeEmoji} ${escapeHTML(displayUrl)}</span>
        <button class="remove-btn" data-index="${actualIndex}">✕</button>
      </div>
    `;
      })
      .join("");

    container.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number.parseInt(btn.dataset.index);
        removeBlocked(index);
      });
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadWhitelist() {
  chrome.storage.local.get(["whitelist"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }
    const whitelist = result.whitelist || [];
    const container = document.getElementById("whitelistItems");

    if (whitelist.length === 0) {
      container.innerHTML = '<div class="empty-state">Sin sitios en whitelist</div>';
      return;
    }

    container.innerHTML = whitelist
      .map(
        (site, i) => `
      <div class="list-item">
        <span class="list-item-url">${escapeHTML(site)}</span>
        <button class="remove-btn" data-index="${i}">✕</button>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number.parseInt(btn.dataset.index);
        removeWhitelist(index);
      });
    });
  });
}

function setupEventListeners() {
  toggleBtn.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    console.log("[AdBlock Pro] Toggling protection to:", isEnabled);
    chrome.runtime.sendMessage({ action: "toggle", enabled: isEnabled }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
        return;
      }
      if (response && response.success) {
        updateStatus(isEnabled);
        console.log("[AdBlock Pro] Protection toggled successfully");
      } else {
        console.log("[AdBlock Pro] Error toggling protection");
      }
    });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName, e.currentTarget);
    });
  });

  document.getElementById("addWhitelistBtn").addEventListener("click", addCurrentSiteToWhitelist);

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("¿Reiniciar todas las estadísticas?")) {
      chrome.runtime.sendMessage({ action: "resetStats" }, () => {
        if (chrome.runtime.lastError) {
          console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
          return;
        }
        loadStats();
        loadBlocklist();
      });
    }
  });
}

function updateStatus(isEnabled) {
  statusBadge.textContent = isEnabled ? "Activo" : "Inactivo";
  statusBadge.classList.toggle("inactive", !isEnabled);
  controlDesc.textContent = isEnabled ? "Protección activa" : "Protección desactivada";
}

function switchTab(tabName, clickedElement) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.getElementById(tabName).classList.add("active");
  clickedElement.classList.add("active");

  if (tabName === "blocklist") loadBlocklist();
  if (tabName === "whitelist") loadWhitelist();
}

function removeBlocked(index) {
  chrome.storage.local.get(["blocked"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }
    const blocked = result.blocked || [];
    if (index >= 0 && index < blocked.length) {
      blocked.splice(index, 1);
      chrome.storage.local.set({ blocked }, () => {
        if (chrome.runtime.lastError) {
          console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
          return;
        }
        loadBlocklist();
      });
    }
  });
}

function addCurrentSiteToWhitelist() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }
    if (!tabs[0] || !tabs[0].url) {
      alert("❌ No se pudo obtener la URL");
      return;
    }

    try {
      const url = new URL(tabs[0].url);
      const hostname = url.hostname;

      if (url.protocol === "chrome:" || url.protocol === "chrome-extension:") {
        alert("❌ No se pueden agregar páginas especiales");
        return;
      }

      chrome.storage.local.get(["whitelist"], (result) => {
        if (chrome.runtime.lastError) {
          console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
          return;
        }
        const whitelist = result.whitelist || [];
        if (!whitelist.includes(hostname)) {
          whitelist.push(hostname);
          chrome.storage.local.set({ whitelist }, () => {
            if (chrome.runtime.lastError) {
              console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
              return;
            }
            loadWhitelist();
            alert(`✅ ${hostname} agregado a whitelist`);
          });
        } else {
          alert(`ℹ️ ${hostname} ya está en whitelist`);
        }
      });
    } catch (e) {
      console.log("[AdBlock Pro] Error processing URL:", e);
      alert("❌ Error al procesar URL");
    }
  });
}

function removeWhitelist(index) {
  chrome.storage.local.get(["whitelist"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
      return;
    }
    const whitelist = result.whitelist || [];
    if (index >= 0 && index < whitelist.length) {
      whitelist.splice(index, 1);
      chrome.storage.local.set({ whitelist }, () => {
        if (chrome.runtime.lastError) {
          console.error("[AdBlock Pro] Error:", chrome.runtime.lastError);
          return;
        }
        loadWhitelist();
      });
    }
  });
}
