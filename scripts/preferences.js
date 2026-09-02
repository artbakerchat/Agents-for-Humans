(() => {
  const preferenceCookie = 'lavender_preferences';
  const settingsCookie = 'lavender_cookie_settings';
  const consentCookie = 'lavender_cookie_consent';
  const maxAge = 60 * 60 * 24 * 365;
  const french = document.documentElement.lang === 'fr';

  // Add future cookie categories here. The panel and saved settings update automatically.
  const cookieCategories = french ? [
    { key: 'necessary', required: true, label: 'Cookies nécessaires', description: 'Utilisés pour enregistrer votre choix de consentement.' },
    { key: 'preferences', label: 'Cookies de préférence', description: 'Mémorisent la langue, les brouillons et votre dernière page.' }
  ] : [
    { key: 'necessary', required: true, label: 'Necessary cookies', description: 'Used to remember your consent choice.' },
    { key: 'preferences', label: 'Preference cookies', description: 'Remember your language, drafts, and last page.' }
  ];
  const copy = french ? {
    title: 'Préférences relatives aux cookies', message: 'Nous utilisons des cookies pour mémoriser vos préférences et vos brouillons sur cet appareil.', accept: 'Accepter', decline: 'Refuser', personalize: 'Personnaliser', panelTitle: 'Gestion des cookies', panelText: 'Choisissez les catégories de cookies que vous autorisez sur cet appareil.', save: 'Enregistrer les préférences', close: 'Fermer'
  } : {
    title: 'Cookie preferences', message: 'We use cookies to remember your preferences and drafts on this device.', accept: 'Accept', decline: 'Decline', personalize: 'Personalize', panelTitle: 'Cookie management', panelText: 'Choose which cookie categories you allow on this device.', save: 'Save preferences', close: 'Close'
  };

  const readCookie = (name) => document.cookie.split('; ').find((item) => item.startsWith(`${name}=`))?.split('=').slice(1).join('=');
  const parseCookie = (name, fallback) => { const value = readCookie(name); if (!value) return fallback; try { return JSON.parse(decodeURIComponent(value)); } catch { return fallback; } };
  const writeCookie = (name, value) => { document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${maxAge}; Path=/; SameSite=Lax`; };
  const removeCookie = (name) => { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`; };
  const readPreferences = () => parseCookie(preferenceCookie, {});
  const writePreferences = (preferences) => writeCookie(preferenceCookie, preferences);
  const consent = readCookie(consentCookie);
  const preferences = readPreferences();
  const savedSettings = parseCookie(settingsCookie, {});
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const baseFile = currentFile.replace('_fr', '');
  const preferredFile = french ? baseFile.replace('.html', '_fr.html') : baseFile;
  const expectedFile = preferences.language === 'fr' ? baseFile.replace('.html', '_fr.html') : baseFile;
  if (preferences.language && currentFile === preferredFile && currentFile !== expectedFile) { window.location.replace(`./${expectedFile}`); return; }

  const savePreferences = (next) => { if (readCookie(consentCookie) === 'accepted' && parseCookie(settingsCookie, {}).preferences !== false) writePreferences(next); };
  const currentPreferences = { ...preferences, language: french ? 'fr' : 'en', lastPage: baseFile };
  savePreferences(currentPreferences);
  document.querySelectorAll('.language-switch a').forEach((link) => link.addEventListener('click', () => { const next = link.getAttribute('lang') === 'fr' ? 'fr' : 'en'; savePreferences({ ...readPreferences(), language: next, lastPage: baseFile }); }));

  const settingsForPanel = () => Object.fromEntries(cookieCategories.map((category) => [category.key, category.required || savedSettings[category.key] !== false]));
  const showPanel = (banner) => {
    const panel = document.createElement('aside');
    panel.className = 'cookie-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'cookiePanelTitle');
    panel.innerHTML = `<div class="cookie-panel__top"><strong id="cookiePanelTitle"></strong><button class="cookie-panel__close" type="button" data-cookie-close></button></div><p class="cookie-panel__intro"></p><div class="cookie-panel__options"></div><div class="cookie-panel__actions"><button class="send-button" type="button" data-cookie-save></button></div>`;
    panel.querySelector('#cookiePanelTitle').textContent = copy.panelTitle;
    panel.querySelector('.cookie-panel__intro').textContent = copy.panelText;
    panel.querySelector('[data-cookie-save]').textContent = copy.save;
    panel.querySelector('[data-cookie-close]').textContent = copy.close;
    const enabled = settingsForPanel();
    panel.querySelector('.cookie-panel__options').innerHTML = cookieCategories.map((category) => `<label class="cookie-option"><input type="checkbox" data-cookie-category="${category.key}"${enabled[category.key] ? ' checked' : ''}${category.required ? ' disabled' : ''} /><span><strong>${category.label}</strong><small>${category.description}</small></span></label>`).join('');
    document.body.append(panel);
    panel.querySelector('[data-cookie-close]').addEventListener('click', () => panel.remove());
    panel.querySelector('[data-cookie-save]').addEventListener('click', () => {
      const nextSettings = Object.fromEntries(cookieCategories.map((category) => [category.key, category.required || panel.querySelector(`[data-cookie-category="${category.key}"]`).checked]));
      writeCookie(settingsCookie, nextSettings);
      setConsent('accepted');
      if (nextSettings.preferences) writePreferences(currentPreferences); else removeCookie(preferenceCookie);
      panel.remove(); banner?.remove();
    });
    panel.querySelector('[data-cookie-close]').focus();
  };

  const setConsent = (value) => { document.cookie = `${consentCookie}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`; };
  if (!consent) {
    const banner = document.createElement('aside');
    banner.className = 'cookie-banner cookie-banner--hidden'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-labelledby', 'cookieBannerTitle');
    banner.innerHTML = '<div><strong id="cookieBannerTitle"></strong><p></p></div><div class="cookie-banner__actions"><button class="secondary-btn" type="button" data-cookie-personalize></button><button class="secondary-btn" type="button" data-cookie-decline></button><button class="secondary-btn" type="button" data-cookie-accept></button><button class="send-button" type="button" data-cookie-save></button></div>';
    banner.querySelector('strong').textContent = copy.title; banner.querySelector('p').textContent = copy.message; banner.querySelector('[data-cookie-personalize]').textContent = copy.personalize; banner.querySelector('[data-cookie-accept]').textContent = copy.accept; banner.querySelector('[data-cookie-decline]').textContent = copy.decline; banner.querySelector('[data-cookie-save]').textContent = copy.save;
    document.body.append(banner);
    window.setTimeout(() => banner.classList.add('cookie-banner--visible'), 1000);
    banner.querySelector('[data-cookie-personalize]').addEventListener('click', () => showPanel(banner));
    banner.querySelector('[data-cookie-accept]').addEventListener('click', () => { setConsent('accepted'); writeCookie(settingsCookie, Object.fromEntries(cookieCategories.map((category) => [category.key, true]))); writePreferences(currentPreferences); banner.remove(); });
    banner.querySelector('[data-cookie-save]').addEventListener('click', () => { setConsent('accepted'); writeCookie(settingsCookie, settingsForPanel()); writePreferences(currentPreferences); banner.remove(); });
    banner.querySelector('[data-cookie-decline]').addEventListener('click', () => { setConsent('declined'); writeCookie(settingsCookie, Object.fromEntries(cookieCategories.map((category) => [category.key, category.required]))); removeCookie(preferenceCookie); banner.remove(); });
  }
  window.LavenderPreferences = { get: (key, fallback = '') => readPreferences()[key] ?? fallback, set: (key, value) => savePreferences({ ...readPreferences(), [key]: typeof value === 'string' ? value.slice(0, 1200) : value }), openCookieSettings: showPanel };
})();
