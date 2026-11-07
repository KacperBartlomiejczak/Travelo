# Travelo Privacy Policy

Version of 6 November 2026

This policy explains what personal data the Travelo mobile app (the "App") processes, why, for how long, and what rights you have.

## 1. Data controller

The controller of your personal data is **Kacper Bartłomiejczak**, a natural person, Poland ("we", the "Controller").

For anything about personal data, write to: **kacperbartlomiejczak@proton.me**.

We have not appointed a data protection officer, as we are not required to.

## 2. What data we process

### 2.1 Account and sign-in
- Sign-in with **Google**: your e-mail address and Google account ID, which Google passes to us after you agree on its sign-in screen.
- Sign-in with **Discord**: your e-mail address and Discord account ID.
- Sign-in with **e-mail**: the e-mail address we send a 6-digit code to.
- Technical sign-in data: date and time of sign-in, IP address and device information kept in server logs.

We never see or store your Google or Discord password.

### 2.2 Profile
- Nickname (unique), chosen interests, an optional profile photo.
- Friend code (6 characters), assigned automatically. Anyone who knows your code can see your nickname and interests and add you to their trip as a friend with an account.

### 2.3 Trips
- Trip name, cover photo, flights (airports, dates and times, optionally the flight number), daily budget and currency.
- **Friends without an account:** the name (or other label) and interests of the people you add to a trip. These people have no account in the App. Only add them if they know you are using their details to plan a shared trip.
- **Friends with an account:** if you add someone by their friend code, they can see the trip (without changing it) and add their own expenses. You see their nickname and interests.

### 2.4 Photos
- Photos you add to a trip, and your profile photo.
- Before uploading, the App downsizes each photo and re-saves it **without EXIF metadata**, so **without GPS location**, camera model etc. We keep only the date the photo was taken (to sort photos).
- Photos are kept in private file storage; only people with access to the trip can see them (your profile photo: only you).

### 2.5 Expenses
- Name, amount, currency, category and day of the expense, and who paid it (you or a friend on the trip).

### 2.6 Discovering places (AI)
- When you use "Discover places", we send Google **only the city name and a list of interests**. We do not send your nickname, e-mail, photos, friends' names or your device location.
- We keep a count of your requests per day (limit: 5 per day per account) to protect the service from abuse.

### 2.7 Data on your phone only
The App keeps a copy of your trips, profile and expenses on your phone so it works without internet, plus your theme and language choice. When you sign out or delete your account, the copy of your data is erased from the phone (theme and language stay).

The App **does not use** advertising or analytics tools and **does not track** your location.

## 3. Purposes and legal bases

| Purpose | Legal basis (GDPR) |
|---|---|
| Creating and running your account, sign-in, profile | Art. 6(1)(b) — performance of a contract (the Terms) |
| Trip planning, photos, expenses, syncing between phone and server | Art. 6(1)(b) — performance of a contract |
| Processing the details of friends without an account that you enter | Art. 6(1)(f) — legitimate interest: letting you plan a shared trip |
| Discovering places (city + interests) | Art. 6(1)(b) — performance of a contract |
| Security, logs, the AI request limit, preventing abuse | Art. 6(1)(f) — legitimate interest: security of the service |
| Replying to messages, complaints, defending against claims | Art. 6(1)(f) and Art. 6(1)(c) (consumer-law obligations) |

Providing data is voluntary, but an account cannot be created without an e-mail address (or a Google/Discord account) and a nickname.

We do not make decisions about you based solely on automated processing that produce legal effects or similarly significantly affect you. AI place recommendations are only suggestions.

## 4. Who receives your data

- **Supabase Inc.** — hosting of the database, sign-in, files and server functions (a processor under a data processing agreement). Data is stored in **Ireland (AWS eu-west-1)**.
- **Google** — (a) if you sign in with Google: Google, as a separate controller, authenticates you and passes us your e-mail; (b) the Google Places API and the Gemini API receive **only the city and interests** from a "Discover places" request. The request is sent by our server, not by your phone. We use the paid tier of the Gemini API, where Google does not use requests to train its models.
- **Discord Inc.** — if you sign in with Discord, as a separate controller.
- **Friends with an account** whom you add to a trip, or who added you — they see that trip's data (see 2.3).
- Public authorities — only where the law requires it.

We do not sell your data or share it for marketing.

## 5. Transfers outside the European Economic Area

Supabase, Google and Discord are US companies. Where data leaves the EEA, this is based on a European Commission adequacy decision (the EU-US Data Privacy Framework) or standard contractual clauses (Art. 46 GDPR). You can get a copy of the safeguards by writing to the address in section 1.

## 6. How long we keep data

- Account, profile, trip, photo and expense data — **until you delete your account** (or earlier, if you delete a given trip, photo or expense).
- When you delete your account, the data is erased from the database and file storage at once. The provider's backups may still contain it for a limited time set by the backup cycle, after which they are overwritten.
- Exception: in **other people's trips** you belong to, your nickname and your expenses stay as a "friend without an account", because they are part of another person's trip.
- AI request count — for the day it relates to and briefly after.
- Technical logs — for the period set by the hosting provider, usually a few days.
- Correspondence with us — until the matter is closed; for complaints or claims, until the limitation period ends.

## 7. Your rights

You have the right to:
- access your data and get a copy,
- rectify your data (you can change your nickname and interests yourself in "Edit profile"),
- erasure,
- restriction of processing,
- data portability,
- object to processing based on legitimate interest,
- lodge a complaint with a supervisory authority — in Poland the **President of the Personal Data Protection Office** (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl), or the authority in your EU country of residence.

To use your rights, write to the address in section 1. We reply within one month.

If you were added to someone's trip without an account and want your data removed, write to us or ask the organizer to remove you.

## 8. Deleting your account

You can delete your account yourself in the App: **Profile → Settings → Delete account** (needs internet). This erases your account, profile, profile photo and every trip you organize, with its expenses and photos — also for the friends added to it. You can also ask us by e-mail to delete your account.

## 9. Security

Connections are encrypted (HTTPS). Row-level security rules limit access in the database — everyone sees only their own data and the trips they belong to. Photos are in private storage and shown through links valid for one hour. Keys for external services are kept on the server only.

## 10. Age

The App is intended for people aged 16 and over.

## 11. Changes to this policy

We will tell you about significant changes in the App before they take effect. The current version is always available in the App and at this policy's public address.
