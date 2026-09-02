import { apiFetch } from './security.js';
import Hls from 'hls.js';

(() => {
  const isFrench = document.documentElement.lang === 'fr';

  // Localized UI strings
  const strings = isFrench ? {
    statusReady: "Prêt à parler. Maintenez ou cliquez sur le micro pour commencer.",
    statusRecording: "Enregistrement en cours... Parlez maintenant.",
    statusError: "Erreur: ",
    micBtnStart: "🎤 Parler",
    micBtnStop: "🛑 Arrêter",
    micAccessError: "Impossible d'accéder au microphone.",
    apiError: "Le serveur a renvoyé une erreur.",
    recordFolder: "📁 Choisir le dossier d'enregistrement",
    recordFolderReady: "Dossier d'enregistrement sélectionné",
    recordFolderUnsupported: "L'enregistrement local n'est pas pris en charge par ce navigateur.",
    waitlistJoin: "Rejoindre la liste d'attente",
    waitlistLeave: "Quitter la liste d'attente",
    waitlistWaiting: (position, total, elapsed) => `Veuillez rejoindre la liste d'attente. Position ${position} sur ${total}. Temps écoulé: ${elapsed}.`,
    waitlistReady: "Les cinq participants sont prêts. Vous pouvez enregistrer.",
    waitlistIdle: "Cliquez sur le microphone pour rejoindre la liste d'attente.",
    waitlistError: "Impossible de contacter la liste d'attente."
  } : {
    statusReady: "Ready to talk. Hold or click the microphone to start.",
    statusRecording: "Recording... Speak now.",
    statusError: "Error: ",
    micBtnStart: "🎤 Talk",
    micBtnStop: "🛑 Stop",
    micAccessError: "Cannot access microphone.",
    apiError: "Server returned an error.",
    recordFolder: "📁 Choose record folder",
    recordFolderReady: "Record folder selected",
    recordFolderUnsupported: "Local recording is not supported by this browser.",
    waitlistJoin: "Join the waitlist",
    waitlistLeave: "Leave the waitlist",
    waitlistWaiting: (position, total, elapsed) => `Please wait. Position ${position} of ${total}. Elapsed: ${elapsed}.`,
    waitlistReady: "Five participants are active. You can record now.",
    waitlistIdle: "Click the microphone to join the waitlist.",
    waitlistError: "Could not contact the waitlist."
  };

  // Inject UI elements into <main class="app">
  const mainApp = document.querySelector('main.app');
  if (!mainApp) return;

  // Clear or append to intro
  const introSection = mainApp.querySelector('.intro');
  if (introSection) {
    // We keep the header/subtitle but add our interface below
  }

  // Create playground console
  const consoleDiv = document.createElement('div');
  consoleDiv.className = 'playground-console';
  consoleDiv.innerHTML = `
    <div class="voice-button-container">
      <button id="voiceBtn" class="voice-btn" type="button" aria-label="Microphone">🎤</button>
    </div>
    <button id="recordFolderBtn" class="record-folder-btn" type="button">${strings.recordFolder}</button>
    <section class="waitlist-panel" aria-live="polite">
      <h3>${strings.waitlistJoin}</h3>
      <p id="waitlistStatus">${strings.waitlistIdle}</p>
      <p id="waitlistCount"></p>
    <ol id="waitlistList" class="waitlist-list"></ol>
    </section>
    <p id="novaControlStatus" class="console-status" aria-live="polite"></p>
    <div id="consoleStatus" class="console-status">${strings.statusReady}</div>
  `;
  mainApp.appendChild(consoleDiv);

  // State variables for recording
  let audioContext = null;
  let mediaStream = null;
  let scriptProcessor = null;
  let isRecording = false;
  let streamChunkSamples = [];
  let streamChunkIndex = 0;
  let streamChunkUploadPromise = Promise.resolve();
  let recordDirectory = null;
  let anonymousSessionIdPromise = null;
  let vadNoiseFloor = 0.006;
  let vadCalibrationFrames = 0;
  let vadSpeechSamples = [];
  let vadSpeechActive = false;
  let vadSilenceFrames = 0;
  let novaControlInFlight = Promise.resolve();

  const voiceBtn = document.querySelector('#voiceBtn');
  const consoleStatus = document.querySelector('#consoleStatus');
  const novaControlStatus = document.querySelector('#novaControlStatus');
  const recordFolderBtn = document.querySelector('#recordFolderBtn');
  const waitlistStatus = document.querySelector('#waitlistStatus');
  const waitlistCount = document.querySelector('#waitlistCount');
  const waitlistList = document.querySelector('#waitlistList');
  let waitlistState = 'idle';
  let waitlistTimer = null;
  let waitingSince = null;
  let audioRoomSessionId = null;
  let audioRoomRole = null;
  let audioRoomStream = null;
  let audioRoomPeer = null;
  let audioRoomSubscriberPeer = null;
  let audioRoomHls = null;
  let audioRoomBroadcastAudio = null;
  let audioRoomTracksKey = '';
  let audioRoomPoller = null;
  let audioRoomPublishedTrackName = null;
  const audioRoomApi = (path, options = {}) => apiFetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}${path}`, options);
  const audioRoomManifest = async () => (await audioRoomApi('/api/audio-room/manifest')).json();
  const createAudioRoomSession = async () => {
    if (audioRoomSessionId) return;
    const response = await audioRoomApi('/api/audio-room/session', { method: 'POST' });
    if (!response.ok) throw new Error('The live audio room is unavailable.');
    const session = await response.json();
    audioRoomSessionId = session.sessionId;
    audioRoomRole = session.role;
  };
  const closeAudioSubscriber = () => { audioRoomSubscriberPeer?.close(); audioRoomSubscriberPeer = null; document.querySelectorAll('audio[data-audio-sfu]').forEach((audio) => audio.remove()); };
  const closeAudioBroadcast = () => { audioRoomHls?.destroy(); audioRoomHls = null; audioRoomBroadcastAudio?.pause(); audioRoomBroadcastAudio?.remove(); audioRoomBroadcastAudio = null; };
  const closeAudioPublisher = () => { audioRoomPeer?.close(); audioRoomPeer = null; };
  const subscribeToAudioRoom = async (tracks) => {
    const key = JSON.stringify(tracks);
    if (!tracks.length) { closeAudioSubscriber(); audioRoomTracksKey = ''; return; }
    if (key === audioRoomTracksKey) return;
    closeAudioSubscriber();
    audioRoomSubscriberPeer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
    audioRoomSubscriberPeer.ontrack = ({ track }) => { const audio = new Audio(); audio.autoplay = true; audio.dataset.audioSfu = 'true'; const stream = new MediaStream([track]); audio.srcObject = stream; document.body.appendChild(audio); };
    const response = await audioRoomApi('/api/audio-room/subscribe', { method: 'POST', body: JSON.stringify({ sessionId: audioRoomSessionId, tracks }) });
    if (!response.ok) throw new Error('Could not connect to the live audio room.');
    const result = await response.json();
    if (result.sessionDescription) {
      await audioRoomSubscriberPeer.setRemoteDescription(result.sessionDescription);
      const answer = await audioRoomSubscriberPeer.createAnswer();
      await audioRoomSubscriberPeer.setLocalDescription(answer);
      await audioRoomApi('/api/audio-room/renegotiate', { method: 'PUT', body: JSON.stringify({ sessionId: audioRoomSessionId, sessionDescription: { type: 'answer', sdp: answer.sdp } }) });
    }
    audioRoomTracksKey = key;
  };
  const subscribeToProcessedBroadcast = async (playbackUrl) => {
    closeAudioSubscriber();
    if (!playbackUrl) { closeAudioBroadcast(); return; }
    if (!audioRoomBroadcastAudio) {
      audioRoomBroadcastAudio = new Audio();
      audioRoomBroadcastAudio.autoplay = true;
      audioRoomBroadcastAudio.controls = false;
      audioRoomBroadcastAudio.dataset.audioBroadcast = 'true';
      document.body.appendChild(audioRoomBroadcastAudio);
    }
    if (audioRoomBroadcastAudio.canPlayType('application/vnd.apple.mpegurl')) {
      if (audioRoomBroadcastAudio.src !== playbackUrl) audioRoomBroadcastAudio.src = playbackUrl;
      await audioRoomBroadcastAudio.play().catch(() => {});
    } else if (Hls.isSupported() && !audioRoomHls) {
      audioRoomHls = new Hls({ liveSyncDurationCount: 3 });
      audioRoomHls.loadSource(playbackUrl);
      audioRoomHls.attachMedia(audioRoomBroadcastAudio);
      audioRoomHls.on(Hls.Events.MANIFEST_PARSED, () => audioRoomBroadcastAudio.play().catch(() => {}));
    }
  };
  const refreshAudioRoom = async () => {
    const manifest = await audioRoomManifest();
    if (manifest.streamType === 'processed') { await subscribeToProcessedBroadcast(manifest.playbackUrl); return; }
    closeAudioBroadcast();
    if (!audioRoomSessionId) await createAudioRoomSession();
    await subscribeToAudioRoom(manifest.tracks || []);
  };
  const connectAudioRoom = async () => { await refreshAudioRoom(); if (!audioRoomPoller) audioRoomPoller = window.setInterval(() => refreshAudioRoom().catch(console.error), 10000); };
  const publishRoomStream = async () => {
    if (!audioRoomSessionId || audioRoomRole !== 'speaker' || !audioRoomStream) return;
    closeAudioPublisher();
    audioRoomPeer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
    const transceiver = audioRoomPeer.addTransceiver(audioRoomStream.getAudioTracks()[0], { direction: 'sendonly' });
    const offer = await audioRoomPeer.createOffer();
    await audioRoomPeer.setLocalDescription(offer);
    const response = await audioRoomApi('/api/audio-room/publish', { method: 'POST', body: JSON.stringify({ sessionId: audioRoomSessionId, sessionDescription: { type: 'offer', sdp: offer.sdp }, tracks: [{ location: 'local', mid: transceiver.mid, trackName: audioRoomStream.getAudioTracks()[0].id }] }) });
    if (!response.ok) throw new Error('Could not publish microphone audio.');
    const result = await response.json();
    await audioRoomPeer.setRemoteDescription(result.sessionDescription);
    audioRoomPublishedTrackName = result.tracks?.[0]?.trackName || audioRoomStream.getAudioTracks()[0].id;
  };
  const disconnectAudioRoom = () => { if (audioRoomPoller) window.clearInterval(audioRoomPoller); audioRoomPoller = null; closeAudioSubscriber(); closeAudioBroadcast(); closeAudioPublisher(); if (audioRoomSessionId) audioRoomApi('/api/audio-room/leave', { method: 'POST', body: JSON.stringify({ sessionId: audioRoomSessionId }) }).catch(() => {}); audioRoomSessionId = null; audioRoomRole = null; audioRoomTracksKey = ''; audioRoomPublishedTrackName = null; };

  const formatElapsed = () => {
    if (!waitingSince) return '00:00:00';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(waitingSince).getTime()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
  };

  const updateWaitlist = async () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/waitlist`);
    if (!response.ok) throw new Error(strings.waitlistError);
    const status = await response.json();
    waitlistState = status.state;
    waitingSince = status.waitingSince;
    waitlistStatus.dataset.position = status.position;
    waitlistStatus.dataset.waiting = status.waiting;
    waitlistCount.textContent = isFrench
      ? `Enregistrement: ${status.active || 0}/5 · En attente: ${status.waiting}`
      : `Recording: ${status.active || 0}/5 · Waiting: ${status.waiting}`;
    waitlistList.innerHTML = '';
    for (let index = 0; index < status.waiting; index++) {
      const item = document.createElement('li');
      item.textContent = index === status.position - 1 ? `${strings.waitlistJoin} (${index + 1})` : `Participant ${index + 1}`;
      waitlistList.appendChild(item);
    }
    if (status.state === 'ready') {
      waitlistStatus.textContent = strings.waitlistReady;
      voiceBtn.disabled = false;
      voiceBtn.textContent = isRecording ? strings.micBtnStop : strings.micBtnStart;
    } else if (status.state === 'waiting') {
      waitlistStatus.textContent = strings.waitlistWaiting(status.position, status.waiting, formatElapsed());
      voiceBtn.textContent = strings.waitlistLeave;
    } else {
      waitlistStatus.textContent = strings.waitlistIdle;
      voiceBtn.textContent = strings.waitlistJoin;
      voiceBtn.disabled = false;
    }
    if (status.state === 'ready' && audioRoomRole === 'listener') disconnectAudioRoom();
    if (['waiting', 'ready'].includes(status.state)) await connectAudioRoom();
    else disconnectAudioRoom();
  };

  const joinWaitlist = async () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/waitlist`, { method: 'POST' });
    if (!response.ok) throw new Error(strings.waitlistError);
    await updateWaitlist();
    if (!waitlistTimer) waitlistTimer = window.setInterval(() => updateWaitlist().catch(console.error), 2000);
  };

  const leaveWaitlist = async () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/waitlist`, { method: 'DELETE' });
    if (!response.ok) throw new Error(strings.waitlistError);
    await updateWaitlist();
  };

  const sendNovaControlWindow = (samples, inputSampleRate) => {
    if (!samples.length || waitlistState !== 'ready') return;
    const pcm16 = downsampleAndConvertTo16BitPCM(samples, inputSampleRate, 16000);
    if (pcm16.length < 1600) return;
    const rms = Math.sqrt(pcm16.reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / pcm16.length);
    if (rms < 0.012) return;
    const blob = pcmToWav(new Uint8Array(pcm16.buffer), 16000);
    novaControlStatus.textContent = isFrench ? 'Fenêtre vocale envoyée au contrôle.' : 'Speech window sent to control sidecar.';
    novaControlInFlight = novaControlInFlight.then(async () => {
      const response = await audioRoomApi('/api/nova-control', { method: 'POST', headers: { 'Content-Type': 'audio/wav', 'X-Audio-Sample-Rate': '16000' }, body: blob });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || strings.apiError);
      if (result.action === 'tool') novaControlStatus.textContent = `${isFrench ? 'Contrôle' : 'Control'}: ${result.tool.name}`;
      else novaControlStatus.textContent = isFrench ? 'Aucune action.' : 'No action.';
    }).catch((error) => {
      novaControlStatus.textContent = `${strings.statusError}${error.message}`;
    });
  };

  const consumeVadFrame = (channelData, inputSampleRate) => {
    const rms = Math.sqrt(channelData.reduce((sum, sample) => sum + sample * sample, 0) / channelData.length);
    if (vadCalibrationFrames < 20) {
      vadNoiseFloor = vadNoiseFloor * 0.9 + rms * 0.1;
      vadCalibrationFrames += 1;
    } else if (!vadSpeechActive && rms < vadNoiseFloor * 2.5) {
      vadNoiseFloor = vadNoiseFloor * 0.995 + rms * 0.005;
    }
    const meaningfulSpeech = rms > Math.max(0.012, vadNoiseFloor * 3.2);
    if (meaningfulSpeech) {
      if (!vadSpeechActive) { vadSpeechActive = true; vadSpeechSamples = []; }
      vadSilenceFrames = 0;
      vadSpeechSamples.push(...channelData);
    } else if (vadSpeechActive) {
      vadSilenceFrames += 1;
      vadSpeechSamples.push(...channelData);
      const reachedPause = vadSilenceFrames >= 5;
      const reachedWindowLimit = vadSpeechSamples.length >= inputSampleRate * 3;
      if (reachedPause || reachedWindowLimit) {
        sendNovaControlWindow(vadSpeechSamples.splice(0), inputSampleRate);
        vadSpeechActive = false;
        vadSilenceFrames = 0;
      }
    }
  };

  const pcmToWav = (pcmBytes, sampleRate) => {
    const wav = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(wav);
    const write = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, pcmBytes.length, true);
    new Uint8Array(wav, 44).set(pcmBytes);
    return new Blob([wav], { type: 'audio/wav' });
  };

  const downsampleAndConvertTo16BitPCM = (buffer, inputSampleRate, outputSampleRate = 16000) => {
    const ratio = inputSampleRate / outputSampleRate;
    const result = new Int16Array(Math.round(buffer.length / ratio));
    for (let index = 0; index < result.length; index++) {
      const start = Math.round(index * ratio);
      const end = Math.min(buffer.length, Math.round((index + 1) * ratio));
      let total = 0;
      for (let sourceIndex = start; sourceIndex < end; sourceIndex++) total += buffer[sourceIndex];
      const sample = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
      result[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return result;
  };

  const saveRecording = async (name, blob) => {
    if (!recordDirectory) return;
    const file = await recordDirectory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const getAnonymousSessionId = () => {
    if (!anonymousSessionIdPromise) {
      anonymousSessionIdPromise = (async () => {
        const stored = JSON.parse(sessionStorage.getItem('lavender-session') || 'null');
        if (stored?.sessionId && stored?.sessionToken && stored.expiresAt > Date.now()) return stored.sessionId;
        const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
        const response = await apiFetch(`${apiBaseUrl}/api/session`);
        if (!response.ok) throw new Error(strings.apiError);
        const { sessionId } = await response.json();
        if (!sessionId) throw new Error(strings.apiError);
        return sessionId;
      })();
    }
    return anonymousSessionIdPromise;
  };

  const uploadRecording = async (sessionId, role, blob) => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'X-Session-Id': sessionId,
        'X-Recording-Role': role
      },
      body: blob
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || strings.apiError);
    return response.json();
  };

  const queueStreamChunk = (samples, inputSampleRate) => {
    if (!samples.length) return streamChunkUploadPromise;
    const pcm16 = downsampleAndConvertTo16BitPCM(samples, inputSampleRate, 16000);
    const blob = pcmToWav(new Uint8Array(pcm16.buffer), 16000);
    const chunkNumber = streamChunkIndex++;
    streamChunkUploadPromise = streamChunkUploadPromise.then(async () => {
      const sessionId = await getAnonymousSessionId();
      await saveRecording(`stream-chunk-${String(chunkNumber).padStart(6, '0')}.wav`, blob);
      await uploadRecording(sessionId, 'user', blob);
    }).catch((error) => {
      console.error(`Could not upload live 20-second audio chunk ${chunkNumber}:`, error);
    });
    return streamChunkUploadPromise;
  };

  getAnonymousSessionId().catch((error) => console.error('Could not initialize anonymous session:', error));

  if (recordFolderBtn) {
    if (!window.showDirectoryPicker) {
      recordFolderBtn.disabled = true;
      recordFolderBtn.textContent = strings.recordFolderUnsupported;
    } else {
      recordFolderBtn.addEventListener('click', async () => {
        try {
          recordDirectory = await window.showDirectoryPicker({ mode: 'readwrite' });
          recordFolderBtn.textContent = `✓ ${strings.recordFolderReady}`;
        } catch (err) {
          if (err.name !== 'AbortError') console.error('Could not select record folder:', err);
        }
      });
    }
  }

  // Start recording
  const startRecording = async () => {
    streamChunkSamples = [];
    streamChunkIndex = 0;
    vadNoiseFloor = 0.006;
    vadCalibrationFrames = 0;
    vadSpeechSamples = [];
    vadSpeechActive = false;
    vadSilenceFrames = 0;
    isRecording = true;
    voiceBtn.classList.add('recording');
    consoleStatus.textContent = strings.statusRecording;
    consoleStatus.className = 'console-status recording';

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRoomStream = mediaStream;
      await publishRoomStream();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(mediaStream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const channelData = e.inputBuffer.getChannelData(0);
        consumeVadFrame(channelData, audioContext.sampleRate);
        streamChunkSamples.push(...channelData);
        const chunkLength = Math.floor(audioContext.sampleRate * 20);
        while (streamChunkSamples.length >= chunkLength) {
          queueStreamChunk(streamChunkSamples.splice(0, chunkLength), audioContext.sampleRate);
        }
      };

      source.connect(scriptProcessor);
      const mutedOutput = audioContext.createGain();
      mutedOutput.gain.value = 0;
      scriptProcessor.connect(mutedOutput).connect(audioContext.destination);
    } catch (err) {
      console.error('Failed to access microphone', err);
      stopRecordingState();
      consoleStatus.textContent = strings.statusError + strings.micAccessError;
      consoleStatus.className = 'console-status';
    }
  };

  const stopRecordingState = () => {
    isRecording = false;
    if (vadSpeechActive && vadSpeechSamples.length) sendNovaControlWindow(vadSpeechSamples.splice(0), audioContext?.sampleRate || 48000);
    vadSpeechActive = false;
    vadSilenceFrames = 0;
    voiceBtn.classList.remove('recording');

    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (audioRoomSessionId && audioRoomPublishedTrackName) {
      audioRoomApi('/api/audio-room/close-track', { method: 'PUT', body: JSON.stringify({ sessionId: audioRoomSessionId, trackName: audioRoomPublishedTrackName }) }).catch(() => {});
    }
    audioRoomStream = null;
    audioRoomPublishedTrackName = null;
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  // Stop recording after flushing the final partial stream chunk.
  const stopRecordingAndSend = async () => {
    const inputSampleRate = audioContext ? audioContext.sampleRate : 48000;
    if (streamChunkSamples.length) {
      queueStreamChunk(streamChunkSamples.splice(0), inputSampleRate);
    }
    stopRecordingState();
    consoleStatus.textContent = strings.statusReady;
    consoleStatus.className = 'console-status';
  };

  // Admission control gates the existing per-turn recording flow.
  updateWaitlist().catch((error) => {
    waitlistStatus.textContent = error.message;
  });

  window.setInterval(() => {
    if (waitlistState === 'waiting' && waitingSince) {
      waitlistStatus.textContent = strings.waitlistWaiting(
        Number(waitlistStatus.dataset.position || 0),
        Number(waitlistStatus.dataset.waiting || 0),
        formatElapsed()
      );
    }
  }, 1000);

  voiceBtn.textContent = strings.waitlistJoin;
  voiceBtn.addEventListener('click', async () => {
    if (waitlistState === 'ready') {
      if (isRecording) await stopRecordingAndSend();
      else await startRecording();
      return;
    }
    voiceBtn.disabled = true;
    try {
      if (waitlistState === 'waiting') await leaveWaitlist();
      else if (waitlistState === 'idle') await joinWaitlist();
    } catch (error) {
      waitlistStatus.textContent = error.message;
      voiceBtn.disabled = false;
    }
  });

  window.addEventListener('pagehide', () => {
    if (isRecording) stopRecordingState();
    if (audioRoomSessionId) audioRoomApi('/api/audio-room/leave', { method: 'POST', body: JSON.stringify({ sessionId: audioRoomSessionId }) }).catch(() => {});
    if (!['waiting', 'ready'].includes(waitlistState)) return;
    const stored = JSON.parse(sessionStorage.getItem('lavender-session') || 'null');
    if (!stored?.sessionId || !stored?.sessionToken) return;
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    fetch(`${apiBaseUrl}/api/waitlist`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${stored.sessionToken}`,
        'X-Session-Id': stored.sessionId
      },
      keepalive: true
    }).catch(() => {});
  });

})();
