// ============================================================================
// SMART SUSPENDER - Options Page Script
// ============================================================================
// Handles the extension settings page with intelligent navigation and auto-save
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
    // Setup page navigation
    setupNavigation();

    // Get DOM elements
    const suspendTimeSelect = document.getElementById("suspend-time");
    const ignorePinnedToggle = document.getElementById("ignore-pinned-toggle");
    const ignoreAudioToggle = document.getElementById("ignore-audio-toggle");
    const ignoreActiveToggle = document.getElementById("ignore-active-toggle");
    const urlWhitelistTextarea = document.getElementById("url-whitelist");

    // Keyboard shortcut display elements
    const suspendTabDisplay = document.getElementById("suspend-tab-display");
    const unsuspendTabDisplay = document.getElementById(
        "unsuspend-tab-display"
    );
    const suspendOtherTabsDisplay = document.getElementById(
        "suspend-other-tabs-display"
    );
    const suspendAllTabsDisplay = document.getElementById(
        "suspend-all-tabs-display"
    );
    const unsuspendAllTabsDisplay = document.getElementById(
        "unsuspend-all-tabs-display"
    );
    const editShortcutsBtn = document.getElementById("edit-shortcuts-btn");

    // Default settings (must match background.js)
    const defaultSettings = {
        autoSuspend: true,
        autoSuspendTime: 30,
        ignorePinned: true,
        ignoreAudio: true,
        ignoreActive: true,
        urlWhitelist: "",
    };

    let currentSettings = { ...defaultSettings };

    // ========================================================================
    // SETTINGS MANAGEMENT
    // ========================================================================

    // Load current settings from background script
    async function loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getSettings",
            });
            currentSettings = { ...defaultSettings, ...response };

            // Update UI elements
            suspendTimeSelect.value = currentSettings.autoSuspend
                ? currentSettings.autoSuspendTime
                : "never";
            setToggleState(ignorePinnedToggle, currentSettings.ignorePinned);
            setToggleState(ignoreAudioToggle, currentSettings.ignoreAudio);
            setToggleState(ignoreActiveToggle, currentSettings.ignoreActive);
            urlWhitelistTextarea.value = currentSettings.urlWhitelist || "";

            // Update keyboard shortcut displays
            updateShortcutDisplays();
        } catch (error) {
            console.error("Failed to load settings:", error);
            showNotification("Error loading settings", "error");
        }
    }

    // Save settings to background script
    async function saveSettings() {
        try {
            const settings = {
                autoSuspend: suspendTimeSelect.value !== "never",
                autoSuspendTime:
                    suspendTimeSelect.value === "never"
                        ? 30
                        : parseInt(suspendTimeSelect.value),
                ignorePinned: getToggleState(ignorePinnedToggle),
                ignoreAudio: getToggleState(ignoreAudioToggle),
                ignoreActive: getToggleState(ignoreActiveToggle),
                urlWhitelist: urlWhitelistTextarea.value.trim(),
            };

            currentSettings = { ...currentSettings, ...settings };

            const response = await chrome.runtime.sendMessage({
                action: "updateSettings",
                settings: settings,
            });

            if (response?.success) {
                showNotification("Settings saved successfully!", "success");
            } else {
                throw new Error("Failed to save settings");
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            showNotification("Error saving settings", "error");
        }
    }

    // ========================================================================
    // UI HELPER FUNCTIONS
    // ========================================================================

    // Toggle switch utilities
    function setToggleState(toggle, isActive) {
        toggle.classList.toggle("active", isActive);
    }

    function getToggleState(toggle) {
        return toggle.classList.contains("active");
    }

    async function toggleState(toggle) {
        toggle.classList.toggle("active");
        await saveSettings(); // Auto-save on change
    }

    // Navigation setup for different settings sections
    function setupNavigation() {
        const navItems = document.querySelectorAll(".nav-item");
        const contentSections = document.querySelectorAll(".content-section");

        navItems.forEach((item) => {
            item.addEventListener("click", () => {
                // Update active nav item
                navItems.forEach((nav) => nav.classList.remove("active"));
                item.classList.add("active");

                // Show corresponding content section
                contentSections.forEach((section) =>
                    section.classList.add("content-section-hidden")
                );
                const sectionId = item.dataset.section + "-section";
                const targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    targetSection.classList.remove("content-section-hidden");
                }
            });
        });
    }

    // Keyboard shortcut validation and helpers

    // Update keyboard shortcut displays
    async function updateShortcutDisplays() {
        try {
            // Get current Chrome shortcuts
            const shortcuts = await chrome.runtime.sendMessage({
                action: "getChromeShortcuts",
            });

            // Update display elements (Chrome returns kebab-case command names)
            if (suspendTabDisplay) {
                suspendTabDisplay.textContent =
                    shortcuts["suspend-tab"] || "Not set";
            }
            if (unsuspendTabDisplay) {
                unsuspendTabDisplay.textContent =
                    shortcuts["unsuspend-tab"] || "Not set";
            }
            if (suspendOtherTabsDisplay) {
                suspendOtherTabsDisplay.textContent =
                    shortcuts["suspend-other-tabs"] || "Not set";
            }
            if (suspendAllTabsDisplay) {
                suspendAllTabsDisplay.textContent =
                    shortcuts["suspend-all-tabs"] || "Not set";
            }
            if (unsuspendAllTabsDisplay) {
                unsuspendAllTabsDisplay.textContent =
                    shortcuts["unsuspend-all-tabs"] || "Not set";
            }
        } catch (error) {
            console.error("Failed to update shortcut displays:", error);
            // Set fallback text
            if (suspendTabDisplay) suspendTabDisplay.textContent = "Not set";
            if (unsuspendTabDisplay)
                unsuspendTabDisplay.textContent = "Not set";
            if (suspendOtherTabsDisplay)
                suspendOtherTabsDisplay.textContent = "Not set";
            if (suspendAllTabsDisplay)
                suspendAllTabsDisplay.textContent = "Not set";
            if (unsuspendAllTabsDisplay)
                unsuspendAllTabsDisplay.textContent = "Not set";
        }
    }

    // Show notification to user
    function showNotification(message, type = "info") {
        // Remove any existing notifications
        document.querySelectorAll(".notification").forEach((n) => n.remove());

        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            padding: 12px 20px; border-radius: 6px;
            color: white; font-size: 14px; font-weight: 500;
            z-index: 1000; transition: all 0.3s ease;
            ${
                type === "success"
                    ? "background: #22c55e;"
                    : "background: #ef4444;"
            }
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transform = "translateX(100%)";
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    // Auto-save when settings change
    if (suspendTimeSelect) {
        suspendTimeSelect.addEventListener("change", saveSettings);
    }

    if (ignorePinnedToggle) {
        ignorePinnedToggle.addEventListener("click", () =>
            toggleState(ignorePinnedToggle)
        );
    }

    if (ignoreAudioToggle) {
        ignoreAudioToggle.addEventListener("click", () =>
            toggleState(ignoreAudioToggle)
        );
    }

    if (ignoreActiveToggle) {
        ignoreActiveToggle.addEventListener("click", () =>
            toggleState(ignoreActiveToggle)
        );
    }

    if (urlWhitelistTextarea) {
        urlWhitelistTextarea.addEventListener("blur", saveSettings);
        // Save on Ctrl+S
        urlWhitelistTextarea.addEventListener("keydown", async (e) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                await saveSettings();
            }
        });
    }

    // Edit shortcuts button
    if (editShortcutsBtn) {
        editShortcutsBtn.addEventListener("click", () => {
            chrome.tabs.update({ url: "chrome://extensions/shortcuts" });
        });
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    // Load settings when page opens
    await loadSettings();
});
