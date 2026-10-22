# De Stijl × Ukiyo-e local acceptance

Date: 2026-10-23

Reference: https://tasteux.com/#mix=de-stijl+ukiyo-e

## Scope

Local UI only; no GitHub commit, push or deployment. Preserve the existing backend and editing workflows. The user's cream-paper override is `#f7f4ec`.

## Design checks

- Orthogonal, asymmetric rectangular sections and dark grid dividers: checked.
- No rounded-card, diagonal structural or shadow-based visual system: checked.
- Prussian blue, vermilion and ochre accents on predominantly cream paper: checked.
- Vermilion strips carry no small text; blue/white contrast is approximately 8.02:1, ochre/ink approximately 7.40:1.
- New woodblock-style artwork loads at 1024×1536 from `/assets/ukiyo-stijl-v4.png`.

## Executed validation

- Implementation agent: `npm run build` passed.
- Final review agent: `npm run check` passed; `node --test tests/post-editor.test.mjs tests/fixtures/preview-smoke.mjs` passed all 22 tests; `git diff --check` passed with line-ending notices only.
- Browser: desktop 1440×900 and mobile 390×844 checked. No horizontal document overflow at either viewport.
- Browser: mobile navigation, article directory, article editor, publication dates/settings and rendered preview tabs opened successfully.
- Final review found no confirmed blocking regression in this visual change. `api/admin.js` is unchanged; demo fixtures do not send GitHub requests.

## Limitations

This is a local, in-memory demo. Real GitHub writes and Vercel deployment were not exercised. Browser screenshot display succeeded, but saving a screenshot file was denied by the browser runtime; no saved screenshot artifact is claimed.
