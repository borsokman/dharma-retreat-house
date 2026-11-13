import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CarFront, Check } from "lucide-react";
import { WhatsAppButton } from "../components/WhatsAppButton";
import { images } from "../data/images";
import "./TawangPage.css";

type Block = {
  title: string;
  paragraphs: string[];
  image: string;
  alt: string;
  imageSide: "left" | "right";
  size: "tall" | "medium" | "short";
};

/* ---------- Intro blocks (zig-zag image + text) ---------- */

const introBlocks: Block[] = [
  {
    title: "Where is Tawang?",
    paragraphs: [
      "Tawang in Arunachal Pradesh, located in the north-eastern part of India bordering Tibet in the north and Bhutan in the south-west, is praised by all as the unexplored beauty of the North-East with majestic mountain peaks, lakes, forests and waterfalls.",
      "It is one of the most beautiful places in India, ornamented with its rich cultures and traditions.",
    ],
    image: images.tawang.map,
    alt: "Map showing Tawang in Arunachal Pradesh, between Tibet and Bhutan",
    imageSide: "right",
    size: "medium",
  },
  {
    title: "Land of monasteries and masters",
    paragraphs: [
      "Tawang is home to Tawang Monastery, the second largest Buddhist monastery in the world, founded by the great 5th Dalai Lama in the 17th century.",
      "It is also the birthplace of the 6th Dalai Lama and has been the birthplace of many great masters over the centuries.",
    ],
    image: images.tawang.monks,
    alt: "Monks in red robes in the courtyard of a Tawang monastery",
    imageSide: "left",
    size: "medium",
  },
  {
    title: "A small district with a big heart",
    paragraphs: [
      "With an area of 2,000 square kilometres and a population of around sixty thousand, Tawang is one of the smallest districts in Arunachal Pradesh. The majority of the people are followers of Tibetan Buddhism and are very dedicated, religious and hard-working. The local spoken dialect is Monpa, emerging from the Bhoti language, which resembles the Central Tibetan dialect and is also spoken in many other parts of the Himalayan region.",
      "Tawang is blessed with a number of monasteries, nunneries and stupas, which give it a very religious appearance, while at the same time there have been tremendous developments in infrastructure lately.",
      "In today's globalised world the people of Tawang, like many small traditional communities around the world, are facing challenges in preserving their distinctive identity while at the same time integrating into a global community.",
    ],
    image: images.tawang.town,
    alt: "Tawang town and its golden Buddha statue beneath a dark sky",
    imageSide: "right",
    size: "tall",
  },
  {
    title: "The Monpa People and Culture",
    paragraphs: [
      "The Monpas are one of the major tribes of Arunachal Pradesh. The Monpas are Buddhists by religion and Tawang Monastery is the fountainhead of their spiritual lives. They are by and large agriculturists and they have their own distinctive way of clothing themselves, well adapted to the conditions of their environment.",
    ],
    image: images.tawang.monpaCulture,
    alt: "Monpa people in traditional attire",
    imageSide: "left",
    size: "medium",
  },
];

/* ---------- Visiting places (zig-zag, ordered by travel distance) ---------- */

