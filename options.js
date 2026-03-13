const DEFAULT_PROMPT = `Please provide a comprehensive summary of the following YouTube video.

Video title: {title}
Video URL: {url}
Subtitle language: {lang}

Subtitles:
{subtitles}

---
Please summarize the key points of this video in a clear and structured way.`;

const statusEl = document.getElementById("status");
const promptEl = document.getElementById("prompt-template");
const timestampsEl = document.getElementById("timestamps");
const saveBtn = document.getElementById("btn-save");
const resetBtn = document.getElementById("btn-reset");

function showStatus(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.className = ok ? "status-ok" : "status-err";
  setTimeout(() => (statusEl.textContent = ""), 2500);
}

// Load saved settings
chrome.storage.local.get(
  ["ytAiService", "ytPromptTemplate", "ytTimestamps"],
  (data) => {
    const ai = data.ytAiService || "chatgpt";
    const radio = document.getElementById("ai-" + ai);
    if (radio) radio.checked = true;

    promptEl.value = data.ytPromptTemplate || DEFAULT_PROMPT;
    timestampsEl.checked = data.ytTimestamps || false;
  }
);

// Save
saveBtn.addEventListener("click", () => {
  const ai =
    document.querySelector('input[name="ai"]:checked')?.value || "chatgpt";
  chrome.storage.local.set(
    {
      ytAiService: ai,
      ytPromptTemplate: promptEl.value,
      ytTimestamps: timestampsEl.checked,
    },
    () => showStatus("Settings saved!")
  );
});

// Reset prompt
resetBtn.addEventListener("click", () => {
  promptEl.value = DEFAULT_PROMPT;
  showStatus("Prompt reset to default");
});
