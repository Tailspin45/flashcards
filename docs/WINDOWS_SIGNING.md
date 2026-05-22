# Windows code signing — upgrade path

The current `windows-build.yml` workflow produces an **unsigned** Windows
build. Users will see a Microsoft Defender SmartScreen warning on first
launch ("Windows protected your PC"). The app still runs after clicking
"More info" → "Run anyway", but it looks unprofessional and may be blocked
by some corporate IT policies.

## Options for signing, ranked

### 1. Azure Trusted Signing (recommended)

Microsoft's modern, cloud-managed alternative to traditional code-signing
certificates. Works inside GitHub-hosted runners (no self-hosted Windows
runner required, no hardware token).

- Cost: ~$10/month + per-signature fees
- Pre-req: Azure subscription, Microsoft Partner Center identity
  verification (typically 1–3 business days)
- Docs: https://learn.microsoft.com/en-us/azure/trusted-signing/

To wire it into the workflow, add the `Azure/trusted-signing-action` step
between `Install dependencies` and `Build`, and have electron-builder sign
via the `signtoolOptions.sign` hook.

### 2. OV code-signing certificate (.pfx)

Older, cheaper option. The cert is delivered as a `.pfx` file that you
base64-encode into a GitHub secret.

- Cost: ~$80–$200/year (SSL.com, Sectigo, etc.)
- Pre-req: business identity validation (1–5 business days)
- After purchase:
  1. Base64-encode the .pfx: `base64 -w0 cert.pfx > cert.pfx.b64`
  2. Add repo secrets:
     - `WIN_CSC_LINK` = contents of `cert.pfx.b64`
     - `WIN_CSC_KEY_PASSWORD` = the .pfx password
  3. Uncomment the two `CSC_*` lines in `.github/workflows/windows-build.yml`
  4. electron-builder will sign automatically.

Note: as of June 2023, Microsoft requires **all new** code-signing certs
to be stored on a hardware token (HSM/USB) or use cloud signing. OV `.pfx`
files are still issued by some CAs that pre-stage signing in their cloud
HSM and let you download a signed artifact, but increasingly the path is
Azure Trusted Signing or SSL.com's eSigner.

### 3. EV code-signing certificate (hardware token)

Best SmartScreen reputation (no warning even on first install) but cannot
be used from GitHub-hosted runners — the cert is physically on a USB token.

You'd need either:
- A self-hosted Windows runner with the token plugged in, or
- A cloud signing service like SSL.com eSigner that proxies token access.

Not recommended unless you ship to enterprise customers who require EV.

## What about SmartScreen reputation?

Even a signed binary gets a SmartScreen warning the first time it's
distributed — Microsoft needs to see "enough" installs from "enough"
distinct users before the reputation flips to clean. EV certs skip this
ramp-up; OV certs and Trusted Signing do not.
