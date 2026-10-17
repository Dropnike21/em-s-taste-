/**
 * Em's Taste reference recipes: curated, unranked common Filipino dishes.
 * The templates are NOT a live menu, stock list, price list, or recipe guarantee.
 * Staff choose a template, confirm preparation, set price, then save it to Firestore.
 * Public sources: https://www.tasteatlas.com/philippines
 * https://www.pna.gov.ph/articles/1273614
 */
export const FILIPINO_DISHES = Object.freeze([
  {
    "id": "pork-adobo",
    "name": "Pork Adobo",
    "description": "Pork simmered in vinegar, soy sauce, garlic, bay leaves and pepper.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "sinigang-na-baboy",
    "name": "Sinigang na Baboy",
    "description": "Pork and vegetables in a comforting, tamarind-sour broth.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pork-menudo",
    "name": "Pork Menudo",
    "description": "Pork and vegetables cooked in a savory tomato-based sauce.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pork-sisig",
    "name": "Pork Sisig",
    "description": "Sizzling chopped pork with onions and calamansi flavors.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "lechon-kawali",
    "name": "Lechon Kawali",
    "description": "Crispy pork belly, traditionally served with a dipping sauce.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "crispy-pata",
    "name": "Crispy Pata",
    "description": "Crispy pork leg with tender meat, served with dipping sauce.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "bicol-express",
    "name": "Bicol Express",
    "description": "Pork simmered in rich coconut milk with chilies.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pork-binagoongan",
    "name": "Pork Binagoongan",
    "description": "Pork cooked with shrimp paste and aromatic seasonings.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "dinuguan",
    "name": "Dinuguan",
    "description": "Savory pork stew traditionally made with pork blood and vinegar.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "paksiw-na-pata",
    "name": "Paksiw na Pata",
    "description": "Pork hock slowly simmered in a tangy, lightly sweet sauce.",
    "group": "Pork",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "chicken-adobo",
    "name": "Chicken Adobo",
    "description": "Chicken braised in vinegar, soy sauce, garlic and bay leaves.",
    "group": "Chicken",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "tinolang-manok",
    "name": "Tinolang Manok",
    "description": "Chicken soup with ginger, green papaya and leafy greens.",
    "group": "Chicken",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "chicken-afritada",
    "name": "Chicken Afritada",
    "description": "Chicken and vegetables in a Filipino-style tomato sauce.",
    "group": "Chicken",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "chicken-inasal",
    "name": "Chicken Inasal",
    "description": "Visayan-style grilled chicken with citrus and savory marinade.",
    "group": "Chicken",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "beef-caldereta",
    "name": "Beef Caldereta",
    "description": "Tender beef in a rich tomato-based stew with vegetables.",
    "group": "Beef",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "kare-kare",
    "name": "Kare-Kare",
    "description": "Filipino peanut stew with meat and vegetables, served with bagoong.",
    "group": "Beef",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "sinigang-na-hipon",
    "name": "Sinigang na Hipon",
    "description": "Shrimp and vegetables served in a sour, savory broth.",
    "group": "Seafood",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "paksiw-na-bangus",
    "name": "Paksiw na Bangus",
    "description": "Milkfish simmered in vinegar, ginger and other aromatics.",
    "group": "Seafood",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "daing-na-bangus",
    "name": "Daing na Bangus",
    "description": "Marinated, pan-fried milkfish with garlic and vinegar flavors.",
    "group": "Seafood",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "fried-tilapia",
    "name": "Fried Tilapia",
    "description": "Crisp fried tilapia, commonly paired with rice and sawsawan.",
    "group": "Seafood",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "laing",
    "name": "Laing",
    "description": "Taro leaves gently simmered in coconut milk and chilies.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pinakbet",
    "name": "Pinakbet",
    "description": "Mixed vegetables cooked with savory fermented seafood seasoning.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "tortang-talong",
    "name": "Tortang Talong",
    "description": "Grilled eggplant coated in egg and pan-fried.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "ginisang-monggo",
    "name": "Ginisang Monggo",
    "description": "Mung bean stew with garlic, onions and leafy greens.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "ginisang-ampalaya",
    "name": "Ginisang Ampalaya",
    "description": "Sautéed bitter melon with egg and aromatics.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "lumpiang-gulay",
    "name": "Lumpiang Gulay",
    "description": "Crispy vegetable spring rolls.",
    "group": "Vegetables & egg",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "lumpiang-shanghai",
    "name": "Lumpiang Shanghai",
    "description": "Crispy Filipino-style meat spring rolls.",
    "group": "Noodles & favorites",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pancit-bihon",
    "name": "Pancit Bihon",
    "description": "Rice noodles sautéed with vegetables and savory seasonings.",
    "group": "Noodles & favorites",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pancit-canton",
    "name": "Pancit Canton",
    "description": "Stir-fried egg noodles with vegetables and savory seasonings.",
    "group": "Noodles & favorites",
    "category": "ulam",
    "tag": "Lutong bahay"
  },
  {
    "id": "pork-barbecue",
    "name": "Pork Barbecue",
    "description": "Filipino-style marinated pork skewers grilled until flavorful.",
    "group": "Noodles & favorites",
    "category": "ulam",
    "tag": "Lutong bahay"
  }
]);
