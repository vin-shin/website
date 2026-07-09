// Scans photos/ for image files, pulls EXIF date/time/GPS from each, reverse-geocodes
// any GPS coordinates into a place name (cached), generates a small compressed thumbnail
// for the gallery grid, and writes photos-data.js for photos.html. The lightbox still
// loads the full-resolution original when a photo is opened.
//
// Usage: npm run build:photos

import { readdir, stat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PHOTOS_DIR = path.join(ROOT, 'photos');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');
const OUTPUT_FILE = path.join(ROOT, 'photos-data.js');
const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');
const OVERRIDES_FILE = path.join(__dirname, 'photo-overrides.json');
const CONTACT_EMAIL = 'vinshin623@gmail.com';
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const THUMB_WIDTH = 900;
const THUMB_QUALITY = 78;

async function loadOverrides() {
  if (!existsSync(OVERRIDES_FILE)) return {};
  try {
    return JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
}

function cacheKey(lat, lon) {
  // Rounded to ~110m; nearby photos reuse the same lookup.
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

async function reverseGeocode(lat, lon, cache) {
  const key = cacheKey(lat, lon);
  if (key in cache) return cache[key];

  let location = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12`;
    const res = await fetch(url, {
      headers: { 'User-Agent': `vin-shin-portfolio-build/1.0 (${CONTACT_EMAIL})` },
    });
    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};
      const place = a.city || a.town || a.village || a.hamlet || a.county;
      const region = a.state || a.country;
      location = [place, region].filter(Boolean).join(', ') || data.display_name || null;
    }
  } catch (err) {
    console.warn(`Reverse geocode failed for ${lat},${lon}: ${err.message}`);
  }

  cache[key] = location;
  await saveCache(cache);
  await sleep(1100); // Nominatim usage policy: max 1 request/sec
  return location;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  // Local calendar date (EXIF timestamps have no timezone) — toISOString()
  // would shift to UTC and can roll the date to the next/previous day.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toTimeString().slice(0, 5); // HH:MM (local time the photo was taken)
}

function titleCaseMake(make) {
  if (!make) return null;
  return /^[A-Z0-9 ]+$/.test(make) ? make.charAt(0) + make.slice(1).toLowerCase() : make;
}

async function ensureThumb(file, filePath, sourceMtime) {
  const thumbName = `${path.parse(file).name}.jpg`;
  const thumbPath = path.join(THUMBS_DIR, thumbName);

  if (existsSync(thumbPath)) {
    const { mtime: thumbMtime } = await stat(thumbPath);
    if (thumbMtime >= sourceMtime) return `photos/thumbs/${thumbName}`;
  }

  await sharp(filePath)
    .rotate() // apply EXIF orientation before stripping metadata
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toFile(thumbPath);

  return `photos/thumbs/${thumbName}`;
}

async function main() {
  if (!existsSync(PHOTOS_DIR)) {
    console.error(`No photos/ folder found at ${PHOTOS_DIR}`);
    process.exit(1);
  }

  await mkdir(THUMBS_DIR, { recursive: true });

  const entries = await readdir(PHOTOS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    console.warn('No photos found in photos/. Writing an empty gallery.');
  }

  const cache = await loadCache();
  const overrides = await loadOverrides();
  const photos = [];

  for (const file of files) {
    const filePath = path.join(PHOTOS_DIR, file);
    const override = overrides[file] || {};
    let exif = {};
    try {
      exif = (await exifr.parse(filePath, { gps: true, exif: true, tiff: true })) || {};
    } catch (err) {
      console.warn(`Could not read EXIF from ${file}: ${err.message}`);
    }

    const takenAt = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || null;
    const { mtime } = await stat(filePath);
    const thumb = await ensureThumb(file, filePath, mtime);

    let location = override.location ?? null;
    if (!location && typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
      location = await reverseGeocode(exif.latitude, exif.longitude, cache);
    }

    const camera = override.camera ?? [titleCaseMake(exif.Make), exif.Model].filter(Boolean).join(' ') ?? null;
    const date = override.date ?? formatDate(takenAt);
    const time = override.time ?? formatTime(takenAt);
    const focalLength =
      override.focalLength ?? (typeof exif.FocalLength === 'number' ? Math.round(exif.FocalLength * 10) / 10 : null);
    const aperture =
      override.aperture ?? (typeof exif.FNumber === 'number' ? Math.round(exif.FNumber * 10) / 10 : null);

    photos.push({
      file,
      src: `photos/${file}`,
      thumb,
      date,
      time,
      location,
      lat: typeof exif.latitude === 'number' ? exif.latitude : null,
      lon: typeof exif.longitude === 'number' ? exif.longitude : null,
      camera: camera || null,
      focalLength,
      aperture,
      sortKey: (
        override.date
          ? new Date(`${override.date}T${override.time || '00:00'}`)
          : takenAt instanceof Date && !Number.isNaN(takenAt.getTime())
            ? takenAt
            : mtime
      ).getTime(),
    });
  }

  photos.sort((a, b) => b.sortKey - a.sortKey); // newest first
  photos.forEach((p) => delete p.sortKey);

  const banner =
    '// Auto-generated by scripts/build-photos.mjs — do not edit by hand.\n' +
    '// Run `npm run build:photos` after adding/removing files in photos/.\n';
  const body = `const photos = ${JSON.stringify(photos, null, 2)};\n`;
  await writeFile(OUTPUT_FILE, banner + body);

  console.log(`Wrote ${photos.length} photo(s) to ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
