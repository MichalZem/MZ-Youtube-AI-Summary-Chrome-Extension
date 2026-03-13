(function () {
  "use strict";

  const MAX_AGE_MS = 5 * 60 * 1000;

  // Detect which AI service we're on
  function detectService() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com"))
      return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("gemini.google.com")) return "gemini";
    if (host.includes("grok.com")) return "grok";
    return null;
  }

  // Input selectors and send button selectors per service
  const SERVICE_CONFIG = {
    chatgpt: {
      inputSelectors: [
        "#prompt-textarea",
        'div[contenteditable="true"][id="prompt-textarea"]',
        'div[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Odeslat dotaz"]',
      ],
    },
    claude: {
      inputSelectors: [
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"]',
        'fieldset div[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[aria-label="Send Message"]',
        'button[aria-label="Odeslat zprávu"]',
        'button:has(svg)[aria-label*="end"]',
        'button:has(> div > svg)',
      ],
    },
    gemini: {
      inputSelectors: [
        ".ql-editor",
        'div[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[aria-label="Send message"]',
        'button[aria-label="Odeslat zprávu"]',
        'button.send-button',
        'button[mat-icon-button]',
      ],
    },
    grok: {
      inputSelectors: [
        "textarea",
        'div[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[aria-label="Submit"]',
        'button[type="submit"]',
        'button:has(svg)',
      ],
    },
  };

  function tryInsertPrompt() {
    const service = detectService();
    if (!service) return;

    chrome.storage.local.get(
      ["ytSummaryPrompt", "ytSummaryTimestamp"],
      (data) => {
        if (!data.ytSummaryPrompt) return;
        if (Date.now() - data.ytSummaryTimestamp > MAX_AGE_MS) {
          chrome.storage.local.remove([
            "ytSummaryPrompt",
            "ytSummaryTimestamp",
          ]);
          return;
        }

        const prompt = data.ytSummaryPrompt;
        chrome.storage.local.remove(
          ["ytSummaryPrompt", "ytSummaryTimestamp"],
          () => {
            waitForInput(service).then((el) => {
              insertAndSend(el, prompt, service);
            });
          }
        );
      }
    );
  }

  function waitForInput(service, timeout = 15000) {
    const selectors = SERVICE_CONFIG[service].inputSelectors;
    return new Promise((resolve, reject) => {
      function find() {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        return null;
      }

      const el = find();
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = find();
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el = find();
        if (el) resolve(el);
        else reject(new Error("Input field not found on " + service));
      }, timeout);
    });
  }

  function insertAndSend(element, text, service) {
    if (element.tagName === "TEXTAREA") {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      nativeSetter.call(element, text);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable div
      element.focus();
      element.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = text;
      element.appendChild(p);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Find and click send button
    const sendSelectors = SERVICE_CONFIG[service].sendSelectors;

    function findSendBtn() {
      for (const sel of sendSelectors) {
        try {
          const btn = document.querySelector(sel);
          if (btn) return btn;
        } catch {}
      }
      // Fallback: find the closest form's submit-like button
      const form = element.closest("form");
      if (form) {
        return form.querySelector('button[type="submit"]') ||
          form.querySelector("button:last-of-type");
      }
      return null;
    }

    setTimeout(() => {
      const btn = findSendBtn();
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        // Retry
        setTimeout(() => {
          const btn2 = findSendBtn();
          if (btn2 && !btn2.disabled) btn2.click();
        }, 1500);
      }
    }, 800);
  }

  // Run when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInsertPrompt);
  } else {
    tryInsertPrompt();
  }
})();
