# Homepage

A self-hosted dashboard inspired by [gethomepage/homepage](https://github.com/gethomepage/homepage), so you can open all your services (Jellyfin, Proxmox, Nextcloud, …) from one page without remembering every URL and port.

- Services organized in groups, defined in a simple YAML file
- Automatic icons from [Dashboard Icons](https://dashboard-icons.homarr.dev) and [Simple Icons](https://simpleicons.org), or a URL / emoji
- Online/offline status indicator per service (with latency)
- Instant search: press `/` to search, `Enter` opens the first result
- Config changes apply on refresh — no container restart
- Users recognized via Authelia (no password in the dashboard), with a welcome message and account menu
- Personal homes: each user picks their own services from the web UI
- Designed to run as a Docker container

## Run with Docker (recommended)

```bash
docker compose up -d --build
```

Rebuilds reuse the npm and Next.js caches (BuildKit, on by default with Compose), so a code change does not re-download dependencies. The running container is the same: config still comes from the mounted data folder, not from the image.
The dashboard is available at `http://<server-ip>:3000`.

### Data folder

The container keeps everything under one data folder, mounted at `/app/data`:

```
/srv/homedash/                 ← host folder (e.g. `- /srv/homedash:/app/data`)
├── config/                    ← general config, edited by the admin
│   ├── settings.yaml
│   ├── services.yaml
│   ├── bookmarks.yaml
│   └── users.yaml
└── users/                     ← one folder per user, managed by the app
    ├── mario/
    │   └── home.yaml          ← personal home (chosen services/bookmarks)
    └── giulia/
```

If `config/` is empty on first start, it is seeded with the example files. User folders are created automatically the first time a user listed in `users.yaml` opens the dashboard. The folder must be writable by user `1000` inside the container (`sudo chown -R 1000:1000 /srv/homedash`).

Without Compose:

```bash
docker build -t homepage-dashboard .
docker run -d --name homepage -p 3000:3000 -v /srv/homedash:/app/data --restart unless-stopped homepage-dashboard
```

## Configuration

### `config/services.yaml`

```yaml
- Media:
    - Jellyfin:
        href: http://192.168.1.10:8096
        description: Movies and TV shows
        icon: jellyfin
    - Router:
        href: http://192.168.1.1
        icon: 📡
        ping: false

- Infrastructure:
    - Proxmox:
        href: https://proxmox.home.lan:8006
        icon: proxmox
        ping: https://192.168.1.2:8006
        users: [Giulio]          # only these people
        groups: [admins]         # …or any of these Authelia groups
```

Omit both `users` and `groups` to show the service to everyone. Guests (no Authelia headers) only see public services.

| Field         | Description                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `href`        | Service link                                                                                         |
| `description` | Short text under the name                                                                            |
| `icon`        | Dashboard Icons name (`jellyfin`), `si-<name>` for Simple Icons, an image URL, or an emoji           |
| `ping`        | Alternate URL for the status check, or `false` to disable it                                         |
| `target`      | `_blank` or `_self`, overrides the global setting                                                    |
| `users`       | Optional list of Authelia usernames/displayNames allowed to see this service                         |
| `groups`      | Optional list of Authelia groups allowed to see this service                                         |

The status check runs **from the server** (the container), so use addresses the container can reach. Any HTTP response under 500 (including 401/403) counts as "online"; self-signed certificates are accepted.

### `config/bookmarks.yaml`

Quick links shown above the services as compact chips. Same optional `users` / `groups` fields as services.

```yaml
- Favorites:
    - YouTube:
        href: https://youtube.com
        icon: si-youtube
    - Reddit:
        href: https://reddit.com
        icon: si-reddit
        users: [mario]   # optional — only these people
```

### `config/users.yaml`

Users to recognize. There is no login: identity comes from **Authelia**, which passes the user data to the container as HTTP headers through the **nginx** reverse proxy. A user is matched by Authelia `username` first (case-insensitive), then by `displayName`. Set `username` for every user, especially when several users share the same display name.

```yaml
users:
  - displayName: Mario Rossi   # must match Authelia's displayname
    username: mario
    email: mario@example.com
    avatar: https://example.com/mario.png
    role: Admin
```

Example nginx config (in the `location` that proxies to the dashboard, after `auth_request`):

```nginx
auth_request_set $user   $upstream_http_remote_user;
auth_request_set $name   $upstream_http_remote_name;
auth_request_set $email  $upstream_http_remote_email;
auth_request_set $groups $upstream_http_remote_groups;
proxy_set_header Remote-User   $user;
proxy_set_header Remote-Name   $name;
proxy_set_header Remote-Email  $email;
proxy_set_header Remote-Groups $groups;
```

Header names can be changed under `settings.yaml` → `auth.headers`. If a user arrives who is not in `users.yaml`, they are still welcomed but the menu notes they are missing from the config. With no headers, the dashboard shows "Guest".

> **Important:** headers are only trustworthy if the dashboard is reachable **exclusively** through nginx. Do not expose the container port on untrusted networks, or anyone can forge a `Remote-Name` header.

#### Personal home

Each user listed in `users.yaml` can pick which services and bookmarks appear on their own home: user menu → **Customize home**. Drag the grip handle to rearrange them; the order is kept on their home. The choice is saved in `users/<username>/home.yaml` as a list of **hidden** items plus an order — so when the admin adds a new service to `services.yaml`, it appears automatically for everyone who can access it. **Reset to default** deletes the file and shows everything again. Services are referenced as `Group/Name`.

The user folder name is the Authelia username (set `username` in `users.yaml` to keep it stable); if no username is available, a slug of the display name is used.

**Troubleshooting:** run `docker compose logs -f homedash` (use your service name) and open the dashboard. Each visit logs whether the identity headers arrived and which user they matched; startup logs show the data folder, whether it is writable and the configured users.

To try locally without Authelia, start the dev server with `DEV_REMOTE_NAME="Mario Rossi" DEV_REMOTE_USER=mario npm run dev` (ignored in production).

### `config/settings.yaml`

| Field                | Default                              | Description                                  |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| `title`              | `Homepage`                           | Page title                                   |
| `subtitle`           | `Your services, one click away.`     | Subtitle (`null` to hide)                    |
| `columns`            | `4`                                  | Max columns on large screens (1-6)           |
| `target`             | `_blank`                             | How to open links                            |
| `statusCheck`        | `true`                               | Enable status checks for everyone            |
| `statusInterval`     | `60`                                 | Status check interval in seconds (min. 5)    |
| `showClock`          | `true`                               | Show clock and date                          |
| `backgroundImage`    | —                                    | Background image URL                         |
| `backgroundBlur`     | `0`                                  | Background blur in px (0-40)                 |
| `backgroundOpacity`  | `0.35`                               | Background visibility (0-1)                  |
| `auth.enabled`       | `true`                               | Recognize users from headers                 |
| `auth.headers.*`     | `Remote-User/Name/Email/Groups`      | Header names forwarded by nginx              |
| `auth.accountUrl`    | —                                    | "Manage account" link in the user menu       |
| `auth.logoutUrl`     | —                                    | "Sign out" link (e.g. Authelia logout)       |

If a YAML file has an error, the page shows the message with the line to fix.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev     # http://localhost:43127
```

In development the data folder is `./data` (git-ignored), seeded from the examples in `./config`. Override with `DATA_DIR`.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
