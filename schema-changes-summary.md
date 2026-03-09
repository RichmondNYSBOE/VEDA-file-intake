# VEDA File Intake — Schema Changes Summary

**Date:** 2026-03-09
**Branch:** `claude/add-poll-site-attestation-IVIHb`

---

## 1. Poll Sites

**Column count:** 13 → 14

| Change | Field | Details |
|--------|-------|---------|
| **Added** | `MunicipalityType` | Required string, inserted after `Municipality` |

---

## 2. Election Results

**Column count:** 43 → 44

| Change | Old Name | New Name | Details |
|--------|----------|----------|---------|
| **Added** | — | `LongName` | Optional string, inserted after `ShortDesc` |
| **Required** | `ElectionDistrict` (optional) | `ElectionDistrict` (required) | Changed from optional to required |
| **Renamed** | `ElectionDistrictCombined` | `ElectionDistrictCombinedInto` | Added "Into" suffix |
| **Renamed** | `VotesElectionDayAtPollSite` | `VoteElectionDayatPollsite` | Casing change to match spec |
| **Renamed** | `VotesEarlyVoteatPollSite` | `VotesEarlyVoteAtPollSite` | Capitalization fix ("At" was "at") |
| **Renamed** | `VotesOther` | `VotesOTHERS` | Name change to match spec |

---

## 3. Voter History → Voter Information

**File type key renamed:** `voter-history` → `voter-information`
**Display label renamed:** "Voter History" → "Voter Information"
**Column count:** 36 → 36 (one removed, one added)

### Structural Changes

| Change | Old Name | New Name | Details |
|--------|----------|----------|---------|
| **Renamed** | `Election_Name` | `ElectionName` | Removed underscore |
| **Added** | — | `ConfidentialYN` | Optional string, inserted after `DOB` |
| **Removed** | `LD` | — | Field removed from schema |
| **Renamed** | `ElectionDistrict` | `ElectionSchoolLibraryDistrict` | Expanded name |
| **Renamed** | `RegistrationSource` | `Registration_Source` | Added underscore |

### Files Updated for Rename

| File | Change |
|------|--------|
| `src/lib/file-schemas.ts` | Schema key + aliases |
| `src/lib/election-types.ts` | `fileType` and `label` |
| `src/components/upload-dashboard.tsx` | Card title, description, fileType |
| `src/components/upload-wizard.tsx` | Comment |
| `src/components/submission-log.tsx` | Display label mapping |
| `src/app/actions.ts` | `FILE_TYPES` constant |

---

## Notes

- Header aliases were updated in all cases to point to the new canonical field names.
- The spec listed "MaillingAddr2" (double L) for Voter Information — assumed to be a typo and kept as `MailingAddr2`.
- No other source files outside `file-schemas.ts` referenced the renamed election-results field names.