const placeGroups: { label: string; places: Block[] }[] = [
  {
    label: "Within Tawang town",
    places: [
      {
        title: "Tawang Monastery",
        paragraphs: [
          "Tawang Monastery is a Buddhist monastery located in Tawang, Arunachal Pradesh, India. It is the largest Buddhist monastery in the country. It is situated in the valley of the Tawang Chu, in close proximity to the Chinese and Bhutanese border.",
          'Tawang Monastery is known in Tibetan as Gaden Namgyal Lhatse, which translates to "the divine paradise of complete victory". It was founded by Merak Lama Lodre Gyatso in 1680–1681 in accordance with the wishes of the 5th Dalai Lama, Ngawang Lobsang Gyatso. It belongs to the Gelug school of Vajrayana Buddhism and had a religious association with Drepung Monastery of Lhasa, which continued during the period of British rule.',
          "The monastery is three stories high. It is enclosed by a 925 feet (282 m) long compound wall. Within the complex there are 65 residential buildings. The library of the monastery has valuable old scriptures, mainly Kangyur and Tengyur.",
        ],
        image: images.tawang.monastery,
        alt: "Tawang Monastery",
        imageSide: "left",
        size: "medium",
      },
      {
        title: "Urgelling Gompa",
        paragraphs: [
          "Hidden amidst the quiet landscapes of Tawang in Arunachal Pradesh, Urgelling Gompa is a monastery of profound spiritual significance. Though small and modest compared to the grandeur of Tawang Monastery, it holds a revered place in Buddhist history as the birthplace of the 6th Dalai Lama, Tsangyang Gyatso (1683–1706).",
          "This ancient monastery, believed to have been built in the 14th century, is a sanctuary of peace and devotion. Surrounded by prayer flags fluttering in the wind, its walls echo with centuries of faith and tradition. For travelers seeking to connect with authentic Tibetan Buddhist culture and enjoy moments of quiet reflection, Urgelling Gompa is an unmissable stop on an Arunachal Pradesh travel itinerary.",
        ],
        image: images.tawang.urgelingGompa,
        alt: "Urgeling Gompa",
        imageSide: "right",
        size: "medium",
      },
      {
        title: "Tawang War Memorial",
        paragraphs: [
          "Amidst the beautiful landscape of Tawang stands a solemn and historic site: the Tawang War Memorial. This stupa stands as a poignant testament to the brave Indian soldiers who laid down their lives during the 1962 Indo-China War. The imposing structure is adorned with names of the martyrs, their regiments, and inscriptions honouring their sacrifice.",
        ],
        image: images.tawang.warMemorial,
        alt: "Tawang War Memorial",
        imageSide: "left",
        size: "medium",
      },
    ],
  },
  {
    label: "South-east toward Sela Pass",
    places: [
      {
        title: "Nuranang Waterfalls",
        paragraphs: [
          "Nuranang Falls (also known as Jung Falls & Bong Bong Falls), 100 m high waterfall, is located 2 km northeast of the Jung town on the motorable Jung Falls Road in the Tawang district of Arunachal Pradesh state of India. Jung is 40 km southeast of Tawang, north of Sela Tunnel, and between Tawang and Bomdila on NH-13 Trans-Arunachal Highway. Jung Hydal Plant, near the base of fall, is a small hydel plant which generates electricity for local use.",
          "The Nuranang river originates from the Northern slopes of the Sela Pass. Shortly after the waterfall it confluences with the Tawang river.",
        ],
        image: images.tawang.nuranang,
        alt: "Nuranang Waterfalls",
        imageSide: "right",
        size: "tall",
      },
      {
        title: "Jaswantgarh War Memorial",
        paragraphs: [
          "The Eastern Himalayas are known for their breathtaking mountain landscapes, peaceful monasteries and remarkable stories of courage. Among the important historical landmarks in Arunachal Pradesh, Jaswantgarh War Memorial holds a special place. Located along the mountain highway leading to Tawang, this memorial honours Rifleman Jaswant Singh Rawat of the 4th Garhwal Rifles, remembered for his bravery during the 1962 Sino-Indian War.",
        ],
        image: images.tawang.jaswantgarh,
        alt: "Jaswantgarh War Memorial",
        imageSide: "left",
        size: "medium",
      },
      {
        title: "Sela Lake",
        paragraphs: [
          "Perched high in the Eastern Himalayas at an altitude of around 13,700 feet, Sela Lake, also known as Paradise Lake, is one of the most breathtaking natural wonders in Arunachal Pradesh. Located near Sela Pass, on the road connecting Tawang with Dirang and Bomdila, this pristine glacial lake offers an unforgettable experience of serenity, spirituality, and surreal beauty.",
          "Sela Lake, surrounded by snow-clad mountains and fluttering prayer flags, is not just a visual spectacle; it’s a sacred site revered by local Buddhist communities and a must-visit stop for every traveller journeying through Tawang’s Himalayan highway.",
        ],
        image: images.tawang.selaLake,
        alt: "Sela Lake",
        imageSide: "right",
        size: "medium",
      },
      {
        title: "Sela Pass",
        paragraphs: [
          "The Sela Pass (Se La) is a high-altitude mountain pass located on the border between the Tawang and West Kameng districts in the Indian state of Arunachal Pradesh. It has an elevation of 4170 m (13,700 ft) and connects the Indian Buddhist town of Tawang to Dirang and Guwahati. The pass carries the National Highway 13 (previously NH 229), connecting Tawang with the rest of India. The pass supports scarce amounts of vegetation and is usually snow-covered to some extent throughout the year. Sela Lake, near the summit of the pass, is one of approximately 101 lakes in the area that are sacred in Tibetan Buddhism. While Sela Pass does get heavy snowfall in winters, it is usually open throughout the year unless landslides or snow require the pass to be shut down temporarily. Sela pass is one of the highest motorable mountain passes in the world.",
        ],
        image: images.tawang.selaPass,
        alt: "Sela Pass",
        imageSide: "left",
        size: "medium",
      },
    ],
  },
  {
    label: "North of Tawang",
    places: [
      {
        title: "Pankang Teng Tso Lake",
        paragraphs: [
          "Penga Teng Tso Lake—more commonly called P.T. Tso or Pankang Teng Tso—is a high-altitude glacial lake near Tawang in Arunachal Pradesh, India. It is a popular scenic stop on the road toward Bum La Pass.",
        ],
        image: images.tawang.pengaTengTso,
        alt: "Penga Teng Tso Lake",
        imageSide: "right",
        size: "medium",
      },
      {
        title: "Sangetsar Tso lake",
        paragraphs: [
          "Created by falling rocks, boulders and trees in an earthquake, there is a Sangetsar Tso lake (lake is called Tso in Tibetan) that featured Madhuri Dixit (Bollywood actress) in the movie Koyla, as a result this lake is sometimes also called Madhuri lake. The lake is about 20 km from Tawang town, about 7 km beyond the bifurcation of road leading to Bum La Pass.",
        ],
        image: images.tawang.sungesterLake,
        alt: "Sungester Lake",
        imageSide: "left",
        size: "medium",
      },
      {
        title: "Bumla Pass",
        paragraphs: [
          "The Bum La Pass (Tibetan: བུམ་ལ་) is a border pass between China's Tsona County in Tibet and India's Tawang district in Arunachal Pradesh. It is 37 km away from the town of Tawang in India's Tawang district and 43 km from the town of Tsona Dzong in China's Tsona County. The pass currently serves as a trading point between Arunachal Pradesh and Tibet. It is also an agreed Border Personnel Meeting Point for the security forces of China and India.",
          "The road to Bum La is also a historical route, the People's Liberation Army of China invaded India during the 1962 Sino-Indian War. Here in Bum La Pass one of the fiercest battles, the Battle of Bum La Pass, took place in the 1962 Sino-Indian War.",
        ],
        image: images.tawang.bumlaPass,
        alt: "Bumla Pass",
        imageSide: "right",
        size: "medium",
      },
    ],
  },
];

