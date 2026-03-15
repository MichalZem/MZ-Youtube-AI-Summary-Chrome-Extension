(function () {
  "use strict";

  const BUTTON_ID = "yt-summary-btn";

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const voiceBtn = document.querySelector("#voice-search-button");
    if (!voiceBtn) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    const label = chrome.i18n.getMessage("buttonLabel") || "AI Summary";
    btn.title = label;
    btn.textContent = "✨ " + label;

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
    `;
    document.head.appendChild(style);

    btn.addEventListener("click", handleClick);
    voiceBtn.insertAdjacentElement("afterend", btn);
  }

  async function handleClick() {
    const btn = document.getElementById(BUTTON_ID);
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId || btn.classList.contains("loading")) return;

    const originalText = btn.textContent;
    btn.classList.add("loading");
    btn.textContent = "⏳ " + (chrome.i18n.getMessage("buttonLoading") || "Loading...");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "summarize",
        videoId,
      });
      if (response?.error) {
        throw new Error(response.error);
      }
      btn.textContent = originalText;
    } catch (err) {
      console.error("YT Summary:", err);
      btn.textContent = "❌ " + (chrome.i18n.getMessage("buttonError") || "Error");
      setTimeout(() => (btn.textContent = originalText), 2000);
    } finally {
      btn.classList.remove("loading");
    }
  }

  function init() {
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (videoId) createButton();
  }

  const observer = new MutationObserver(init);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("yt-navigate-finish", init);
  init();
})();
