(function () {
  "use strict";

  const INTERNAL_ACCESS_CODE = "Wz2026";
  const BACKEND_CHAT_ENDPOINT = "https://microcure-sales-worker.zliubc928.workers.dev/";
  const ACCESS_SESSION_KEY = "microcure_sales_access_verified";
  const ACCESS_CODE_SESSION_KEY = "microcure_sales_access_code";
  const USER_SESSION_ID_KEY = "microcure_sales_session_id";
  const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
  const REQUEST_TIMEOUT_MS = 45000;
  const SCREENSHOT_BLOCKED_MESSAGE = "截图上传功能将在后端文件上传接口接入后开放。当前请先用文字描述截图内容。";

  let selectedImageFile = null;
  let selectedImagePreviewUrl = "";
  let isSending = false;

  const accessScreen = document.getElementById("access-screen");
  const chatApp = document.getElementById("chat-app");
  const accessForm = document.getElementById("access-form");
  const accessCodeInput = document.getElementById("access-code");
  const accessError = document.getElementById("access-error");
  const backBtn = document.getElementById("back-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const newConversationBtn = document.getElementById("new-conversation-btn");
  const sessionLabel = document.getElementById("session-label");
  const timePill = document.getElementById("time-pill");
  const chatBox = document.getElementById("chat-box");
  const backendStatus = document.getElementById("backend-status");
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const uploadBtn = document.getElementById("upload-btn");
  const imageUpload = document.getElementById("image-upload");
  const imagePreview = document.getElementById("image-preview");
  const previewImage = document.getElementById("preview-image");
  const previewName = document.getElementById("preview-name");
  const previewSize = document.getElementById("preview-size");
  const removeImageBtn = document.getElementById("remove-image-btn");
  const inputStatus = document.getElementById("input-status");
  const quickChips = document.querySelectorAll(".quick-chip");

  function hasAccess() {
    try {
      return sessionStorage.getItem(ACCESS_SESSION_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function getAccessCode() {
    try {
      return sessionStorage.getItem(ACCESS_CODE_SESSION_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setAccessGranted(accessCode) {
    try {
      sessionStorage.setItem(ACCESS_SESSION_KEY, "1");
      sessionStorage.setItem(ACCESS_CODE_SESSION_KEY, accessCode);
    } catch (error) {
      // Keep the current page usable if sessionStorage is blocked.
    }
  }

  function clearAccess() {
    try {
      sessionStorage.removeItem(ACCESS_SESSION_KEY);
      sessionStorage.removeItem(ACCESS_CODE_SESSION_KEY);
    } catch (error) {
      // Ignore restrictive browser storage failures.
    }
  }

  function createSessionId() {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return "wz_" + Date.now().toString(36) + "_" + randomPart;
  }

  function getUserSessionId() {
    try {
      let sessionId = localStorage.getItem(USER_SESSION_ID_KEY);

      if (!sessionId) {
        sessionId = createSessionId();
        localStorage.setItem(USER_SESSION_ID_KEY, sessionId);
      }

      return sessionId;
    } catch (error) {
      return createSessionId();
    }
  }

  function updateSessionLabel() {
    const sessionId = getUserSessionId();
    sessionLabel.textContent = "测试会话：" + sessionId.slice(-8);
  }

  function updateTimePill() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    timePill.textContent = hour + ":" + minute;
  }

  function updateBackendStatus() {
    backendStatus.textContent = isBackendConfigured() ? "已配置" : "待配置";
  }

  function showAccessScreen() {
    chatApp.classList.add("hidden");
    chatApp.classList.remove("flex");
    accessScreen.classList.remove("hidden");
    accessCodeInput.value = "";
    accessError.textContent = "";

    setTimeout(function () {
      accessCodeInput.focus();
    }, 0);
  }

  function showChatApp() {
    accessScreen.classList.add("hidden");
    chatApp.classList.remove("hidden");
    chatApp.classList.add("flex");
    updateSessionLabel();
    updateTimePill();
    updateBackendStatus();
    scrollToBottom();
  }

  function verifyAccess(event) {
    event.preventDefault();

    const submittedCode = accessCodeInput.value.trim();

    if (submittedCode === INTERNAL_ACCESS_CODE) {
      setAccessGranted(submittedCode);
      showChatApp();
      return;
    }

    accessError.textContent = "访问码错误，请重新输入。";
    accessCodeInput.select();
  }

  function setStatus(message, type) {
    inputStatus.textContent = message;
    inputStatus.classList.toggle("is-error", type === "error");
    inputStatus.classList.toggle("is-success", type === "success");
  }

  function clearStatusSoon() {
    window.clearTimeout(clearStatusSoon.timer);
    clearStatusSoon.timer = window.setTimeout(function () {
      setStatus("", "");
    }, 2600);
  }

  function updateSendButton() {
    const hasText = input.value.trim().length > 0;
    sendBtn.disabled = isSending || (!hasText && !selectedImageFile);
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 96) + "px";
  }

  function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function isAllowedImage(file) {
    const allowedTypes = {
      "image/jpeg": true,
      "image/jpg": true,
      "image/png": true,
      "image/webp": true
    };
    const allowedExtension = /\.(jpe?g|png|webp)$/i.test(file.name || "");

    if (file.type) {
      return Boolean(allowedTypes[file.type]);
    }

    return allowedExtension;
  }

  function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) {
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function revokePreviewUrl() {
    if (selectedImagePreviewUrl && window.URL && URL.revokeObjectURL) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    selectedImagePreviewUrl = "";
  }

  function resetImagePreview() {
    selectedImageFile = null;
    imageUpload.value = "";
    previewImage.removeAttribute("src");
    previewName.textContent = "";
    previewSize.textContent = "";
    imagePreview.classList.add("hidden");
    imagePreview.classList.remove("flex");
    revokePreviewUrl();
    updateSendButton();
  }

  function showImagePreview(file) {
    selectedImageFile = file;
    previewName.textContent = file.name || "截图";
    previewSize.textContent = formatFileSize(file.size);

    revokePreviewUrl();
    if (window.URL && URL.createObjectURL) {
      selectedImagePreviewUrl = URL.createObjectURL(file);
      previewImage.src = selectedImagePreviewUrl;
    } else {
      const reader = new FileReader();
      reader.onload = function () {
        previewImage.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    imagePreview.classList.remove("hidden");
    imagePreview.classList.add("flex");
    updateSendButton();
  }

  function handleImageSelected() {
    const file = imageUpload.files && imageUpload.files[0];
    setStatus("", "");
    resetImagePreview();

    if (!file) {
      return;
    }

    if (!isAllowedImage(file)) {
      setStatus("仅支持 jpg、jpeg、png、webp 图片，不支持视频、PDF 或 Word。", "error");
      return;
    }

    if (file.size > MAX_SCREENSHOT_BYTES) {
      setStatus("图片不能超过 10 MB。", "error");
      return;
    }

    showImagePreview(file);
  }

  function populateInput(text) {
    input.value = text;
    resizeInput();
    updateSendButton();
    input.focus();
    setStatus("已填入输入框，请确认后发送。", "success");
    clearStatusSoon();
  }

  function appendUserBubble(text) {
    const row = document.createElement("div");
    row.className = "msg-fade-in mt-4 flex items-start justify-end gap-2";

    const bubble = document.createElement("div");
    bubble.className = "max-w-[75%] rounded-2xl rounded-tr-sm bg-medical-600 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm break-words";
    bubble.textContent = text;

    row.appendChild(bubble);
    chatBox.appendChild(row);
    scrollToBottom();
  }

  function appendBotBubble(text, isError) {
    const row = document.createElement("div");
    row.className = "msg-fade-in mt-4 flex items-start gap-2";

    const avatar = document.createElement("div");
    avatar.className = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-medical-100 bg-medical-50";
    avatar.innerHTML = '<svg class="h-4 w-4 text-medical-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>';

    const stack = document.createElement("div");
    stack.className = "flex max-w-[80%] flex-col gap-1";

    const name = document.createElement("span");
    name.className = "ml-1 text-[11px] text-gray-400";
    name.textContent = "微至君销售助手";

    const bubble = document.createElement("div");
    bubble.className = "rounded-2xl rounded-tl-sm border px-4 py-2.5 text-[14px] leading-relaxed shadow-sm " +
      (isError ? "border-red-100 bg-red-50 text-red-700" : "border-gray-100 bg-white text-gray-700");
    bubble.textContent = text;

    stack.appendChild(name);
    stack.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(stack);
    chatBox.appendChild(row);
    scrollToBottom();
  }

  function isBackendConfigured() {
    return BACKEND_CHAT_ENDPOINT &&
      BACKEND_CHAT_ENDPOINT !== "REPLACE_WITH_CLOUDFLARE_WORKER_URL";
  }

  function normalizeErrorMessage(status, data) {
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (status === 401) {
      return "访问码错误，请重新输入。";
    }

    if (status === 429) {
      return "请求过于频繁，请稍后再试。";
    }

    if (status === 502) {
      return "Coze API 暂时返回错误，请稍后重试。";
    }

    if (status === 504) {
      return "请求超时，请稍后重试。";
    }

    return "后端服务暂不可用，请稍后重试。";
  }

  function postToBackend(message) {
    if (!isBackendConfigured()) {
      return Promise.reject(new Error("请先在 app.js 中配置 Cloudflare Worker 地址。"));
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const payload = {
      access_code: getAccessCode(),
      session_id: getUserSessionId(),
      message: message
      // Future image support can add safe metadata here, for example:
      // image_metadata: { name: "...", type: "image/png", size: 12345 }
      // Do not send image bytes until the backend file upload API is implemented.
    };

    return fetch(BACKEND_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            throw new Error(normalizeErrorMessage(response.status, data));
          }

          if (!data || typeof data.reply !== "string") {
            throw new Error("后端返回格式异常，请检查 Worker 配置。");
          }

          return data.reply;
        });
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") {
          throw new Error("请求超时，请稍后重试。");
        }

        if (error instanceof TypeError) {
          throw new Error("后端服务暂不可用，请稍后重试。");
        }

        throw error;
      })
      .finally(function () {
        window.clearTimeout(timeoutId);
      });
  }

  function sendCurrentInput() {
    const text = input.value.trim();

    if (isSending) {
      return;
    }

    if (selectedImageFile) {
      setStatus(SCREENSHOT_BLOCKED_MESSAGE, "error");
      return;
    }

    if (!text) {
      setStatus("请输入要发送的客户问题。", "error");
      return;
    }

    isSending = true;
    updateSendButton();
    setStatus("正在发送...", "");
    appendUserBubble(text);
    input.value = "";
    resizeInput();

    postToBackend(text)
      .then(function (reply) {
        appendBotBubble(reply, false);
        setStatus("", "");
      })
      .catch(function (error) {
        appendBotBubble(error.message || "后端服务暂不可用，请稍后重试。", true);
        setStatus(error.message || "后端服务暂不可用，请稍后重试。", "error");
      })
      .finally(function () {
        isSending = false;
        updateSendButton();
      });
  }

  function resetConversation() {
    const newSessionId = createSessionId();

    try {
      localStorage.setItem(USER_SESSION_ID_KEY, newSessionId);
    } catch (error) {
      // Ignore restrictive browser storage failures.
    }

    updateSessionLabel();
    setStatus("已创建新会话。", "success");
    clearStatusSoon();
  }

  function bindEvents() {
    accessForm.addEventListener("submit", verifyAccess);

    backBtn.addEventListener("click", function () {
      clearAccess();
      showAccessScreen();
    });

    logoutBtn.addEventListener("click", function () {
      clearAccess();
      showAccessScreen();
    });

    newConversationBtn.addEventListener("click", resetConversation);

    input.addEventListener("input", function () {
      resizeInput();
      updateSendButton();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCurrentInput();
      }
    });

    sendBtn.addEventListener("click", sendCurrentInput);

    uploadBtn.addEventListener("click", function () {
      imageUpload.click();
    });

    imageUpload.addEventListener("change", handleImageSelected);
    removeImageBtn.addEventListener("click", resetImagePreview);

    Array.prototype.forEach.call(quickChips, function (chip) {
      chip.addEventListener("click", function () {
        populateInput(chip.getAttribute("data-question"));
      });
    });
  }

  function init() {
    bindEvents();

    if (hasAccess() && getAccessCode()) {
      showChatApp();
      return;
    }

    clearAccess();
    showAccessScreen();
  }

  init();
})();
