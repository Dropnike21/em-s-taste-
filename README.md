# Em's Taste — Role-Based Ordering and Kitchen Workspace

**Lutong Bahay, Gawang May Puso.** A modular Filipino home-cooked food site: static GitHub Pages UI and Firebase Authentication / Firestore data.

## Current implementation

### Customer (public site: index.html)
- Browse menus without signing in.
- Google sign-in is required for actual order requests, personal history, suggestions, and feedback.
- **Normal ordering: 1–50 servings per workday**, one order request per Google account / service date. Status starts **pending**; business staff must confirm.
- **Bulk booking: 51–500 servings**: use the separate request form, enter intended workday and meal preferences, then **wait for a staff quote and confirmation**. Bulk inquiries do not reserve stock or constitute a paid transaction.
- Request a dish be added to the menu.
- Submit private 0–5 star food/site/service feedback, bugs, other issues. One request per feedback category per Philippine calendar day. *General feedback isn't a verified purchased-meal review.*
- **Verified food ratings** are available on My orders only for completed orders, one review per order.
- View your order history and personal report/bulk inquiry statuses.

### Staff (team workspace: admin.html)
- Menu CRUD (add/edit, name, description, price, image link, category, availability).
- Read meal requests / menu suggestions, but NOT general customer complaints or directory information.
- View recent normal-order / transaction history, manage fulfillment status, record manual **payment status**, export recent transactions as CSV.
- **Kitchen prep view:** consolidated confirmed/completed servings grouped by dish, workplace and service date, with a CSV packing/cooking sheet.
- Review and quote bulk inquiries, then mark under review, confirmed, declined or completed. Quotes and payment flags are **internal**, not an online payment gateway.
- Cannot grant roles, access customer directories, manage customer reports, change global ordering settings, or make customers administrators.

### Administrator (team workspace: admin.html)
All staff operations **plus**:
- Admin-only global ordering schedule/availability.
- Customer directory and account-blocking.
- Searchable Users & roles directory; promote registered customers to staff/admin without copying their Firebase UIDs.
- Private ratings and operational insights.
- Administrator-only reports, bug triage, service issues, and resolution statuses.

## Menu templates and simplified staff workflow

The **Menu & products** form now starts with a grouped dropdown containing **30 curated, unranked Filipino dishes**. These are reference templates, not confirmed production items or a numerical national popularity ranking. Staff can select a familiar meal and its name/description will be prefilled, or click **Create a custom dish** to enter an original meal. Prices are intentionally **not** supplied; staff must enter a real whole-peso price.

**No templates are automatically written to Firestore or shown as available.** A meal is saved only when staff confirms the details and selects Save. Newly added dishes default to **Unavailable** until staff explicitly makes them available. Existing meals in Firestore are not overwritten during template initialization. If a selected template already exists, the form opens its existing record for editing.

The saved-menu filter supports Current / Archived / All. Staff can **Edit**, **Pause**, or **Archive** meals. Archiving sets `archived:true` and `available:false`. **Restore** keeps the meal unavailable until staff deliberately enables it. Archived products are excluded from the customer-facing menu but remain in Firestore to preserve references in previous orders.

Template source references:
- https://www.tasteatlas.com/philippines
- https://www.pna.gov.ph/articles/1273614

## Users & roles — manage customers without UID lookups

The admin-only **Users & roles** screen combines registered customer profiles from `customers/{uid}` and existing authorized members from `team/{uid}`. It includes the signed-in protected owner if their `admins/{uid}` record is active. Registered customers appear under their names and Google email addresses, with **Customer** as the default role.

- Search by name, email, or UID and filter by Customer, Staff, or Administrator.
- Change a user's role from their row: **Customer → Staff**, **Customer → Administrator**, or **Staff/Admin → Customer**.
- Staff and delegated administrators have trusted `team/{uid}` role records; reverting to Customer deletes their team role record but **does not delete their customer profile or order history**.
- A protected original owner's `admins/{uid}` record cannot be altered by the public website or the role selector; administrators cannot change their own role.
- Block or unblock customer ordering separately from staff permissions; blocking orders does not revoke admin/team authorization.
- On administrator sign-in, the directory fetches the first 100 customer profiles plus the current authorized team. **Load more users** pages through additional customer profiles as needed.
- The list is cached for five minutes, refreshes automatically when the page is active, and supports **↻ Refresh users** after changes.
- Customers who sign in via the customer storefront get a Firestore profile. New Google users entering via the staff login also receive a customer profile, even when their team role is awaiting approval. This allows them to appear in the directory after sign-in.

