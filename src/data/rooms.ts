import type { RoomType } from "../api/types";
import { images } from "../data/images";

/**
 * Static room catalog. With the mock adapter this is the demo inventory;
 * once the Go backend is live, rooms, descriptions and photos come from it.
 */
export const rooms: RoomType[] = [
  {
    slug: "garden-view-double",
    name: "Garden View Double",
    shortDescription:
      "A calm double room overlooking the garden, filled with morning light.",
    description:
      "Wake to the soft green of the garden. The Garden View Double pairs a comfortable queen bed with warm wood, natural fabrics, and a reading nook by the window — a quiet place to begin or end the day.",
    maxGuests: 2,
    bedType: "Queen bed",
    sizeSqm: 22,
    amenities: [
      "En-suite bathroom",
      "Garden view",
      "Tea & coffee making",
      "Free Wi-Fi",
      "Organic toiletries",
      "Daily housekeeping",
    ],
    photos: [images.rooms.gardenDouble, images.rooms.woodenDetail],
    basePrice: 75,
    currency: "USD",
  },
  {
    slug: "mountain-view-twin",
    name: "Mountain View Twin",
    shortDescription:
      "Two comfortable beds and a wide window onto the mountains.",
    description:
      "A bright, airy twin room with two full-sized beds and a wide window framing the surrounding hills. Ideal for friends travelling together or families with one child.",
    maxGuests: 3,
    bedType: "Two single beds",
    sizeSqm: 26,
    amenities: [
      "En-suite bathroom",
      "Mountain view",
      "Tea & coffee making",
      "Free Wi-Fi",
      "Writing desk",
      "Daily housekeeping",
    ],
    photos: [images.rooms.mountainTwin, images.rooms.balcony],
    basePrice: 85,
    currency: "USD",
  },
  {
    slug: "valley-suite",
    name: "Valley Suite",
    shortDescription:
      "A spacious suite with a sitting area and sweeping valley views.",
    description:
      "Our most generous room. The Valley Suite offers a king bed, a separate sitting area, and large windows that open onto the valley. A peaceful retreat after a day of walking, reading, or simply being.",
    maxGuests: 4,
    bedType: "King bed + sofa bed",
    sizeSqm: 38,
    amenities: [
      "En-suite bathroom",
      "Panoramic valley view",
      "Sitting area",
      "Tea & coffee making",
      "Free Wi-Fi",
      "Organic toiletries",
      "Breakfast included",
    ],
    photos: [images.rooms.valleySuite, images.rooms.breakfast],
    basePrice: 120,
    currency: "USD",
  },
];
