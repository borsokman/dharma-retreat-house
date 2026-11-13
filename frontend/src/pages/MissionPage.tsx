import { Link } from "react-router-dom";
import { images } from "../data/images";
import { site } from "../data/site";
import "./MissionPage.css";

type Chapter = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  image: string;
  alt: string;
};

// Text adapted from the Tashol Tengyur School "About" page.
const chapters: Chapter[] = [
  {
    eyebrow: "Why it began",
    title: "A school for the children of Tawang",
    paragraphs: [
      "Tashol Tengyur School was established in 2022 by Tengyur Rinpoche to meet a critical need in Tawang, where there were no local, culturally appropriate Buddhist schools for lay children. Many poor families in Tawang and the surrounding villages were forced to send their children to distant places for education, often at a very young age.",
      "Numerous families could not afford quality schooling or even basic necessities such as uniforms and books, leading many children to become child labourers. Recognising this urgent challenge, Rinpoche envisioned a school where children could be nurtured in an environment that preserved the language, culture and living traditions of Tawang.",
    ],
    image: images.mission.gathering,
    alt: "A large gathering of teachers and community members in front of the school building",
  },
  {
    eyebrow: "The vision",
    title: "Modern education, Buddhist values",
    paragraphs: [
      "Rinpoche's research took him to schools across India, Europe, Japan and Singapore, where he met educators and students to identify the best teaching methods. The school's mission is to provide a high-quality modern education infused with the altruistic principles of the Buddha's teachings — nurturing not only well-educated students, but compassionate, ethical individuals who contribute to a more peaceful world.",
      "The curriculum follows the N.C.E.R.T. standards of India's Department of Education, enriched with materials from the National Geographic School Curriculum, the U.S. Department of Education and the Central Tibetan Administration in Dharamsala. It also includes the Social, Emotional and Ethical (S.E.E.) Learning Program from Emory University and the 16 Guidelines from the Foundation for Developing Compassion and Wisdom. Before opening, the school invited Cecilia Buzon from Argentina, a SEE Learning and 16 Guidelines facilitator, to train its teachers.",
    ],
    image: images.mission.prayer,
    alt: "Pupils in school uniform with their hands folded in prayer",
  },
  {
    eyebrow: "The first classes",
    title: "Thirty first-graders",
    paragraphs: [
      "After visiting remote villages around Tawang to understand the needs of families, the school opened enrolment for the 2023–2024 academic year. In July 2022 it was inaugurated by the eminent Buddhist teacher Kyabje Yongzin Ling Rinpoche, alongside local government officials and community leaders.",
      "The first cohort of 30 first-grade students began classes on 15 March 2023, taught by a principal and teachers of mathematics, Tibetan and English. Classrooms had modern teaching aids, child-friendly furniture and heating for the cold months, and every student received free school materials, two sets of uniforms, shoes, a bag, a water bottle and warm meals.",
    ],
    image: images.mission.firstClass,
    alt: "The first class of pupils holding up their drawings in the English classroom",
  },
  {
    eyebrow: "The school today",
    title: "A beacon of hope",
    paragraphs: [
      "After its first year, difficulties in retaining qualified teachers locally led the school to pause full primary classes. It remains committed to out-of-school and summer courses focused on Buddhist and secular ethics.",
      "Tashol Tengyur School continues to preserve the cultural and spiritual heritage of Tawang while preparing children to thrive in today's world.",
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
          <h1>More than a place to stay</h1>
          <p className="lede">
            The earnings from {site.name} support {site.charityName}: education
            that nurtures knowledge, character and a lasting connection to
            culture.
          </p>
        </div>
      </section>

      {chapters.map((chapter, i) => (
        <section
          key={chapter.title}
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
            Every night you spend with us helps keep the school's courses
            running for the children of Tawang.
          </p>
          <Link to="/stay" className="btn btn--primary">
            Book a room
          </Link>
        </div>
      </section>
    </>
  );
}
