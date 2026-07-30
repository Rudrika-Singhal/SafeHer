// SafeHer Backend Server
// Handles: (1) AI-generated SOS messages via Groq, (2) SMS via Twilio, (3) Chatbot via Groq
// Run this locally — never put API keys directly in frontend code.

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GROQ_MODEL = 'openai/gpt-oss-20b'; // fast, free-tier friendly Groq model

// ---------------------------------------------
// 1. AI-GENERATED SOS MESSAGE (Groq)
// ---------------------------------------------
app.post('/api/generate-message', async (req, res) => {
  try {
    const { name, location, time, situation } = req.body;

    if (!process.env.GROQ_API_KEY) {
      const fallback = `🚨 ${name} has triggered an emergency alert at ${time}. Situation: ${situation || 'unspecified'}. Last known location: ${location}. Please respond immediately or contact local authorities.`;
      return res.json({ message: fallback, source: 'fallback-template' });
    }

    const prompt = `Generate a short, urgent SOS alert message (under 35 words) to send to a trusted contact.
Name: ${name}
Situation: ${situation || 'general emergency'}
Location: ${location}
Time: ${time}
Keep it clear, urgent, and actionable. Do not add hashtags or emojis besides one 🚨 at the start.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    console.log('Groq generate-message raw:', JSON.stringify(data));
    const message = data.choices?.[0]?.message?.content?.trim();

    res.json({ message: message || `🚨 ${name} needs help. Location: ${location}`, source: message ? 'groq' : 'groq-empty' });
  } catch (err) {
    console.error('generate-message error:', err.message);
    res.status(500).json({ error: 'Failed to generate message' });
  }
});

// ---------------------------------------------
// 2. SEND SMS TO TRUSTED CONTACTS (Twilio)
// ---------------------------------------------
app.post('/api/send-sms', async (req, res) => {
  try {
    const { contacts, message } = req.body;

    if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE) {
      return res.json({ sent: false, note: 'Twilio not configured yet — this is a simulated send.', contacts });
    }

    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    const results = [];

    for (const number of contacts) {
      const sms = await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE,
        to: number
      });
      results.push({ to: number, sid: sms.sid, status: sms.status });
    }

    res.json({ sent: true, results });
  } catch (err) {
    console.error('send-sms error:', err.message);
    res.status(500).json({ error: 'Failed to send SMS', details: err.message });
  }
});

// ---------------------------------------------
// 3. REAL CHATBOT — Safety Assistant (Groq)
// ---------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, name } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.json({ reply: "I'm here with you. (Real AI chat isn't connected yet — add your GROQ_API_KEY.)", source: 'fallback' });
    }

    const systemPrompt = `You are a calm, caring safety assistant inside a women's safety app called SafeHer. The user's name is ${name || 'there'}. Keep replies short (under 35 words), warm, and practical — like a supportive friend, not a robot. If the user seems to be in real danger or asks for help urgently, gently suggest you can send an SOS alert to their trusted contacts, or that they can tap the SOS button.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-8),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 150, messages })
    });

    const data = await response.json();
    console.log('Groq chat raw:', JSON.stringify(data));
    const reply = data.choices?.[0]?.message?.content?.trim();

    res.json({ reply: reply || "Sorry, I didn't quite catch that — try again?", source: reply ? 'groq' : 'groq-empty' });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.get('/', (req, res) => res.send('SafeHer backend is running ✅'));

app.listen(PORT, () => console.log(`SafeHer backend running on http://localhost:${PORT}`));