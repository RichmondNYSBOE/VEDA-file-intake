// TODO: This file appears to be unused (superseded by upload-wizard.tsx). Remove after confirming with team.

import admin from "firebase-admin";

if (!admin.apps.length) {
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    console.warn(
      "No GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT env var set — " +
        "Firebase Admin will rely on Application Default Credentials.",
    );
  }

  admin.initializeApp(projectId ? { projectId } : undefined);
}

export const db = admin.firestore();
