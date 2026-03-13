function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

function getDefaultPrompt() {
  return msg("defaultPrompt");
}

// Localize all elements with data-i18n and data-i18n-html attributes
function localizePage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = msg(key);
    if (text) el.textContent = text;
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const text = msg(key);
    if (text) {
      // Wrap code-like content (square brackets) in <code> tags
      el.innerHTML = text.replace(
        /(\{[^}]+\}|\[\d{2}:\d{2}\])/g,
        "<code>$1</code>"
      );
    }
  });
  document.title = msg("settingsTitle");
}

const statusEl = document.getElementById("status");
const promptEl = document.getElementById("prompt-template");
const timestampsEl = document.getElementById("timestamps");
const saveBtn = document.getElementById("btn-save");
const resetBtn = document.getElementById("btn-reset");

function showStatus(msgText, ok = true) {
  statusEl.textContent = msgText;
  statusEl.className = ok ? "status-ok" : "status-err";
  setTimeout(() => (statusEl.textContent = ""), 2500);
}

// Init
localizePage();

// Load saved settings
chrome.storage.local.get(
  ["ytAiService", "ytPromptTemplate", "ytTimestamps"],
  (data) => {
    const ai = data.ytAiService || "chatgpt";
    const radio = document.getElementById("ai-" + ai);
    if (radio) radio.checked = true;

    promptEl.value = data.ytPromptTemplate || getDefaultPrompt();
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
    () => showStatus(msg("settingsSaved"))
  );
});

// Reset prompt
resetBtn.addEventListener("click", () => {
  promptEl.value = getDefaultPrompt();
  showStatus(msg("settingsResetDone"));
});
