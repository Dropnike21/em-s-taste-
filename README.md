# Em's Taste

**Lutong Bahay, Gawang May Puso.** A warm, responsive storefront for Emma's home-cooked Filipino meals.

## What version 1 does

- Modern mobile-friendly home page inspired by the Em's Taste branding
- Editable sample menu with prices and categories
- Cart with adjustable quantities and peso totals
- Pre-order schedule based on **Asia/Manila** time
- **11:00 PM cutoff on Sunday–Thursday** for the following workday (Monday–Friday)
- Customer name, workplace / pickup group, and optional order note
- Share or copy a detailed order request through the customer's own messaging app
- Cart draft stored on the customer's **own browser only**

**Important:** This is a **preview**, not a live online order-processing system. No orders, names, payments, or messages are saved to a business database or sent to Emma automatically. The order summary must be shared with a coordinator, who must acknowledge/confirm it. Menu items and prices are **examples** and must be replaced before real customers use the site.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Main page and ordering interface |
| `styles.css` | Colors, layout, animations, mobile responsiveness |
| `logo.svg` | Simplified bowl logo icon inspired by the Em's Taste sample logo |
| `menu.js` | Menu items, prices, availability, schedule settings |
| `app.js` | Menu rendering, cart, cutoff display, order summary and sharing |

## How to preview locally

Open `index.html` in a modern browser. For more reliable Clipboard and Share API behavior, serve it over `localhost` or HTTPS.

For example, if Python is installed:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main**, folder **/(root)**, and click **Save**.
4. When GitHub has finished publishing, visit the URL shown under Pages.

Publishing makes the preview visible to others. **Do not present the preview as an automated order submission service.**

## Update the menu

Edit `menu.js`: change each item's `name`, `description`, `price`, `category`, `available`, and `tag`. Use category `ulam` or `sides`. Keep each `id` unique. You may optionally add an `image` path such as `images/adobo.jpg` after uploading a real food photo.

When all actual dishes and prices have replaced the examples, set `sampleMenu: false`.

The initial `previewMode: true` lets the family test the summary even outside the normal order window; a summary outside the cutoff is marked as a **preview**. Changing `previewMode: false` disables preparing new summaries outside the order window in the browser, **but browser-only cutoff enforcement is not secure** and must not be relied on for actual order acceptance.

## Current assumptions

- Customers choose meals Sunday–Thursday for pickup/distribution at participating workplaces on the next workday.
- Sunday orders are for Monday; Monday orders for Tuesday; ...; Thursday orders for Friday.
- Ordering closes at 11 PM PH time on each ordering day.
- Friday and Saturday have no ordering window.
- Holiday exceptions, order capacity, or temporary closures are not yet supported.
- Dedicated delivery is **not** advertised as available.

## What to build before a real launch

- A private order database and a secure backend to receive orders
- **Server-side** cutoff validation in the Asia/Manila timezone (clients can change their local clocks)
- An admin page to set the next day's menu, prices, stock caps, and available workplaces
- An order confirmation workflow and packing/cooking totals grouped by company
- Basic privacy notice and appropriate handling of customer information
- Testing of all flows on phones, including closed ordering days
- Optional delivery integration, only when the business is ready

Until a backend is connected, staff should confirm orders manually through an agreed messaging channel.

## Branding

The palette uses cream, terracotta, and warm brown. The `logo.svg` is an intentionally simplified vector **icon**, not an exact copy of the previously generated sample logo. It can be replaced by a finalized, production-ready brand asset later.
