export const site = {
  name: "Dharma Retreat House",
  tagline: "A peaceful stay. A purpose beyond it.",
  description:
    "Enjoy a welcoming place to stay and dine, while supporting a meaningful cause.",
  charityName: "Tashol Tengyur School",
  charityNote:
    "All proceeds from your stay and dining support the Tashol Tengyur School, located in this same building.",
  email: "stay@dharma-retreat-house.org",
  phone: "+000 000 0000",
  addressLines: [
    "Dharma Retreat House",
    "Tashol Tengyur School Building",
    "[Street address]",
    "[Town / Region]",
  ],
  /** Replace with the real embed URL for the property's location. */
  mapEmbedUrl: "",
};

export const navLinks = [
  { label: "Home", to: "/" },
  { label: "Rooms", to: "/stay" },
  { label: "Buffet", to: "/buffet" },
  { label: "Explore Tawang", to: "/tawang" },
  // The Dharma Coffee House & Library page is not live yet — add its link
  // here once its route is enabled in App.tsx.
  { label: "Our Mission", to: "/our-mission" },
  { label: "Gallery", to: "/gallery" },
  { label: "Contact", to: "/contact" },
];

export const policies = {
  cancellation:
    "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours of check-in are charged the first night. No-shows are charged the full stay.",
  checkIn: "Check-in from 14:00",
  checkOut: "Check-out until 11:00",
  buffetCancellation:
    "Tables are held for 15 minutes past the reservation time. Cancel any time up to 2 hours before your reservation.",
};

/** Buffet seating times offered by the kitchen (HH:mm). */
export const buffetTimes = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
];