/* ---------- Best Time to Visit ---------- */

const seasonTable: {
  season: string;
  months: string;
  temperature: string;
}[] = [
  { season: "Summers", months: "March to June", temperature: "5 °C – 22 °C" },
  {
    season: "Monsoon",
    months: "July to September",
    temperature: "15 °C – 20 °C",
  },
  {
    season: "Winters",
    months: "November to February",
    temperature: "2 °C – 10 °C",
  },
];

const seasonDetails: {
  heading: string;
  text: string;
}[] = [
  {
    heading: "Tawang in summer — March to June",
    text: "Summer is the best time to visit Tawang. The temperature during this time ranges between 5 °C and 22 °C. The days are pleasant and nights are colder. On your visit to Tawang, don't forget to visit the popular attractions: Tawang Monastery, Sela Pass, Taktsang Gompa, Gorichen Peak and Shonga-tser Lake.",
  },
  {
    heading: "Tawang in monsoon — July to September",
    text: "Tawang is mostly wet during the monsoon season. Copious rainfall is sprinkled all over the vicinity and the temperature drops. However, Tawang looks even more enchanting during this season. Visiting Tawang in monsoon is a good idea if you love rains.",
  },
  {
    heading: "Tawang in winter — November to February",
    text: "Winters in Tawang are chilly and the temperature sometimes drops near the freezing point. The maximum temperature during winters in Tawang gets around 10 °C. The coldest month of winter is January. If you are travelling to Tawang during this season, make sure you have enough clothing to keep yourself warm.",
  },
];

/* ---------- ILP / PAP info (two-column, no image) ---------- */

