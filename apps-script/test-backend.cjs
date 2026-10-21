// Test locale: node apps-script/test-backend.cjs (servizi Google simulati).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const base = __dirname;
const props = new Map(), cache = new Map(), files = new Map();
let locked = false;
function csvParse(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {cell += '"'; i++;}
      else quoted = !quoted;
    } else if (!quoted && ch === ',') {row.push(cell); cell = '';}
    else if (!quoted && ch === '\r' && text[i + 1] === '\n') {row.push(cell); rows.push(row); row = []; cell = ''; i++;}
    else cell += ch;
  }
  row.push(cell); rows.push(row); return rows;
}
function file(id) {
  assert(files.has(id), 'File esistente');
  return {getId: () => id, getBlob: () => ({getDataAsString: () => files.get(id)}), setContent: text => files.set(id, text)};
}
const context = vm.createContext({
  console,
  PropertiesService: {getScriptProperties: () => ({getProperty: key => props.get(key) || null, setProperty: (key, val) => props.set(key, val), deleteProperty: key => props.delete(key)})},
  CacheService: {getScriptCache: () => ({get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key)})},
  Utilities: {
    getUuid: () => crypto.randomUUID(), DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
    computeDigest: (alg, text) => Array.from(crypto.createHash(alg).update(text).digest()),
    computeHmacSha256Signature: (text, key) => Array.from(crypto.createHmac('sha256', key).update(text).digest()),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'), parseCsv: csvParse
  },
  LockService: {getScriptLock: () => ({waitLock() {assert(!locked); locked = true;}, releaseLock() {locked = false;}})},
  MimeType: {CSV: 'text/csv'},
  DriveApp: {
    createFolder: () => ({getId: () => 'test-folder'}),
    getFolderById: () => ({createFile: (name, text) => {const id = crypto.randomUUID(); files.set(id, text); return file(id);}}),
    getFileById: file
  }
});
vm.runInContext(fs.readFileSync(path.join(base, 'Bcrypt.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(base, 'Code.gs'), 'utf8'), context);
function createUser(email) {
  props.set('SETUP_EMAIL', email);
  props.set('SETUP_PASSWORD', 'Only-a-test-password!');
  context.setupUser_();
  assert(!props.has('SETUP_PASSWORD'));
  assert(!props.has('SETUP_EMAIL'));
}
createUser('one@example.test'); createUser('two@example.test');
context.Session = {getActiveUser: () => ({getEmail: () => ''}), getEffectiveUser: () => ({getEmail: () => 'owner@example.test'})};
assert.throws(() => context.inizializzaUtente(), /Solo il proprietario/);
context.Session.getActiveUser = () => ({getEmail: () => 'different@example.test'});
assert.throws(() => context.inizializzaUtente(), /Solo il proprietario/);
assert.throws(() => context.login('one@example.test', 'wrong'), /non corrette/);
const one = context.login('one@example.test', 'Only-a-test-password!');
const two = context.login('two@example.test', 'Only-a-test-password!');
assert.equal(one.token.length, 72);
assert.throws(() => context.listQuotes('fake'), /scaduta/);
const state = {numeroPreventivo: '26-001', codiceParte: '=parte,"speciale"', materialeParte: 'XPETG', coloreParte: 'Bianco', pezziTotali: '200', pezziPerBatch: '24', giorniTotali: '5', matMarkup: '1.1', note: 'Prima riga\nSeconda, "citazione"', checkMatSTR: true};
const saved = context.saveQuote(one.token, {state, total: 123.45});
assert.equal(context.listQuotes(one.token).length, 1);
assert.equal(context.listQuotes(two.token).length, 0);
assert.throws(() => context.loadQuote(two.token, saved.id), /non trovato/);
assert.deepEqual(JSON.parse(JSON.stringify(context.loadQuote(one.token, saved.id).state)), state);
assert([...files.values()].some(text => text.includes("'=parte")));
context.saveQuote(one.token, {state: {...state, note: 'Versione nuova'}, total: 100});
assert.equal(context.listQuotes(one.token).length, 2);
assert.equal(context.loadQuote(one.token, saved.id).state.note, state.note);
assert.throws(() => context.saveQuote(one.token, {state: {...state, codiceParte: ''}}), /nome parte/);
assert.throws(() => context.saveQuote(one.token, {state: {...state, note: {invalid: true}}}), /non valido/);
for (let i = 0; i < 5; i++) assert.throws(() => context.login('absent@example.test', 'wrong'), /non corrette/);
assert.throws(() => context.login('absent@example.test', 'wrong'), /Troppi tentativi/);
context.logout(one.token);
assert.throws(() => context.listQuotes(one.token), /scaduta/);
assert.equal(context.listQuotes(two.token).length, 0);
for (const value of props.values()) assert(!value.includes('Only-a-test-password!'));
const frontend = fs.readFileSync(path.join(base, 'Login.html'), 'utf8');
new vm.Script(frontend.match(/<script>([\s\S]*)<\/script>/)[1]);
console.log('OK: bcrypt, login errato/corretto, isolamento utenti, CSV multilinea, recupero campi/checkbox, revisioni, validazione, blocco tentativi, logout e sintassi frontend.');
