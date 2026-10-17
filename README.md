# Em's Taste — Ordering Website

**Lutong Bahay, Gawang May Puso.** A responsive Filipino home-cooked food storefront for Emma and her family.

> **Deployment status:** Website source is committed, but Firebase Console provisioning and Firestore rules deployment must be completed before live orders can work. Until then, the storefront is a sample preview.

## Architecture

- Static GitHub Pages site: HTML, CSS, JavaScript
- **Firebase Authentication:** Facebook Login for *administrators only*. Customers never register or log in.
- **Cloud Firestore:** stores current menu, workday/cutoff configuration, customer order requests and privately authorized admin IDs
- No independent delivery service yet; orders are organized by workplace/pickup group

## Set up Facebook Login (Firebase + Meta)

Use the Firebase project **ems-taste** at https://console.firebase.google.com/ and create a Meta developer app at https://developers.facebook.com/.

1. In **Firebase Authentication → Sign-in method**, enable **Facebook**. Do **not** need Email/Password for this Facebook-only dashboard.
2. In **Meta for Developers**, create or select a Meta app with **Facebook Login** enabled (web application). Meta's workflow may ask for app details, privacy policy URL, and other compliance information. Add your actual website domain in its applicable app settings.
3. Copy your Meta **App ID** and **App Secret** to the **Facebook provider settings in Firebase Authentication**. **Never commit the App Secret to GitHub.** The public Firebase web config in `firebase-config.js` is a different thing.
4. Set the **Valid OAuth Redirect URI** in the Meta Facebook Login settings to **`https://ems-taste.firebaseapp.com/__/auth/handler`** (exact path, including HTTPS).
5. In **Firebase Authentication → Settings → Authorized domains**, allow the domain hosting your admin page, generally **`dropnike21.github.io`** for GitHub Pages. Add any custom domain you use.
6. For initial testing, keep the Meta app in Development mode and add your intended admins as eligible app roles/testers. Public Facebook Login can require additional Meta configuration/review. Switch to Live only after you meet Meta's requirements.
7. Set up Cloud Firestore if not already created. **Publish the repository's `firestore.rules`** in Firestore's Rules tab (or deploy with `firebase deploy --only firestore:rules --project ems-taste`). Pushing this file to GitHub **does not** deploy the security rules.
8. Open your hosted **`admin.html`** page and click **Continue with Facebook**. The *first* successful Facebook sign-in creates an Authentication user even if it is not yet an authorized admin. The page will display your Firebase UID when it denies dashboard access. You can also retrieve that UID from **Firebase Authentication → Users**.
9. In **Firestore → Data**, create an `admins` collection. Create a document with **the exact Firebase UID as its document ID** and field `active` of type **Boolean**, value `true`. Perform this only as the trusted project owner in Firebase Console. Never create admin accounts or allowlist entries from the public site.
10. Sign in with Facebook again. The dashboard will open once the UID is approved. Add real menu items, select the corresponding workday in Ordering settings, and enable orders only after completing safeguards below.
11. On GitHub, deploy **main → /(root)** using **Settings → Pages → Deploy from branch**, if not already enabled.

### Accounts and password recovery

- **No Em's Taste username, email address, or local password is necessary** for the admin login. Administrators use their Facebook credentials on Facebook's own login screen. No Facebook passwords are stored in Firestore.
- If an administrator forgets their password, they should recover it **through Facebook**. The previous Firebase Email/Password reset UI has been removed.
- If you previously authorized an email/password Firebase user, **Facebook login may create a different UID**, even if the email is the same. Approve the correct Facebook UID in `admins/{uid}` (or securely link the Facebook provider to the existing user, if you intentionally need the same UID). Do not rely on email/display names as your administrator authorization.
- The website uses **`signInWithPopup()`** for GitHub Pages. A blocked popup or incompatible in-app browser may require enabling popups or opening in a normal browser. Firebase's cross-origin redirect flow has limitations on third-party hosted sites.
- Sign-in is not proof of authorization. The app and Firestore security rules both require a Facebook-authenticated UID with `admins/{uid}.active == true`.

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
- Login via **Facebook + Firebase Authentication**; no public username/password form
- Verify authorization with Firestore document `admins/{uid}` containing `active: true`
- Facebook handles password recovery and sign-in security
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
- Admin identities are managed by **Facebook + Firebase Authentication**; the allowlist is stored in Firestore, but passwords never are. Never save passwords, service-account JSON keys, or private keys in GitHub. Web-app Firebase configuration fields are public identifiers, not authorization.
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
