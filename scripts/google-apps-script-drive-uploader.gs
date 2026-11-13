/**
 * Google Apps Script — Developa Store Image Uploader to Google Drive
 * 
 * Instructions to Deploy (Takes 2 minutes):
 * 1. Go to https://script.google.com and click "New project".
 * 2. Delete any code in Code.gs, paste this entire file, and click "Save" (Disk icon).
 * 3. Click "Deploy" (top right) -> "New deployment".
 * 4. Select type: "Web app" (click the gear icon -> Web app).
 * 5. Set:
 *    - Description: "Developa Image Uploader"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (allows your store app to send uploads)
 * 6. Click "Deploy", authorize access with your Google account.
 * 7. Copy the "Web app URL" (starts with https://script.google.com/macros/s/...)
 * 8. Add it to your project's .env.local:
 *    GOOGLE_APPS_SCRIPT_UPLOAD_URL="https://script.google.com/macros/s/..."
 *    DRIVE_UPLOAD_SECRET="your-own-secret-password-optional"
 */

var FOLDER_NAME = "Developa Store Uploads";
var SHARED_SECRET = "developa_drive_upload_secret_2026"; // Change to match DRIVE_UPLOAD_SECRET in your .env

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ error: "No post data received" }, 400);
    }

    var data = JSON.parse(e.postData.contents);

    // Optional secret token verification
    if (data.secret && data.secret !== SHARED_SECRET) {
      return responseJson({ error: "Invalid secret key" }, 403);
    }

    if (!data.base64Data) {
      return responseJson({ error: "Missing base64Data" }, 400);
    }

    var mimeType = data.mimeType || "image/jpeg";
    var fileName = data.fileName || ("product_" + new Date().getTime() + ".jpg");

    // Get or create dedicated Drive folder
    var folder;
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // Decode base64
    var decodedBytes = Utilities.base64Decode(data.base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Create file in folder
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();

    // Direct image embed URL (compatible with Next.js & mobile browsers)
    var directImageUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    var downloadUrl = file.getDownloadUrl();
    var viewUrl = file.getUrl();

    return responseJson({
      success: true,
      fileId: fileId,
      url: directImageUrl,
      viewUrl: viewUrl,
      downloadUrl: downloadUrl
    }, 200);

  } catch (err) {
    return responseJson({ error: err.toString() }, 500);
  }
}

function doGet(e) {
  return responseJson({ status: "Developa Google Drive Upload Service is Active" }, 200);
}

function responseJson(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
