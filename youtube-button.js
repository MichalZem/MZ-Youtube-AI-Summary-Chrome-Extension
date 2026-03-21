(function () {
  "use strict";

  const BUTTON_ID = "yt-summary-btn";
  const DROPDOWN_ID = "yt-summary-dropdown";
  let observer;

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const voiceBtn = document.querySelector("#voice-search-button");
    if (!voiceBtn) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    const label = chrome.i18n.getMessage("buttonLabel") || "AI Summary";
    btn.title = label;
    btn.textContent = "\u2728 " + label;

    const style = document.createElement("style");
    style.textContent = `
      #${BUTTON_ID} {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 16px;
        margin-left: 8px;
        border: none;
        border-radius: 20px;
        background: #10a37f;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        font-family: "Roboto", Arial, sans-serif;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.2s, transform 0.1s;
      }
      #${BUTTON_ID}:hover {
        background: #0d8c6d;
        transform: scale(1.03);
      }
      #${BUTTON_ID}:active {
        transform: scale(0.97);
      }
      #${BUTTON_ID}.loading {
        pointer-events: none;
        opacity: 0.6;
      }
      #${DROPDOWN_ID} {
        position: fixed;
        z-index: 9999;
        background: #212121;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        padding: 6px 0;
        min-width: 180px;
        max-width: 300px;
      }
      #${DROPDOWN_ID} .dropdown-item {
        display: block;
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: none;
        color: #e0e0e0;
        font-size: 14px;
        font-family: "Roboto", Arial, sans-serif;
        cursor: pointer;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background 0.1s;
      }
      #${DROPDOWN_ID} .dropdown-item:hover {
        background: #3a3a3a;
      }
    `;
    document.head.appendChild(style);

    btn.addEventListener("click", handleClick);
    voiceBtn.insertAdjacentElement("afterend", btn);
  }

  function closeDropdown() {
    const existing = document.getElementById(DROPDOWN_ID);
    if (existing) {
      if (observer) observer.disconnect();
      existing.remove();
      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    }
    document.removeEventListener("click", onOutsideClick);
  }

  function onOutsideClick(e) {
    const dropdown = document.getElementById(DROPDOWN_ID);
    const btn = document.getElementById(BUTTON_ID);
    if (dropdown && !dropdown.contains(e.target) && e.target !== btn) {
      closeDropdown();
    }
  }

  function showDropdown(templates) {
    closeDropdown();

    const btn = document.getElementById(BUTTON_ID);
    const rect = btn.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.id = DROPDOWN_ID;
    menu.style.top = (rect.bottom + 6) + "px";
    menu.style.left = rect.left + "px";

    for (const t of templates) {
      const item = document.createElement("button");
      item.className = "dropdown-item";
      item.textContent = t.name;
      item.addEventListener("click", () => {
        closeDropdown();
        sendSummarize(t.id);
      });
      menu.appendChild(item);
    }

    // Pause observer while inserting dropdown to prevent init() from removing it
    observer.disconnect();
    document.body.appendChild(menu);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => document.addEventListener("click", onOutsideClick), 0);
  }

  async function handleClick() {
    const btn = document.getElementById(BUTTON_ID);
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId || btn.classList.contains("loading")) return;

    // Close dropdown if already open
    if (document.getElementById(DROPDOWN_ID)) {
      closeDropdown();
      return;
    }

    const data = await chrome.storage.local.get(["ytPromptTemplates"]);
    const templates = data.ytPromptTemplates;

    if (!templates || templates.length <= 1) {
      // Single template or none — send directly
      sendSummarize(templates?.[0]?.id || null);
    } else {
      // Multiple templates — show dropdown
      showDropdown(templates);
    }
  }

  async function sendSummarize(templateId) {
    const btn = document.getElementById(BUTTON_ID);
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId) return;

    const originalText = btn.textContent;
    btn.classList.add("loading");
    btn.textContent = "\u23f3 " + (chrome.i18n.getMessage("buttonLoading") || "Loading...");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "summarize",
        videoId,
        templateId,
      });
      if (response?.error) {
        throw new Error(response.error);
      }
      btn.textContent = originalText;
    } catch (err) {
      console.error("YT Summary:", err);
      btn.textContent = "\u274c " + (chrome.i18n.getMessage("buttonError") || "Error");
      setTimeout(() => (btn.textContent = originalText), 2000);
    } finally {
      btn.classList.remove("loading");
    }
  }

  function init() {
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (videoId) createButton();
  }

  observer = new MutationObserver(init);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("yt-navigate-finish", () => {
    closeDropdown();
    init();
  });
  init();
})();
