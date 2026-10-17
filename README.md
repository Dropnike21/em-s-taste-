# Em's Taste — Website and Ordering System

**Lutong Bahay, Gawang May Puso.** Home-cooked Filipino meals prepared by Emma.

## Project status

The site is built with HTML/CSS/JavaScript, GitHub Pages, and Firebase JavaScript SDK **13.0.0**. The code is committed to GitHub, but **Firestore rule deployment, first-admin approval, and real-device tests must be completed manually** in the Firebase project before taking orders. Menu sample values are examples, not live products.

## Roles

- **Visitor:** Browse the menu and prices without signing in.
- **Customer:** Sign in with Google using Firebase Authentication. A customer profile is created in Firestore on their first visit. No Em's Taste password is needed.
- **Administrator:** Sign in with Google **and** have a manually approved `admins/{firebaseUid}` record with `active: true`.

### Firebase Console setup: approve first administrator

1. Open https://console.firebase.google.com/project/ems-taste/authentication/providers and **enable Google** if it is not already enabled.
2. Go to **Authentication → Settings → Authorized domains** and include `dropnike21.github.io` (and any custom site domain).
3. Find the admin's exact **Firebase UID** under **Authentication → Users**. The UID shown to the admin on the "access not approved" screen is also valid.
4. Under **Firestore Database → Data**, create the collection `admins`. Add a document **whose ID is exactly that admin UID** with a Boolean `active` field set to `true`.
5. In **Firestore Database → Rules**, publish the full contents of [firestore.rules](firestore.rules). **Committing rules to GitHub does not deploy them.** Do not replace the rules with globally open read/write permissions.
6. Sign out and sign back into `admin.html` using Google. You should now see the admin dashboard. The UID must not be hardcoded into the website or placed in a publicly writable record.
7. In admin **Ordering settings**, set the intended service date and enable orders only after real dishes and prices have been loaded and tested. The dashboard also writes a `menuDayKey` string matching the service date.

## Customer account and order data

```text
admins/{adminUid}
  active: boolean

customers/{googleUid}
  displayName: string
  email: string
  blocked: boolean
  createdAt: timestamp

settings/storefront
  menuDate: timestamp    // midnight UTC, representing the target workday
  menuDayKey: string     // "YYYY-MM-DD"
  ordersOpen: boolean
  updatedAt: timestamp

menu/{dishId}
  name, price (whole PHP amount), available, category,
  description, tag, palette, image?

orders/{googleUid_YYYY-MM-DD}
  customerUid: string
  customerName: string
  workplace: string
  note: string
  items: array of {id, name, quantity, unitPrice}
  total: integer
  serviceDay: "YYYY-MM-DD"
  serviceDate: timestamp
  createdAt: timestamp
  status: "pending" | "confirmed" | "completed" | "cancelled"
  reviewedAt?: timestamp

reviews/{orderId}
  orderId: string
  customerUid: string
  rating: integer 1–5
  comment: string (max 500 characters)
  createdAt: timestamp
```

A customer **cannot read another customer's private orders or reviews**. Only administrators can list all profiles or orders.

### What prevents casual prank orders?

- Google account sign-in and a verified email are required.
- A Firestore customer profile must exist and not be blocked.
- Only **one order request per Google UID per workday** is permitted. Its deterministic Firestore document ID prevents duplicate submissions or overwrites by that user.
- Each order is limited to **6 different dishes, 5 of each dish, 10 total servings, and ₱3,000**. Menus and prices are verified against Firestore in rules.
- The **11:00 PM Philippine-time Sunday–Thursday** ordering deadline is enforced in Firestore security rules using server time.
- Admins can mark abusive customer accounts as blocked (preventing future order requests and reviews).
- Requests are marked **pending** until a person confirms them. No payment or automatic delivery is implied.

**Important:** Google authentication and client-side limits cannot stop a determined attacker from using several different Google accounts or consuming Firestore requests. Before a public launch, deploy **Firebase App Check**, add backend request throttling, monitor billing and abuse, and consider an order confirmation/deposit mechanism for unusually large requests. Do not assume this prototype is fraud-proof.

### Customer feedback

After staff sets an order to **completed**, the customer can create **one 1–5 star rating and optional comment** tied to that actual order. Reviews are private to the customer and admins, not public testimonials. Admins can view recent feedback and ratings.

### Business metrics

The admin dashboard reports total registered customer profiles, pending requests from the 100 most recent orders, recent order amounts (not paid sales), popular dishes from recent non-cancelled requests, and averages from the 100 most recent reviews. These are **initial operational insights**, not a full analytics/BI system. Later, add date-based reports, sales vs. payments, repeat purchases, retention, and company breakdowns.

## Order timetable (Philippine time)

| Order request | Intended meal date |
| --- | --- |
| Sunday before 11 PM | Monday |
| Monday before 11 PM | Tuesday |
| Tuesday before 11 PM | Wednesday |
| Wednesday before 11 PM | Thursday |
| Thursday before 11 PM | Friday |

No ordering window on Friday or Saturday. The menu date must be set to the correct workday in admin settings. Workplace coordination is the current distribution method; a commercial delivery feature is **not enabled**.

## Data protection and launch checklist

- [ ] Publish and test **firestore.rules** against the current Firebase project.
- [ ] Approve the owner/admin in `admins/{uid}` in Firestore Console.
- [ ] Enter real food/menu details, prices, and workday.
- [ ] Verify Google sign-in on mobile and desktop.
- [ ] Test that customer A cannot read customer B's profile, orders, or reviews.
- [ ] Test that an unsigned customer cannot submit an order.
- [ ] Test that a second order for the same day is rejected.
- [ ] Test that the same customer can order on a different workday.
- [ ] Test that cancelled/not-completed orders cannot be rated.
- [ ] Test that blocked customers cannot create orders or reviews.
- [ ] Test server-side cutoff behavior before and after 11 PM Philippine time.
- [ ] Enable Firebase App Check and appropriate abuse controls.
- [ ] Finalize [privacy notice](privacy.html), retention period, customer support contact, and relevant legal obligations **before public launch**.
- [ ] Monitor Firebase project quota and billing.

## Files

- `index.html`, `styles.css` — responsive customer website
- `logo.svg` — simplified steaming bowl icon
- `menu.js` — preview-only sample dishes
- `app.js` — cart, schedule, account dashboard and feedback UI
- `firebase-config.js` — public web-app config, not a secret service account key
- `storefront-firebase.js` — Google sign-in, profile creation, order requests/history, reviews
- `admin.html`, `admin.css`, `admin.js` — admin dashboard and recent operational insights
- `firestore.rules`, `firebase.json` — security rules and Firebase CLI configuration
- `privacy.html` — pre-launch data-use notice

## Publishing

GitHub repository → **Settings → Pages → Deploy from branch → main → /(root)**.

Firestore rules require a **separate publish** in Firebase Console or the Firebase CLI. Real authentication and write flows have **not** been verified against the live Firebase project from this GitHub connection. Deploy and run the launch checklist before accepting customer orders.
