# Googledrive-mp4-extractor

Turn Google Drive share links into direct MP4/MOV/MKV URLs for VLC, Infuse, and nPlayer — no backend, no installs, just deploy and go.

## What it does

Google Drive share links (`drive.google.com/file/d/…`) don't work directly in media players. This tool converts them into stream-ready URLs you can paste straight into VLC, Infuse, nPlayer, or any app that accepts direct links.

Everything runs in your browser. There's no server, no account, and nothing to install.

---

## Usage

1. Deploy the service on Vercel
2. Paste your Google Drive share URL
3. Copy the generated direct link
4. Open it in your media player of choice

---

## Compatibility

| App | Platform | Status |
|-----|----------|--------|
| VLC | iOS, Android, Desktop | ✅ |
| Infuse | iOS, tvOS, macOS | ✅ |
| nPlayer | iOS, Android | ✅ |
| Any direct-link player | — | ✅ |

---

## Supported URL formats

The parser supports common Google Drive + Google Docs URL shapes and extracts either the `FILE_ID` (or `FOLDER_ID` for folder links):

```
// Standard share/view
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/open?id=FILE_ID

// Direct download
https://drive.google.com/uc?export=download&id=FILE_ID
https://docs.google.com/uc?export=download&id=FILE_ID
https://drive.google.com/uc?export=view&id=FILE_ID

// Native Google Docs/Sheets/Slides edit links
https://docs.google.com/document/d/FILE_ID/edit
https://docs.google.com/document/d/FILE_ID/edit?usp=sharing
https://docs.google.com/spreadsheets/d/FILE_ID/edit
https://docs.google.com/presentation/d/FILE_ID/edit

// Preview/embed
https://docs.google.com/document/d/FILE_ID/preview
https://docs.google.com/spreadsheets/d/FILE_ID/preview
https://docs.google.com/presentation/d/FILE_ID/preview

// Copy-to-drive
https://docs.google.com/document/d/FILE_ID/copy
https://docs.google.com/document/d/FILE_ID/copy?userstoinvite=email@example.com

// Export links (Docs, Sheets, Slides, Drawings)
https://docs.google.com/document/d/FILE_ID/export?format=pdf
https://docs.google.com/spreadsheets/d/FILE_ID/export?format=xlsx
https://docs.google.com/presentation/d/FILE_ID/export/pdf
https://docs.google.com/presentation/d/FILE_ID/export/png?pageid=p10
https://docs.google.com/drawings/d/FILE_ID/export/svg

// Web viewer (valid URL, no file ID in this shape)
https://docs.google.com/viewer?url=...

// Folder links
https://drive.google.com/drive/folders/FOLDER_ID
https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing

// Resource key variant (newer secure links)
https://drive.google.com/file/d/FILE_ID/view?usp=sharing&resourcekey=KEY

// Raw ID still supported
FILE_ID
```

---

## Requirements

- The file must be set to **"Anyone with the link can view"** in Google Drive sharing settings
- The file must be an MP4 (or other direct-playable format)

---

## Deploy (One-click-depoly)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/DisabledAbel/gdrive-mp4-extractor)

---

## How it works

The tool extracts the file ID from your share URL and constructs a `drive.google.com/uc?export=download&id=FILE_ID` link, which Google Drive serves as a direct download/stream endpoint compatible with media players.

---

## Notes

- Large files (>100MB) may hit Google's virus-scan confirmation page. Some players handle this automatically; others may not.
- Links are not permanent — if the file owner changes permissions or deletes the file, the link will stop working.
- This tool does not upload, store, or transmit your URLs anywhere.

---

## License

MIT
