// ============================================================================
// SMART SUSPENDER EXTENSION - Background Service Worker
// ============================================================================
// Goals: intelligent per-tab suspension with precise timing, aggressive memory
// release via tab replacement strategy, and reliable restore functionality.
// Uses dynamic single-alarm scheduling for optimal resource usage.
// ============================================================================

// ---------------------------- Storage Keys & Defaults ----------------------
// These keys are the only persisted data. Keep schema stable or write
// a migration routine if changing.
const STORAGE_KEYS = {
    SUSPENDED_TABS: "suspendedTabs",
    SETTINGS: "settings",
};

const DEFAULT_SETTINGS = {
    autoSuspend: true,
    autoSuspendTime: 30, // minutes
    ignorePinned: true,
    ignoreAudio: true,
    ignoreActive: true,
    urlWhitelist: "",
};

// ---------------------------- In-Memory State ------------------------------
// Avoids frequent storage round-trips. Always call persistSuspendedCache()
// after mutating suspendedTabsCache.
let currentSettings = { ...DEFAULT_SETTINGS };
/** @type {Record<number, {url:string,title:string,favicon?:string,suspendedAt:number,reason:string,originalTabId:number,windowId:number,index:number,pinned:boolean,wasActive:boolean,strategy:string,placeholderTabId?:number}>} */
let suspendedTabsCache = {};
// Track finer-grained last activity (content interaction) to avoid double suspends & improve accuracy
const lastActivityMap = {}; // tabId -> timestamp

// ---------------------------- Helper Functions -----------------------------
function getSuspendedUrl(originalUrl, title) {
    const params = new URLSearchParams();
    params.set("url", originalUrl);
    if (title) params.set("title", title);
    return chrome.runtime.getURL("suspended.html") + "?" + params.toString();
}

function isExtensionSuspendedPage(url) {
    return url?.startsWith(chrome.runtime.getURL("suspended.html"));
}

function whitelistEntries() {
    return (currentSettings.urlWhitelist || "")
        .split(/\r?\n|,/)
        .map((e) => e.trim())
        .filter(Boolean);
}

function isWhitelisted(url) {
    const wl = whitelistEntries();
    if (!wl.length) return false;
    // Simple wildcard support: treat '*' as multi-char wildcard
    return wl.some((pattern) => {
        if (pattern === "*") return true;
        // Escape regex special except '*'
        const re = new RegExp(
            "^" +
                pattern
                    .split("*")
                    .map((s) =>
                        s.replace(/[.*+?^${}()|[\\]\\]/g, (r) => "\\" + r)
                    )
                    .join(".*") +
                "$"
        );
        return re.test(url);
    });
}

async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        currentSettings = {
            ...DEFAULT_SETTINGS,
            ...(stored?.[STORAGE_KEYS.SETTINGS] || {}),
        };
        if (
            typeof currentSettings.autoSuspendTime !== "number" ||
            currentSettings.autoSuspendTime <= 0
        ) {
            currentSettings.autoSuspendTime = DEFAULT_SETTINGS.autoSuspendTime;
        }
        await configureAlarm();
    } catch (e) {
        console.error("[loadSettings] error", e);
        currentSettings = { ...DEFAULT_SETTINGS };
    }
}

async function saveSettings(newSettings) {
    try {
        currentSettings = { ...currentSettings, ...newSettings };
        await chrome.storage.local.set({
            [STORAGE_KEYS.SETTINGS]: currentSettings,
        });
        await configureAlarm();
        return true;
    } catch (e) {
        console.error("[saveSettings] error", e);
        return false;
    }
}

async function loadSuspendedCache() {
    try {
        const res = await chrome.storage.local.get(STORAGE_KEYS.SUSPENDED_TABS);
        const raw = res?.[STORAGE_KEYS.SUSPENDED_TABS] || {};
        // Basic validation to avoid corrupt shapes
        suspendedTabsCache = Object.fromEntries(
            Object.entries(raw).filter(
                ([id, val]) =>
                    val &&
                    typeof val === "object" &&
                    typeof val.url === "string"
            )
        );
    } catch (e) {
        console.error("[loadSuspendedCache] error", e);
        suspendedTabsCache = {};
    }
}

