// ============================================================================
// SMART SUSPENDER - Content Script (Minimal)
// ============================================================================
// Lightweight content script for precise tab activity detection and timing
// ============================================================================

(function () {
    "use strict";

    // Track user activity for more accurate auto-suspend timing
    let lastActivity = Date.now();

    // Activity events to monitor
    const activityEvents = ["click", "keydown", "scroll", "mousemove"];

    // Update activity timestamp
    function updateActivity() {
        lastActivity = Date.now();
        sessionStorage.setItem(
            "tabSuspender_lastActivity",
            lastActivity.toString()
        );
        // Debounced ping to background to reschedule timer
        if (!updateActivity._t) {
            updateActivity._t = setTimeout(() => {
                updateActivity._t = null;
                try {
                    chrome.runtime.sendMessage({ action: "activityPing" });
                } catch (e) {}
            }, 1500);
        }
    }

    // Add activity listeners
    activityEvents.forEach((event) => {
        document.addEventListener(event, updateActivity, { passive: true });
    });
})();