const ilpColumns: {
  title: string;
  items: { label: string; value: string }[];
  note?: string;
}[] = [
  {
    title: "For Indian Citizens",
    items: [
      {
        label: "Requirement",
        value:
          "All Indian citizens residing outside Arunachal require an Inner Line Permit (ILP) to enter the state. This is a mandatory safety and conservation measure.",
      },
      {
        label: "Online Application",
        value: "Apply via the official eILP portal (eilp.arunachal.gov.in).",
      },
      { label: "Validity", value: "Usually issued for 15 days, extendable." },
      {
        label: "Offline",
        value:
          "Available at Resident Commissioner offices in Delhi, Kolkata and Guwahati.",
      },
      {
        label: "Documents needed",
        value: "Aadhaar Card, passport-size photo and address proof.",
      },
    ],
  },
  {
    title: "For Foreign Nationals",
    items: [
      {
        label: "Requirement",
        value:
          "Foreign travellers require a Protected Area Permit (PAP). This is typically issued for a group of 2 or more people.",
      },
      { label: "Group Requirement", value: "Minimum 2 adults required." },
      { label: "Duration", value: "Issued for 30 days." },
      { label: "Fee", value: "Approximately $50 per person." },
    ],
    note: "Certain areas near borders may have additional restrictions for foreign tourists.",
  },
];

/* ---------- How to reach blocks (zig-zag) ---------- */

const reachBlocks: Block[] = [
  {
    title: "Reaching Tawang by air",
    paragraphs: [
      "The nearest international airport from Tawang is Lokpriya Gopinath Bordoloi International Airport, Guwahati, roughly 480 km from Tawang. It is well connected with major cities like Delhi, Mumbai, Kolkata, Bengaluru, Hyderabad, Chennai and many others.",
    ],
    image: images.tawang.highLake,
    alt: "A still mountain lake beneath snow-dusted peaks and clouds",
    imageSide: "right",
    size: "medium",
  },
  {
    title: "Guwahati to Tawang by helicopter",
    paragraphs: [
      "Helicopter service operates from Guwahati Airport to Tawang on Monday, Tuesday, Thursday and Friday. Due to the limited number of seats (on average only 10–12), booking early is essential. The helicopter journey to Tawang over Bhutan takes around 55 minutes.",
    ],
    image: images.tawang.plainsDusk,
    alt: "Distant blue mountain ranges at dusk over a wide river plain",
    imageSide: "left",
    size: "medium",
  },
  {
    title: "Guwahati to Tawang by road",
    paragraphs: [
      "Tawang is 480 km from Guwahati city in Assam. A journey by car takes around 12 hours, passing through various small towns and villages. The highest peak to cross is Sela Pass, at an altitude of 4,170 metres above sea level.",
    ],
    image: images.tawang.bridge,
    alt: "A wooden suspension bridge decorated with colourful prayer flags over a river",
    imageSide: "right",
    size: "medium",
  },
];

/* ---------- Render helpers ---------- */

