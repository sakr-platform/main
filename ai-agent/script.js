const toggleBtn = document.getElementById('chatToggleBtn');
const closeBtn = document.getElementById('chatCloseBtn');
const chatPanel = document.getElementById('chatPanel');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
const messages = document.getElementById('messages');

function addMessage(text, sender) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${sender}`;
  wrapper.textContent = text;
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function showThinking() {
  const thinking = document.createElement('div');
  thinking.className = 'message bot';
  thinking.id = 'thinkingMessage';
  thinking.textContent = 'جاري التفكير...';
  messages.appendChild(thinking);
  messages.scrollTop = messages.scrollHeight;
}

function removeThinking() {
  const thinking = document.getElementById('thinkingMessage');
  if (thinking) thinking.remove();
}

toggleBtn.addEventListener('click', () => {
  chatPanel.classList.toggle('open');
});

closeBtn.addEventListener('click', () => {
  chatPanel.classList.remove('open');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userText = input.value.trim();
  if (!userText) return;

  addMessage(userText, 'user');
  input.value = '';
  showThinking();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: userText })
    });

    const data = await response.json();
    removeThinking();

    if (data && data.reply) {
      addMessage(data.reply, 'bot');
    } else {
      addMessage('عذراً، لم أتمكن من الحصول على رد.', 'bot');
    }
  } catch (error) {
    removeThinking();
    addMessage('حدث خطأ أثناء الاتصال بالخادم.', 'bot');
  }
});
