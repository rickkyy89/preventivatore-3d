// Google Apps Script V8. I CSV restano privati nel Drive del proprietario.
const REPO_BASE_ = 'https://raw.githubusercontent.com/rickkyy89/preventivatore-3d/main/';
const CSV_HEADER_ = ['id', 'salvato_il', 'numero', 'parte', 'materiale', 'colore', 'pezzi', 'totale_euro', 'dati_json'];

function doGet() {
  const names = ['index.html', 'config.csv', 'materiali.csv'];
  const responses = UrlFetchApp.fetchAll(names.map(name => ({url: REPO_BASE_ + name, muteHttpExceptions: true})));
  if (responses.some(response => response.getResponseCode() !== 200)) {
    return HtmlService.createHtmlOutput('Preventivatore temporaneamente non disponibile. Riprova.');
  }
  let html = responses[0].getContentText();
  const markers = ["window.addEventListener('DOMContentLoaded', init);", "const STORAGE_KEY =", "const PREVIOUS_STATE_KEY ="];
  if (markers.some(marker => !html.includes(marker))) throw new Error('Versione del preventivatore non compatibile.');
  html = html.replace("window.addEventListener('DOMContentLoaded', init);", '')
    .replaceAll("querySelectorAll('input, select, textarea')", "querySelectorAll('.container input, .container select, .container textarea')")
    .replace('const STORAGE_KEY =', 'let STORAGE_KEY =')
    .replace('const PREVIOUS_STATE_KEY =', 'let PREVIOUS_STATE_KEY =')
    .replace("LOGO_URL: 'assets/logo.png'", "LOGO_URL: '" + REPO_BASE_ + "assets/logo.png'")
    .replace(/await fetch\(`config\.csv\?v=\$\{APP_VERSION\}`, \{ cache: 'no-store' \}\)/, "({ok:true,text:async()=>window.DRIVE_CSV.config})")
    .replace(/await fetch\(`materiali\.csv\?v=\$\{APP_VERSION\}`, \{ cache: 'no-store' \}\)/, "({ok:true,text:async()=>window.DRIVE_CSV.materiali})");
  const csv = JSON.stringify({config: responses[1].getContentText(), materiali: responses[2].getContentText()}).replace(/</g, '\\u003c');
  html = html.replace('<body>', '<body><style>.container{display:none}</style><script>window.DRIVE_CSV=' + csv + ';</script>');
  html = html.replace('</body>', HtmlService.createHtmlOutputFromFile('Login').getContent() + '</body>');
  return HtmlService.createHtmlOutput(html).setTitle('Preventivatore 3DMV').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Eseguire solo dall'editor, dopo avere impostato SETUP_EMAIL e SETUP_PASSWORD
// nelle proprietà private dello script. Non inserire password nel sorgente.
function setupUser_() {
  return locked_(() => {
    const properties = PropertiesService.getScriptProperties();
    const email = normalizeEmail_(properties.getProperty('SETUP_EMAIL'));
    const password = properties.getProperty('SETUP_PASSWORD');
    if (!password || password.length < 10 || password.length > 256) throw new Error('Imposta una password tra 10 e 256 caratteri.');
    const key = 'USER_' + digest_(email);
    if (properties.getProperty(key)) throw new Error('Utente già presente: nessuna credenziale modificata.');
    if (!properties.getProperty('AUTH_PEPPER')) properties.setProperty('AUTH_PEPPER', Utilities.getUuid() + Utilities.getUuid());
    let folderId = properties.getProperty('QUOTES_FOLDER_ID');
    if (!folderId) {
      folderId = DriveApp.createFolder('Preventivatore 3DMV - Storico privato').getId();
      properties.setProperty('QUOTES_FOLDER_ID', folderId);
    }
    const salt = Utilities.getUuid();
    const file = DriveApp.getFolderById(folderId).createFile('preventivi_' + email.replace(/[^a-z0-9@._-]/g, '_') + '.csv', csvString_([CSV_HEADER_]), MimeType.CSV);
    const saltBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid(), Utilities.Charset.UTF_8).slice(0, 16).map(value => value & 255);
    const bcryptSalt = '$2a$12$' + dcodeIO.bcrypt.encodeBase64(saltBytes, saltBytes.length);
    const verifier = dcodeIO.bcrypt.hashSync(verifier_(email, salt, password), bcryptSalt);
    properties.setProperty(key, JSON.stringify({email, salt, verifier, fileId: file.getId(), version: Utilities.getUuid()}));
    properties.deleteProperty('SETUP_PASSWORD');
    properties.deleteProperty('SETUP_EMAIL');
    return 'Utente creato. Password temporanea rimossa dalle proprietà.';
  });
}