function ZigZagBlock({ block }: { block: Block }) {
  return (
    <article
      className={`tawang-block tawang-block--${block.imageSide} tawang-block--${block.size}`}
    >
      <div className="tawang-block__img">
        <img
          src={block.image}
          alt={block.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="tawang-block__body">
        <h2>{block.title}</h2>
        {block.paragraphs.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </article>
  );
}

const taxiTrips = [
  "Bumla Pass & Sangetsar Lake trips",
  "Chumi Gyatsar holy waterfalls circuit",
  "Full-day Tawang sightseeing",
  "Guwahati – Tawang direct drops & pickups",
];

export default function TawangPage() {
  return (
    <>
      {/* Hero */}
      <section className="tawang-hero" aria-label="Welcome to Tawang">
        <img
          src={images.tawang.hero}
          alt="Blue mountain ridges of Tawang beneath dramatic clouds"
          className="tawang-hero__img"
        />
        <div className="tawang-hero__overlay" aria-hidden="true" />
        <div className="tawang-hero__content container">
          <p className="eyebrow tawang-hero__eyebrow">
            Arunachal Pradesh, India
          </p>
          <h1>Tawang</h1>
          <p className="tawang-hero__lede">
            Majestic peaks, quiet lakes and living monastery culture — the
            unexplored beauty of India's North-East.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="section" aria-label="About Tawang">
        <div className="container">
          {introBlocks.map((block) => (
            <ZigZagBlock key={block.title} block={block} />
          ))}
        </div>
      </section>

      {/* Visiting places */}
      <section
        className="section section--sage"
        aria-label="Places to visit around Tawang"
      >
        <div className="container">
          <div className="section-head section-head--center">
            <p className="eyebrow">Explore the region</p>
            <h2>Places to visit around Tawang</h2>
            <p className="lede">
              Organised by travel distance from the hotel in Tawang — starting
              within the town, then heading south-east toward Sela Pass, and
              finally north toward the border.
            </p>
          </div>

          {placeGroups.map((group) => (
            <Fragment key={group.label}>
              <h3 className="tawang-route-label">{group.label}</h3>
              {group.places.map((block) => (
                <ZigZagBlock key={block.title} block={block} />
              ))}
            </Fragment>
          ))}
        </div>
      </section>

      {/* Best Time to Visit */}
      <section
        className="section section--sage"
        aria-label="Best time to visit Tawang"
      >
        <div className="container">
          <div className="section-head section-head--center">
            <p className="eyebrow">Plan your trip</p>
            <h2>Best time to visit Tawang</h2>
          </div>
          <div className="season-table-wrap">
            <table className="season-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Months</th>
                  <th>Temperature</th>
                </tr>
              </thead>
              <tbody>
                {seasonTable.map((row) => (
                  <tr key={row.season}>
                    <td data-label="Season">{row.season}</td>
                    <td data-label="Months">{row.months}</td>
                    <td data-label="Temperature">{row.temperature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="season-details">
            {seasonDetails.map((s) => (
              <div className="season-detail" key={s.heading}>
                <h3>{s.heading}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ILP / PAP — two-column */}
      <section className="section" aria-label="Inner Line Permit information">
        <div className="container">
          <div className="section-head section-head--center">
            <p className="eyebrow">Before you travel</p>
            <h2>Inner Line Permit (ILP) information</h2>
            <p className="lede">
              Essential travel documents required for every visitor entering the
              state of Arunachal Pradesh.
            </p>
          </div>

          <div className="ilp-grid">
            {ilpColumns.map((col) => (
              <div className="ilp-card" key={col.title}>
                <h3 className="ilp-card__title">{col.title}</h3>
                <dl className="ilp-card__list">
                  {col.items.map((item) => (
                    <div className="ilp-card__item" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {col.note && (
                  <p className="ilp-card__note">
                    <strong>Note:</strong> {col.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to reach */}
      <section
        className="section section--sage"
        aria-label="How to reach Tawang"
      >
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Getting here</p>
            <h2>How to reach Tawang</h2>
          </div>
          {reachBlocks.map((block) => (
            <ZigZagBlock key={block.title} block={block} />
          ))}
        </div>
      </section>

      {/* Sightseeing taxis */}
      <section className="section" aria-labelledby="taxi-title">
        <div className="container">
          <div className="section-head section-head--center">
            <p className="eyebrow">Getting around</p>
            <h2 id="taxi-title">Safe & reliable sightseeing taxis</h2>
            <p className="lede">
              Travel with complete peace of mind. We arrange reliable local
              drivers, safe vehicles, and a replacement taxi anywhere during
              your trip in Tawang.
            </p>
          </div>

          <div className="taxi-card">
            <CarFront
              size={32}
              aria-hidden="true"
              className="taxi-card__icon"
            />
            <ul className="taxi-card__list">
              {taxiTrips.map((trip) => (
                <li key={trip}>
                  <Check size={18} aria-hidden="true" /> {trip}
                </li>
              ))}
            </ul>
            <p className="taxi-card__note">
              Ask at the front desk for current seasonal rates and travel
              assistance.
            </p>
            <WhatsAppButton label="Ask about a taxi" />
          </div>

          <div className="text-center" style={{ marginTop: "var(--space-5)" }}>
            <p
              className="lede"
              style={{ maxWidth: 560, margin: "0 auto 16px" }}
            >
              Dharma Retreat House sits right in this landscape — rest here
              while you explore.
            </p>
            <Link to="/book" className="btn btn--primary">
              Book your stay <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
