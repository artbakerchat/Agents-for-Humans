(() => {
  const storageKey = 'lavender_question_state';
  const answersStorageKey = 'lavender_question_answers';
  const questions = [
    { id: 'visit', en: 'Would you visit this gallery in person?', fr: 'Visiteriez-vous cette galerie en personne ?' },
    { id: 'share', en: 'Would you share this page with a friend?', fr: 'Partageriez-vous cette page avec un ami ?' },
    { id: 'return', en: 'Would you come back to explore another section?', fr: 'Reviendriez-vous pour explorer une autre section ?' },
    { id: 'art', en: 'Do you enjoy discovering unfamiliar art?', fr: 'Aimez-vous découvrir des œuvres inconnues ?' },
    { id: 'quiet', en: 'Would you spend a quiet afternoon here?', fr: 'Passeriez-vous un après-midi tranquille ici ?' },
  ];
  const french = document.documentElement.lang === 'fr';
  const copy = french
    ? { yes: 'Oui', no: 'Non', answeredYes: 'Vous avez répondu oui', answeredNo: 'Vous avez répondu non' }
    : { yes: 'Yes', no: 'No', answeredYes: 'You answered yes', answeredNo: 'You answered no' };

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  };
  const writeState = (state) => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  };
  const readAnswers = () => {
    try {
      const answers = JSON.parse(localStorage.getItem(answersStorageKey) || '[]');
      return Array.isArray(answers) ? answers : [];
    } catch { return []; }
  };
  const recordAnswer = (answer) => {
    try {
      const answers = readAnswers();
      answers.push(answer);
      localStorage.setItem(answersStorageKey, JSON.stringify(answers.slice(-100)));
    } catch {}
    window.dispatchEvent(new CustomEvent('lavender-question-answer', { detail: answer }));
  };
  const previous = readState();
  const answeredIds = new Set(readAnswers().map((item) => item.questionId));
  if (answeredIds.size >= questions.length) return;
  let question = questions.find((item) => item.id === previous.id && !answeredIds.has(item.id));
  if (!question) {
    const choices = questions.filter((item) => !answeredIds.has(item.id));
    question = choices[Math.floor(Math.random() * choices.length)] || questions[0];
    writeState({ id: question.id });
  }

  const banner = document.createElement('aside');
  banner.className = 'question-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-labelledby', 'questionBannerTitle');
  banner.innerHTML = '<div class="question-banner__copy"><strong id="questionBannerTitle"></strong><p></p></div><div class="question-banner__actions"><button class="question-banner__button question-banner__button--yes" type="button"></button><button class="question-banner__button question-banner__button--no" type="button"></button></div>';
  banner.querySelector('strong').textContent = french ? question.fr : question.en;
  const message = banner.querySelector('p');
  const yesButton = banner.querySelector('.question-banner__button--yes');
  const noButton = banner.querySelector('.question-banner__button--no');
  yesButton.innerHTML = '<span aria-hidden="true">✓</span> ' + copy.yes;
  noButton.innerHTML = '<span aria-hidden="true">×</span> ' + copy.no;
  document.body.append(banner);

  const answer = (value) => {
    const answerRecord = { questionId: question.id, answer: value, language: french ? 'fr' : 'en', answeredAt: new Date().toISOString() };
    writeState({ id: question.id, answer: value });
    recordAnswer(answerRecord);
    banner.classList.toggle('question-banner--yes', value === 'yes');
    banner.classList.toggle('question-banner--no', value === 'no');
    message.textContent = value === 'yes' ? copy.answeredYes : copy.answeredNo;
    yesButton.disabled = true;
    noButton.disabled = true;
    window.setTimeout(() => {
      banner.classList.add('question-banner--dismissed');
      window.setTimeout(() => banner.remove(), 350);
    }, 1000);
  };
  yesButton.addEventListener('click', () => answer('yes'));
  noButton.addEventListener('click', () => answer('no'));
})();
