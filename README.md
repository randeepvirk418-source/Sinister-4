# CRACKPROOF

A small, offline password lab that shows why a password can look strong and still be easy to guess.

**Type a password. Watch it die. Learn why.**

I built this for Vibeathon 2026 at Graphic Era Hill University because “add a capital letter and a symbol” is pretty weak advice on its own. `Summer2024!` ticks those boxes, but an attacker sees a word, a year, and an exclamation mark. I wanted to put that difference on screen and make it easy to explain.

Made by **Mr Deadron**.

## Quick start

For the full app with its backend, install Node.js 22 or newer, open this repository's folder, and run:

```sh
node server.js
```

Open `http://localhost:3000/`. There are no packages to install and no build step. The server serves the page and its API from the same address.

For a standalone demo, you can still open `index.html` directly. Analysis, word lists, generation, and simulations work offline. Online breach checking is optional.

If you only want a static preview, you can also serve the frontend alone:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. For the full backend, use the Node command above. See [DEPLOY.md](DEPLOY.md) for the exact Render setup. Netlify Drop hosts the static file; it does not run `server.js`.

Add `?selftest=1` to the page address to run the built-in checks. For example, use `http://localhost:8000/?selftest=1` when serving it locally.

## Features

- Live strength score, naive entropy, and a pattern-aware estimate.
- Token chips showing the words, years, suffixes, and other shortcuts an attacker might notice.
- Three live crack-time estimates below the strength meter, plus a detailed attack-scenario table.
- A local common-password check and optional prefix-only online breach lookup.
- Secure random character passwords and passphrases, generated with `crypto.getRandomValues`.
- Specific improvement tips and a stronger-passphrase comparison that leaves your input alone.
- A short visual attack simulation, demo presets, and a guided demo.
- Green, amber, and cyan terminal themes, a phone layout, and reduced-motion support.
- Password-free reports and a panic wipe button.

The frontend stays in one HTML file. The optional Node backend serves it, exposes public settings and health checks, and proxies five-character breach prefixes. The attack animation only illustrates the math; it does not try passwords, crack hashes, or contact another system.

## How it works

### Two different entropy estimates

The naive estimate assumes every character was chosen independently from the available character pool:

```text
naive bits = length × log2(character pool size)
```

The pool adds 26 for lowercase letters, 26 for uppercase, 10 for digits, 33 for symbols, and roughly 100 for other Unicode characters. This is a simple model, not a count of every character a person could type. Length is counted in Unicode code points, so some emoji sequences count as more than one character.

The second estimate looks for structure. It recognizes words, names, common passwords, leet substitutions such as `a` → `@`, reversed words, keyboard walks, sequences, repeated blocks, dates, years from 1900–2029, and common suffixes.

For `Summer2024!`, the useful breakdown is `[Summer: word] [2024: year] [!: suffix]`. The engine assigns guess costs to those matches. Dynamic programming finds the cheapest way to cover the whole password. Unmatched text falls back to brute force.

```text
estimated guesses = min(pattern estimate, character pool size ^ length)
pattern-aware bits = log2(estimated guesses)
```

A match in the embedded common-password list can lower the whole-password estimate further. That's why the public demo value `Summer2024!` lands at about **8.3 bits**, despite its naive estimate of about **72.3 bits**. The 8.3 figure is a heuristic guessing cost, not a measured rank in a current breach database.

Passphrases get a word-choice estimate too. The generator has 4,096 words, so each independent random choice adds `log2(4096) = 12` bits. Six random words give **72 bits**. A fixed separator or capitalization adds no randomness. A phrase you picked yourself, or copied from a comic, does not get the same guarantee.

### Score levels

The score is the rounded pattern-aware bit estimate, capped between 0 and 100. These are the app's teaching thresholds, not an industry standard:

| Score | Label |
| --- | --- |
| 0–20 | CRITICAL |
| 21–35 | WEAK |
| 36–49 | FAIR |
| 50–79 | STRONG |
| 80–100 | FORTRESS |

An embedded common-password match always forces CRITICAL and caps the score at 20. An empty field stays idle. A high score does not make a reused or publicly disclosed password a good choice.

## How long would an attacker take?

The three estimates directly below the strength meter use the **pattern-aware bits**, not the naive number. They assume an attacker already knows common words, dates, substitutions, and other familiar tricks.

