// ============================================================================
// SMART SUSPENDER - Popup Script
// ============================================================================
// Handles the extension popup with intelligent controls and user feedback
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
    const suspendCurrentBtn = document.getElementById("suspend-current");
    const suspendAllBtn = document.getElementById("suspend-all");
    const unsuspendAllBtn = document.getElementById("unsuspend-all");
    const openOptionsBtn = document.getElementById("open-options");

    // ========================================================================
    // UI HELPER FUNCTIONS
    // ========================================================================

    // Show loading state for button
    function setButtonLoading(button, loading = true) {
        if (loading) {
            button.disabled = true;
            button.style.opacity = "0.6";
            button.dataset.originalText = button.textContent;
            button.innerHTML = "⏳ Loading...";
        } else {
            button.disabled = false;
            button.style.opacity = "1";
            button.textContent = button.dataset.originalText;
        }
    }

    // Show success feedback
    function showSuccess(button, message) {
        const originalText = button.textContent;
        button.textContent = `✓ ${message}`;
        button.style.background = "rgba(34, 197, 94, 0.3)";

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = "";
        }, 1500);
    }

    // Show error feedback
    function showError(button, message) {
        const originalText = button.textContent;
        button.textContent = `❌ ${message}`;
        button.style.background = "rgba(239, 68, 68, 0.3)";

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = "";
        }, 2000);
    }

    // ========================================================================
    // BUTTON EVENT HANDLERS
    // ========================================================================

    // Guard in case HTML not fully populated
    if (!suspendCurrentBtn || !suspendAllBtn || !unsuspendAllBtn) {
        console.error("[popup] Missing expected DOM elements.");
        return;
    }

    // Suspend current tab
    suspendCurrentBtn.addEventListener("click", async () => {
        setButtonLoading(suspendCurrentBtn);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "suspendCurrentTab",
            });
            if (response?.success) {
                showSuccess(suspendCurrentBtn, "Suspended!");
            } else if (response?.already) {
                showError(suspendCurrentBtn, "Already suspended");
            } else if (response?.ignored) {
                showError(suspendCurrentBtn, "Ignored by rules");
            } else {
                showError(suspendCurrentBtn, "Cannot suspend");
            }
        } catch (error) {
            console.error("Failed to suspend tab:", error);
            showError(suspendCurrentBtn, "Error");
        } finally {
            setButtonLoading(suspendCurrentBtn, false);
        }
    });

    // Suspend other tabs
    suspendAllBtn.addEventListener("click", async () => {
        setButtonLoading(suspendAllBtn);

        try {
            await chrome.runtime.sendMessage({ action: "suspendOtherTabs" });
            showSuccess(suspendAllBtn, "Other tabs suspended!");
        } catch (error) {
            console.error("Failed to suspend other tabs:", error);
            showError(suspendAllBtn, "Error");
        } finally {
            setButtonLoading(suspendAllBtn, false);
        }
    });

    // Unsuspend all tabs
    unsuspendAllBtn.addEventListener("click", async () => {
        setButtonLoading(unsuspendAllBtn);

        try {
            await chrome.runtime.sendMessage({ action: "unsuspendAllTabs" });
            showSuccess(unsuspendAllBtn, "All restored!");
        } catch (error) {
            console.error("Failed to unsuspend all tabs:", error);
            showError(unsuspendAllBtn, "Error");
        } finally {
            setButtonLoading(unsuspendAllBtn, false);
        }
    });

    // Open options page
    openOptionsBtn.addEventListener("click", () =>
        chrome.runtime.openOptionsPage()
    );

    // Clean up interval when popup closes
    window.addEventListener("beforeunload", () => {
        // no interval cleanup needed
    });

    // ========================================================================
    // KEYBOARD SHORTCUTS & INTERACTIONS
    // ========================================================================

    // Enable keyboard shortcuts within popup
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey) {
            switch (e.code) {
                case "KeyS":
                    e.preventDefault();
                    suspendCurrentBtn.click();
                    break;
                case "KeyA":
                    e.preventDefault();
                    suspendAllBtn.click(); // Suspend other tabs
                    break;
                case "KeyU":
                    e.preventDefault();
                    unsuspendAllBtn.click();
                    break;
            }
        }
    });

    // Add hover effects for better UX
    const buttons = [suspendCurrentBtn, suspendAllBtn, unsuspendAllBtn];
    buttons.forEach((button) => {
        button.addEventListener("mouseenter", () => {
            if (!button.disabled) {
                button.style.transform = "translateY(-1px)";
                button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            }
        });

        button.addEventListener("mouseleave", () => {
            button.style.transform = "";
            button.style.boxShadow = "";
        });
    });
});
