Drop photo files here (`.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif`).

Then from the project root run:

```
npm install
npm run build:photos
```

This reads each photo's EXIF metadata (date/time taken, and GPS location if
present) and regenerates `photos-data.js`, which `photos.html` reads to build
the gallery. Re-run the command any time you add or remove photos, then
commit the photo files together with the updated `photos-data.js`.
