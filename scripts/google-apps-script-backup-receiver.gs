/**
 * Google Apps Script: Developa backup receiver.
 *
 * Receives the nightly encrypted backup from the app and saves it in a PRIVATE Google Drive folder (never shared).
 * The files are already encrypted before they leave the server, so Google only ever holds scrambled data.
 *
 * Deploy: script.google.com, New project, paste this file, set SHARED_SECRET below (a long random value that equals
 * DRIVE_BACKUP_SECRET in the app), then Deploy, New deployment, type Web app, Execute as: Me, Who has access: Anyone
 * (the secret is what protects it). Copy the web app URL into DRIVE_BACKUP_URL in the app.
 */

var FOLDER_NAME = 'Developa Backups (private)';
var SHARED_SECRET = 'CHANGE-ME-long-random-secret';
var KEEP_DAYS = 14; // older backups are moved to the Drive trash

function doPost(e) {
  try {
    if (SHARED_SECRET.indexOf('CHANGE-ME') === 0) return out({ error: 'Set SHARED_SECRET first' });
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.secret !== SHARED_SECRET) return out({ error: 'denied' });
    if (!d.base64Data || !d.fileName) return out({ error: 'missing data' });

    var folder = getFolder();
    var bytes = Utilities.base64Decode(d.base64Data);
    var blob = Utilities.newBlob(bytes, 'application/octet-stream', String(d.fileName).slice(0, 120));

    // Re-running on the same day replaces that day's file instead of piling up copies.
    var same = folder.getFilesByName(blob.getName());
    while (same.hasNext()) same.next().setTrashed(true);
    folder.createFile(blob);

    prune(folder);
    return out({ ok: true, name: blob.getName(), bytes: bytes.length });
  } catch (err) {
    return out({ error: String(err) });
  }
}

function doGet() {
  return out({ ok: true, service: 'developa-backup-receiver' });
}

function getFolder() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME); // new folders are private by default
}

function prune(folder) {
  var cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000);
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
