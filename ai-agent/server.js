const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

const apiKey = process.env.MISTRAL_API_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const firebaseApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyCEFLxdWt8h1_JWjzyJ2n2dP-HXxmD3jvU';
const firebaseProjectId = 'students-68430';
let telegramOffset = 0;
let telegramUsername = '';

if (!apiKey) {
  console.error('Missing MISTRAL_API_KEY in .env');
  process.exit(1);
}

app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, '..')));
app.use('/ai-agent', express.static(path.join(__dirname)));

app.options('/api/telegram-registration', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.get('/ai-agent', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/telegram-registration', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    if (!telegramBotToken || !telegramChatId) {
      return res.status(503).json({ error: 'Telegram notification is not configured' });
    }

    const { name, grade, group, phone, studentPhone, id, parentId } = req.body || {};
    if (!name || !grade || !group || !phone || !studentPhone) {
      return res.status(400).json({ error: 'Registration details are required' });
    }

    const message = [
      'New student registration',
      `Name: ${name}`,
      `Grade: ${grade}`,
      `Group: ${group}`,
      `Parent phone: ${phone}`,
      `Student phone: ${studentPhone}`,
      id ? `Student ID: ${id}` : '',
      parentId ? `Parent ID: ${parentId}` : ''
    ].filter(Boolean).join('\n');

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text: message })
    });
    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error('Telegram API error:', telegramResult);
      return res.status(502).json({ error: 'Telegram notification failed' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram notification error:', error);
    res.status(500).json({ error: 'Telegram notification failed' });
  }
});

async function telegramApi(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const error = new Error(result.description || `Telegram ${method} failed`);
    error.parameters = result.parameters;
    throw error;
  }
  return result.result;
}

async function getTelegramUsername() {
  if (!telegramUsername) {
    const bot = await telegramApi('getMe', {});
    telegramUsername = bot.username;
  }
  return telegramUsername;
}

function firestoreDocumentUrl(documentId) {
  return `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/telegramSubscriptions/${encodeURIComponent(documentId)}?key=${firebaseApiKey}`;
}

async function saveTelegramSubscription(chatId, groupId, language = 'en') {
  const response = await fetch(firestoreDocumentUrl(String(chatId)), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      chatId: { integerValue: String(chatId) },
      groupId: { stringValue: String(groupId) },
      language: { stringValue: language === 'ar' ? 'ar' : 'en' },
      updatedAt: { integerValue: String(Date.now()) }
    }})
  });
  if (!response.ok) throw new Error(`Could not save Telegram subscription (${response.status})`);
}

async function getTelegramSubscriptions() {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/telegramSubscriptions?key=${firebaseApiKey}`);
  if (!response.ok) throw new Error(`Could not load Telegram subscriptions (${response.status})`);
  const data = await response.json();
  return (data.documents || []).map((document) => {
    const fields = document.fields || {};
    return {
      chatId: fields.chatId?.integerValue || fields.chatId?.stringValue,
      groupId: fields.groupId?.stringValue || '',
      language: fields.language?.stringValue === 'ar' ? 'ar' : 'en'
    };
  }).filter((subscription) => subscription.chatId && subscription.groupId);
}

async function getTelegramGroups() {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/groups?key=${firebaseApiKey}`);
  if (!response.ok) throw new Error(`Could not load groups (${response.status})`);
  const data = await response.json();
  return (data.documents || []).map((document) => {
    const fields = document.fields || {};
    return {
      id: document.name.split('/').pop(),
      name: fields.name?.stringValue || 'Unnamed group',
      middle: Number(fields.middle?.integerValue || fields.middle?.doubleValue || 0),
      active: fields.active?.booleanValue !== false
    };
  }).filter((group) => group.active && group.middle >= 1 && group.middle <= 3);
}

function groupButtons(groups, botUsername) {
  return groups.map((group) => ([{
    text: String(group.name).slice(0, 64),
    callback_data: `group:${group.id.slice(0, 50)}`
  }]));
}

function middleButtons() {
  return [1, 2, 3].map((middle) => ([{
    text: `Middle ${middle}`,
    callback_data: `middle:${middle}`
  }]));
}

function languageButtons() {
  return [[
    { text: 'العربية', callback_data: 'language:ar' },
    { text: 'English', callback_data: 'language:en' }
  ]];
}

function localizedMiddleButtons(language) {
  const names = language === 'ar'
    ? ['الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي']
    : ['First Preparatory', 'Second Preparatory', 'Third Preparatory'];
  return [1, 2, 3].map((middle) => ([{
    text: names[middle - 1],
    callback_data: `middle:${language}:${middle}`
  }]));
}

