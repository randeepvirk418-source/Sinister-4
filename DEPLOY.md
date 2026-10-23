# Running and hosting CRACKPROOF

The backend is a small Node server. It serves the existing app and provides three API routes. Password analysis and generation still happen in the browser. Sending those jobs to a server would break the privacy model.

For a hosted demo, I would put the whole repository on **Render as one Node web service**. The page and API then share one URL. There is no separate frontend URL to configure, no CORS setup, and no database to create.

## Where the files go

Keep these files in the root of your GitHub repository:

```text
Sinister-4/
├── index.html
├── server.js
├── package.json
├── .node-version
├── render.yaml
├── README.md
├── DEPLOY.md
├── DEMO_SCRIPT.md
└── tests/
    ├── server.test.js
    └── breach-client.test.js
```

`index.html` is the frontend. `server.js` is the backend. Do not paste the server code into the HTML file or put it in a public assets folder.

The HTML file can still be opened on its own. The server is needed for the backend API, not for the local entropy engine or generator.

## Run it on your laptop

Install Node.js 22 or newer, open a terminal in the repository folder, and run:

```sh
node server.js
```

Open `http://localhost:3000/`. There are no third-party packages to install. `npm start` runs the same command if you prefer it.

Run the backend tests with:

```sh
node --test tests/*.test.js
```

To check the frontend too, open `http://localhost:3000/?selftest=1`. Its small overlay shows the actual PASS/FAIL results.

The server reads `PORT` when your host supplies it. It listens on `0.0.0.0` so a cloud platform can route traffic to it. You do not need to edit the source to change a hosted port.

## Host the whole app on Render

### Option A: use the included Blueprint

1. Put the project files in your `randeepvirk418-source/Sinister-4` GitHub repository. Make sure the branch you deploy contains `server.js` and `render.yaml`.
2. Sign in to Render and connect your GitHub account when prompted.
3. Choose **New → Blueprint** and select the repository and branch.
4. Render reads `render.yaml`. Review the web service and the available plan before creating it.
5. Deploy it. When the service is live, open the public URL shown in Render's dashboard.

The Blueprint selects Render's free web-service plan. Plan availability, quotas, and account requirements can change; check the options shown in your account. A sleeping or cold service can take time to wake up, so load it before presenting.

### Option B: create the web service manually

Choose **New → Web Service**, connect the same repository, and use:

| Setting | Value |
| --- | --- |
| Runtime / language | Node |
| Branch | The branch containing these files, usually `main` |
| Root directory | Leave blank; the files are in the repository root |
| Build command | `node --check server.js` |
| Start command | `node server.js` |
| Health check path | `/api/health` |
| Node version | `22` through `.node-version` or `NODE_VERSION` |
| Environment | `NODE_ENV=production` |

Choose a plan available in your account and create the service. Render supplies `PORT`; do not hardcode a public port or add your own frontend API URL.

Neither option needs an API key, database connection string, or paid password-cracking service. The backend does not crack passwords.

## Check the deployed version

Use the public URL from your Render dashboard:

1. Open `/`. The app should load from the Node server.
2. Open `/api/health`. A healthy server returns HTTP 200 and JSON.
3. Open `/api/config`. It returns public attack-speed assumptions, not session data.
4. Open `/?selftest=1`. Check the frontend overlay.
5. Type a public demo password, then open the breach network inspector. In hosted mode the browser should call `/api/breach/` followed by exactly five hexadecimal characters.
6. Switch the online check off, or disconnect the internet. The analyzer, generator, simulator, and embedded common-password check should keep working.

A blocked or unavailable breach service should produce the explicit local fallback. A successful health check does not prove the external breach service is reachable.

Before judging starts, open the hosted app and wait for it to finish starting. Keep a local copy of `index.html` as your offline demo backup.

## What the backend does

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Lets the host and you check that the server is running |
| `GET /api/config` | Returns the public attack-rate settings |
| `GET /api/breach/:PREFIX` | Proxies one five-character SHA-1 prefix to the Pwned Passwords range API |

For the breach lookup, the browser computes SHA-1 and keeps the full hash. The server receives only a five-hex-character prefix. It requests the fixed Pwned Passwords endpoint with `Add-Padding: true`, returns the range response, and lets the browser compare the remaining suffix locally.

The proxy does not accept a password, full hash, arbitrary destination URL, or password file. It has an upstream timeout, bounded requests, and an in-memory rate limit. It does not cache prefix results or write request data to a database.

The server and hosting provider can still see the prefix and request timing. Their infrastructure may also see IP addresses or keep access logs even though the application does not log requests. A five-character hash prefix reveals less than a whole password, but it is still information. Disable the online check if you want no lookup traffic.

The rate limiter is a small, per-process guard for this demo. It is not a distributed abuse-control system. Behind a hosting proxy, several visitors can share the same apparent client IP and rate limit. Do not treat it as production protection for a large public API.

## Can I still use Netlify?

Yes, for the static `index.html` demo. Drag-and-drop hosting does not run a long-lived Node `server.js` process. Uploading that file beside your HTML will not create a backend.

To run a backend on Netlify, the API would need a Netlify Functions adapter and a Git-based deployment, or a separate API host. This repository's provided backend is a Node web service, so Render is the direct route for hosting the page and API together. No Netlify Functions deployment is claimed here.

## What still needs a real hosting check

The deployment files and local tests cannot create a service in your account. You must connect the GitHub repository and start the deployment in Render. No live Render URL, successful public deployment, or external breach-service availability should be assumed until you check it there.


Local validation for this change: all 19 Node tests and all 17 browser self-tests passed. The browser was exercised against the real Node HTTP server with controlled breach-range responses; prefix-only requests, local matching, offline fallback, and the 390px layout passed. A real upstream lookup could not complete from this cloud environment, and no service has been deployed in your Render account yet.
