(async () => {
  const content = document.getElementById("content");

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let videoId = null;
  try {
    const url = new URL(tab.url || "");
    if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
      if (!videoId) {
        const match = url.pathname.match(/^\/(live|shorts)\/([a-zA-Z0-9_-]+)/);
        if (match) videoId = match[2];
      }
    }
  } catch {}

  if (!videoId) {
    content.innerHTML = '<div class="status error">Not a YouTube video</div>';
    return;
  }

  // Read templates
  const data = await chrome.storage.local.get(["ytPromptTemplates"]);
  const templates = data.ytPromptTemplates;

  if (!templates || templates.length <= 1) {
    // Single template — trigger immediately and close
    triggerSummarize(tab.id, videoId, templates?.[0]?.id || null);
    return;
  }

  // Multiple templates — show list
  for (const t of templates) {
    const btn = document.createElement("button");
    btn.className = "template-item";
    btn.textContent = t.name;
    btn.addEventListener("click", () => {
      triggerSummarize(tab.id, videoId, t.id);
    });
    content.appendChild(btn);
  }

  async function triggerSummarize(tabId, videoId, templateId) {
    content.innerHTML = '<div class="status loading">' +
      (chrome.i18n.getMessage("buttonLoading") || "Loading...") + '</div>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "summarizeFromPopup",
        tabId,
        videoId,
        templateId,
        tabTitle: tab.title,
      });
      if (response?.error) throw new Error(response.error);
      window.close();
    } catch (err) {
      content.innerHTML = '<div class="status error">' +
        (chrome.i18n.getMessage("buttonError") || "Error") +
        ': ' + err.message + '</div>';
    }
  }
})();
