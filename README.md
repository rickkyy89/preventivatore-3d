# Preventivatore 3DMV

Calcolatore di preventivi per stampa 3D, con accesso tramite email e password e storico separato per utente.

**[Apri il preventivatore](https://script.google.com/macros/s/AKfycbyLR31AvCTo2u6p1aHOnEiM7lyybeqkCY37pcrMD1z1JIYPdGbHJ3f6HtfcGiZ3EYII/exec)**

## Dove si trova il sito

Dal 21 ottobre 2026 il sito viene pubblicato tramite **Google Apps Script**. **GitHub Pages è disattivato**: il vecchio indirizzo `rickkyy89.github.io/preventivatore-3d/` non è più l'indirizzo da utilizzare.

Il repository resta necessario: Apps Script recupera da qui l'interfaccia e i dati del calcolatore. Disattivare Pages non elimina i file e non interrompe questo collegamento.

| Componente | Dove risiede | Funzione |
| --- | --- | --- |
| `index.html` | GitHub, branch `main` | Interfaccia, calcoli, output e stampa PDF |
| `config.csv` | GitHub, branch `main` | Configurazione e valori predefiniti |
| `materiali.csv` | GitHub, branch `main` | Catalogo e parametri dei materiali |
| `assets/logo.png` | GitHub, branch `main` | Logo caricato dal browser |
| Codice Apps Script e `Login.html` | Progetto Google Apps Script; sorgenti di riferimento in `apps-script/` | Pubblicazione, login, sessioni e gestione dello storico |
| CSV dei preventivi | Drive privato del proprietario, un file per utente | Archivio dei preventivi salvati |
| Configurazione degli utenti | Proprietà private di Apps Script | Verificatori delle password e associazione al CSV |

## Collegamento GitHub → Apps Script

Aprendo il link della web app, Google esegue `doGet()`. Il server recupera `index.html`, `config.csv` e `materiali.csv` da `raw.githubusercontent.com/rickkyy89/preventivatore-3d/main/`, incorpora i CSV nella pagina e aggiunge la schermata di login contenuta nel progetto Apps Script. Il logo usa un indirizzo assoluto sullo stesso repository.

Dopo l'accesso, il browser chiama le funzioni server tramite `google.script.run`. Il server verifica la sessione e legge o scrive il CSV associato all'utente nel Drive del proprietario. I preventivi e le credenziali non vengono scritti nel repository.

Questo collegamento **non è una sincronizzazione bidirezionale**: la web app legge i file pubblici da GitHub, mentre i file `.gs` e `Login.html` vengono eseguiti dalla copia presente nel progetto Google. Non viene usato GitHub Pages.

## Come aggiornare

| Modifica | Operazione necessaria |
| --- | --- |
| Interfaccia o calcoli in `index.html` | Commit su `main`, poi riaprire la web app; non occorre un nuovo deployment Apps Script se l'adattatore resta compatibile |
| Valori in `config.csv` o catalogo in `materiali.csv` | Commit su `main`, poi riaprire la web app |
| Logo | Aggiornare `assets/logo.png`; la cache del browser può ritardarne la visualizzazione |
| Login, sessioni, salvataggio o adattatore `doGet()` | Aggiornare i sorgenti nel repository **e** copiarli nel progetto Apps Script; salvare e aggiornare il deployment esistente a una nuova versione |
| Nuovo utente | Inizializzarlo dalle proprietà private e dall'editor Apps Script, secondo la [guida tecnica](apps-script/README.md#utenti) |

Le pagine già aperte mantengono il codice e il catalogo caricati all'apertura. I valori locali ripristinati o un preventivo ricaricato possono prevalere sui nuovi valori predefiniti: usare il comando per un nuovo preventivo con valori di default quando necessario.

Aggiornando Apps Script, modificare il **deployment esistente** per conservare lo stesso link `/exec`. Un commit nella cartella `apps-script/` da solo non aggiorna il servizio Google. Nel progetto attuale `Bcrypt.gs` e `Code.gs` sono riuniti nel file `Codice.gs`; `Login.html` e il manifest restano file separati.

## Dipendenze e storico

Il repository deve restare pubblico e i percorsi dei file devono rimanere raggiungibili. Se viene rinominato, spostato o reso privato, occorre aggiornare l'integrazione: la configurazione attuale non usa credenziali GitHub. Se il recupero dei tre file principali fallisce, la web app mostra un messaggio di indisponibilità.

L'adattatore controlla alcuni punti della struttura di `index.html`: una modifica all'inizializzazione o al caricamento dei CSV può richiedere un aggiornamento di `doGet()`.

Ogni salvataggio aggiunge una nuova voce allo storico. Ricaricare una voce ripristina i campi e ricalcola con il codice e il catalogo correnti; per conservare l'offerta originale esportare anche il PDF.

Il servizio usa Apps Script e Drive senza abbonamenti aggiuntivi, entro le quote e lo spazio dell'account Google. Per installazione, accesso, limiti e verifica consultare [apps-script/README.md](apps-script/README.md).