```text
average time in seconds = 2^(entropy_bits - 1) / guesses_per_second
```

Why subtract one bit? If a search space contains `2^bits` candidates, this model assumes the attacker finds the right candidate halfway through it, on average.

| Attacker | Guessing speed | What it represents |
| --- | ---: | --- |
| Online attack | 100 guesses/sec | An illustrative login-guessing rate; real sites may allow much less |
| Offline fast hash | 10 billion guesses/sec | A GPU rig checking a fast hash from a stolen database |
| Massive cracking cluster | 100 trillion guesses/sec | A large, hypothetical fast-hash cracking setup |

The app displays readable durations such as “3 seconds,” “14 years,” or longer time spans. Very large estimates say “longer than the age of the universe”; a tooltip keeps the scientific value available. Calculations stay in log space so long inputs do not overflow.

Here's what those assumptions produce:

| Example | Bits used | Online: 100/sec | Fast hash: 10 billion/sec | Cluster: 100 trillion/sec |
| --- | ---: | --- | --- | --- |
| `Summer2024!` | 8.3 | About 1.6 seconds | Instantly, about 16 nanoseconds | Instantly, about 1.6 picoseconds |
| Random 20-character password | 131, illustrative | Beyond the universe's age, about 4.3 × 10²⁹ years | Beyond the universe's age, about 4.3 × 10²¹ years | Beyond the universe's age, about 4.3 × 10¹⁷ years |
| Six independently generated words | 72 | Beyond the universe's age, about 748 billion years | About 7,500 years, or 75 centuries | About 9 months |

The 20-character row assumes roughly 131 bits for randomly selected mixed characters. It's an example, not a fixed score for every 20-character string. The analyzer can find accidental patterns and report fewer bits. For the sub-second examples, “instantly” is the useful takeaway; a mathematical picosecond result is not a claim that a real system finishes an attack in picoseconds.

**These are estimates, not predictions.** Real attackers order guesses unevenly and may know things this model does not. A site's rate limits and password hashing settings matter a lot. The detailed simulator has separate algorithm and hardware assumptions; its controls do not change these three fixed comparison rates. All rates are editable in `CONFIG` inside `index.html`.

The detailed simulator uses separate assumptions for one high-end consumer GPU:

| Scenario | Guesses per second |
| --- | ---: |
| Online, rate limited | 100 per hour |
| Online, no rate limit | 1,000 |
| MD5 | 150 billion |
| NTLM | 250 billion |
| SHA-1 | 49 billion |
| SHA-256 | 21 billion |
| bcrypt, cost 12 | 1,400 |
| Argon2id | 100, explicitly an assumption |

The GPU figures are rounded estimates informed by public RTX 4090 hashcat benchmarks, not measurements made here. Bcrypt's cost and Argon2id's memory/time settings matter. Hardware options multiply only offline rows by 1, 8, or 1,000. Rates from the backend are public configuration, never measurements of the visitor's hardware.

## Backend and hosting

Keep `server.js`, `index.html`, `package.json`, and `render.yaml` at the repository root. The tests live in `tests/`. The backend uses Node's built-in modules and has no runtime dependencies.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | A small health response for the host and manual checks |
| `GET /api/config` | Public attack speeds and settings; the frontend uses these when available |
| `GET /api/breach/ABCDE` | Fetch the padded SHA-1 suffix range for one five-character hex prefix |

The server has no password-analysis endpoint, database, login system, or password storage. Those would not improve this project: the sensitive calculations belong in the browser. It rejects request bodies, query parameters, full hashes, and malformed prefixes. The breach proxy has an upstream timeout, bounded concurrency, and an in-memory rate limit. Rate limits are local to one running server; on a shared hosting proxy, multiple users may share a limit.

For the quickest full deployment, connect this GitHub repository to a **Render Node Web Service**. Build command: `node --check server.js`. Start command: `node server.js`. Health path: `/api/health`. Render supplies the port and HTTPS address. No database or API key is needed. [DEPLOY.md](DEPLOY.md) walks through the buttons and the included Blueprint option.

## Privacy

Your password, its full hash, and the analysis stay in your browser. There are no remote fonts, CDN scripts, analytics, or password uploads. Only the non-secret color-theme preference may be stored.

