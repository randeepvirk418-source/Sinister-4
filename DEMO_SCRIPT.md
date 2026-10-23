# CRACKPROOF — Vibeathon 2026 demo

**Graphic Era Hill University · Made by Mr Deadron**

Tagline: **“Type a password. Watch it die. Learn why.”**

## Two-minute live pitch

Before presenting: run `node server.js` and open the served page, or open `index.html` for the standalone backup, skip the boot sequence if needed, use the green theme, leave hardware at **1 GPU** and attacker at **smart**. Use the built-in presets to avoid typing mistakes. Check live breach connectivity beforehand; offline fallback is a supported demonstration mode. Use only the public examples below, never your own password.

| Time | Action / exact input | What to say |
| --- | --- | --- |
| 0:00–0:12 | Show the idle screen and privacy bar. | “Most password meters reward symbols. CRACKPROOF asks a better question: what would an attacker guess first? Everything analyzing the password runs inside this single HTML file.” |
| 0:12–0:29 | Select or type `password123`. | “This is long enough to look plausible, but it's a common leaked password. We force CRITICAL. A dictionary attack doesn't search every possible string first.” |
| 0:29–0:49 | Select or type `Summer2024!`. Point to the gap and token chips. | “Here is the trap: a capital, digits, and punctuation inflate the naive estimate. The attacker sees a common word, a year, and a predictable suffix. The gap between these two numbers is our lesson.” |
| 0:49–1:01 | Select `P@ssw0rd`, then `qwertyuiop`. | “Replacing letters with symbols doesn't erase the word. A keyboard walk isn't random either. Our matcher recognizes both.” |
| 1:01–1:11 | Select `Tr0ub4dor&3`, then `correct horse battery staple`. | “Complex-looking text needs context. And this famous phrase is public: don't reuse a teaching example as a real secret.” |
| 1:11–1:31 | Return to `Summer2024!`. Point to MD5 and bcrypt. Switch to the **8 GPU rig**, then back to **1 GPU**. | “The site's storage choice changes the answer by orders of magnitude. Online rate limits and offline stolen-database attacks are very different situations. These are transparent estimates, not actual attacks.” |
| 1:31–1:44 | Click the **random 20-character** preset. Optionally RUN ATTACK, then skip. | “This one is generated with the browser's cryptographic randomness. The animation only illustrates the math; no password or hash is being attacked.” |
| 1:44–1:53 | Use **SHOW ME A STRONGER ONE** to compare a generated six-word passphrase without changing the input. | “Six independent choices from our 4,096-word list give 72 bits of generation entropy, and can be easier to type. The analyzer is a separate conservative estimate.” |
| 1:53–2:00 | Open the network inspector; finish on privacy bar and habits. | “The optional breach request sends only a five-character hash prefix. Unique passwords, a password manager, and 2FA or passkeys are the habits that matter.” |

The exact preset sequence is:

1. `password123`
2. `Summer2024!`
3. `P@ssw0rd`
4. `qwertyuiop`
5. `Tr0ub4dor&3`
6. `correct horse battery staple`
7. A freshly generated random 20-character password — deliberately different every time.

RUN DEMO presents the presets automatically over approximately 66.5 seconds with teaching captions. RUN ATTACK visualizes MD5 with the current hardware and attacker setting; its random decoys are not password guesses. Any key or Esc stops the guided demo. For the two-minute pitch above, use manual presets so you can respond to the room. If live breach checking is unavailable, show the explicit OFFLINE/local-list status and explain the fallback; do not describe it as a successful live API check.

## Ten likely judge questions

1. **Is the breach API call really client-side?**

   Hashing and suffix matching are client-side. The browser sends only five hash hex characters. In the hosted Node version, our backend forwards that prefix to Pwned Passwords with `Add-Padding: true`; standalone mode calls the service directly. Neither route sends the password or full hash. The backend, provider, and hosting infrastructure can observe the prefix and request timing; they can also see network metadata.

2. **How accurate are the crack times?**

   They are explainable estimates, not predictions. The guess model is heuristic and the speeds are rounded hardware assumptions. Hash parameters, attacker knowledge, hardware, and guessing order change real results. The useful lesson is the relative difference between patterns, online limits, and hash algorithms.

