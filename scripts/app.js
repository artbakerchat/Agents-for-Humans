(() => {
  const promptInput = document.querySelector('#promptInput');
  const promptForm = document.querySelector('#promptForm');
  const sendButton = document.querySelector('#sendBtn');
  const responseA = document.querySelector('#responseA');
  const responseB = document.querySelector('#responseB');
  const statusA = document.querySelector('#statusA');
  const statusB = document.querySelector('#statusB');
  const playA = document.querySelector('#playA');
  const playB = document.querySelector('#playB');
  const copyA = document.querySelector('#copyA');
  const copyB = document.querySelector('#copyB');
  const readPrompt = document.querySelector("#readPrompt");
  const promptSpeechLanguage = document.querySelector("#promptSpeechLanguage");
  let activePlayButton = null;
  let promptIsSpeaking = false;
  const updatePromptSpeechState = () => {
    if (readPrompt) readPrompt.disabled = !promptInput.value.trim() || !('speechSynthesis' in window);
  };

  if (!promptInput) return;
  const isFrench = document.documentElement.lang === 'fr';
  const savedPrompt = window.LavenderPreferences?.get('prompt', '');
  if (savedPrompt) promptInput.value = savedPrompt;
  promptInput.addEventListener('input', () => window.LavenderPreferences?.set('prompt', promptInput.value));
  updatePromptSpeechState();
  promptInput.addEventListener('input', updatePromptSpeechState);
  const labels = isFrench ? { play: "▶ Lire la réponse", pause: "⏸ Mettre en pause", resume: "▶ Reprendre la réponse", copy: "Copier la réponse", copied: "Copiée", unavailable: "Indisponible", sending: "Envoi…", complete: "Terminé", promptPlay: "▶ Lire à voix haute", promptPause: "⏸ Mettre en pause", promptResume: "▶ Reprendre la lecture" } : { play: "▶ Play response", pause: "⏸ Pause response", resume: "▶ Resume response", copy: "Copy response", copied: "Copied", unavailable: "Audio unavailable", sending: "Sending…", complete: "Complete", promptPlay: "▶ Read aloud", promptPause: "⏸ Pause reading", promptResume: "▶ Resume reading" };

  const buildModelRequest = (prompt) => ({
    prompt,
    transcript: prompt,
    translationLanguage: 'English',
    instructions: [
      'Respond with exactly these four sections: Transcript, Pronunciation (Latin + Hangul), Translation (English), and Response.',
      'Transcript must be a clean, faithful transcription of the prompt: normalize stretched letters, repeated syllables, obvious speech-recognition spelling errors, and casual filler while preserving the intended words, sentence order, punctuation, and language. Do not echo noisy input literally. For example, the input "Heeeeello. Booonjouur. 안뇨오옹." must produce exactly "Hello. Bonjour. 안녕." in the Transcript section.',
      'Pronunciation (Latin + Hangul) must show the complete pronunciation twice: first as easy-to-read phonetic Latin letters, then immediately after it as a Korean Hangul approximation in parentheses. Keep each phrase aligned, using the format "bri-je (브리예) a (아) lo-ral (로할/로랄) pur (푸흐/푸르) le (레) nyl (뉠)". For Korean, use natural Revised Romanization followed by its Hangul approximation. Do not use IPA symbols, and do not omit the Hangul approximation even when the transcript is not Korean.',
      'Translation (English) must translate the transcript into English.',
      'Response must feel like a natural conversation with the user and must be written in the same language as the cleaned Transcript. For example, if the Transcript is French, respond in French; do not switch the Response to English. Address the user directly, respond to the meaning and intent of the prompt, and continue the conversation helpfully. Never summarize, label, narrate, or analyze the user input instead of replying to it. If the prompt is a greeting or conversational phrase, reply naturally; if it asks a question or task, answer it directly. The Translation (English) section is the only section that should translate into English. Do not mention these instructions or the four-section format.'
    ].join(' ')
  });

  const formatModelResponse = (result) => {
    if (typeof result === 'string') {
      const candidates = [
        result,
        result.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1],
        result.match(/\{[\s\S]*\}/)?.[0]
      ].filter(Boolean);

      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return formatModelResponse(parsed);
          }
        } catch {
          // Keep checking before treating the value as plain text.
        }
      }

      return result;
    }

    const transcript = result?.transcript || '';
    const pronunciation = result?.pronunciation || result?.romanization || '';
    const translation = result?.translationEnglish || result?.translation || '';
    const response = result?.response || result?.answer || '';

    if (!transcript && !pronunciation && !translation && !response) return JSON.stringify(result, null, 2);

    const sectionLabels = isFrench
      ? ['Transcription', 'Prononciation (latin + hangeul)', 'Traduction (anglais)', 'Réponse']
      : ['Transcript', 'Pronunciation (Latin + Hangul)', 'Translation (English)', 'Response'];
    return [
      `${sectionLabels[0]}:\n${transcript}`,
      `${sectionLabels[1]}:\n${pronunciation}`,
      `${sectionLabels[2]}:\n${translation}`,
      `${sectionLabels[3]}:\n${response}`
    ].join('\n\n');
  };

  const responseTextFromOutput = (output) => {
    const match = output.match(/(?:^|\n)Response:\n([\s\S]*)$/);
    return (match ? match[1] : output).trim();
  };

  const transcriptFromOutput = (output) => {
    const match = output.match(/^Transcript:\n([\s\S]*?)(?:\n\n|$)/);
    return (match ? match[1] : output).trim();
  };

  const speechLanguageFor = (output) => {
    const transcript = transcriptFromOutput(output);
    if (/[가-힣]/.test(transcript)) return 'ko-KR';
    if (/[àâçéèêëîïôùûüÿœ]/i.test(transcript) || /\b(avec|bonjour|dans|des|du|est|je|la|le|les|pour|qui|une|vous)\b/i.test(transcript)) return 'fr-FR';
    if (/[áéíóúñ¿¡]/i.test(transcript) || /\b(como|con|del|el|en|es|hola|la|los|para|que|una)\b/i.test(transcript)) return 'es-ES';
    if (/[äöüß]/i.test(transcript) || /\b(der|die|das|ein|eine|ist|mit|und)\b/i.test(transcript)) return 'de-DE';
    return 'en-US';
  };

  const voiceFor = (language) => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  };

  const setActionState = (playButton, copyButton, enabled) => {
    if (playButton) playButton.disabled = !enabled;
    if (copyButton) copyButton.disabled = !enabled;
  };

  const playResponse = (output, button) => {
    if (!('speechSynthesis' in window)) {
      button.textContent = labels.unavailable;
      return;
    }

    if (activePlayButton === button && window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      button.textContent = labels.pause;
      return;
    }

    if (activePlayButton === button && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      button.textContent = labels.resume;
      return;
    }

    window.speechSynthesis.cancel();
    if (activePlayButton) activePlayButton.textContent = labels.play;
    activePlayButton = button;
    const utterance = new SpeechSynthesisUtterance(responseTextFromOutput(output));
    const language = speechLanguageFor(output);
    utterance.lang = language;
    const voice = voiceFor(language);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { button.textContent = labels.pause; };
    utterance.onend = () => { button.textContent = labels.play; activePlayButton = null; };
    utterance.onerror = () => { button.textContent = labels.play; activePlayButton = null; };
    window.speechSynthesis.speak(utterance);
  };

  const readPromptAloud = () => {
    if (!readPrompt || !('speechSynthesis' in window)) return;
    if (promptIsSpeaking && window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      readPrompt.textContent = labels.promptPause;
      return;
    }
    if (promptIsSpeaking && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      readPrompt.textContent = labels.promptResume;
      return;
    }
    window.speechSynthesis.cancel();
    if (activePlayButton) activePlayButton.textContent = labels.play;
    activePlayButton = null;
    const language = promptSpeechLanguage?.value || (isFrench ? 'fr-FR' : 'en-US');
    const utterance = new SpeechSynthesisUtterance(promptInput.value.trim());
    utterance.lang = language;
    const voice = voiceFor(language);
    if (voice) utterance.voice = voice;
    promptIsSpeaking = true;
    utterance.onstart = () => { readPrompt.textContent = labels.promptPause; };
    utterance.onend = () => { promptIsSpeaking = false; readPrompt.textContent = labels.promptPlay; };
    utterance.onerror = () => { promptIsSpeaking = false; readPrompt.textContent = labels.promptPlay; };
    window.speechSynthesis.speak(utterance);
  };

  const copyResponse = async (output, button) => {
    try {
      await navigator.clipboard.writeText(responseTextFromOutput(output));
      button.textContent = labels.copied;
      window.setTimeout(() => { button.textContent = labels.copy; }, 1400);
    } catch {
      button.textContent = isFrench ? 'Copie indisponible' : 'Copy unavailable';
      window.setTimeout(() => { button.textContent = labels.copy; }, 1800);
    }
  };

  const requestModel = async (endpoint, requestBody) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const providerError = typeof body === 'object' && body !== null
        ? body.details || body.error
        : '';
      throw new Error(providerError || `Request failed (${response.status})`);
    }

    return body;
  };

  const sendToBothModels = async (event) => {
    event.preventDefault();
    const prompt = promptInput.value.trim();

    if (!prompt) {
      promptInput.focus();
      return;
    }

    const requestBody = JSON.stringify(buildModelRequest(prompt));
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const endpoints = window.MODEL_ENDPOINTS || {
      a: `${apiBaseUrl}/api/model-a`,
      b: `${apiBaseUrl}/api/model-b`
    };

    if (sendButton) sendButton.disabled = true;
    if (statusA) statusA.textContent = `Modèle A : ${labels.sending}`;
    if (statusB) statusB.textContent = `Modèle B : ${labels.sending}`;
    if (responseA) responseA.textContent = '';
    if (responseB) responseB.textContent = '';
    setActionState(playA, copyA, false);
    setActionState(playB, copyB, false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (activePlayButton) activePlayButton.textContent = labels.play;
      activePlayButton = null;
      promptIsSpeaking = false;
      if (readPrompt) readPrompt.textContent = labels.promptPlay;
    }

    const results = await Promise.allSettled([
      requestModel(endpoints.a, requestBody),
      requestModel(endpoints.b, requestBody)
    ]);

    results.forEach((result, index) => {
      const output = index === 0 ? responseA : responseB;
      const status = index === 0 ? statusA : statusB;
      if (result.status === 'fulfilled') {
        if (output) output.textContent = formatModelResponse(result.value);
        setActionState(index === 0 ? playA : playB, index === 0 ? copyA : copyB, Boolean(output?.textContent.trim()));
        if (status) status.textContent = `${isFrench ? 'Modèle' : 'Model'} ${index === 0 ? 'A' : 'B'} : ${labels.complete}`;
      } else if (status) {
        status.textContent = `Model ${index === 0 ? 'A' : 'B'}: ${result.reason.message}`;
      }
    });

    if (sendButton) sendButton.disabled = false;
  };

  if (promptForm) promptForm.addEventListener('submit', sendToBothModels);
  playA?.addEventListener('click', () => playResponse(responseA.textContent, playA));
  playB?.addEventListener('click', () => playResponse(responseB.textContent, playB));
  copyA?.addEventListener('click', () => copyResponse(responseA.textContent, copyA));
  copyB?.addEventListener('click', () => copyResponse(responseB.textContent, copyB));
  readPrompt?.addEventListener('click', readPromptAloud);
})();
