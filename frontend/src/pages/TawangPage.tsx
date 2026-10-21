import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { images } from "../data/images";
import "./TawangPage.css";

/**
 * All Tawang content as alternating image/text blocks. imageSide controls the
 * zig-zag on desktop; size sets the image height tier so taller text columns
 * get taller images.
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
  {
    title: "The best time to visit Tawang",
    paragraphs: [
      "Tawang experiences summer from March until June. The temperature remains comfortable between 5°C and 21°C and is apt to experience the beauty of the place.",
      "July and September are the months of monsoon, and Tawang experiences moderate rainfall during this season. November to February is the winter season, when temperatures range from −11°C to 12°C.",
      "The best season to visit Tawang is the summer season and the onset of the monsoon. The temperature remains comfortable and is apt for sightseeing. The best months to visit are March, April, May, June, September and October.",
    ],
    image: images.tawang.mountainLake,
    alt: "A high-altitude mountain lake reflecting clouds and rocky peaks",
    imageSide: "left",
    size: "tall",
  },
  {
    title: "How to reach Tawang by air",
    paragraphs: [
      "The nearest international airport from Tawang is Lokpriya Gopinath Bordoloi International Airport, Guwahati, roughly 480 km from Tawang. It is well connected with major cities like Delhi, Mumbai, Kolkata, Bengaluru, Hyderabad, Chennai and many others.",
    ],
    image: images.tawang.plainsDusk,
    alt: "Distant blue mountain ranges at dusk over a wide river plain",
    imageSide: "right",
    size: "short",
  },
  {
    title: "Guwahati to Tawang by helicopter",
    paragraphs: [
      "Helicopter service operates from Guwahati Airport to Tawang on Monday, Tuesday, Thursday and Friday. Due to the limited number of seats (on average only 10–12), booking early is essential. The helicopter journey to Tawang over Bhutan takes around 55 minutes.",
    ],
    image: images.tawang.selaRoad,
    alt: "The winding road climbing toward Sela Pass under heavy clouds",
    imageSide: "left",
    size: "short",
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
  {
    title: "Permits to enter Arunachal Pradesh",
    paragraphs: [
      "Inner Line Permit (ILP): for Indian nationals other than natives of Arunachal Pradesh, an Inner Line Permit is required for entering any part of Arunachal Pradesh.",
      "Protected Area Permit (PAP): the Foreigners (Protected Areas) Act requires foreigners to obtain a Protected Area Permit to visit certain areas in India. This requirement is in addition to getting an Indian visa. Detailed information is available at arunpol.gov.in/ilp.html.",
    ],
    image: images.tawang.welcomeGate,
    alt: "The colourful 'Welcome to Tawang' gateway decorated with prayer flags",
    imageSide: "left",
    size: "medium",
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

      <section className="section" aria-label="About Tawang and planning your visit">
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
          <div className="text-center" style={{ marginTop: "var(--space-5)" }}>
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
