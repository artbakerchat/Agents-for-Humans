const board = document.querySelector('#board');
const notesLayer = document.querySelector('#notes');
const status = document.querySelector('#boardStatus');
let notes = [];
let drag = null;
let topZ = 1;
let editingIndex = -1;
let lastTap = null;
const draftStorageKey = 'lavender.approximation.draft';
const isFrench = document.documentElement.lang === 'fr';
const ui = isFrench ? { time: 'Choisissez une heure', invalid: 'Choisissez une heure entre 8 h et 20 h, par tranches de 10 minutes.', untitled: 'Événement sans titre', newEvent: 'Nouvel événement', addNotes: 'Ajoutez une date ou des notes', drag: 'Faites glisser pour déplacer ; double-cliquez pour modifier', ready: 'post-it événement prêt à organiser', readyPlural: 'post-its événement prêts à organiser', loadError: 'Impossible de charger events_fr.html' } : { time: 'Choose a time', invalid: 'Choose a time between 8:00 AM and 8:00 PM in 10-minute increments.', untitled: 'Untitled event', newEvent: 'New event', addNotes: 'Add date or notes', drag: 'Drag to move; double-tap to edit', ready: 'event post-it ready to arrange', readyPlural: 'event post-its ready to arrange', loadError: 'Could not load events.html' };

const editor = document.querySelector('#noteEditor');
const noteForm = document.querySelector('#noteForm');
const editTitle = document.querySelector('#editTitle');
const editDate = document.querySelector('#editDate');
const editTime = document.querySelector('#editTime');
const editNotes = document.querySelector('#editNotes');
const clearEditor = document.querySelector("#clearEditor");
const saveEditor = noteForm.querySelector('[value="save"]');

const firstEditTime = 8 * 60;
const lastEditTime = 20 * 60;

for (let minutes = firstEditTime; minutes <= lastEditTime; minutes += 10) {
  const option = document.createElement("option");
  option.value = String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
  option.textContent = option.value;
  editTime.append(option);
}
editTime.options[0].textContent = ui.time;
const validateEditTime = () => {
  const value = editTime.value;
  const minutes = value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(-2)) : 0;
  const valid = !value || (Number.isInteger(minutes) && minutes >= firstEditTime && minutes <= lastEditTime && minutes % 10 === 0);
  editTime.setCustomValidity(valid ? "" : ui.invalid);
  return valid;
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

const readEvents = async () => {
  const sourcePath = isFrench ? './events_fr.html' : './events.html';
  const response = await fetch(sourcePath);
  if (!response.ok) throw new Error(`${sourcePath} returned ${response.status}`);
  const source = new DOMParser().parseFromString(await response.text(), 'text/html');
  const cards = [...source.querySelectorAll('.event-card')].map((card) => ({
    title: card.querySelector('h4')?.textContent.trim() || card.querySelector('.event-kicker')?.textContent.trim() || (isFrench ? 'Événement' : 'Event'),
    details: card.querySelector('.event-meta')?.textContent.trim() || card.querySelector('.event-kicker')?.textContent.trim() || ''
  }));
  const workshops = [...source.querySelectorAll('.events-page tbody tr')].map((row) => ({
    title: row.querySelector('strong')?.textContent.trim() || (isFrench ? 'Atelier' : 'Workshop'),
    details: [...row.querySelectorAll('td')].slice(1, 3).map((cell) => cell.textContent.trim()).join(' · ')
  }));
  return [...cards, ...workshops];
};

const positionFor = (index) => ({ left: 3 + ((index * 17) % 72), top: 4 + ((index * 23) % 70), rotate: (index % 5) * 2 - 4 });
const randomPosition = () => ({ left: 4 + Math.random() * 72, top: 4 + Math.random() * 72, rotate: Math.round((Math.random() * 14 - 7) * 10) / 10 });

const detailsFor = (note) => {
  const scheduled = [note.date, note.time].filter(Boolean).join(' · ');
  return [scheduled, note.notes ?? note.details].filter(Boolean).join(scheduled && (note.notes ?? note.details) ? ' · ' : '');
};

const saveDraft = () => {
  try {
    sessionStorage.setItem(draftStorageKey, JSON.stringify(notes));
  } catch {
    // The board still works when storage is unavailable (for example in private mode).
  }
};

const loadDraft = () => {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftStorageKey) || 'null');
    return Array.isArray(draft) ? draft : null;
  } catch {
    return null;
  }
};

const editNote = (index) => {
  const note = notes[index];
  editingIndex = index;
  editTitle.value = note.title;
  editDate.value = note.date || '';
  editTime.value = note.time || '';
  editNotes.value = note.notes ?? note.details ?? '';
  editor.showModal();
  editTitle.focus();
};

