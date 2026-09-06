import { apiFetch } from './security.js';

(() => {
  const isFrench = document.documentElement.lang === 'fr';
  const WAITING_ROOM_LIMIT_MS = 10 * 60 * 1000;
  const ROOM_CAPACITY = 5;
  const RECORDING_LIMIT_MS = 15 * 60 * 1000;

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
    waitlistEnter: "Entrer dans la liste d'attente",
    waitlistTimer: "Temps d'attente restant",
    waitlistTimerIdle: "Commence dès votre entrée dans la liste",
    waitlistTimerReady: "Temps d'attente terminé",
    waitlistLeave: "Quitter la liste d'attente",
    waitlistWaiting: (position, total, elapsed) => `Veuillez rejoindre la liste d'attente. Position ${position} sur ${total}. Temps écoulé: ${elapsed}.`,
    waitlistReady: "Les cinq participants sont prêts. Vous pouvez enregistrer.",
    waitlistIdle: "Cliquez sur le bouton pour entrer dans la liste, puis parlez à l'agent d'accueil.",
    waitlistExpired: "La période d'attente de 10 minutes est terminée.",
    recordingLimit: "La limite d'enregistrement de 15 minutes est atteinte.",
    intakeTitle: "Parlez à l'agent d'accueil",
    intakeName: "Votre nom",
    intakeColors: "Vos couleurs préférées",
    intakeMusic: "Votre expérience musicale",
    intakeSubmit: "Partager avec l'agent",
    intakeSaved: (name) => `Merci ${name}. L'agent vous connaît maintenant.`,
    outcomeTitle: "Votre session est prête",
    outcomePrompt: "Choisissez votre destination pour les 15 prochaines minutes.",
    controlRoom: "Salle de contrôle",
    bobDylanHall: "Salle Bob Dylan",
    outcomeAccepted: (room) => `Bienvenue dans ${room}. Vous pouvez commencer l'enregistrement.`,
    outcomeRejected: "La session d'enregistrement n'est pas disponible cette fois.",
    runnerLink: "Aller à la machine de course",
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
    waitlistEnter: "Enter the waitlist",
    waitlistTimer: "Waiting time remaining",
    waitlistTimerIdle: "Starts when you enter the waitlist",
    waitlistTimerReady: "Waiting time complete",
    waitlistLeave: "Leave the waitlist",
    waitlistWaiting: (position, total, elapsed) => `Please wait. Position ${position} of ${total}. Elapsed: ${elapsed}.`,
    waitlistReady: "Five participants are active. You can record now.",
    waitlistIdle: "Click the button to enter the waitlist, then talk to the welcome agent.",
    waitlistExpired: "The 10-minute waiting period has ended.",
    recordingLimit: "The 15-minute recording limit has been reached.",
    intakeTitle: "Talk to the welcome agent",
    intakeName: "Your name",
    intakeColors: "Your favourite colours",
    intakeMusic: "Your musical experience",
    intakeSubmit: "Share with the agent",
    intakeSaved: (name) => `Thanks, ${name}. The agent knows you now.`,
    outcomeTitle: "Your session is ready",
    outcomePrompt: "Choose your destination for the next 15 minutes.",
    controlRoom: "Control Room",
    bobDylanHall: "Bob Dylan's Hall",
    outcomeAccepted: (room) => `Welcome to ${room}. You can begin recording.`,
    outcomeRejected: "The recording session is not available this time.",
    runnerLink: "Go to the running machine",
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
    <form id="agentIntake" class="advisory-intake">
      <h3>${strings.intakeTitle}</h3>
      <label>${strings.intakeName}<input id="agentName" name="name" required maxlength="80" autocomplete="name" /></label>
      <label>${strings.intakeColors}<input id="agentColors" name="colors" required maxlength="120" /></label>
      <label>${strings.intakeMusic}<textarea id="agentMusic" name="music" rows="3" maxlength="500" required></textarea></label>
      <button type="submit">${strings.intakeSubmit}</button>
      <p id="agentIntakeStatus" class="advisory-intake__status" role="status"></p>
    </form>
    <div class="voice-button-container">
      <button id="voiceBtn" class="voice-btn" type="button" aria-label="Microphone">🎤</button>
    </div>
    <button id="recordFolderBtn" class="record-folder-btn" type="button">${strings.recordFolder}</button>
    <section id="sessionOutcome" class="advisory-outcome" hidden>
      <h3>${strings.outcomeTitle}</h3>
      <p>${strings.outcomePrompt}</p>
      <div class="advisory-outcome__choices">
        <button type="button" data-room="control">${strings.controlRoom}</button>
        <button type="button" data-room="hall">${strings.bobDylanHall}</button>
      </div>
      <button class="advisory-outcome__reject" id="rejectSession" type="button">${strings.outcomeRejected}</button>
      <p id="sessionOutcomeStatus" class="advisory-outcome__status" role="status"></p>
      <a href="./running%20machien.html">${strings.runnerLink}</a>
    </section>
    <a class="advisory-runner-link" href="./running%20machien.html">${strings.runnerLink}</a>
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
  let audioOutputDestination = null;
  let recordingTimeoutId = null;
  let recordingStartedAt = null;

  const voiceBtn = document.querySelector('#voiceBtn');
  const intakeForm = document.querySelector('#agentIntake');
  const intakeStatus = document.querySelector('#agentIntakeStatus');
  const agentName = document.querySelector('#agentName');
  const agentColors = document.querySelector('#agentColors');
  const agentMusic = document.querySelector('#agentMusic');
  const sessionOutcome = document.querySelector('#sessionOutcome');
  const sessionOutcomeStatus = document.querySelector('#sessionOutcomeStatus');
  const rejectSession = document.querySelector('#rejectSession');
  const consoleStatus = document.querySelector('#consoleStatus');
  const recordFolderBtn = document.querySelector('#recordFolderBtn');
  const waitlistStatus = document.querySelector('#waitlistStatus');
  const waitlistCount = document.querySelector('#waitlistCount');
  const waitlistCountdown = document.querySelector('#waitlistCountdown');
  const waitlistTimerLabel = document.querySelector('#waitlistTimerLabel');
  const waitlistBtn = document.querySelector('#waitlistBtn');
  const waitlistList = document.querySelector('#waitlistList');
  let waitlistState = 'idle';
  let intakeComplete = false;
  let joinedAt = Number(sessionStorage.getItem('advisory-joined-at')) || null;
  let reservationStartedAt = Number(sessionStorage.getItem('advisory-reservation-started-at')) || null;
  let outcomeShown = false;
  let selectedRoom = null;
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
    } else if (window.Hls?.isSupported?.() && !audioRoomHls) {
      const Hls = window.Hls;
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

  const getWaitlistRemainingSeconds = () => reservationStartedAt
    ? Math.max(0, Math.ceil((reservationStartedAt + WAITING_ROOM_LIMIT_MS - Date.now()) / 1000))
    : WAITING_ROOM_LIMIT_MS / 1000;

  const updateWaitlistCountdown = () => {
    const remainingSeconds = getWaitlistRemainingSeconds();
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    waitlistCountdown.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    waitlistTimerLabel.textContent = remainingSeconds
      ? (reservationStartedAt ? strings.waitlistTimer : strings.waitlistTimerIdle)
      : strings.waitlistTimerReady;
    waitlistCountdown.closest('.waitlist-timer').classList.toggle('is-running', Boolean(reservationStartedAt && remainingSeconds));
  };

  const loadIntake = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('advisory-agent-intake') || 'null');
      if (!saved?.name || !saved?.colors || !saved?.music) return;
      agentName.value = saved.name;
      agentColors.value = saved.colors;
      agentMusic.value = saved.music;
      intakeComplete = true;
      intakeStatus.textContent = strings.intakeSaved(saved.name);
    } catch (error) {
      intakeComplete = false;
    }
  };

  const showOutcome = (roomReady) => {
    if (outcomeShown) return;
    outcomeShown = true;
    sessionOutcome.hidden = false;
    sessionOutcome.querySelectorAll('[data-room]').forEach((button) => { button.disabled = !roomReady; });
    sessionOutcomeStatus.textContent = roomReady ? strings.outcomePrompt : strings.outcomeRejected;
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
    if (status.state === 'waiting' && status.waitingSince && Date.now() - new Date(status.waitingSince).getTime() >= WAITING_ROOM_LIMIT_MS) {
      window.location.href = './running%20machien.html';
      return;
    }
    waitlistCount.textContent = isFrench
      ? `Enregistrement: ${status.active || 0}/${ROOM_CAPACITY} · En attente: ${status.waiting}`
      : `Recording: ${status.active || 0}/${ROOM_CAPACITY} · Waiting: ${status.waiting}`;
    waitlistList.innerHTML = '';
    for (let index = 0; index < status.waiting; index++) {
      const item = document.createElement('li');
      item.textContent = index === status.position - 1 ? `${strings.waitlistJoin} (${index + 1})` : `Participant ${index + 1}`;
      waitlistList.appendChild(item);
    }
    const reservationExpired = !getWaitlistRemainingSeconds();
    const hasVerifiedWaitingSession = Boolean(intakeComplete && joinedAt);
    if (status.state === 'ready' && reservationExpired && hasVerifiedWaitingSession) {
      showOutcome(true);
      waitlistStatus.textContent = strings.waitlistReady;
      updateWaitlistCountdown();
      waitlistBtn.hidden = true;
      voiceBtn.disabled = !selectedRoom;
      voiceBtn.textContent = isRecording ? strings.micBtnStop : strings.micBtnStart;
    } else if (status.state === 'ready') {
      waitlistStatus.textContent = isFrench ? 'Orientation en cours. La salle sera disponible après 10 minutes.' : 'Orientation is in progress. The room will open after 10 minutes.';
      waitlistBtn.hidden = false;
      waitlistBtn.disabled = true;
      updateWaitlistCountdown();
      voiceBtn.disabled = true;
      voiceBtn.textContent = strings.waitlistJoin;
    } else if (status.state === 'waiting') {
      waitlistStatus.textContent = strings.waitlistWaiting(status.position, status.waiting, formatElapsed());
      updateWaitlistCountdown();
      waitlistBtn.hidden = false;
      waitlistBtn.textContent = strings.waitlistLeave;
      waitlistBtn.disabled = false;
      voiceBtn.disabled = true;
      if (!getWaitlistRemainingSeconds()) {
        window.location.href = './running%20machien.html';
        return;
      }
    } else {
      waitlistStatus.textContent = strings.waitlistIdle;
      waitingSince = null;
      updateWaitlistCountdown();
      waitlistBtn.hidden = false;
      waitlistBtn.textContent = strings.waitlistEnter;
      waitlistBtn.disabled = false;
      voiceBtn.disabled = true;
    }
    if (status.state === 'ready' && audioRoomRole === 'listener') disconnectAudioRoom();
    if (['waiting', 'ready'].includes(status.state)) {
      try {
        await connectAudioRoom();
      } catch (error) {
        window.location.href = './running%20machien.html';
        return;
      }
    } else {
      if (waitlistTimer) window.clearInterval(waitlistTimer);
      waitlistTimer = null;
      disconnectAudioRoom();
    }
  };

  const joinWaitlist = async () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/waitlist`, {
      method: 'POST',
      headers: {
        'X-Room-Capacity': String(ROOM_CAPACITY),
        'X-Waiting-Room-Limit-Seconds': String(WAITING_ROOM_LIMIT_MS / 1000)
      }
    });
    if (!response.ok) throw new Error(strings.waitlistError);
    joinedAt = Date.now();
    sessionStorage.setItem('advisory-joined-at', String(joinedAt));
    await updateWaitlist();
    if (!waitlistTimer) waitlistTimer = window.setInterval(() => updateWaitlist().catch(console.error), 2000);
  };

  const leaveWaitlist = async () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/waitlist`, { method: 'DELETE' });
    if (!response.ok) throw new Error(strings.waitlistError);
    await updateWaitlist();
  };

  const speechDetected = (channelData) => {
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
      return true;
    } else if (vadSpeechActive) {
      vadSilenceFrames += 1;
      const reachedPause = vadSilenceFrames >= 5;
      if (reachedPause) { vadSpeechActive = false; vadSilenceFrames = 0; }
    }
    return false;
  };

  const removeSpeech = (channelData) => {
    if (!speechDetected(channelData)) return channelData;
    return new Float32Array(channelData.length);
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

  const uploadRecording = async (sessionId, role, blob, metadata = {}) => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await apiFetch(`${apiBaseUrl}/api/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'X-Session-Id': sessionId,
        'X-Recording-Role': role,
        'X-Room-Capacity': String(ROOM_CAPACITY),
        'X-Waiting-Room-Limit-Seconds': String(WAITING_ROOM_LIMIT_MS / 1000),
        'X-Recording-Metadata': JSON.stringify({
          ...metadata,
          destination: selectedRoom,
          roomCapacity: ROOM_CAPACITY,
          waitingLimitMinutes: 10,
          recordingLimitMinutes: 15,
          speechSuppressed: true,
          retainedAudio: ['instruments', 'background-noise']
        })
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
      await uploadRecording(sessionId, 'user', blob, {
        chunkNumber,
        durationSeconds: samples.length / inputSampleRate,
        recordedAt: new Date().toISOString()
      });
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
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(mediaStream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      audioOutputDestination = audioContext.createMediaStreamDestination();
      audioRoomStream = audioOutputDestination.stream;

      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const channelData = e.inputBuffer.getChannelData(0);
        const filteredData = removeSpeech(channelData);
        e.outputBuffer.getChannelData(0).set(filteredData);
        streamChunkSamples.push(...filteredData);
        const chunkLength = Math.floor(audioContext.sampleRate * 20);
        while (streamChunkSamples.length >= chunkLength) {
          queueStreamChunk(streamChunkSamples.splice(0, chunkLength), audioContext.sampleRate);
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioOutputDestination);
      await publishRoomStream();
      recordingStartedAt = Date.now();
      recordingTimeoutId = window.setTimeout(() => {
        if (!isRecording) return;
        stopRecordingAndSend().catch((error) => console.error('Could not stop timed recording:', error));
        consoleStatus.textContent = strings.recordingLimit;
      }, RECORDING_LIMIT_MS);
    } catch (err) {
      console.error('Failed to access microphone', err);
      stopRecordingState();
      consoleStatus.textContent = strings.statusError + strings.micAccessError;
      consoleStatus.className = 'console-status';
    }
  };

  const stopRecordingState = () => {
    isRecording = false;
    if (recordingTimeoutId) window.clearTimeout(recordingTimeoutId);
    recordingTimeoutId = null;
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
    audioOutputDestination = null;
    audioRoomPublishedTrackName = null;
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    recordingStartedAt = null;
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

  intakeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const intake = { name: agentName.value.trim(), colors: agentColors.value.trim(), music: agentMusic.value.trim() };
    if (!intake.name || !intake.colors || !intake.music) return;
    sessionStorage.setItem('advisory-agent-intake', JSON.stringify(intake));
    intakeComplete = true;
    intakeStatus.textContent = strings.intakeSaved(intake.name);
    if (waitlistState === 'idle') waitlistBtn.disabled = false;
  });

  sessionOutcome.querySelectorAll('[data-room]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!intakeComplete || !joinedAt || waitlistState !== 'ready' || getWaitlistRemainingSeconds()) {
        window.location.href = './running%20machien.html';
        return;
      }
      selectedRoom = button.dataset.room;
      const roomName = selectedRoom === 'control' ? strings.controlRoom : strings.bobDylanHall;
      sessionOutcomeStatus.textContent = strings.outcomeAccepted(roomName);
      voiceBtn.disabled = false;
      voiceBtn.textContent = strings.micBtnStart;
    });
  });

  rejectSession.addEventListener('click', async () => {
    if (['waiting', 'ready'].includes(waitlistState)) await leaveWaitlist().catch(() => {});
    window.location.href = './running%20machien.html';
  });

  loadIntake();

  // Admission control gates the existing per-turn recording flow.
  updateWaitlist().catch((error) => {
    waitlistStatus.textContent = error.message;
  });

  window.setInterval(() => {
    updateWaitlistCountdown();
    if (!getWaitlistRemainingSeconds()) {
      if (!intakeComplete || !joinedAt || waitlistState !== 'ready') {
        window.location.href = './running%20machien.html';
        return;
      }
      updateWaitlist().catch(() => { window.location.href = './running%20machien.html'; });
      return;
    }
    if (waitlistState === 'waiting' && waitingSince) {
      updateWaitlistCountdown();
      waitlistStatus.textContent = strings.waitlistWaiting(
        Number(waitlistStatus.dataset.position || 0),
        Number(waitlistStatus.dataset.waiting || 0),
        formatElapsed()
      );
    }
  }, 1000);

  waitlistBtn.disabled = false;
  voiceBtn.disabled = true;
  waitlistBtn.addEventListener('click', async () => {
    if (!reservationStartedAt) {
      reservationStartedAt = Date.now();
      sessionStorage.setItem('advisory-reservation-started-at', String(reservationStartedAt));
      updateWaitlistCountdown();
    }
    joinedAt = Date.now();
    sessionStorage.setItem('advisory-joined-at', String(joinedAt));
    waitlistBtn.disabled = true;
    try {
      if (waitlistState === 'waiting') await leaveWaitlist();
      else if (waitlistState === 'idle') await joinWaitlist();
    } catch (error) {
      joinedAt = null;
      sessionStorage.removeItem('advisory-joined-at');
      updateWaitlistCountdown();
      waitlistStatus.textContent = error.message;
      waitlistBtn.disabled = false;
    }
  });
  voiceBtn.addEventListener('click', async () => {
    if (waitlistState === 'ready') {
      if (isRecording) await stopRecordingAndSend();
      else await startRecording();
      return;
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
