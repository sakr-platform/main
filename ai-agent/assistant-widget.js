(function () {
  const MISTRAL_API_KEY = 'FEP7lHD8VkWfu4XF2ghkzYh5OnFu5fDE';
  const BACKEND_URL = window.AI_BACKEND_URL || '/api/chat';
  const LOCKOUT_STORAGE_KEY = 'aureon-chat-lockout';

  function getEndOfDayTimestamp() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime();
  }

  function getStoredLockout() {
    try {
      const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.locked) return null;
      if (Date.now() >= parsed.expiresAt) {
        localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function saveLockoutState() {
    try {
      const state = {
        locked: true,
        expiresAt: getEndOfDayTimestamp()
      };
      localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function ensureStyles() {
    if (document.getElementById('ai-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-assistant-styles';
    style.textContent = `
      @keyframes glowPulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.12); opacity: 1; }
      }
      @keyframes shimmerGlow {
        0% { background-position: 0% 50%; }
        100% { background-position: 100% 50%; }
      }
      @keyframes floatIcon {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }

      .ai-assistant-launcher {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2200;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        padding: 14px 20px;
        min-height: 54px;
        background: linear-gradient(135deg, #0f1729 0%, #1a2f4b 45%, #ffcb4b 100%);
        background-size: 220% 220%;
        color: #f8f7ff;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.18);
        cursor: pointer;
        font-family: 'Share Tech', sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.03em;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        overflow: hidden;
        animation: shimmerGlow 4.5s ease infinite;
      }
      .ai-assistant-launcher:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 26px 48px rgba(0, 0, 0, 0.36);
        filter: saturate(1.08);
      }
      .ai-assistant-launcher::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(255, 207, 77, 0.5), rgba(255,255,255,0.08));
        filter: blur(14px);
        z-index: -1;
        opacity: 0.9;
        animation: glowPulse 2.4s ease-in-out infinite;
      }
      .ai-assistant-launcher::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.22), transparent);
        transform: translateX(-130%);
        animation: launcherSweep 3s linear infinite;
      }
      .ai-assistant-launcher .ai-assistant-icon {
        display: inline-flex;
        font-size: 18px;
        animation: floatIcon 2s ease-in-out infinite;
      }
      @keyframes launcherSweep {
        0% { transform: translateX(-130%); }
        100% { transform: translateX(180%); }
      }
      .ai-assistant-panel {
        position: fixed;
        right: 24px;
        bottom: 94px;
        width: min(92vw, 400px);
        height: 560px;
        max-height: 82vh;
        background: linear-gradient(145deg, rgba(9, 14, 28, 0.98), rgba(17, 24, 41, 0.95));
        border: 1px solid rgba(255, 206, 90, 0.24);
        border-radius: 24px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255,255,255,0.04) inset;
        z-index: 2201;
        transform: translateY(18px) scale(0.97);
        opacity: 0;
        pointer-events: none;
        transition: all 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
        backdrop-filter: blur(16px);
      }
      .ai-assistant-panel.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }
      .ai-assistant-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top left, rgba(255, 206, 90, 0.14), transparent 40%);
        pointer-events: none;
      }
      .ai-assistant-panel::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 24px;
        box-shadow: 0 0 0 1px rgba(255, 206, 90, 0.1) inset;
        pointer-events: none;
      }
      .ai-assistant-header {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, rgba(255, 208, 78, 0.16), rgba(255, 142, 0, 0.08));
      }
      .ai-assistant-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ai-assistant-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #ffd54f, #ffb300);
        color: #07111f;
        font-weight: 800;
        box-shadow: 0 8px 18px rgba(255, 183, 0, 0.25);
      }
      .ai-assistant-header h3 { margin: 0; font-size: 16px; color: #ffe6a3; }
      .ai-assistant-header p { margin: 2px 0 0; font-size: 12px; color: #c7d1e4; }
      .ai-assistant-close {
        border: none;
        background: rgba(255,255,255,0.08);
        color: white;
        font-size: 20px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease, transform 0.2s ease;
      }
      .ai-assistant-close:hover {
        background: rgba(255,255,255,0.16);
        transform: rotate(90deg);
      }
      .ai-assistant-messages { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; scrollbar-width: none; }
      .ai-assistant-messages::-webkit-scrollbar { display: none; }
      .ai-assistant-message {
        max-width: 92%;
        padding: 10px 12px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.55;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
      }
      .ai-assistant-message.user {
        align-self: flex-end;
        background: linear-gradient(135deg, #ffd54f, #ffb300);
        color: #071222;
        border-bottom-right-radius: 6px;
      }
      .ai-assistant-message.bot {
        align-self: flex-start;
        background: rgba(255,255,255,0.06);
        color: #f6f8ff;
        border: 1px solid rgba(255,255,255,0.06);
        border-bottom-left-radius: 6px;
      }
      .ai-assistant-message-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .ai-assistant-action-btn {
        border: 1px solid rgba(255, 204, 75, 0.24);
        background: rgba(255, 204, 75, 0.12);
        color: #ffe6a3;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 11px;
        cursor: pointer;
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .ai-assistant-thinking {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        min-width: 180px;
      }
      .ai-assistant-thinking-text {
        color: #f8f7ff;
        font-weight: 600;
      }
      .ai-assistant-thinking-dots {
        display: inline-flex;
        gap: 4px;
      }
      .ai-assistant-thinking-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ffe6a3;
        opacity: 0.45;
        animation: thinkingBounce 0.9s ease-in-out infinite;
      }
      .ai-assistant-thinking-dot:nth-child(2) {
        animation-delay: 0.15s;
      }
      .ai-assistant-thinking-dot:nth-child(3) {
        animation-delay: 0.3s;
      }
      @keyframes thinkingBounce {
        0%, 100% { transform: translateY(0); opacity: 0.45; }
        50% { transform: translateY(-5px); opacity: 1; }
      }
      .ai-assistant-action-btn:hover {
        transform: translateY(-1px);
        background: rgba(255, 204, 75, 0.2);
      }
      .ai-assistant-form {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
      }
      .ai-assistant-form input {
        flex: 1;
        border: none;
        border-radius: 999px;
        padding: 11px 14px;
        outline: none;
        background: rgba(255,255,255,0.08);
        color: white;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
      }
      .ai-assistant-form input::placeholder { color: #86a0bd; }
      .ai-assistant-form button {
        border: none;
        border-radius: 50%;
        width: 46px;
        height: 46px;
        padding: 0;
        background: linear-gradient(135deg, #ffd86d 0%, #ffb300 100%);
        color: #071222;
        font-weight: 800;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 10px 22px rgba(255, 183, 0, 0.28);
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        position: relative;
        overflow: hidden;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .ai-assistant-form button:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 14px 26px rgba(255, 183, 0, 0.34);
      }
      .ai-assistant-form button:active { transform: scale(0.96); }
      .ai-assistant-form button::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.28), transparent);
        transform: translateX(-140%);
        animation: sendSweep 2.8s linear infinite;
        opacity: 0.7;
      }
      .ai-assistant-form button .ai-assistant-send-icon {
        display: inline-block;
        transform: translateX(1px);
      }
      .ai-assistant-footer-note {
        padding: 0 16px 10px;
        font-size: 10px;
        color: #8798b1;
        letter-spacing: 0.04em;
        text-align: center;
        opacity: 0.9;
      }
      @keyframes sendSweep {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(220%); }
      }
    `;
    document.head.appendChild(style);
  }

  function getUserName() {
    const nameDisplay = document.getElementById('nameDisplay');
    if (nameDisplay && nameDisplay.textContent) {
      const cleanName = nameDisplay.textContent.trim();
      if (cleanName && cleanName.toLowerCase() !== 'loading...') {
        return cleanName;
      }
    }

    const welcomeBlock = document.querySelector('.name-container');
    if (welcomeBlock) {
      const text = welcomeBlock.textContent || '';
      const parts = text.split(/\n|\s{2,}/).map(function (part) {
        return part.trim();
      }).filter(Boolean);
      const possibleName = parts.find(function (part) {
        return part && !/WELCOME BACK/i.test(part) && part.toLowerCase() !== 'loading...';
      });
      if (possibleName) {
        return possibleName;
      }
    }

    return 'friend';
  }

  function getCurrentChannelNumber() {
    const fileName = (window.location.pathname || '').split('/').pop().toLowerCase();
    if (fileName.includes('channel3')) return 3;
    if (fileName.includes('channel2')) return 2;
    return 1;
  }

  function getSuggestedActions(userText) {
    const channelNumber = getCurrentChannelNumber();
    const lower = userText.toLowerCase();
    const actions = [];

    if (/(recorded|recording|recordings|lecture|lectures|lesson|lessons)/i.test(lower)) {
      actions.push({ label: 'Open Recorded Lessons', target: `course${channelNumber}.html` });
    }
    if (/(document|documents|notes|material|materials|study guide|study guides)/i.test(lower)) {
      actions.push({ label: 'Open Study Materials', target: `doc${channelNumber}.html` });
    }
    if (/(live|session|class)/i.test(lower)) {
      actions.push({ label: 'Open Live Class', target: `live${channelNumber}.html` });
    }
    if (/(chat|discussion|talk|community)/i.test(lower)) {
      actions.push({ label: 'Open Discussion', target: `chat${channelNumber}.html` });
    }
    if (/(question|questions|quiz|practice|exercise|exercises)/i.test(lower)) {
      actions.push({ label: 'Open Practice Questions', target: `p${channelNumber}.html` });
    }
    if (/(grade|grades|marks|results)/i.test(lower)) {
      actions.push({ label: 'Open Grades', target: 'grades.html' });
    }

    return actions;
  }

  function sanitizeAssistantReply(reply, userText) {
    if (!reply) return reply;
    const normalizedReply = reply.trim();
    const offTopicPhrase = 'I am here to help with science and study topics, not to distract you.';
    const actions = getSuggestedActions(userText);

    if (!actions.length || !normalizedReply.includes(offTopicPhrase)) {
      return normalizedReply;
    }

    return normalizedReply
      .replace(new RegExp(offTopicPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function createWidget() {
    ensureStyles();
    if (document.getElementById('ai-assistant-widget')) return;

    const launcher = document.createElement('button');
    launcher.id = 'ai-assistant-widget';
    launcher.className = 'ai-assistant-launcher';
    launcher.type = 'button';
    launcher.innerHTML = '<span class="ai-assistant-icon">✦</span><span>Aureon</span>';

    const panel = document.createElement('div');
    panel.className = 'ai-assistant-panel';
    panel.innerHTML = `
      <div class="ai-assistant-header">
        <div class="ai-assistant-title-wrap">
          <div class="ai-assistant-avatar">A</div>
          <div>
            <h3>Aureon</h3>
            <p>Your study companion</p>
          </div>
        </div>
        <button class="ai-assistant-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="ai-assistant-messages" id="ai-assistant-messages"></div>
      <form class="ai-assistant-form" id="ai-assistant-form">
        <input id="ai-assistant-input" type="text" placeholder="Ask me anything..." autocomplete="off" />
        <button type="submit" aria-label="Send message"><span class="ai-assistant-send-icon">➜</span></button>
      </form>
      <div class="ai-assistant-footer-note">Aureon is an AI assistant and may make mistakes.</div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const closeBtn = panel.querySelector('.ai-assistant-close');
    const form = panel.querySelector('#ai-assistant-form');
    const input = panel.querySelector('#ai-assistant-input');
    const messages = panel.querySelector('#ai-assistant-messages');
    const sendButton = form.querySelector('button');
    const userName = getUserName();
    const storedLockout = getStoredLockout();
    let insultCount = 0;
    let isLocked = Boolean(storedLockout);

    function applyLockState(locked) {
      isLocked = locked;
      if (input) input.disabled = locked;
      if (sendButton) sendButton.disabled = locked;
      if (input) input.placeholder = locked ? 'Chat locked' : 'Ask me anything...';
    }

    if (storedLockout) {
      insultCount = 3;
      applyLockState(true);
    }

    function addMessage(text, sender, actions) {
      const msg = document.createElement('div');
      msg.className = `ai-assistant-message ${sender}`;

      const content = document.createElement('div');
      content.textContent = text;
      msg.appendChild(content);

      if (actions && actions.length) {
        const actionWrap = document.createElement('div');
        actionWrap.className = 'ai-assistant-message-actions';
        actions.forEach(function (action) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'ai-assistant-action-btn';
          button.textContent = action.label;
          button.addEventListener('click', function () {
            const targetUrl = new URL(action.target, window.location.href);
            window.location.href = targetUrl.href;
          });
          actionWrap.appendChild(button);
        });
        msg.appendChild(actionWrap);
      }

      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    function addTypingMessage(text, sender, actions) {
      const msg = document.createElement('div');
      msg.className = `ai-assistant-message ${sender}`;
      const content = document.createElement('div');
      msg.appendChild(content);
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;

      let index = 0;
      function typeCharacter() {
        if (index < text.length) {
          content.textContent += text[index++];
          messages.scrollTop = messages.scrollHeight;
          setTimeout(typeCharacter, 10 + Math.random() * 10);
        } else if (actions && actions.length) {
          const actionWrap = document.createElement('div');
          actionWrap.className = 'ai-assistant-message-actions';
          actions.forEach(function (action) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ai-assistant-action-btn';
            button.textContent = action.label;
            button.addEventListener('click', function () {
              const targetUrl = new URL(action.target, window.location.href);
              window.location.href = targetUrl.href;
            });
            actionWrap.appendChild(button);
          });
          msg.appendChild(actionWrap);
          messages.scrollTop = messages.scrollHeight;
        }
      }

      typeCharacter();
    }

    function showThinking() {
      const thinking = document.createElement('div');
      thinking.className = 'ai-assistant-message bot ai-assistant-thinking';
      thinking.id = 'ai-assistant-thinking';

      const text = document.createElement('div');
      text.className = 'ai-assistant-thinking-text';
      text.textContent = 'Aureon is thinking';
      thinking.appendChild(text);

      const dots = document.createElement('div');
      dots.className = 'ai-assistant-thinking-dots';
      for (let i = 0; i < 3; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'ai-assistant-thinking-dot';
        dots.appendChild(dot);
      }
      thinking.appendChild(dots);

      messages.appendChild(thinking);
      messages.scrollTop = messages.scrollHeight;
    }

    function removeThinking() {
      const el = document.getElementById('ai-assistant-thinking');
      if (el) el.remove();
    }

    launcher.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open') && messages.children.length === 0) {
        if (isLocked) {
          addMessage('Your access is locked for the rest of today. You can try again tomorrow.', 'bot');
        } else {
          addMessage(`Hello ${userName}! I am Aureon, your premium study companion. I can help you with science, lessons, and study questions. How can I help you today?`, 'bot');
        }
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('open');
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      if (isLocked) {
        addMessage(text, 'user');
        input.value = '';
        addMessage('Your access is locked for the rest of today. You can try again tomorrow.', 'bot');
        return;
      }

      const isInsult = /\b(أحمق|غبي|خايس|قذر|كسم|كس|ابن الزنا|انحرف|لعن|قحبة|سافل|هبل|خرا|زب|مجنون|غلط|تافه|أ idiot|stupid|idiot|dumb|shit|fuck|bitch|asshole|moron|عبيط|اهبل|اهطل|زاني|متناك|زبل|زبالة|قذر)\b/i.test(text);
      if (isInsult) {
        insultCount += 1;
        addMessage(text, 'user');
        input.value = '';
        const remaining = Math.max(0, 3 - insultCount);
        if (remaining > 0) {
          addMessage(`Watch your language, ${userName}. You have ${remaining} warning${remaining === 1 ? '' : 's'} left. Respectful questions only.`, 'bot');
        } else {
          addMessage('Enough. You have used your 3 strikes. Your access is locked for the rest of today.', 'bot');
          applyLockState(true);
          saveLockoutState();
        }
        return;
      }

      if (insultCount >= 3) {
        addMessage(text, 'user');
        input.value = '';
        addMessage('Your access is locked. You can no longer ask questions today.', 'bot');
        return;
      }

      addMessage(text, 'user');
      input.value = '';
      showThinking();

      try {
        const directRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [
              {
                role: 'system',
                content: `You are Aureon, a polished and intelligent study assistant for a science learning website. Always reply in English. Address the user by their name if you know it. The user's name is ${userName}. Keep answers concise, helpful, and encouraging. For study, school, science, lesson, document, live class, practice, or grade requests, help directly and offer the relevant action. Only use the phrase "I am here to help with science and study topics, not to distract you." for clearly unrelated requests. If the user insults or uses rude language, respond firmly and warn them that after 3 warnings they will be blocked from asking more questions.`
              },
              {
                role: 'user',
                content: text
              }
            ]
          })
        });

        const directData = await directRes.json();
        removeThinking();

        if (directRes.ok && directData.choices?.[0]?.message?.content) {
          const actions = getSuggestedActions(text);
          const cleanedReply = sanitizeAssistantReply(directData.choices[0].message.content, text);
          addTypingMessage(cleanedReply, 'bot', actions);
          return;
        }

        throw new Error(directData?.error?.message || 'Direct Mistral call failed');
      } catch (error) {
        try {
          const fallbackRes = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          const fallbackData = await fallbackRes.json();
          removeThinking();
          const actions = getSuggestedActions(text);
          const cleanedReply = sanitizeAssistantReply(fallbackData.reply || 'I could not respond right now.', text);
          addTypingMessage(cleanedReply, 'bot', actions);
        } catch (fallbackError) {
          removeThinking();
          addTypingMessage('I could not connect to the AI service right now.', 'bot');
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
