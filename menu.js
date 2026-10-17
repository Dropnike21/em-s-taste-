/**
 * Em's Taste — editable storefront settings and example menu.
 * Replace the sample dishes, prices, and descriptions before opening for orders.
 * Images are optional: add an image: "images/adobo.jpg" property if available.
 *
 * Orders currently produce a shareable summary only; they are NOT saved to a
 * server. See README.md for the limitations and steps before launching.
 */
window.EMS_CONFIG = {
  timezone: "Asia/Manila",
  cutoffHour: 23,
  previewMode: true, // Allows testing the order summary while ordering is closed.
  sampleMenu: true    // Turn off after replacing ALL example dishes and prices.
};

window.EMS_MENU = [
  {
    id: "pork-adobo",
    name: "Pork Adobo",
    description: "A savory Filipino classic with soy, vinegar, and comforting spices.",
    category: "ulam",
    price: 75,
    tag: "Filipino favorite",
    palette: "coral",
    available: true
  },
  {
    id: "chicken-afritada",
    name: "Chicken Afritada",
    description: "Tender chicken simmered in a rich tomato-based sauce.",
    category: "ulam",
    price: 85,
    tag: "Comfort food",
    palette: "sage",
    available: true
  },
  {
    id: "bicol-express",
    name: "Bicol Express",
    description: "Creamy coconut flavors with a satisfying spicy kick.",
    category: "ulam",
    price: 80,
    tag: "A little spicy",
    palette: "coral",
    available: true
  },
  {
    id: "pork-menudo",
    name: "Pork Menudo",
    description: "Hearty, home-style pork and vegetables in tomato sauce.",
    category: "ulam",
    price: 85,
    tag: "Lutong bahay",
    palette: "sage",
    available: true
  },
  {
    id: "steamed-rice",
    name: "Steamed Rice",
    description: "Warm rice — just the right partner for your favorite ulam.",
    category: "sides",
    price: 15,
    tag: "Meal essential",
    palette: "cream",
    available: true
  },
  {
    id: "extra-rice",
    name: "Extra Rice",
    description: "An extra serving of rice for an extra satisfying lunch.",
    category: "sides",
    price: 15,
    tag: "Add-on",
    palette: "cream",
    available: true
  }
];
