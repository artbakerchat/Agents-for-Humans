const form = document.querySelector('#memberForm');
const sendButton = document.querySelector('#sendMemberBtn');
const memberStatus = document.querySelector('#memberStatus');
const responseA = document.querySelector('#responseA');
const responseB = document.querySelector('#responseB');
const statusA = document.querySelector('#statusA');
const statusB = document.querySelector('#statusB');

const buildChecklistPrompt = (member) => [
  'Create a concise, respectful support summary from this member checklist.',
  'Mention selected support needs, activities, at-home options, music interests, and notes.',
  'Do not invent personal information.',
  'Return exactly these four sections: Transcript, Pronunciation (Latin + Hangul), Translation (English), and Response.',
  'For Transcript, faithfully restate the checklist information in clear English.',
  'For Pronunciation, provide a simple English pronunciation and Hangul approximation.',
  'For Translation (English), translate the transcript into English.',
  'For Response, write the concise support summary in natural English.',
  JSON.stringify(member, null, 2)
].join('\n\n');

const formatResponse = (result) => {
  if (typeof result === 'string') return result;
  const fields = [
    ['Transcript', result?.transcript || ''],
    ['Pronunciation (Latin + Hangul)', result?.pronunciation || result?.romanization || ''],
    ['Translation (English)', result?.translationEnglish || result?.translation || ''],
    ['Response', result?.response || result?.answer || '']
  ];
  return fields.filter(([, value]) => value).map(([label, value]) => `${label}:\n${value}`).join('\n\n')
    || JSON.stringify(result, null, 2);
};

const requestModel = async (endpoint, payload) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.details || `Request failed (${response.status})`);
  return body;
};

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const member = Object.fromEntries(
      ['memberInfo', 'activities', 'supportNeeds', 'music', 'atHomeOptions']
        .map((name) => [name, data.getAll(name)])
    );
    member.notes = String(data.get('notes') || '').trim();

    const request = {
      prompt: buildChecklistPrompt(member),
      transcript: JSON.stringify(member),
      translationLanguage: 'English',
      instructions: ['Return the requested four sections as a concise support summary.']
    };
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const endpoints = window.MODEL_ENDPOINTS || {
      a: `${apiBaseUrl}/api/model-a`,
      b: `${apiBaseUrl}/api/model-b`
    };

    sendButton.disabled = true;
    memberStatus.textContent = 'Sending checklist to both models…';
    statusA.textContent = 'Model A: Sending…';
    statusB.textContent = 'Model B: Sending…';
    responseA.textContent = '';
    responseB.textContent = '';

    const results = await Promise.allSettled([
      requestModel(endpoints.a, request),
      requestModel(endpoints.b, request)
    ]);
    results.forEach((result, index) => {
      const output = index === 0 ? responseA : responseB;
      const status = index === 0 ? statusA : statusB;
      if (result.status === 'fulfilled') {
        output.textContent = formatResponse(result.value);
        status.textContent = `Model ${index === 0 ? 'A' : 'B'}: Complete`;
      } else {
        status.textContent = `Model ${index === 0 ? 'A' : 'B'}: ${result.reason.message}`;
      }
    });
    memberStatus.textContent = 'Responses ready.';
    sendButton.disabled = false;
  });
}