async function persistSuspendedCache() {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.SUSPENDED_TABS]: suspendedTabsCache,
        });
    } catch (e) {
        console.error("[persistSuspendedCache] error", e);
    }
}

function eligibleForSuspend(tab, reason) {
    if (!tab || !tab.id) return false;
    const url = tab.url || "";
    if (!url.startsWith("http") && !url.startsWith("file:")) return false; // skip chrome:// etc
    if (isExtensionSuspendedPage(url)) return false;
    if (currentSettings.ignorePinned && tab.pinned) return false;
    if (currentSettings.ignoreAudio && tab.audible) return false;
    if (currentSettings.ignoreActive && tab.active && reason === "auto")
        return false;
    if (isWhitelisted(url)) return false;
    return true;
}

// ---------------------------- Suspension Core ------------------------------
async function suspendTab(tabId, reason = "manual") {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!eligibleForSuspend(tab, reason)) return { success: false };
        if (isExtensionSuspendedPage(tab.url))
            return { success: false, already: true };
        if (suspendedTabsCache[tabId]) return { success: false, already: true };

        const baseRecord = {
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl,
            suspendedAt: Date.now(),
            reason,
            originalTabId: tab.id,
            windowId: tab.windowId,
            index: tab.index,
            pinned: tab.pinned,
            wasActive: tab.active,
        };

        // Always attempt aggressive replace strategy (no user toggle)
        {
            try {
                const suspendedUrl = getSuspendedUrl(
                    baseRecord.url,
                    baseRecord.title
                );
                const newTab = await chrome.tabs.create({
                    windowId: tab.windowId,
                    index: tab.index + 1,
                    active: tab.active,
                    pinned: tab.pinned,
                    url: suspendedUrl,
                });

                // Move into exact original slot if necessary
                try {
                    if (newTab.index !== baseRecord.index)
                        await chrome.tabs.move(newTab.id, {
                            index: baseRecord.index,
                        });
                } catch {}
                // Preserve group membership if possible
                if (typeof tab.groupId === "number" && tab.groupId >= 0) {
                    try {
                        await chrome.tabs.group({
                            tabIds: newTab.id,
                            groupId: tab.groupId,
                        });
                    } catch {}
                }

                suspendedTabsCache[newTab.id] = {
                    ...baseRecord,
                    strategy: "replace",
                    placeholderTabId: newTab.id,
                };
                await persistSuspendedCache();
                try {
                    await chrome.tabs.remove(tab.id);
                } catch {}
                return { success: true, replaced: true };
            } catch (errReplace) {
                console.warn(
                    "[suspendTab] replace strategy failed; fallback to navigate",
                    errReplace
                );
            }
        }

        // Fallback / navigate strategy
        const record = { ...baseRecord, strategy: "navigate" };
        suspendedTabsCache[tabId] = record;
        await persistSuspendedCache();
        await chrome.tabs.update(tabId, {
            url: getSuspendedUrl(record.url, record.title),
        });
        return { success: true, navigated: true };
    } catch (e) {
        console.warn("suspendTab error", e);
        return { success: false, error: e?.message };
    }
}

async function unsuspendTab(tabId) {
    try {
        const rec = suspendedTabsCache[tabId];
        if (!rec) return { success: false, notSuspended: true };
        delete suspendedTabsCache[tabId];
        await persistSuspendedCache();

        if (rec.strategy === "replace") {
            await chrome.tabs.update(tabId, {
                url: rec.url,
                active: true,
                pinned: rec.pinned,
            });
            return { success: true, restored: "replace" };
        } else {
            await chrome.tabs.update(tabId, { url: rec.url });
            return { success: true, restored: "navigate" };
        }
    } catch (e) {
        return { success: false, error: e?.message };
    }
}

async function unsuspendAllTabs() {
    const ids = Object.keys(suspendedTabsCache).map(Number);
    let restored = 0;
    for (const id of ids) {
        try {
            const res = await unsuspendTab(id);
            if (res.success) restored++;
        } catch (e) {
            console.warn("[unsuspendAllTabs] per-tab error", e);
        }
    }
    return { success: true, count: restored };
}

