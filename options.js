function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

function getDefaultPrompt() {
  return msg("defaultPrompt");
}

// Localize all elements with data-i18n, data-i18n-html, and data-i18n-placeholder attributes
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
      el.innerHTML = text.replace(
        /(\{[^}]+\}|\[\d{2}:\d{2}\])/g,
        "<code>$1</code>"
      );
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const text = msg(key);
    if (text) el.placeholder = text;
  });
  document.title = msg("settingsTitle");
}

const statusEl = document.getElementById("status");
const promptEl = document.getElementById("prompt-template");
const timestampsEl = document.getElementById("timestamps");
const closeTabEl = document.getElementById("close-tab");
const resetBtn = document.getElementById("btn-reset");
const templateListEl = document.getElementById("template-list");
const addTemplateBtn = document.getElementById("btn-add-template");
const templateNameInput = document.getElementById("template-name-input");

let templates = [];
let selectedId = null;
let saveTimeout = null;

// Migrate old single-template format to new multi-template format
async function migrateTemplates() {
  const data = await chrome.storage.local.get(["ytPromptTemplates", "ytPromptTemplate"]);
  if (data.ytPromptTemplates) return data.ytPromptTemplates;

  const defaultPrompt = getDefaultPrompt();
  const defaultName = msg("templateDefaultName");
  const result = [{ id: "default", name: defaultName, prompt: defaultPrompt }];

  const oldPrompt = data.ytPromptTemplate;
  if (oldPrompt && oldPrompt !== defaultPrompt) {
    const migratedName = msg("templateMigratedName");
    result.push({ id: "t_" + Date.now(), name: migratedName, prompt: oldPrompt });
  }

  await chrome.storage.local.set({ ytPromptTemplates: result });
  return result;
}

function renderTemplateList() {
  templateListEl.innerHTML = "";
  for (const t of templates) {
    const li = document.createElement("li");
    li.className = "template-item" + (t.id === selectedId ? " active" : "");
    li.dataset.id = t.id;

    const nameSpan = document.createElement("span");
    nameSpan.className = "template-name";
    nameSpan.textContent = t.name;
    li.appendChild(nameSpan);

    const delBtn = document.createElement("button");
    delBtn.className = "template-delete";
    delBtn.textContent = "\u00d7";
    delBtn.title = msg("templateDeleteConfirm");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTemplate(t.id);
    });
    li.appendChild(delBtn);

    li.addEventListener("click", () => selectTemplate(t.id));
    templateListEl.appendChild(li);
  }
}

function selectTemplate(id) {
  // Save current textarea content to previously selected template
  if (selectedId) {
    const prev = templates.find((t) => t.id === selectedId);
    if (prev) prev.prompt = promptEl.value;
  }

  selectedId = id;
  const tpl = templates.find((t) => t.id === id);
  if (tpl) {
    promptEl.value = tpl.prompt;
    templateNameInput.value = tpl.name;
  }
  renderTemplateList();
}

function addTemplate() {
  const newId = "t_" + Date.now();
  const newName = msg("templateNewName");
  templates.push({ id: newId, name: newName, prompt: getDefaultPrompt() });
  selectTemplate(newId);
  saveAll();
}

function deleteTemplate(id) {
  if (templates.length <= 1) {
    showStatus(msg("templateCannotDeleteLast"), false);
    return;
  }
  if (!confirm(msg("templateDeleteConfirm"))) return;

  templates = templates.filter((t) => t.id !== id);
  if (selectedId === id) {
    selectTemplate(templates[0].id);
  }
  renderTemplateList();
  saveAll();
}

function saveAll() {
  // Sync current textarea/name to selected template
  const current = templates.find((t) => t.id === selectedId);
  if (current) {
    current.prompt = promptEl.value;
    current.name = templateNameInput.value;
  }

  const ai =
    document.querySelector('input[name="ai"]:checked')?.value || "chatgpt";
  chrome.storage.local.set(
    {
      ytAiService: ai,
      ytPromptTemplates: templates,
      ytTimestamps: timestampsEl.checked,
      ytCloseTab: closeTabEl.checked,
    },
    () => {
      renderTemplateList();
      showStatus(msg("settingsSaved"));
    }
  );
}

// Debounced save for text input (waits 500ms after last keystroke)
function saveDebounced() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveAll, 500);
}

function showStatus(msgText, ok = true) {
  statusEl.textContent = msgText;
  statusEl.className = ok ? "status-ok" : "status-err";
  setTimeout(() => (statusEl.textContent = ""), 1500);
}

// Init
localizePage();

// Load saved settings
(async () => {
  templates = await migrateTemplates();

  const data = await chrome.storage.local.get(["ytAiService", "ytTimestamps", "ytCloseTab"]);
  const ai = data.ytAiService || "chatgpt";
  const radio = document.getElementById("ai-" + ai);
  if (radio) radio.checked = true;
  timestampsEl.checked = data.ytTimestamps || false;
  closeTabEl.checked = data.ytCloseTab || false;

  // Select first template
  selectedId = templates[0].id;
  promptEl.value = templates[0].prompt;
  templateNameInput.value = templates[0].name;
  renderTemplateList();
})();

// Auto-save on any change
document.querySelectorAll('input[name="ai"]').forEach((radio) => {
  radio.addEventListener("change", saveAll);
});
timestampsEl.addEventListener("change", saveAll);
closeTabEl.addEventListener("change", saveAll);
promptEl.addEventListener("input", saveDebounced);
templateNameInput.addEventListener("input", saveDebounced);
addTemplateBtn.addEventListener("click", addTemplate);

// Reset prompt for selected template
resetBtn.addEventListener("click", () => {
  promptEl.value = getDefaultPrompt();
  saveAll();
  showStatus(msg("settingsResetDone"));
});