The optional online breach check is on by default. After a 600 ms pause in typing, the browser computes SHA-1 locally and sends **only the first five hexadecimal characters**. It compares the returned suffixes locally. When the Node backend is detected, the browser requests `/api/breach/PREFIX`; the server forwards that prefix to `https://api.pwnedpasswords.com/range/PREFIX` with `Add-Padding: true`. In standalone/static mode, the browser uses the same public API directly. The inspector shows which route was used, the exact application request, and the number of non-padding results.

The backend and breach provider can observe a hash prefix, timing, and network metadata. A prefix is less revealing than a password or full hash, but it is not information-free. This app does not log requests or store lookup ranges; a hosting provider can have its own access logs. The server temporarily tracks connection IPs for rate limiting. SHA-1 is used for this lookup protocol, not recommended for password storage.

Turning the online check off keeps password checks local. Inputs shorter than four code points skip online checks. Offline, disabled, failed, or timed-out lookups use the embedded common-password list; they are never presented as a successful online search. A local match says common/public, not proof of a particular breach. NOT FOUND does not mean safe. The UI's “FOUND IN N BREACHES” label displays exposure occurrences, not necessarily N separate incidents.

When served over HTTP(S), the frontend also requests the backend's public configuration. That request contains no password data. The Content Security Policy permits connections only to the current origin and the breach API. Analysis and generation still work without either service.

Passwords are not written to cookies, URLs, localStorage, or the backend. They do exist temporarily in the input, displayed token chips, and JavaScript memory while you use the app. Pressing COPY intentionally puts a value on your system clipboard. Sensitive copies are cleared after 30 seconds where browser permissions allow; focus, permissions, clipboard history, and other applications can prevent reliable clearing. COPY REPORT omits the password and its token text.

PANIC WIPE clears the input, results, generator output, and comparison, cancels pending requests, and stops animations and demos. The page also wipes on `pagehide`. This clears visible values and working references; JavaScript cannot promise forensic erasure from browser memory, screenshots, extensions, or clipboard history.

## Assumptions and limitations

- The pattern engine is an educational heuristic I wrote for this project. It is inspired by pattern-aware estimators, but it is not zxcvbn and has not been calibrated against a full cracking toolkit.
- The embedded data includes 307 common/public password examples, 601 English words, 120 first names, and 4,096 generator words. It misses plenty of languages, personal context, and attacker-specific dictionaries.
- “Realistic bits” describe estimated guessing effort. They are not a measurement of the randomness used to create an arbitrary typed password.
- The time formula assumes a fixed search space and a halfway point. Hardware scaling, hash parameters, memory costs, and attacker knowledge can change real outcomes. The massive-cluster rate is an illustrative assumption.
- The interface accepts up to 256 code points. Unicode's approximate pool size and code-point counting are simplifications, especially for composed emoji and visually similar characters.
- Secure generation depends on the browser's cryptographic random source. Clipboard access and local-file permissions vary by browser.
- This models guessing, not phishing, malware, stolen sessions, or account recovery attacks. Use unique passwords, a password manager, and 2FA or passkeys.

## Contributing

Issues and pull requests are welcome. A clear example of a missed pattern, confusing explanation, or browser problem is useful. Please use made-up or public sample passwords in reports, never a real secret.

Keep the frontend dependency-free and contained in `index.html`; the optional Node service stays in `server.js`. Keep the engine functions pure, preserve client-side password processing, and update the built-in self-tests when changing the math. Run `node --test tests/*.test.js` for the backend and breach client; those tests use controlled upstream responses and need no API credentials. Before opening a pull request, run `?selftest=1`, try the demo passwords, check a 390px-wide layout, and inspect network traffic to confirm only public configuration and five-character breach prefixes are sent. Check the online-disabled and offline paths too. If a change affects a time estimate, include the bits, rate, and expected result so someone else can check it.

## License

The application code is MIT licensed. The embedded datasets keep their own notices:

- The common-password samples come from the first 300 entries of [SecLists' common-password list](https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt), plus seven public demo/common values. SecLists' MIT notice is retained in `index.html`.
- The generator words are a modified 4–7 letter subset of the [EFF large wordlist](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt), by Joseph Bonneau / EFF (2016), under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The subset contains 4,096 words and omits the original dice indices. Attribution and modification notes are retained in `index.html`.
- The small English-word and name lists were curated for this project.

Those links are source references in this README. The app does not load them.

```text
MIT License

Copyright (c) 2026 Mr Deadron

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
