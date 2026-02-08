
const fetch = require('node:fetch');

async function generatePremiumCover() {
  const GEMINI_API_KEY = 'REDACTED_KEY';
  
  const prompt = `Create a premium business book cover for 'The Debt Code' with these EXACT specifications:

LAYOUT (Critical - follow exactly):
- Top 1/3: Pure white background with 'Own your debt, fear no more' in elegant gray text
- Middle 1/3: Pure black background with 'THE DEBT CODE' in white bold text
- Bottom 1/3: Pure white background with author name in gray

TYPOGRAPHY (Premium quality):
- Use professional serif for main title (Trajan, Times New Roman Bold, or similar)
- Use clean sans-serif for subtitle and author (Helvetica, Futura)
- Ensure crisp, readable text at all sizes

STYLE:
- Business book aesthetic (think Harvard Business Review)
- Clean, authoritative, minimal
- No graphics or decorative elements
- Standard book proportions (6x9)
- Professional financial advisory book appearance

OUTPUT: High-resolution book cover image`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, topK: 32, topP: 1, maxOutputTokens: 4096 }
      })
    });
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generatePremiumCover();