editTitle.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  noteForm.requestSubmit(saveEditor);
});
noteForm.addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'save' || editingIndex < 0) return;
  event.preventDefault();
  if (!validateEditTime()) {
    editTime.reportValidity();
    return;
  }
  const note = notes[editingIndex];
  note.title = editTitle.value.trim() || 'Untitled event';
  note.date = editDate.value;
  note.time = editTime.value;
  note.notes = editNotes.value.trim();
  note.details = note.notes;
  saveDraft();
  editor.close();
  render();
  editingIndex = -1;
});

editTime.addEventListener('input', validateEditTime);
clearEditor.addEventListener("click", () => {
  editTitle.value = "";
  editDate.value = "";
  editTime.value = "";
  editNotes.value = "";
  editTitle.focus();
});

editor.addEventListener('close', () => { editingIndex = -1; });

const bringToFront = (note, index) => {
  const z = ++topZ;
  notes[index].z = z;
  note.style.zIndex = z;
  saveDraft();
};

const keepInsideBoard = (note, index) => {
  const bounds = board.getBoundingClientRect();
  const rect = note.getBoundingClientRect();
  const maxLeft = Math.max(0, bounds.width - rect.width) / bounds.width * 100;
  const maxTop = Math.max(0, bounds.height - rect.height) / bounds.height * 100;
  notes[index].left = Math.max(0, Math.min(maxLeft, notes[index].left));
  notes[index].top = Math.max(0, Math.min(maxTop, notes[index].top));
  note.style.left = `${notes[index].left}%`;
  note.style.top = `${notes[index].top}%`;
};

const startDrag = (event, index) => {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  const note = event.currentTarget;
  bringToFront(note, index);
  const bounds = board.getBoundingClientRect();
  const rect = note.getBoundingClientRect();
  drag = { index, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, bounds };
  note.setPointerCapture?.(event.pointerId);
};

const moveDrag = (event) => {
  if (!drag) return;
  const note = notesLayer.children[drag.index];
  const maxLeft = Math.max(0, (drag.bounds.width - note.offsetWidth) / drag.bounds.width * 100);
  const maxTop = Math.max(0, (drag.bounds.height - note.offsetHeight) / drag.bounds.height * 100);
  const left = Math.max(0, Math.min(maxLeft, ((event.clientX - drag.bounds.left - drag.offsetX) / drag.bounds.width) * 100));
  const top = Math.max(0, Math.min(maxTop, ((event.clientY - drag.bounds.top - drag.offsetY) / drag.bounds.height) * 100));
  notes[drag.index].left = left;
  notes[drag.index].top = top;
  note.style.left = `${left}%`;
  note.style.top = `${top}%`;
  saveDraft();
};

const stopDrag = (event, index) => {
  if (event && index !== undefined) {
    const now = performance.now();
    const isDoubleTap = lastTap && lastTap.index === index && now - lastTap.time < 360 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
    if (isDoubleTap) { lastTap = null; editNote(index); }
    else lastTap = { index, time: now, x: event.clientX, y: event.clientY };
  }
  drag = null;
};

const render = () => {
  topZ = Math.max(1, ...notes.map((note) => Number(note.z) || 1));
  notesLayer.innerHTML = notes.map((note, index) => {
    const position = note.left === undefined ? positionFor(index) : note;
    note.left = position.left;
    note.top = position.top;
    note.rotate = note.rotate ?? position.rotate;
    note.z = note.z ?? 1;
    return `<article class="postit" style="left:${note.left}%;top:${note.top}%;z-index:${note.z};--rotation:${note.rotate}deg" data-index="${index}" tabindex="0" title="${ui.drag}"><span class="postit-pin" aria-hidden="true"></span><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(detailsFor(note))}</small></article>`;
  }).join('');
  [...notesLayer.children].forEach((note, index) => {
    requestAnimationFrame(() => keepInsideBoard(note, index));
    note.addEventListener('pointerdown', (event) => startDrag(event, index));
    note.addEventListener('pointermove', moveDrag);
    note.addEventListener('pointerup', (event) => stopDrag(event, index));
    note.addEventListener('pointercancel', () => stopDrag());
    note.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editNote(index); } });
  });
  status.textContent = `${notes.length} ${notes.length === 1 ? ui.ready : ui.readyPlural}.`;
};

window.addEventListener('resize', () => {
  [...notesLayer.children].forEach((note, index) => keepInsideBoard(note, index));
});

document.querySelector('#addNote').addEventListener('click', () => { notes.push({ title: ui.newEvent, details: ui.addNotes }); saveDraft(); render(); editNote(notes.length - 1); });
document.querySelector('#resetNotes').addEventListener('click', () => {
  try { sessionStorage.removeItem(draftStorageKey); } catch { /* Storage may be unavailable. */ }
  readEvents().then((events) => { notes = events; render(); }).catch((error) => { status.textContent = `${ui.loadError}: ${error.message}`; status.dataset.error = 'true'; });
});
readEvents().then((events) => { notes = loadDraft() || events; render(); }).catch((error) => { status.textContent = `${ui.loadError}: ${error.message}`; status.dataset.error = 'true'; });