3. **Are you actually cracking my password?**

   No. There is no hash-cracking implementation, login attempt, password-file reader, or attack connection. We divide an estimated guess count by configured speeds. The decoy strings and progress animation are visual teaching aids.

4. **Why show two entropy numbers?**

   The naive number assumes independent uniformly selected characters. Human choices have structure. The second estimate uses dictionary, date, keyboard, repetition, and substitution matches to show how a smarter guess order can be much cheaper.

5. **Why is `Summer2024!` weak when it meets common password rules?**

   Composition rules don't remove predictability. A common word followed by a recent year and an exclamation mark is an early candidate in many guessing strategies. The attacker token view makes that reason visible.

6. **Does NOT FOUND mean a password is safe?**

   No. It only means no exact match was found in the queried corpus at that time. A new, targeted, or unreported password can still be weak. Offline mode checks only the small embedded list. API occurrence counts are not a count of independent breaches.

7. **Why can six words be stronger than complicated punctuation?**

   If each word is chosen independently and uniformly from a known list, each adds `log2(list size)` bits. Our 4,096-word EFF-derived subset gives 12 bits per word, or 72 for six words. A human-selected quote or public example doesn't have that same randomness. Our generator uses `crypto.getRandomValues` and rejection sampling, not `Math.random`.

8. **Why compare MD5, bcrypt, and Argon2id?**

   A fast general-purpose hash lets attackers test vastly more guesses after a database theft. Password-storage algorithms make each guess expensive. Bcrypt cost 12 has a specific cost factor; the Argon2id rate here is explicitly an assumption because its memory and time parameters matter greatly.

9. **What is original, and what are the limitations?**

   This app's pattern matcher and dynamic-programming cover are written for this project, inspired by the approach of pattern-aware estimators. It uses no framework or copied zxcvbn engine. It embeds 307 common/public password examples, 601 English words, 120 names, and 4,096 EFF-derived generator words, with source and license notices. These dictionaries and heuristic costs are incomplete, favor English patterns, and are less comprehensive than a mature production estimator.

10. **Would you ship this as a security guarantee?**

    No. It's a privacy-conscious educational tool, not a certification or authentication system. We would calibrate costs against representative attacker rule sets, expand language coverage, audit accessibility and browser behavior, and independently review the implementation before broader security use. Unique passwords, a password manager, and 2FA or passkeys remain the recommendation.

## Six-slide outline

1. **The composition-rule illusion**

   Title and tagline. Show `Summer2024!` and ask: “Strong to a checklist, or strong against an attacker?”

2. **Two estimates, one visible lesson**

   Naive character-pool formula versus pattern-aware guess count. Show `[summer] [2024] [!]` and the bits gap. Explain the cheapest cover in one sentence.

3. **The attacker changes the answer**

   Rate-limited online guesses versus stolen-database attacks. Compare MD5 and bcrypt; label every speed an assumption. Show hardware scaling separately.

4. **Privacy you can inspect**

   Browser-only computation → SHA-1 prefix request → local suffix comparison. Show five hex characters leaving, zero password bytes, optional online checking, and offline fallback. Mention prefix/IP leakage honestly.

5. **From warning to a better choice**

   Ranked improvement tips, secure 20-character generation, six-word passphrase comparison, and the three habits: uniqueness, password manager, 2FA/passkeys.

6. **A working demo with honest boundaries**

   One self-contained HTML frontend, an optional zero-dependency Node backend, offline capability, self-tests, mobile view, and reduced-motion support. State the limits: heuristic guesses, rounded speeds, incomplete breach coverage. Close with “Type a password. Watch it die. Learn why.”

## Demo recovery checklist

- If network lookup times out, explain the local fallback and keep presenting; analysis and generation do not depend on the API.
- If clipboard permissions are denied, show the output in the generator and continue. Browser permissions are not password-strength failures.
- If an animation or the automated tour takes too long, use its skip control or press Esc to stop the tour.
- If the live browser behaves unexpectedly, show the built-in self-test overlay and describe its actual PASS/FAIL output rather than claiming a pass you have not seen.
- End with PANIC WIPE before handing the device to someone else.

For the full hosted version, follow [DEPLOY.md](DEPLOY.md). Keep passwords in the browser; the optional backend only serves public settings and forwards five-character prefixes.
