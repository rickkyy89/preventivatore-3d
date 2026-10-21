# Login e storico su CSV in Google Drive

Implementazione per Google Apps Script, senza database esterno o abbonamenti.
Il piano gratuito Google è soggetto alle quote del proprio account e allo spazio Drive disponibile.
Stato: codice preparato; occorre creare e autorizzare la web app nel proprio account Google.

## Installazione (una volta)

1. Crea un progetto Google Apps Script dal tuo account.
2. Incolla `Code.gs` nel file di codice e aggiungi un file HTML chiamato `Login`, usando `Login.html`. Aggiungi anche il file di codice `Bcrypt.gs` (libreria bcryptjs 2.4.3 inclusa, con licenza nel sorgente).
3. Nelle Impostazioni progetto → Proprietà script inserisci `SETUP_EMAIL` (la tua email) e `SETUP_PASSWORD` (la password scelta). Queste proprietà devono restare private: non metterle su GitHub.
4. Dall'editor esegui `inizializzaUtente` e autorizza l'accesso al Drive e il recupero delle pagine della repository. La funzione crea la cartella privata e il CSV dell'utente, poi elimina `SETUP_PASSWORD` e `SETUP_EMAIL`.
5. Distribuisci come app web: esegui come proprietario, accesso a chiunque. Solo la pagina di login è pubblica: ogni funzione che legge o scrive i preventivi richiede una sessione valida. I file CSV non vanno condivisi pubblicamente.
6. Apri il link `/exec` risultante. Verifica login, salvataggio e ricaricamento con un preventivo di prova. Per usare lo storico, utilizzare questo link: il sito GitHub Pages originale non viene trasformato automaticamente nella web app.

La web app legge il preventivatore, i materiali e i costi dal branch `main` della repository. Non duplica il codice dei calcoli. Se cambia la struttura di inizializzazione, il controllo di compatibilità richiede di aggiornare l'adattatore `doGet`.

## Utenti

Per aggiungere un altro utente, ripetere i punti 3 e 4 con la sua email e password. Non c'è registrazione pubblica. Ogni utente ha un CSV differente; il server sceglie il file dalla sessione e non accetta un ID file dal browser. `setupUser_` non è richiamabile dal browser e non sovrascrive credenziali esistenti. La funzione visibile nell'editor `inizializzaUtente` controlla che l'utente Google attivo coincida con il proprietario prima di chiamarla.

## Storico

“Salva preventivo” crea una nuova voce: salvare nuovamente non cancella le versioni precedenti. Ogni riga conserva numero, parte, materiale, colore, quantità, totale e tutti i valori inseriti in JSON (compresi costi, moltiplicatore, sconti, note, materiali e checkbox). “Ricarica” ripristina questi valori e ricalcola l'output con il codice attuale. Non è una copia immutabile del PDF: per conservare l'aspetto e i calcoli originali, esportare il PDF al momento dell'offerta.

I metri per bobina e i prezzi del catalogo continuano a provenire dal CSV materiali corrente. Le tariffe modificabili del preventivo sono salvate nella singola voce.

Le scritture sono serializzate con un lock. Il CSV usa campi tra virgolette, mantiene virgole e ritorni a capo nelle note, e neutralizza formule nei campi leggibili. Il JSON mantiene i valori originali. Se il formato è danneggiato il salvataggio si ferma. Limite applicativo: 5000 voci per utente e 100 KB di campi per voce.

## Accesso

Le password non sono nel sorgente né nei CSV. Il verificatore usa bcrypt con costo 12 sul prehash HMAC-SHA256 con sale per utente e chiave casuale privata (`AUTH_PEPPER`) nelle proprietà dello script. La chiave è necessaria per verificare le password: non eliminarla e non condividere le proprietà o il progetto con persone non autorizzate. Per accessi numerosi o una diffusione pubblica ampia usare un provider di autenticazione dedicato.

Cinque tentativi errati bloccano l'email per 15 minuti. Le sessioni durano al massimo 6 ore e possono scadere prima se Google svuota la cache. I token sono solo in memoria, non negli URL o nel localStorage. Il salvataggio locale dei campi è separato per email; non è lo storico Drive e su un computer condiviso è visibile a chi accede al profilo del browser.

Non viene effettuato l'import automatico del precedente localStorage anonimo, perché non è associato a un utente verificato. I vecchi dati non vengono cancellati. Nessuna password reale deve essere aggiunta a esempi, test o commit.

Prima di considerare conclusa l'attivazione, verificare sul servizio reale login corretto/errato, isolamento tra due utenti, salvataggio, logout e recupero da un altro browser. I test locali con servizi Google simulati non sostituiscono questa verifica.
