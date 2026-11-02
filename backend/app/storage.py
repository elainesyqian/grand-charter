"""File storage interface. Local disk now; S3 later behind the same functions.

- save(stream, max_bytes) -> (storage_key, size): stream to STORAGE_DIR/<uuid>.pdf, enforce size
  limit while reading, reject empty files and files not starting with b"%PDF-".
- open(storage_key) -> binary stream.
- delete(storage_key): used to clean up if the DB insert fails after the file was written.
User-supplied filenames are display-only and never touch the filesystem path.
"""