function login(email, password) {
  return locked_(() => {
    const properties = PropertiesService.getScriptProperties();
    email = normalizeEmail_(email);
    if (typeof password !== 'string' || password.length > 256) throw new Error('Email o password non corrette.');
    const suffix = digest_(email);
    const now = Date.now();
    const attemptKey = 'ATTEMPTS_' + suffix;
    let attempts = JSON.parse(properties.getProperty(attemptKey) || '{"count":0,"until":0}');
    if (attempts.until <= now) attempts = {count: 0, until: now + 15 * 60 * 1000};
    if (attempts.count >= 5) throw new Error('Troppi tentativi. Riprova tra 15 minuti.');
    const raw = properties.getProperty('USER_' + suffix);
    const user = raw ? JSON.parse(raw) : null;
    const valid = user && dcodeIO.bcrypt.compareSync(verifier_(email, user.salt, password), user.verifier);
    if (!valid) {
      attempts.count++;
      properties.setProperty(attemptKey, JSON.stringify(attempts));
      throw new Error('Email o password non corrette.');
    }
    properties.deleteProperty(attemptKey);
    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put('SESSION_' + digest_(token), JSON.stringify({email, version: user.version, expires: now + 6 * 60 * 60 * 1000}), 21600);
    return {token, email};
  });
}

function logout(token) {
  if (typeof token === 'string') CacheService.getScriptCache().remove('SESSION_' + digest_(token));
  return true;
}

function listQuotes(token) {
  const user = sessionUser_(token);
  return readRows_(user).map(row => ({id: row[0], savedAt: row[1], numero: row[2], parte: row[3], materiale: row[4], colore: row[5], pezzi: row[6], totale: row[7]})).reverse();
}

function loadQuote(token, id) {
  const user = sessionUser_(token);
  const row = readRows_(user).find(row => row[0] === id);
  if (!row) throw new Error('Preventivo non trovato.');
  return {id: row[0], state: JSON.parse(row[8])};
}

function saveQuote(token, payload) {
  const user = sessionUser_(token);
  if (!payload || typeof payload.state !== 'object' || !payload.state || Array.isArray(payload.state)) throw new Error('Dati del preventivo non validi.');
  const state = payload.state;
  const json = JSON.stringify(state);
  if (json.length > 100000 || Object.values(state).some(value => !['string', 'boolean'].includes(typeof value))) throw new Error('Preventivo troppo grande o non valido.');
  if (!String(state.numeroPreventivo || '').trim() || !String(state.codiceParte || '').trim()) throw new Error('Inserisci numero preventivo e nome parte prima di salvare.');
  if (!(Number(state.pezziTotali) > 0) || !(Number(state.pezziPerBatch) > 0) || !(Number(state.giorniTotali) > 0)) throw new Error('Controlla quantità, batch e giorni.');
  return locked_(() => {
    const rows = readRows_(user);
    if (rows.length >= 5000) throw new Error('Archivio pieno (5000 preventivi). Esporta il CSV prima di proseguire.');
    const id = Utilities.getUuid();
    const row = [id, new Date().toISOString(), state.numeroPreventivo, state.codiceParte, state.materialeParte || '', state.coloreParte || '', state.pezziTotali, String(Number(payload.total) || 0), json];
    rows.push(row);
    DriveApp.getFileById(user.fileId).setContent(csvString_([CSV_HEADER_].concat(rows)));
    return {id, savedAt: row[1]};
  });
}

function sessionUser_(token) {
  if (typeof token !== 'string' || token.length !== 72) throw new Error('Sessione scaduta. Accedi di nuovo.');
  const raw = CacheService.getScriptCache().get('SESSION_' + digest_(token));
  if (!raw) throw new Error('Sessione scaduta. Accedi di nuovo.');
  const session = JSON.parse(raw);
  const rawUser = PropertiesService.getScriptProperties().getProperty('USER_' + digest_(session.email));
  const user = rawUser ? JSON.parse(rawUser) : null;
  if (!user || user.version !== session.version || session.expires <= Date.now()) throw new Error('Sessione scaduta. Accedi di nuovo.');
  return user;
}

function readRows_(user) {
  const rows = Utilities.parseCsv(DriveApp.getFileById(user.fileId).getBlob().getDataAsString('UTF-8'));
  if (JSON.stringify(rows[0]) !== JSON.stringify(CSV_HEADER_)) throw new Error('CSV non valido: archivio non modificato.');
  const data = rows.slice(1).filter(row => row.some(value => value !== ''));
  if (data.some(row => row.length !== CSV_HEADER_.length)) throw new Error('CSV danneggiato: archivio non modificato.');
  return data;
}

function csvString_(rows) {
  return rows.map(row => row.map(value => {
    let text = String(value == null ? '' : value);
    // Evita formule eseguibili aprendo il CSV in Excel; dati originali in dati_json.
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}

function normalizeEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email o password non corrette.');
  return email;
}

function digest_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

function verifier_(email, salt, password) {
  const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER');
  if (!pepper) throw new Error('Accesso non ancora configurato.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(email + '\n' + salt + '\n' + password, pepper, Utilities.Charset.UTF_8));
}

function locked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}
