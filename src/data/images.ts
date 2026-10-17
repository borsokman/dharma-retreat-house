/**
 * Central image registry.
 *
 * The hero uses the real photo in /public. Every other image is a neutral
 * placeholder: replace the entry with the real photo URL when available —
 * every page references images from here only.
 */
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='940' height='650'%3E%3Crect width='940' height='650' fill='%23E8EDE5'/%3E%3Cpath d='M470 180c100 60 180 150 168 260S520 610 470 610s-146-60-158-170 68-200 158-260Z' fill='%23D3DCD0'/%3E%3C/svg%3E";

export const images = {
  hero: "/dharmahouse-hero.jpg",
  tawang: {
    hero: "/tawang-hero.jpg",
    waterfall1: "/waterfall-tawang-1.jpg",
    waterfall2: "/waterfall-tawang-2.jpg",
    alcove: "/tawang-alcove.jpg",
    lake: "/lake-tawang-3.jpg",
  },
  rooms: {
    gardenDouble: PLACEHOLDER,
    woodenDetail: PLACEHOLDER,
    mountainTwin: PLACEHOLDER,
    balcony: PLACEHOLDER,
    valleySuite: PLACEHOLDER,
    breakfast: PLACEHOLDER,
  },
  restaurant: {
    interior: PLACEHOLDER,
    tableSetting: PLACEHOLDER,
    candles: PLACEHOLDER,
    wine: PLACEHOLDER,
  },
  mission: {
    classroom: PLACEHOLDER,
    studying: PLACEHOLDER,
    teacher: PLACEHOLDER,
  },
  gallery: {
    monastery: PLACEHOLDER,
    stupa: PLACEHOLDER,
    prayerFlags: PLACEHOLDER,
    himalayaSunrise: PLACEHOLDER,
    himalayaMist: PLACEHOLDER,
    goldenHour: PLACEHOLDER,
    gardenPath: PLACEHOLDER,
    gardenFlowers: PLACEHOLDER,
    gardenStone: PLACEHOLDER,
  },
} as const;
