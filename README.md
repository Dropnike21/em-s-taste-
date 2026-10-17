# Em's Taste — Ordering Website

**Lutong Bahay, Gawang May Puso.** A responsive Filipino home-cooked food storefront for Emma and her family.

> **Deployment status:** Website source is committed, but Firebase Console provisioning and Firestore rules deployment must be completed before live orders can work. Until then, the storefront is a sample preview.

## Architecture

- Static GitHub Pages site: HTML, CSS, JavaScript
- **Firebase Authentication:** Google Sign-In for *administrators only*. Customers never register or log in.
- **Cloud Firestore:** stores current menu, workday/cutoff configuration, customer order requests and privately authorized admin IDs
- No independent delivery service yet; orders are organized by workplace/pickup group

## Set up Google Sign-In (Firebase only)

Use the **ems-taste** Firebase project: https://console.firebase.google.com/project/ems-taste/overview

1. Open **Authentication → Sign-in method → Google** and enable it. Firebase may ask you to select a public-facing support email. Save the provider. You **do not need to create a Meta app**, get a Meta app secret, or configure Google Sign-In.
2. Under **Authentication → Settings → Authorized domains**, make sure the hostname serving your site is listed. For GitHub Pages this is **`dropnike21.github.io`** (domain only; no `https://` or repository path). Add a custom domain if using one.
3. Ensure your **Cloud Firestore** database exists. Publish the repository's **`firestore.rules`** in Firebase **Firestore Database → Rules**, or use Firebase CLI: `firebase deploy --only firestore:rules --project ems-taste`. Updating GitHub **does not deploy** Firebase rules automatically.
4. Publish GitHub Pages from **main → /(root)** if not already enabled, then open the deployed **`admin.html`** and select **Continue with Google**.
5. On first sign-in, Firebase Authentication will create or use an account with a **UID**. Until the owner approves that UID, the dashboard will deny admin access and display the UID. Alternatively, get it from **Authentication → Users**.
6. In **Firestore → Data**, create collection **`admins`**, document ID exactly equal to the UID, with a Boolean field **`active`** set to **`true`**. Do this as the trusted Firebase project owner in the Console, **never** by allowing public writes to `admins`.
7. Sign in with Google again. Only a Google-authenticated user with an active `admins/{uid}` record can access the dashboard. Create real menu items and configure ordering dates before accepting actual orders.

### Google account and admin access

- Administrators use their existing **Google accounts**. The Em's Taste website does **not** require a new username or password, and does not store Google credentials.
- Forgotten passwords and account recovery are handled through **Google**.
- Using Google for the first time may produce a **different Firebase UID** than an old Email/Password or Google sign-in. Authorize the **Google** UID. Do not grant access merely because someone knows an admin email address.
- The website uses Firebase `GoogleAuthProvider` and `signInWithPopup()`. Browsers that block popups or mobile in-app browsers may require opening the admin site in a normal browser and allowing popups.
- **The Firebase UID allowlist controls access**, not Google sign-in alone. The committed Firestore rules check the provider and the UID allowlist. Google accounts are not automatically administrators.

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
- Login via **Google + Firebase Authentication**; no public username/password form
- Verify authorization with Firestore document `admins/{uid}` containing `active: true`
- Google handles password recovery and sign-in security
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
- Admin identities are managed by **Google + Firebase Authentication**; the allowlist is stored in Firestore, but passwords never are. Never save passwords, service-account JSON keys, or private keys in GitHub. Web-app Firebase configuration fields are public identifiers, not authorization.
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