**Scope limitation:** A static GitHub Pages site cannot use Firebase Admin SDK to enumerate *every* Firebase Authentication account. Historical Auth-only accounts with **no Firestore customer or team document** will not appear until they next sign into the updated website (or are synchronized by a future trusted Cloud Function). This directory does **not** claim to be a complete export of Firebase Authentication. A manual UID-based advanced form remains for exceptional legacy accounts.

**Security:** All role changes are authorized by Firestore's existing `isAdmin()` rule. The browser never receives a service-account secret or permission to create owner records under `admins`. Existing Firestore rules do not need changes for this UI update.

## Architecture and modules

\`\`\`text
index.html                  Public menu, cart and customer experience
app.js                      Storefront cart and normal order workflow
storefront-firebase.js      Firebase customer identity, order and verified review data
customer/requests.js        Separate forms for bulk bookings and customer suggestions/reports
admin.html                  Role-aware staff and admin workspace navigation
admin.js                    Tiny workspace entry point
workspace/core.js           Google authentication, role resolution, visible tabs
workspace/shared.js         Common UI helpers
workspace/menu.js           Food catalog / price / availability / menu suggestions
workspace/filipino-dishes.js 30 curated Filipino meal templates (local only)
workspace/orders.js         Regular transaction status, manual payment status, CSV export
workspace/bulk.js           Bulk inquiries, manual quote and approval
workspace/prep.js           Dish/workplace cooking preparation totals and CSV
workspace/settings.js       Admin-only global ordering hours / service date settings
workspace/insights.js       Admin-only recent dishes and verified rating insights
workspace/people.js         Admin-only customers, blocked users and staff permissions
workspace/reports.js        Admin-only bug reports and feedback triage
firebase-config.js          Public Firebase web configuration
firestore.rules             Server-side access control (MUST DEPLOY SEPARATELY)
privacy.html                Draft privacy notice; needs final contact/retention policy
\`\`\`

## Role permissions

Access is enforced by **Firestore Security Rules**, not solely by hidden navigation.

| Capability | Customer | Staff | Admin |
|---|---|---|---|
| Browse menu | Yes | Yes | Yes |
| Order / submit feedback as customer | Yes (Google) | As customer account | As customer account |
| Manage menu, prices, availability | No | Yes | Yes |
| View normal and bulk order queues | Own only | All | All |
| Change fulfillment status / record payments | No | Yes | Yes |
| Read menu suggestions | Own | Yes | Yes |
| Review general service / bug reports | Own | No | Yes |
| Customer directory / customer blocking | No | No | Yes |
| Assign roles | No | No | Yes |
| Global ordering control | No | No | Yes |

### Secure role provisioning

The original owner administrator setup **continues working**: in Firestore collection **\`admins\`**, document ID **your Google Firebase Authentication UID**, add **\`active: true\`** (Boolean). **Never** put this UID in source code or permit public writes to \`admins\`.

To authorize other team members:

1. Have the customer or intended team member sign into the website with Google.
2. Sign into the administrator portal, open **Users & roles**, and find their name/email.
3. Choose **Staff** or **Administrator** from the role selector and tap **Save role**.
4. The user should sign out and sign back in to the staff portal so their role is rechecked.
5. To demote someone, select **Customer**; their order history remains intact and the team authorization document is deleted.

Only authorized administrators can change user roles; the original owner record remains protected.


## Firestore collections and formats

- \`admins/{uid}\`: legacy/bootstrap owner allowlist (\`active:true\`).
- \`team/{uid}\`: \`role:'staff'|'admin'\`, \`active:boolean\`, optional \`label\`, \`updatedAt\`.
- \`customers/{uid}\`: Google account profile and \`blocked\` flag.
- \`menu/{dishId}\`: food inventory listing, image URL, name, price, category, availability.
- \`settings/storefront\`: \`menuDate\`, \`menuDayKey\`, \`ordersOpen\`.
- \`orders/{uid_YYYY-MM-DD}\`: usual 1–50 serving order requests, \`status\`, optional \`paymentStatus\` and \`reviewedAt\`.
- \`bulkRequests/{uid_YYYY-MM-DD}\`: requested 51–500 servings, preferences, day, quote, \`status\`, \`paymentStatus\`, \`updatedAt\`.
- \`feedback/{uid_type_YYYY-M-D}\`: report/idea/rating, own author, category, optional rating, message, report status.
- \`reviews/{orderId}\`: one verified completed-order rating (1–5) and optional comment.

**A payment flag is a manual staff record, NOT proof of online payment.** A bulk request's quote is NOT a finalized invoice.

## Mobile navigation and administrator sign-in

- **Mobile customer experience:** the website now has a hamburger menu in the top-right corner. It shows Menu, How ordering works, My account & orders, Requests & feedback, Our Story, and Staff / Admin portal.
- The public page shows the menu and ordering instructions *before* the signed-in account history and customer feedback sections. Order history and request forms expand only when selected.
- A global `[hidden]` style keeps controls that should be hidden—such as “Continue with Google” after signing in—from appearing incorrectly.

**Admin portal:** `https://dropnike21.github.io/em-s-taste-/admin.html`

