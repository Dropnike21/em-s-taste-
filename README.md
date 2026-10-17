# Em's Taste — Ordering Website

**Lutong Bahay, Gawang May Puso.** A responsive Filipino home-cooked food storefront for Emma and her family.

> **Deployment status:** Website source is committed, but Firebase Console provisioning and Firestore rules deployment must be completed before live orders can work. Until then, the storefront is a sample preview.

## Architecture

- Static GitHub Pages site: HTML, CSS, JavaScript
- **Firebase Authentication:** email/password sign-in for *administrators only*. Customers never register or log in.
- **Cloud Firestore:** stores current menu, workday/cutoff configuration, customer order requests and privately authorized admin IDs
- No independent delivery service yet; orders are organized by workplace/pickup group

## Getting started in Firebase Console

Use project **ems-taste** at https://console.firebase.google.com/.

1. **Build → Firestore Database:** Create a Cloud Firestore database (if not created yet). Choose a region carefully because its location cannot be changed later. Keep production rules restrictive; do **not** publish `allow read, write: if true`.
2. **Build → Authentication → Sign-in method:** Enable **Email/Password**. Do not enable public self-signup. Go to **Users → Add user** and create the first admin's email and password.
3. **Authentication → Settings → Authorized domains:** Add your actual GitHub Pages domain, likely `dropnike21.github.io`, if it is not already in the list. For a custom domain, add that too.
4. Copy the Firebase Authentication user’s exact **UID** from **Authentication → Users**.
5. In **Firestore → Data**, manually create collection `admins`, document ID exactly matching that UID, and add field `active` of **boolean** type `true`. This is the allowlist that gives that person admin access. **Never let the public website create/update admin permission documents.**
6. Publish the repository’s **`firestore.rules`** in **Firestore Database → Rules**. Optionally use the CLI with `firebase deploy --only firestore:rules --project ems-taste` from the repository after authenticating Firebase CLI. These rules are **not** deployed automatically merely by pushing them to GitHub.
7. Publish your repository as GitHub Pages: **Settings → Pages → Deploy from branch → main → /(root)**.
8. Open **`admin.html`** on your GitHub Pages domain and sign in with the admin email/password. The page verifies your UID’s `admins/{uid}` Firestore record.
9. In the admin dashboard, create your **real** menu dishes and prices, set the **Monday–Friday service date** in **Ordering settings**, and enable **Allow online order requests** only after you have reviewed the safeguards below.
10. Refresh the public storefront to load the menu. Only Sunday–Thursday before **11:00 PM Philippine time** can customers submit requests for the following workday.

## What the website can do

### Public storefront
- Show published Firestore menu with prices (sample menu displayed until real dishes are published)
- Cart and automatic peso totals
- Customer name, workplace group, and optional note — no customer account
- Send requests to Firestore when the admin allows ordering and the time window is valid
- Show a Firestore-generated reference ID after the request is **saved**
- Copy/share the reference to a workplace coordinator
- Staff **must confirm** every request; receiving a request is not a guarantee of availability or payment

### Admin console
- Login via **Firebase Authentication Email/Password**; no public sign-up page
- Verify authorization with Firestore document `admins/{uid}` containing `active: true`
- Reset password by email on the login screen (Firebase Authentication)
- Create and edit dishes, prices, photos, and availability
- Select menu workday and close/open requests
- View up to 100 most recent order requests and update their status
- Export those recent orders to CSV (contains personal information; keep it private)

### Database collections
```text
admins/{adminAuthUid}
  active: true

settings/storefront
  menuDate: Timestamp at 00:00 UTC of the intended workday
  ordersOpen: boolean
  updatedAt: serverTimestamp

menu/{slug-id}
  name, description, category, tag, price, available, palette, image? (optional)

orders/{automaticDocumentId}
  customerName, workplace, note, items, total,
  serviceDate, createdAt, status ("pending" initially)
  reviewedAt? (after staff status update)
```

## Ordering schedule (Philippine time)

| Request submitted | Meal date |
| --- | --- |
| Sunday, before 11 PM | Monday |
| Monday, before 11 PM | Tuesday |
| Tuesday, before 11 PM | Wednesday |
| Wednesday, before 11 PM | Thursday |
| Thursday, before 11 PM | Friday |

Friday, Saturday, and days after the 11 PM cutoff are closed. **The admin must select the matching service date** each day (e.g., Monday requests for Tuesday must use Tuesday's menu date). Public order rules validate the cutoff against Firebase's server time adjusted to Manila (+08:00), not the customer's device clock.

## Critical security / operations notes

- **Do not launch publicly without publishing and testing the included restrictive `firestore.rules`**. Its rules restrict menu/settings changes and order reads to authorized staff, validate submitted line items against Firestore prices, and enforce the Manila order window server-side.
- Public unauthenticated order creation still has **spam and cost-abuse risks**. Before real customers order, add Firebase **App Check** and stronger server-side throttling/abuse prevention (prefer a Cloud Function or protected backend), verify Firestore quotas/billing alerts, and test rules using the Firestore emulator/rules playground.
- Currently no inventory reservation, payment verification, receipt, automatic customer notification, or cancellation workflow. Customer order requests need staff confirmation; duplicate requests and last-minute stock changes remain possible.
- Admin credentials belong in **Firebase Authentication**, **not Firestore documents**. Never save passwords, service-account JSON keys, or private keys in GitHub. Web-app Firebase configuration fields are public identifiers, not authorization.
- Customer names, workplace details, and notes are personal data. Publish an appropriate privacy notice, limit what is collected, and define secure retention/deletion procedures before public launch.
- Changing a price after a customer loads the page can cause their submission to be rejected; the customer should refresh and try again.
- Image URLs entered by admins are rendered as images. Use trusted hosted photos and confirm permission to use them.

## Source files

- `index.html`, `styles.css`, `logo.svg`: storefront and visual identity
- `menu.js`: clearly labeled demo data for first launch preview (never submitted)
- `app.js`: front-end shopping cart, Philippine schedule display, order UI
- `firebase-config.js`: public Firebase app initialization
- `storefront-firebase.js`: load published menu/settings and submit order requests
- `admin.html`, `admin.css`, `admin.js`: protected administrator screen
- `firestore.rules`, `firebase.json`: proposed Firestore access control and deployment config

## Plans for later versions

- Strong anti-spam backend, App Check, and automated security-rule tests
- Manage multiple workdays and holiday exceptions
- Cooking quantity summaries grouped by dish and workplace
- Stock limits and order capacity
- Payment tracking
- Delivery integration when the business is ready
