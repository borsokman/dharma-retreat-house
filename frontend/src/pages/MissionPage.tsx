import { Link } from "react-router-dom";
import { images } from "../data/images";
import "./MissionPage.css";

type Chapter = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  image: string;
  alt: string;
};

// Text copied verbatim from the Tashol Tengyur School "About" page
// (https://borsokman.github.io/TSF/about/school). Keep it unedited;
// only the section eyebrows and titles are the hotel's own.
const chapters: Chapter[] = [
  {
    eyebrow: "Why it began",
    title: "A school for the children of Tawang",
    paragraphs: [
      "Tashol Tengyur School was established in 2022 by Tengyur Rinpoche to meet a critical need in Tawang, where there were no local, culturally appropriate Buddhist schools for lay children. Many poor families in Tawang and surrounding villages were forced to send their children to distant places for education, often at a very young age. Unfortunately, numerous families could not afford quality schooling or even basic necessities such as uniforms and books, leading many children to become child laborers. Recognizing this urgent challenge, Tengyur Rinpoche envisioned a school where children could be nurtured in an environment that preserved the language, culture, and living traditions of Tawang.",
    ],
    image: images.mission.gathering,
    alt: "A large gathering of teachers and community members in front of the school building",
  },
  {
    eyebrow: "The vision",
    title: "Modern education, Buddhist values",
    paragraphs: [
      "Rinpoche’s extensive research and visits to schools across India, Europe, Japan, and Singapore involved engaging with educators and students to identify the best teaching methods. The school’s mission was to provide a high-quality modern education infused with the altruistic principles of Buddha’s teachings. His vision is to nurture not only well-educated students but also compassionate, ethical individuals who contribute to a more peaceful world.",
      "The school curriculum followed the N.C.E.R.T. standards set by India’s Department of Education and is enriched with materials from the National Geographic School Curriculum, the U.S. Department of Education, and the Central Tibetan Administration in Dharamsala. It also incorporated the Social, Emotional, and Ethical (S.E.E.) Learning Program from Emory University and the 16 Guidelines from the Foundation for Developing Compassion and Wisdom (FDCW). Prior to opening, we invited Cecilia Buzon from Argentina, SEEL and 16 Guidelines facilitator who trained our teachers to implement these programs effectively.",
    ],
    image: images.mission.prayer,
    alt: "Pupils in school uniform with their hands folded in prayer",
  },
  {
    eyebrow: "The first classes",
    title: "Thirty first-graders",
    paragraphs: [
      "After visiting remote villages around Tawang to assess the needs of families, the school officially opened enrollment for the 2023–2024 academic year. In July 2022, Tashol Tengyur School was inaugurated by the eminent Buddhist teacher Kyabje Yongzin Ling Rinpoche, alongside local government officials and community leaders.",
      "The first cohort of 30 first-grade students began classes on March 15, 2023. The school’s team included a principal, teachers specializing in mathematics, Tibetan, and English, as well as administrative staff. The classrooms were equipped with modern teaching aids including large television screens, white and green boards, child-friendly furniture, and heating to ensure comfort throughout the year. Every student received free school materials, two sets of uniforms, shoes, bags, water bottles, and warm meals.",
    ],
    image: images.mission.firstClass,
    alt: "The first class of pupils holding up their drawings in the English classroom",
  },
  {
    eyebrow: "The school today",
    title: "A beacon of hope",
    paragraphs: [
      "After its inaugural year, due to difficulties in retaining qualified teachers locally, the school discontinued full primary operations but remains committed to offering out-of-school and summer courses focused on Buddhist and secular ethics. Tashol Tengyur School continues to stand as a beacon of hope, preserving the cultural and spiritual heritage of Tawang while preparing children to thrive in today’s world.",
    ],
    image: images.mission.craft,
    alt: "A teacher sitting in a circle with young pupils during a craft lesson",
  },
];

export default function MissionPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Our mission</span>
          <h1>Tashol Tengyur School</h1>
          <p className="lede">
            Education that nurtures knowledge, character, and a lasting
            connection to culture.
          </p>
        </div>
      </section>

      {chapters.map((chapter, i) => (
        <section
          key={chapter.image}
          className={i % 2 ? "section section--sage" : "section"}
        >
          <div
            className={
              i % 2
                ? "container mission-grid mission-grid--flip"
                : "container mission-grid"
            }
          >
            <div>
              <span className="eyebrow">{chapter.eyebrow}</span>
              <h2>{chapter.title}</h2>
              {chapter.paragraphs.map((text) => (
                <p key={text.slice(0, 32)} className="lede">
                  {text}
                </p>
              ))}
            </div>
            <div className="mission-page__img">
              <img
                src={chapter.image}
                alt={chapter.alt}
                loading={i === 0 ? "eager" : "lazy"}
                width="1024"
                height="768"
              />
            </div>
          </div>
        </section>
      ))}

      <section className="section text-center">
        <div className="container">
          <h2>Stay and give back</h2>
          <p className="lede" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            The earnings from Dharma Retreat House support Tashol Tengyur
            School.
          </p>
          <Link to="/book" className="btn btn--primary">
            Book a room
          </Link>
        </div>
      </section>
    </>
  );
}
