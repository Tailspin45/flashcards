# Flashcards

Minimal Electron flashcards app extracted from Zipcatcher.

## Run from source

```bash
cd flashcards
npm ci
npm run start
```

Notes:
- Deck file: `flashcards.csv` (bundled) or set `FLASHCARDS_CSV_PATH` to point elsewhere.
- Per-user state saved in Electron `userData` as `flashcards-state.json`.

## Downloads

Pre-built binaries are produced by CI and attached to each release. Two
files are published per platform along with a `SHA256SUMS.txt` for
integrity verification.

### macOS

- `Flashcards-<version>-universal.dmg` — runs on both Apple Silicon and
  Intel Macs.
- Code-signed by **Aerodite, Inc.** and notarized by Apple. The DMG ticket
  is stapled, so Gatekeeper does not need an internet connection at
  install time.

### Windows

- `Flashcards Setup <version>.exe` — NSIS installer.
- `Flashcards <version>.exe` — portable single-file build.
- **Not currently code-signed.** On first launch Windows shows a
  SmartScreen warning:

  > **Windows protected your PC**
  > Microsoft Defender SmartScreen prevented an unrecognized app from
  > starting. Running this app might put your PC at risk.

  To proceed, click **More info** → **Run anyway**. The warning only
  appears the first time after download. The app itself is unchanged and
  runs identically to a signed build.

  Anyone who wants to verify the download before running it can check the
  hash against `SHA256SUMS.txt`:

  ```powershell
  # PowerShell
  Get-FileHash "Flashcards Setup 0.1.0.exe" -Algorithm SHA256
  ```

  Then confirm the printed hash matches the corresponding line in
  `SHA256SUMS.txt`.

## Verifying integrity

`SHA256SUMS.txt` is published alongside every release with one line per
artifact, e.g.:

```
abc123…  Flashcards-0.1.0-universal.dmg
def456…  Flashcards Setup 0.1.0.exe
789aaa…  Flashcards 0.1.0.exe
```

On macOS or Linux:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

On Windows:

```powershell
Get-FileHash *.exe -Algorithm SHA256
```

## Code signing roadmap

- **macOS**: signed + notarized today via Aerodite Developer ID.
- **Windows**: unsigned today. See [`docs/WINDOWS_SIGNING.md`](docs/WINDOWS_SIGNING.md)
  for the planned upgrade to Azure Trusted Signing, which will remove the
  SmartScreen warning for downstream users.