If Google sign-in works on the customer page but staff/admin access is denied, use the admin portal's **Access troubleshooting** section. It shows your active Google email and Firebase Authentication UID. Confirm the correct UID has a trusted owner record at `admins/{uid}` with Boolean `active: true`, or an approved `team/{uid}` role. The original owner authorization is checked first, independently of the optional team record. When Firebase says *permission-denied*, verify that the latest `firestore.rules` were published in Firebase Console.

> Signing into Google and receiving a customer profile does **not** automatically create staff/admin access. The admin portal and its associated Firestore permissions require explicit role approval. The public menu may remain in **preview mode** until real dishes and ordering settings are configured by authorized staff.

## How to publish changes

1. Go to https://console.firebase.google.com/project/ems-taste/authentication/providers and enable **Google** sign-in. Verify your hosted domain (e.g., \`dropnike21.github.io\`) under Authentication → Settings → Authorized domains.
2. Make sure Firestore Database exists, and the owner is approved in \`admins/{uid}\`.
3. **Replace the entire Firestore Rules editor with [firestore.rules](firestore.rules) and Publish**. Editing this file in GitHub alone **does NOT** publish the database rules. Never set \`allow read, write: if true\`.
4. GitHub Pages → Settings → Pages → deploy from \`main\` and \`/(root)\`.
5. Load \`admin.html\` as the owner, test menu and date settings. Staff UIDs are managed from the admin-only Team permissions tab.
6. Test each role's access and denial, on desktop and mobile, *before* allowing real customer orders.

## Pre-launch security and operations

**The code has been updated and statically inspected, but end-to-end Firebase authentication, rules compilation, and database writes have not been confirmed here. Do not launch publicly until tested.**

- [ ] **Rules compile and publish** in Firebase; test each allow/deny case with the Firebase Emulator / Rules Playground.
- [ ] Test that staff cannot list customers, change ordering settings, or read private bug reports.
- [ ] Test that an unauthenticated user cannot submit any order or report.
- [ ] Test Google customer sign-in and that customers can only see their own orders and reports.
- [ ] Test one normal order and one bulk request per Google UID/service date, including duplicate rejection.
- [ ] Test normal quantity **50** passes and **51** must use bulk; test **51** and **500** bulk boundaries.
- [ ] Test Sunday–Thursday 11 PM Philippine-time regular order cutoff.
- [ ] Test food feedback and verified rating only after order marked Completed.
- [ ] Test blocked customers cannot submit orders, reviews or new requests.
- [ ] Test payment statuses and that staff confirms quotes offline.
- [ ] Configure **Firebase App Check**, backend anti-spam/rate limiting, quota and billing alerts before going live.
- [ ] Review personal-data retention, contact details, appropriate consent and privacy notice; avoid sensitive information in notes.
- [ ] Implement payment reconciliation and an audit trail before calling this a production POS.
- [ ] Test all forms using separate Google accounts for customer, staff and admin.

## Planning / future versions

- Date-based menu management beyond one service day.
- Cooking prep totals grouped by dish and workplace and packing sheets.
- Payment reconciliation, receipts, customer notifications and audit logs.
- Inventory/stock constraints and partial-confirmation handling.
- More granular operational statistics beyond the 100–150 latest records.
- Moderation and customer reply workflow for issue reports.