async function suspendAllTabs(includeActive = true) {
    const tabs = await chrome.tabs.query({});
    let count = 0;
    for (const tab of tabs) {
        try {
            if (!includeActive && tab.active) continue;
            const res = await suspendTab(tab.id, "manual");
            if (res.success) count++;
        } catch (e) {
            console.warn("[suspendAllTabs] per-tab error", e);
        }
    }
    return { success: true, count };
}

async function suspendOtherTabs() {
    const [active] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let count = 0;
    for (const tab of tabs) {
        try {
            if (tab.id === active.id) continue;
            const res = await suspendTab(tab.id, "manual");
            if (res.success) count++;
        } catch (e) {
            console.warn("[suspendOtherTabs] per-tab error", e);
        }
    }
    return { success: true, count };
}

// ---------------------------- Auto Suspension (Dynamic Single Alarm) -----
const SCAN_ALARM = "ts_scan";
let scanRunning = false;
let scanRerunRequested = false;

async function runInactivityScan() {
    if (scanRunning) {
        scanRerunRequested = true;
        return;
    }
    scanRunning = true;
    try {
        chrome.alarms.clear(SCAN_ALARM).catch(() => {}); // prevent overlap
        if (!currentSettings.autoSuspend) return;
        const thresholdMs = currentSettings.autoSuspendTime * 60 * 1000;
        if (!thresholdMs) return;
        const now = Date.now();
        let nextDelay = Infinity;
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (!tab.id) continue;
            if (isExtensionSuspendedPage(tab.url)) continue;

            // Initialize activity tracking for new tabs using lastAccessed, not current time
            if (!lastActivityMap[tab.id] && tab.lastAccessed) {
                lastActivityMap[tab.id] = tab.lastAccessed;
            }

            const last = lastActivityMap[tab.id] || tab.lastAccessed;
            if (!last) continue; // Skip tabs without any activity info

            const inactiveFor = now - last;
            if (inactiveFor >= thresholdMs) {
                if (eligibleForSuspend(tab, "auto")) {
                    try {
                        await suspendTab(tab.id, "auto");
                    } catch (e) {
                        console.warn("[autoSuspend]", e);
                    }
                    continue; // don't compute schedule for a tab just suspended
                }
                // Exempt tab - give it full threshold time from now
                nextDelay = Math.min(nextDelay, thresholdMs);
            } else {
                // Tab not yet ready - schedule for when it will be
                const remaining = thresholdMs - inactiveFor;
                nextDelay = Math.min(nextDelay, remaining);
            }
        }
        if (nextDelay === Infinity) nextDelay = 5 * 60 * 1000;
        nextDelay = Math.max(
            5000,
            Math.min(nextDelay, Math.max(thresholdMs, 15 * 60 * 1000))
        );
        chrome.alarms.create(SCAN_ALARM, { when: Date.now() + nextDelay });
    } finally {
        scanRunning = false;
        if (scanRerunRequested) {
            scanRerunRequested = false;
            runInactivityScan();
        }
    }
}

async function configureAlarm() {
    chrome.alarms.clear(SCAN_ALARM).catch(() => {});
    if (!currentSettings.autoSuspend) return;
    runInactivityScan();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SCAN_ALARM) {
        try {
            await runInactivityScan();
        } catch (e) {
            console.warn("[scan]", e);
        }
    }
});

// ---------------------------- Tab Lifecycle Hooks -------------------------
chrome.tabs.onRemoved.addListener((tabId) => {
    try {
        if (suspendedTabsCache[tabId]) {
            delete suspendedTabsCache[tabId];
            persistSuspendedCache();
        }
        // Clean up activity tracking for removed tab
        if (lastActivityMap[tabId]) {
            delete lastActivityMap[tabId];
        }
    } catch (e) {
        console.warn("[onRemoved] error", e);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && suspendedTabsCache[tabId]) {
        try {
            if (!isExtensionSuspendedPage(changeInfo.url)) {
                delete suspendedTabsCache[tabId];
                persistSuspendedCache();
            }
        } catch (e) {
            console.warn("[onUpdated cleanup] error", e);
        }
    }
    // Reschedule on meaningful loads completion
    // No custom tracking needed
});

