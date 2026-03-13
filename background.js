function getDefaultPrompt() {
  return chrome.i18n.getMessage("defaultPrompt") ||
    "Please provide a comprehensive summary of the following YouTube video.\n\nVideo title: {title}\nVideo URL: {url}\nSubtitle language: {lang}\n\nSubtitles:\n{subtitles}\n\n---\nPlease summarize the key points of this video in a clear and structured way.";
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Group segments into ~intervalSec chunks, breaking at sentence boundaries
function formatWithTimestamps(segments, intervalSec) {
  const result = [];
  let chunkTexts = [];
  let chunkStartTime = segments[0]?.time || 0;
  let lastTime = chunkStartTime;

  for (const seg of segments) {
    chunkTexts.push(seg.text);
    lastTime = seg.time;

    const elapsed = seg.time - chunkStartTime;
    if (elapsed >= intervalSec) {
      // Try to break at sentence end (. ! ?)
      const joined = chunkTexts.join(" ");
      const sentenceEnd = joined.search(/[.!?]\s+[^.!?]*$/);

      if (sentenceEnd > 0 && sentenceEnd > joined.length * 0.4) {
        // Split: flush up to sentence end, keep remainder
        const flushed = joined.substring(0, sentenceEnd + 1).trim();
        const remainder = joined.substring(sentenceEnd + 1).trim();
        result.push(`[${formatTime(chunkStartTime)}] ${flushed}`);
        chunkTexts = remainder ? [remainder] : [];
      } else {
        result.push(`[${formatTime(chunkStartTime)}] ${joined}`);
        chunkTexts = [];
      }
      chunkStartTime = seg.time;
    }
  }

  // Flush remaining
  if (chunkTexts.length > 0) {
    result.push(`[${formatTime(chunkStartTime)}] ${chunkTexts.join(" ")}`);
  }

  return result.join("\n");
}

const AI_URLS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/",
};

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yt-summary-settings",
    title: chrome.i18n.getMessage("contextMenuSettings") || "Settings",
    contexts: ["action"],
  });
});

// Right-click context menu → open settings
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "yt-summary-settings") {
    chrome.runtime.openOptionsPage();
  }
});

// Core: extract subtitles, build prompt, open AI
async function summarizeVideo(tabId, videoId, tabTitle) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: extractSubtitlesWithPOToken,
    args: [videoId],
  });

  const data = results?.[0]?.result;
  if (!data || data.error) {
    throw new Error(data?.error || "Failed to extract subtitles");
  }

  const settings = await chrome.storage.local.get([
    "ytAiService",
    "ytPromptTemplate",
    "ytTimestamps",
  ]);
  const ai = settings.ytAiService || "chatgpt";
  const template = settings.ytPromptTemplate || getDefaultPrompt();
  const timestamps = settings.ytTimestamps || false;

  const subtitlesText = timestamps
    ? formatWithTimestamps(data.segments, 20)
    : data.segments.map((s) => s.text).join(" ");

  const title = (tabTitle || "").replace(" - YouTube", "").trim() || "Unknown";
  const prompt = template
    .replace(/\{title\}/g, title)
    .replace(/\{url\}/g, `https://www.youtube.com/watch?v=${videoId}`)
    .replace(/\{lang\}/g, data.lang)
    .replace(/\{subtitles\}/g, subtitlesText);

  await chrome.storage.local.set({
    ytSummaryPrompt: prompt,
    ytSummaryTimestamp: Date.now(),
  });

  chrome.tabs.create({ url: AI_URLS[ai] });
}

// Left-click toolbar icon
chrome.action.onClicked.addListener(async (tab) => {
  let url;
  try {
    url = new URL(tab.url || "");
  } catch {
    return;
  }

  const videoId = url.searchParams.get("v");

  if (!url.hostname.includes("youtube.com") || !videoId) {
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000", tabId: tab.id });
    setTimeout(
      () => chrome.action.setBadgeText({ text: "", tabId: tab.id }),
      2000
    );
    return;
  }

  chrome.action.setBadgeText({ text: "...", tabId: tab.id });
  chrome.action.setBadgeBackgroundColor({ color: "#10a37f", tabId: tab.id });

  try {
    await summarizeVideo(tab.id, videoId, tab.title);
    chrome.action.setBadgeText({ text: "", tabId: tab.id });
  } catch (err) {
    console.error("YT Summary error:", err);
    chrome.action.setBadgeText({ text: "ERR", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000", tabId: tab.id });
    setTimeout(
      () => chrome.action.setBadgeText({ text: "", tabId: tab.id }),
      3000
    );
  }
});

// Message from YouTube page button
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "summarize" || !msg.videoId) return;

  const tabId = sender.tab.id;
  const tabTitle = sender.tab.title;

  summarizeVideo(tabId, msg.videoId, tabTitle)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ error: err.message }));

  return true; // keep channel open for async response
});

// Runs in MAIN world on YouTube page
function extractSubtitlesWithPOToken(videoId) {
  return (async () => {
    try {
      const player = document.querySelector("#movie_player");
      if (!player || !player.getPlayerResponse) {
        return { error: "YouTube player not found" };
      }

      const playerResponse = player.getPlayerResponse();
      const tracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer
          ?.captionTracks;
      if (!tracks || tracks.length === 0) {
        return { error: "No subtitles available for this video" };
      }

      const userLang = navigator.language.slice(0, 2);
      const preferred =
        tracks.find(
          (t) => t.languageCode === userLang && t.kind !== "asr"
        ) ||
        tracks.find(
          (t) => t.languageCode === "en" && t.kind !== "asr"
        ) ||
        tracks.find((t) => t.kind !== "asr") ||
        tracks.find((t) => t.languageCode === userLang) ||
        tracks.find((t) => t.languageCode === "en") ||
        tracks[0];

      const ccButton =
        document.querySelector(
          ".ytp-chrome-bottom .ytp-chrome-controls .ytp-right-controls .ytp-subtitles-button"
        ) || document.querySelector(".ytp-subtitles-button");

      if (!ccButton) {
        return { error: "CC button not found — subtitles not available" };
      }

      performance.clearResourceTimings();
      ccButton.click();
      ccButton.click();

      let pot = null;
      for (let i = 0; i <= 500; i += 50) {
        await new Promise((r) => setTimeout(r, 50));
        const entry = performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes("/api/timedtext?"))
          .pop();
        if (entry) {
          try {
            pot = new URL(entry.name).searchParams.get("pot");
          } catch {}
          if (pot) break;
        }
      }

      if (!pot) {
        return { error: "Could not capture PO token" };
      }

      const subtitleUrl = `${preferred.baseUrl}&pot=${pot}&c=WEB`;
      const response = await fetch(subtitleUrl);
      if (!response.ok) {
        return { error: "Subtitle fetch failed: HTTP " + response.status };
      }

      const xml = await response.text();
      if (!xml || xml.trim().length === 0) {
        return { error: "Empty subtitle response" };
      }

      const segments = [];
      const regex = /<text\s+start="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const startSec = parseFloat(match[1]) || 0;
        const decoded = match[2]
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\n/g, " ")
          .trim();
        if (decoded) segments.push({ time: startSec, text: decoded });
      }

      if (segments.length === 0) {
        return { error: "No text in parsed subtitles" };
      }

      return { segments, lang: preferred.languageCode };
    } catch (e) {
      return { error: e.message };
    }
  })();
}
