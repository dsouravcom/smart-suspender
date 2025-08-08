// ============================================================================
// SMART SUSPENDER - Suspended Page Script (Ultra-minimal for memory efficiency)
// ============================================================================
// Handles the suspended tab page with intelligent restore functionality
// ============================================================================

// Extract URL parameters
const params = new URLSearchParams(location.search);
const url = params.get("url");
const title = params.get("title");

// Update page content
if (title) document.getElementById("title").textContent = title;
if (url) document.getElementById("url").textContent = url;

// ============================================================================
// RESTORE FUNCTIONALITY
// ============================================================================

let restoring = false;
function restore() {
    if (restoring) return; // prevent double trigger
    restoring = true;
    if (!url) return;

    // Primary method: communicate with background script
    try {
        chrome.runtime.sendMessage(
            { action: "restoreTab", url: url },
            (response) => {
                // Fallback: direct navigation if background script fails
                if (!response?.success) {
                    window.location.href = url;
                }
            }
        );
    } catch (error) {
        // Fallback: direct navigation
        window.location.href = url;
    }

    // Safety fallback after short delay
    setTimeout(() => {
        if (document.visibilityState !== "hidden") window.location.href = url;
    }, 400);
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", function () {
    // Show memory status if available
    setTimeout(() => {
        try {
            const memoryInfo = performance.memory;
            const tabInfo = document.querySelector(".tab-info");
            if (tabInfo && memoryInfo) {
                const indicator = document.createElement("div");
                indicator.style.cssText = `
                    font-size: 12px; margin-top: 10px; padding: 6px 12px;
                    border-radius: 16px; display: inline-block;
                    border: 1px solid rgba(74, 222, 128, 0.3);
                    background: rgba(74, 222, 128, 0.15);
                    color: #4ade80;
                `;
                indicator.textContent =
                    memoryInfo.usedJSHeapSize < 5000000
                        ? "💾 Memory freed - Tab discarded"
                        : "⚡ Ready to suspend";
                tabInfo.appendChild(indicator);
            }
        } catch (e) {
            // Silent fail - not critical
        }
    }, 100);

    // Handle page reload - restore immediately
    if (
        url &&
        (performance.getEntriesByType("navigation")[0]?.type === "reload" ||
            performance.navigation?.type === 1)
    ) {
        restore();
        return;
    }

    // Event listeners for restoration
    document.addEventListener("keydown", function (e) {
        if (
            e.code === "Space" ||
            e.code === "Enter" ||
            e.key === "F5" ||
            (e.ctrlKey && e.key === "r")
        ) {
            e.preventDefault();
            restore();
        }
    });

    document.addEventListener("click", function (e) {
        e.preventDefault();
        restore();
    });

    document.addEventListener("touchstart", function (e) {
        e.preventDefault();
        restore();
    });
});
