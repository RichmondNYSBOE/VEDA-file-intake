# VoteVault User Guide

Welcome to **VoteVault**, the secure platform used by New York State election authorities to submit and manage election data. This guide will walk you through everything you need to know to get started.

---

## Table of Contents

1. [Overview](#overview)
2. [Your Dashboard](#your-dashboard)
3. [Creating an Election Event](#creating-an-election-event)
4. [Using the Election Name in Your Files](#using-the-election-name-in-your-files)
5. [Uploading Files](#uploading-files)
6. [File Requirements](#file-requirements)
7. [Attestations](#attestations)
8. [Amending a Submission](#amending-a-submission)
9. [Certifying No Elections](#certifying-no-elections)
10. [Checking Your Compliance Status](#checking-your-compliance-status)
11. [Getting Help](#getting-help)

---

## Overview

VoteVault is where your election authority submits required election data to the New York State Board of Elections. For each election your authority conducts, you will:

1. **Create an election event** in VoteVault.
2. **Upload four data files** — Poll Sites, Election Results, Voter History, and District Maps.
3. **Track your compliance status** on the dashboard until all files are submitted.

If your authority did not hold any elections during a given year, you can certify that instead.

---

## Your Dashboard

When you log in, you will see your **Dashboard**. This is your home base. From here you can:

- **View your election events** — Each event is shown as a card with its name, date, and file upload progress.
- **Create a new election event** — Use the "New Election Event" button in the top-right area.
- **Upload files** — Click "Upload Files" on any election event card to begin.
- **View your submission history** — Click the "History" button to see a log of all past uploads.
- **Certify no elections** — If your authority held no elections in a given year, use the "No Elections" button.

On the right side of the dashboard, you will find helpful resources including this guide, an FAQ, the Data Dictionary, and contact information.

---

## Creating an Election Event

Before you can upload any files, you need to create an election event. Here is how:

1. From the Dashboard, click **"New Election Event"** (or "Create Your First Election Event" if this is your first time).
2. A dialog will appear with the following fields:
   - **Election Date** — Select the date of the election.
   - **Election Type** — Choose the type of election from the dropdown (e.g., General, Primary, Special, etc.).
   - **Certification Date** — Enter the date the election results were certified.
   - **Filing Type** — Select "Original" for a first-time submission. If you are re-submitting corrected data, choose "Amended" and provide the amendment date.
3. As you fill in these fields, VoteVault will automatically generate an **Election Name** at the bottom of the dialog. This name combines the election date, type, and your authority name into a standardized format.
4. Click **"Create Election Event"** to save.

> **Important:** After creating the event, use the **copy button** next to the election name to copy it to your clipboard. You will need this name in your data files.

---

## Using the Election Name in Your Files

Every data file you upload must include the correct **Election Name** so VoteVault can match it to the right election event. Here is what to do:

1. When you create an election event, VoteVault generates a standardized election name (for example: *"2025 General Election — Albany County Board of Elections"*).
2. Use the **copy button** in the election creation dialog to copy the exact name.
3. In your CSV files, paste this name into the **`Election_Name`** column for every row of data.
4. The name must match exactly — including spacing, capitalization, and punctuation — for validation to succeed.

This ensures that all of your uploaded data is properly linked to the correct election event.

---

## Uploading Files

Each election event requires four types of files. VoteVault walks you through each one using a step-by-step upload wizard.

### Starting an Upload

1. On the Dashboard, find the election event card you want to work on.
2. Click **"Upload Files"** to open the upload wizard.
3. You will see a progress bar at the top showing how many of the four files have been submitted.
4. Use the step list on the left side to navigate between file types.

### The Four File Types

| Step | File Type | Description |
|------|-----------|-------------|
| 1 | **Poll Sites** | Locations where voters cast their ballots |
| 2 | **Election Results** | Vote counts, candidates, and outcomes |
| 3 | **Voter History** | Voter participation records |
| 4 | **District Maps** | Geographic boundary files for districts |

### Two Ways to Submit Data

**Option A: Upload a File**
- Drag and drop your file into the upload area, or click to browse your computer.
- Accepted formats: `.csv`, `.xlsx`, `.xls`, or `.json` (for Poll Sites, Election Results, and Voter History). District Maps accept `.zip` (shapefile) or `.geojson`.

**Option B: Paste Your Data** *(Poll Sites, Election Results, and Voter History only)*
- Open your spreadsheet (Excel, Google Sheets, etc.).
- Select all your data **including the header row**.
- Copy it (Ctrl+C on Windows, Cmd+C on Mac).
- Paste it into the text box in VoteVault.
- Click **"Analyze Pasted Data"** to proceed.

### Column Matching

After you provide your data, VoteVault checks that your column headers match the expected format:

- **All columns match** — You are good to go. Proceed to upload.
- **Columns automatically matched** — VoteVault recognized your columns even though the order was different. Review the mapping to confirm.
- **Some headers need review** — A few columns could not be matched automatically. Click **"Map Columns"** to manually assign them.
- **Columns do not match** — The file structure is too different from what is expected. Check that you are uploading the correct file type.

You can click **"Review Mapping"** at any time to see exactly how your columns are being matched.

### Data Preview

Before uploading, VoteVault shows you a preview of the first few rows of your data. Take a moment to review it and confirm everything looks correct.

### Completing the Upload

Once you are satisfied with the column mapping and data preview, click **"Upload File"** (or **"Upload Data"** if you pasted). You will see a confirmation message when the upload succeeds.

If you are not ready to upload a particular file type, you can click **"Skip for Now"** and come back later.

---

## File Requirements

Keep these requirements in mind when preparing your files:

- **Maximum file size:** 5 MB per file
- **Accepted formats:** CSV, XLSX, XLS, or JSON (District Maps accept ZIP or GeoJSON)
- **Date format:** MM/DD/YYYY (for example: 03/15/2025)
- **Headers required:** Your file must include a header row with the correct column names
- **Election Name column:** Must contain the exact election name generated by VoteVault
- **Data validation:** VoteVault checks the first several rows of your data for correct data types (text, numbers, dates, etc.)

For a complete list of required columns and their definitions, refer to the **Data Dictionary** in the sidebar.

---

## Attestations

In some cases, you may not need to upload a new file. If certain data has not changed since your last submission, you can **attest** to that instead.

### When Are Attestations Available?

Attestations are available for **Poll Sites** and **District Maps** only, and only if you have a prior submission on file.

### Poll Sites Attestation

If your poll site locations have not changed since the previous election:

1. In the upload wizard, go to the **Poll Sites** step.
2. You will see an option: **"Attest to Unchanged Poll Sites."**
3. Click **"Attest — No Changes."**
4. A confirmation dialog will appear. Review the statement and click **"Yes, Submit Attestation"** to confirm.

### District Maps Attestations

For district maps, you have two attestation options:

1. **No Change Attestation** — Your district boundaries have not changed since the last election.
2. **State GEO Map Attestation** — You are relying on state-provided maps rather than uploading your own.

Select the appropriate option and confirm.

> **Note:** Attestations are recorded and publicly visible. Only submit an attestation if the information is accurate.

---

## Amending a Submission

If you need to correct a file you have already uploaded, you can submit an amended version.

### How to Amend

1. From the Dashboard, click **"Upload Files"** (or **"View Files"**) on the election event.
2. Navigate to the file type you need to correct.
3. Upload your corrected file. VoteVault will display a warning: *"Uploading a new file will replace the current submission."*
4. In the **Amendment Notes** text box, briefly describe the reason for the change (for example: "Corrected vote totals for District 5").
5. Click **"Upload File"** to submit the amendment.

### Viewing Version History

Every file submission is saved as a version. To view previous versions:

1. Open the election event in the upload wizard.
2. Look for the **version history** option on the file type you want to review.
3. You will see a list of all versions in reverse chronological order, including:
   - Version number
   - File name
   - Upload date and time
   - Amendment notes (if provided)
   - Which version is currently active

This version history provides a complete audit trail of all submissions and corrections.

---

## Certifying No Elections

If your election authority did not hold any elections during a particular year, you can certify that fact instead of creating election events.

### How to Certify

1. From the Dashboard, click the **"No Elections"** button (labeled "Certify No Elections").
2. Select the **year** from the dropdown.
3. Read the certification statement carefully — by submitting, you are confirming that your authority conducted no elections during that year.
4. Click **"Certify No Elections"** to submit.

> **Important:** This certification is recorded permanently and cannot be undone. Make sure the information is accurate before submitting.

Once certified, a **No Elections Certification** card will appear on your dashboard showing the year, who certified it, and the date. It will be marked as **Compliant**.

---

## Checking Your Compliance Status

Your dashboard gives you a clear picture of your compliance status at a glance.

### Election Event Cards

Each election event card shows:

- **A progress indicator** — Colored dots represent each of the four file types. A filled dot means the file has been uploaded.
- **A file count** — For example, "2 of 4 files uploaded."
- **A list of files still needed** — Shown in amber text below the progress indicator.
- **A compliance badge** — Indicates your overall status for that event (e.g., Complete or Incomplete).

### What the Statuses Mean

| Status | Meaning |
|--------|---------|
| **Complete** | All four required files have been uploaded (or attested to) |
| **Incomplete** | One or more files are still missing |
| **Compliant** | Used for No Elections Certifications — your authority is in good standing |

Your goal is to have all election events showing **Complete** status.

---

## Getting Help

If you have questions or run into any issues, here are your options:

- **FAQ** — Check the FAQ section in the sidebar for answers to common questions.
- **Data Dictionary** — Review column definitions and validation rules for each file type.
- **Contact the NYS Board of Elections:**
  - **Phone:** (518) 474-6220
  - **Email:** info@elections.ny.gov

The NYS Board of Elections team is happy to assist you with any questions about VoteVault or the data submission process.
