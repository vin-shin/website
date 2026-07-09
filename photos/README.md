Drop photo files here (`.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif`).

Then from the project root run:

```
npm install
npm run build:photos
```

This reads each photo's EXIF metadata (date/time taken, and GPS location if
present), generates a small compressed thumbnail in `photos/thumbs/` for the
gallery grid (the lightbox still loads the full-resolution original), and
regenerates `photos-data.js`, which `photos.html` reads to build the gallery.
Re-run the command any time you add or remove photos, then commit the photo
files together with `photos/thumbs/` and the updated `photos-data.js`.
