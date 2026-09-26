# Homepage

Una dashboard self-hosted, ispirata a [gethomepage/homepage](https://github.com/gethomepage/homepage), per raccogliere in un'unica pagina i link a tutti i tuoi servizi (Jellyfin, Proxmox, Nextcloud, …) senza doverti ricordare indirizzi e porte.

- Servizi organizzati in gruppi, definiti in un semplice file YAML
- Icone automatiche da [Dashboard Icons](https://dashboard-icons.homarr.dev) e [Simple Icons](https://simpleicons.org), oppure URL o emoji
- Indicatore di stato online/offline per ogni servizio (con latenza)
- Ricerca istantanea: premi `/` per cercare, `Invio` apre il primo risultato
- Le modifiche alla configurazione sono visibili al refresh, senza riavviare il container
- Pensata per girare in un container Docker

## Avvio con Docker (consigliato)

```bash
docker compose up -d --build
```

La dashboard è disponibile su `http://<ip-del-server>:3000`.

La cartella `./config` viene montata nel container in `/app/config`. Se al primo avvio è vuota, il container la popola con i file di esempio (serve che la cartella sia scrivibile dall'utente `1000`, altrimenti vengono usati gli esempi in sola lettura).

Senza compose:

```bash
docker build -t homepage-dashboard .
docker run -d --name homepage -p 3000:3000 -v "$(pwd)/config:/app/config" --restart unless-stopped homepage-dashboard
```

## Configurazione

### `config/services.yaml`

```yaml
- Media:
    - Jellyfin:
        href: http://192.168.1.10:8096
        description: Film e serie TV
        icon: jellyfin
    - Router:
        href: http://192.168.1.1
        icon: 📡
        ping: false

- Infrastruttura:
    - Proxmox:
        href: https://proxmox.casa.lan:8006
        icon: proxmox
        ping: https://192.168.1.2:8006
```

| Campo         | Descrizione                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `href`        | Link del servizio                                                                                    |
| `description` | Testo breve sotto il nome                                                                            |
| `icon`        | Nome da Dashboard Icons (`jellyfin`), `si-<nome>` per Simple Icons, URL di un'immagine, oppure emoji |
| `ping`        | URL alternativo per il controllo di stato, oppure `false` per disattivarlo                           |
| `target`      | `_blank` o `_self`, sovrascrive l'impostazione globale                                               |

Il controllo di stato viene eseguito **dal server** (cioè dal container), quindi usa indirizzi raggiungibili dal container. Qualsiasi risposta HTTP sotto 500 (anche 401/403) conta come "online"; i certificati self-signed sono accettati.

### `config/bookmarks.yaml`

Preferiti/link rapidi, mostrati sopra i servizi come chip compatti.

```yaml
- Preferiti:
    - YouTube:
        href: https://youtube.com
        icon: si-youtube
    - Reddit:
        href: https://reddit.com
        icon: si-reddit
```

### `config/settings.yaml`


| Campo            | Default                              | Descrizione                                  |
| ---------------- | ------------------------------------ | -------------------------------------------- |
| `title`          | `Homepage`                           | Titolo della pagina                          |
| `subtitle`       | `I tuoi servizi, a portata di clic.` | Sottotitolo (`null` per nasconderlo)         |
| `columns`        | `4`                                  | Colonne massime su schermi grandi (1-6)      |
| `target`         | `_blank`                             | Come aprire i link                           |
| `statusCheck`    | `true`                               | Abilita il controllo di stato per tutti      |
| `statusInterval` | `60`                                 | Intervallo del controllo in secondi (min. 5) |
| `showClock`          | `true`                               | Mostra orologio e data                       |
| `backgroundImage`    | —                                    | URL di un'immagine di sfondo                 |
| `backgroundBlur`     | `0`                                  | Sfocatura dello sfondo in px (0-40)          |
| `backgroundOpacity`  | `0.35`                               | Visibilità dello sfondo (0-1)                |

Se un file YAML contiene un errore, la pagina mostra il messaggio con la riga da correggere.

## Sviluppo locale

Requisiti: Node.js 22+.

```bash
npm install
npm run dev     # http://localhost:43127
```

La configurazione viene letta da `./config` (modificabile con la variabile `CONFIG_DIR`).

Stack: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