app.post('/api/telegram-content-notification', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const { groupId, middle, type, name } = req.body || {};
    if (!telegramBotToken || !name || (!groupId && !middle)) return res.status(400).json({ error: 'Notification details are required' });
    const subscriptions = await getTelegramSubscriptions();
    const requestedGroupId = groupId ? String(groupId) : '';
    const requestedMiddle = Number(middle);
    const groups = requestedGroupId ? [] : await getTelegramGroups();
    const recipients = subscriptions.filter((subscription) => {
      if (requestedGroupId) return subscription.groupId === requestedGroupId;
      const subscribedGroup = groups.find((group) => group.id === subscription.groupId);
      return subscribedGroup && subscribedGroup.middle === requestedMiddle;
    });
    let sent = 0;
    for (const recipient of recipients) {
      try {
        const text = recipient.language === 'ar'
          ? `تم إضافة ${type === 'lesson' ? 'حصة' : type === 'document' ? 'ملف' : 'جلسة جديدة'}\n${name}`
          : `New ${type || 'content'} is available\n${name}`;
        await telegramApi('sendMessage', { chat_id: recipient.chatId, text });
        sent += 1;
      } catch (error) {
        console.warn(`Could not notify Telegram chat ${recipient.chatId}:`, error.message);
      }
    }
    res.json({ ok: true, sent, middle: Number(middle) || null });
  } catch (error) {
    console.error('Telegram content notification error:', error);
    res.status(500).json({ error: 'Could not send content notification' });
  }
});

async function pollTelegramUpdates() {
  if (!telegramBotToken) return;
  try {
    const updates = await telegramApi('getUpdates', { offset: telegramOffset, timeout: 20, allowed_updates: ['message', 'callback_query'] });
    for (const update of updates) {
      telegramOffset = update.update_id + 1;
      const message = update.message;
      const startMatch = message?.text?.match(/^\/start(?:\s+.*)?$/);
      if (message?.chat?.type === 'private' && startMatch) {
        await telegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: 'اختار اللغة / Choose your language:',
          reply_markup: { inline_keyboard: languageButtons() }
        });
        continue;
      }
      const callback = update.callback_query;
      if (callback?.data?.startsWith('language:')) {
        const language = callback.data.slice('language:'.length) === 'ar' ? 'ar' : 'en';
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: language === 'ar' ? 'تم اختيار العربية.' : 'English selected.' });
        await telegramApi('sendMessage', {
          chat_id: callback.from.id,
          text: language === 'ar' ? 'اختار السنة الدراسية:' : 'Choose your middle grade:',
          reply_markup: { inline_keyboard: localizedMiddleButtons(language) }
        });
        continue;
      }
      if (callback?.data?.startsWith('middle:')) {
        const [, languageValue, middleValue] = callback.data.split(':');
        const language = languageValue === 'ar' ? 'ar' : 'en';
        const middle = Number(middleValue);
        if (callback.message?.chat?.type !== 'private') {
          await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: 'افتح Meet the bot أولًا.', show_alert: true });
          continue;
        }
        const groups = (await getTelegramGroups()).filter((group) => group.middle === middle);
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: language === 'ar' ? `تم اختيار السنة ${middle}.` : `Middle ${middle} selected.` });
        await telegramApi('sendMessage', {
          chat_id: callback.from.id,
          text: groups.length
            ? (language === 'ar' ? `اختار جروب السنة ${middle}:` : `Choose a group for Middle ${middle}:`)
            : (language === 'ar' ? `لا توجد جروبات محفوظة للسنة ${middle}.` : `No groups found for Middle ${middle}.`),
          ...(groups.length ? { reply_markup: { inline_keyboard: groupButtons(groups, await getTelegramUsername()).map((row) => row.map((button) => ({ ...button, callback_data: `group:${language}:${button.callback_data.slice('group:'.length)}` }))) } } : {})
        });
        continue;
      }
      if (!callback?.data?.startsWith('group:')) continue;
      if (callback.message?.chat?.type !== 'private') {
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: 'افتح Meet the bot أولًا.', show_alert: true });
        continue;
      }
      const [, languageValue, groupId] = callback.data.split(':');
      const language = languageValue === 'ar' ? 'ar' : 'en';
      await saveTelegramSubscription(callback.from.id, groupId, language);
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: language === 'ar' ? 'تم اختيار الجروب بنجاح.' : 'Group selected successfully.' });
      await telegramApi('sendMessage', { chat_id: callback.from.id, text: language === 'ar' ? 'تم اختيار الجروب. ستصلك هنا إشعارات الحصص والملفات الجديدة.' : 'Group selected. You will receive new lesson and file notifications here.' });
    }
  } catch (error) {
    console.error('Telegram polling error:', error.message);
  }
  setImmediate(pollTelegramUpdates);
}

if (telegramBotToken) pollTelegramUpdates();

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for a science learning website. Answer in Arabic when the user writes in Arabic, and in English when the user writes in English. Keep answers concise but useful.'
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || 'Mistral API request failed');
    }

    const reply = data.choices?.[0]?.message?.content || 'No response from model.';
    res.json({ reply });
  } catch (error) {
    console.error('Mistral API error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