// Track tab activation to (re)schedule others that become inactive
chrome.tabs.onActivated.addListener(({ tabId }) => {
    lastActivityMap[tabId] = Date.now();
    if (currentSettings.autoSuspend) runInactivityScan();
});

// ---------------------------- Commands (Shortcuts) -------------------------
chrome.commands.onCommand.addListener(async (command) => {
    try {
        const [active] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        switch (command) {
            case "suspend-tab":
                if (active?.id) await suspendTab(active.id, "manual");
                break;
            case "unsuspend-tab":
                if (active?.id) await unsuspendTab(active.id);
                break;
            case "suspend-other-tabs":
                await suspendOtherTabs();
                break;
            case "suspend-all-tabs":
                await suspendAllTabs(true);
                break;
            case "unsuspend-all-tabs":
                await unsuspendAllTabs();
                break;
        }
    } catch (e) {
        console.error("[commands] root error", e);
    }
});

// ---------------------------- Messaging API -------------------------------
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    (async () => {
        switch (req.action) {
            // Settings
            case "getSettings":
                sendResponse(currentSettings);
                return;
            case "updateSettings": // legacy name
            case "saveSettings":
                await saveSettings(req.settings || {});
                sendResponse({ success: true, settings: currentSettings });
                return;

            // Shortcuts listing
            case "getChromeShortcuts":
                const cmds = await chrome.commands.getAll();
                const map = {};
                cmds.forEach((c) => (map[c.name] = c.shortcut || ""));
                sendResponse(map);
                return;

            // Suspension actions (legacy + new)
            case "suspendTab":
            case "suspendCurrentTab": {
                const tabId =
                    req.tabId ||
                    sender.tab?.id ||
                    (
                        await chrome.tabs.query({
                            active: true,
                            currentWindow: true,
                        })
                    )[0]?.id;
                if (tabId == null) {
                    sendResponse({ success: false });
                    return;
                }
                sendResponse(await suspendTab(tabId, "manual"));
                return;
            }
            case "unsuspendTab": {
                const tabId =
                    req.tabId ||
                    sender.tab?.id ||
                    (
                        await chrome.tabs.query({
                            active: true,
                            currentWindow: true,
                        })
                    )[0]?.id;
                if (tabId == null) {
                    sendResponse({ success: false });
                    return;
                }
                sendResponse(await unsuspendTab(tabId));
                return;
            }
            case "suspendAll":
            case "suspendAllTabs":
                sendResponse(await suspendAllTabs(true));
                return;
            case "unsuspendAll":
            case "unsuspendAllTabs":
                sendResponse(await unsuspendAllTabs());
                return;
            case "suspendOtherTabs":
                sendResponse(await suspendOtherTabs());
                return;
            case "getSuspendedTabData": {
                const tabId = sender.tab?.id;
                sendResponse(tabId != null ? suspendedTabsCache[tabId] : null);
                return;
            }
            case "restoreTab": {
                if (sender.tab?.id && suspendedTabsCache[sender.tab.id]) {
                    await unsuspendTab(sender.tab.id);
                    sendResponse({ success: true });
                } else if (sender.tab?.id && req.url) {
                    await chrome.tabs.update(sender.tab.id, { url: req.url });
                    sendResponse({ success: true, fallback: true });
                } else {
                    sendResponse({ success: false });
                }
                return;
            }
            case "activityPing": {
                if (sender.tab?.id) {
                    lastActivityMap[sender.tab.id] = Date.now();
                }
                sendResponse({ ok: true });
                return;
            }
            default:
                sendResponse({ success: false, error: "Unknown action" });
                return;
        }
    })();
    return true; // keep channel open for async
});

// ---------------------------- Initialization -------------------------------
async function init() {
    try {
        await loadSettings();
        await loadSuspendedCache();
        await configureAlarm();
    } catch (e) {
        console.error("[init] error", e);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    init();
});
chrome.runtime.onStartup.addListener(() => {
    init();
});
init(); // also run when worker wakes for first event

// End of file
