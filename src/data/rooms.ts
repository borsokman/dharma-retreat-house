import type { RoomType } from "../api/types";
import { images } from "../data/images";

/**
 * Static room catalog. With the mock adapter this is the demo inventory;
 * once the Go backend is live, rooms, descriptions and photos come from it.
 */
export const rooms: RoomType[] = [
  {
    slug: "luxury-suite",
    name: "Luxury Suite",
    shortDescription:
      "Room No: 205 — private balcony with panoramic mountain views and a separate living lounge.",
    description:
      "Our finest room. The Luxury Suite opens onto a private balcony with panoramic mountain views and offers a separate living area with a peaceful seating lounge — room 205, at the top of the house.",
    maxGuests: 3,
    bedType: "King bed",
    sizeSqm: 45,
    amenities: [
      "Private balcony with panoramic mountain views",
      "Separate living area & seating lounge",
      '55" Google TV',
      "Free high-speed Wi-Fi",
      "Complimentary daily breakfast",
    ],
    photos: [images.rooms.luxurySuite, images.rooms.balcony],
    basePrice: 140,
    currency: "USD",
  },
  {
    slug: "super-deluxe-king",
    name: "Super Deluxe King",
    shortDescription:
      "Room Nos: 201, 203, 208 & 210 — spacious king room with smart TV and tea & coffee facilities.",
    description:
      "A spacious layout with a king-size bed, a 55\" Google Smart TV, free Wi-Fi and tea & coffee facilities. Available as rooms 201, 203, 208 and 210.",
    maxGuests: 2,
    bedType: "King bed",
    sizeSqm: 32,
    amenities: [
      '55" Google Smart TV',
      "Free Wi-Fi",
      "Tea & coffee facilities",
      "Complimentary daily breakfast",
    ],
    photos: [images.rooms.superDeluxe, images.rooms.woodenDetail],
    basePrice: 100,
    currency: "USD",
  },
  {
    slug: "executive-twin",
    name: "Executive Twin",
    shortDescription:
      "Room No: 212 — two comfortable twin beds, ideal for travel companions or colleagues.",
    description:
      "Two comfortable twin beds in a calm, practical room — ideal for travel companions or colleagues sharing a trip. Room 212 comes with a 55\" Google TV, free Wi-Fi and complimentary daily breakfast.",
    maxGuests: 2,
    bedType: "Two twin beds",
    sizeSqm: 28,
    amenities: [
      "Two comfortable twin beds",
      '55" Google TV',
      "Free Wi-Fi",
      "Complimentary daily breakfast",
    ],
    photos: [images.rooms.twinExecutive, images.rooms.balcony],
    basePrice: 85,
    currency: "USD",
  },
  {
    slug: "standard-king",
    name: "Standard King",
    shortDescription:
      "Room Nos: 206 & 207 — cozy ambiance with a plush king bed and modern en-suite bathroom.",
    description:
      "A cozy ambiance with a plush king bed, a 55\" Google TV, free Wi-Fi and an en-suite modern bathroom. Available as rooms 206 and 207.",
    maxGuests: 2,
    bedType: "King bed",
    sizeSqm: 24,
    amenities: [
      "Plush king bed",
      '55" Google TV',
      "Free Wi-Fi",
      "En-suite modern bathroom",
      "Complimentary daily breakfast",
    ],
    photos: [images.rooms.standardKing, images.rooms.gardenDouble],
    basePrice: 70,
    currency: "USD",
  },
  {
    slug: "standard-twin",
    name: "Standard Twin",
    shortDescription:
      "Room Nos: 202, 204, 209 & 211 — two comfortable single beds in clean, cozy mountain accommodation.",
    description:
      "Two comfortable single twin beds, a 55\" Google TV and free Wi-Fi in clean, cozy mountain accommodation. Available as rooms 202, 204, 209 and 211.",
    maxGuests: 2,
    bedType: "Two single beds",
    sizeSqm: 22,
    amenities: [
      "Two comfortable single twin beds",
      '55" Google TV',
      "Free Wi-Fi",
      "Complimentary daily breakfast",
    ],
    photos: [images.rooms.standardTwin, images.rooms.mountainTwin],
    basePrice: 60,
    currency: "USD",
  },
];
