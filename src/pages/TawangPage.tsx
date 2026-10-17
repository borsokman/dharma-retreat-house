import { Link } from "react-router-dom";
import { ArrowRight, Landmark, Plane, Sun } from "lucide-react";
import { images } from "../data/images";
import "./TawangPage.css";
/**
 * Content blocks rendered as a zig-zag: image right (text first) then image
 * left (text after). The image gets a height class that roughly matches the
 * length of its accompanying text so columns stay balanced.
 */
const blocks: {
  title: string;
  paragraphs: string[];
  image: string;
  alt: string;
  imageSide: "left" | "right";
  size: "tall" | "medium" | "short";
}[] = [
  {
    title: "An unexplored beauty of the North-East",
    paragraphs: [
      "Tawang in Arunachal Pradesh, located in the north-eastern part of India bordering Tibet in the north and Bhutan in the southwest, is praised by all as the unexplored beauty of the North-East with majestic mountain peaks, lakes, forests and waterfalls.",
      "It is one of the most beautiful places in India, ornamented with its rich cultures and traditions.",
    ],
    image: images.tawang.hero,
    alt: "Lush blue-green mountain ridges of Tawang under a dramatic cloudy sky",
    imageSide: "right",
    size: "medium",
  },
  {
    title: "Land of monasteries and masters",
    paragraphs: [
      "Tawang is home to Tawang Monastery, the second largest Buddhist monastery in the world, founded by the great 5th Dalai Lama in the 17th century.",
      "It is also the birthplace of the 6th Dalai Lama and has been the birthplace of many great masters over the centuries.",
    ],
    image: images.tawang.waterfall1,
    alt: "A powerful waterfall plunging down dark rocks in Tawang",
    imageSide: "left",
    size: "medium",
  },
  {
    title: "A small district with a big heart",
    paragraphs: [
      "With an area of 2,000 square kilometres and a population of around sixty thousand, Tawang is one of the smallest districts in Arunachal Pradesh. The majority of the people are followers of Tibetan Buddhism and are very dedicated, religious and hard working. The local spoken dialect is Monpa, emerging from the Bhoti language, which resembles the Central Tibetan dialect and is also spoken in many other parts of the Himalayan region.",
      "Tawang is blessed with a number of monasteries, nunneries and stupas, which give it a very religious appearance, while at the same time there have been tremendous developments in infrastructure lately.",
      "In today's globalized world the people of Tawang, like many small traditional communities around the world, are facing challenges in preserving their distinctive identity while at the same time integrating into a global community.",
    ],
    image: images.tawang.lake,
    alt: "A calm lake framed by dense pine forest and prayer flags in Tawang",
    imageSide: "right",
    size: "tall",
  },
];

const visitTips = [
  {
    icon: Sun,
    title: "Best time to visit",
    body: [
      "Summer lasts from March until June, with comfortable temperatures between 5°C and 21°C — perfect for experiencing the beauty of the place.",
      "July to September is the monsoon, with moderate rainfall. November to February is winter, with temperatures from −11°C to 12°C.",
      "The best months to visit are March, April, May, June, September and October.",
    ],
  },
  {
    icon: Plane,
    title: "How to reach Tawang",
    body: [
      "By air: the nearest international airport is Lokpriya Gopinath Bordoloi International Airport, Guwahati, roughly 480 km from Tawang, well connected with Delhi, Mumbai, Kolkata, Bengaluru, Hyderabad, Chennai and many other cities.",
      "By helicopter: a service operates from Guwahati Airport to Tawang on Monday, Tuesday, Thursday and Friday. Seats are limited (on average only 10–12), and the journey over Bhutan takes around 55 minutes.",
      "By road: Tawang is 480 km from Guwahati in Assam — around 12 hours by car through small towns and villages. The highest point to cross is Sela Pass at 4,170 m above sea level.",
    ],
  },
  {
    icon: Landmark,
    title: "Permits to enter Arunachal Pradesh",
    body: [
      "Inner Line Permit (ILP): for Indian nationals other than natives of Arunachal Pradesh, an ILP is required to enter any part of the state.",
      "Protected Area Permit (PAP): the Foreigners (Protected Areas) Act requires foreign visitors to obtain a PAP for certain areas — this is in addition to an Indian visa. Details: arunpol.gov.in/ilp.html",
    ],
  },
];

export default function TawangPage() {
  return (
    <>
      <section className="tawang-hero" aria-label="Welcome to Tawang">
        <img
          src={images.tawang.hero}
          alt="Blue mountain ridges of Tawang beneath dramatic clouds"
          className="tawang-hero__img"
        />
        <div className="tawang-hero__overlay" aria-hidden="true" />
        <div className="tawang-hero__content container">
          <p className="eyebrow tawang-hero__eyebrow">Arunachal Pradesh, India</p>
          <h1>Tawang</h1>
          <p className="tawang-hero__lede">
            Majestic peaks, quiet lakes and living monastery culture — the
            unexplored beauty of India's North-East.
          </p>
        </div>
      </section>

      <section className="section" aria-label="About Tawang">
        <div className="container">
          {blocks.map((block) => (
            <article
              key={block.title}
              className={`tawang-block tawang-block--${block.imageSide} tawang-block--${block.size}`}
            >
              <div className="tawang-block__img">
                <img src={block.image} alt={block.alt} loading="lazy" />
              </div>
              <div className="tawang-block__body">
                <h2>{block.title}</h2>
                {block.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--sage" aria-label="Planning your visit">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">Plan your journey</span>
            <h2>Visiting Tawang</h2>
            <p className="lede">
              Seasons, routes and permits — the essentials for a smooth trip.
            </p>
          </div>
          <div className="tawang-tips">
            {visitTips.map((tip) => (
              <article key={tip.title} className="card tawang-tip">
                <h3>
                  <tip.icon size={20} aria-hidden="true" /> {tip.title}
                </h3>
                {tip.body.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </article>
            ))}
          </div>
          <div className="text-center mt-4">
            <p className="lede" style={{ maxWidth: 560, margin: "0 auto 16px" }}>
              Dharma Retreat House sits right in this landscape — rest here
              while you explore.
            </p>
            <Link to="/stay" className="btn btn--primary">
              Book your stay <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
