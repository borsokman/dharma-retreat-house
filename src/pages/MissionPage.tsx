import { HeartHandshake, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { images } from "../data/images";
import { site } from "../data/site";

export default function MissionPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Our mission</span>
          <h1>More than a place to stay</h1>
          <p className="lede">
            {site.name} exists for one reason: to support {site.charityName}.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container mission-grid">
          <div>
            <h2>
              <HeartHandshake size={22} aria-hidden="true" /> The school in this
              building
            </h2>
            <p className="lede">
              {site.charityName} educates children from the surrounding
              valleys. The school occupies this same building, and every part
              of the hotel and restaurant — every room, every meal, every cup
              of tea — contributes to its work.
            </p>
            <p className="lede">
              [Replace this paragraph with the foundation's own description:
              who it serves, how it teaches, and what your support makes
              possible.]
            </p>
          </div>
          <div className="mission-page__img">
            <img
              src={images.mission.classroom}
              alt="Placeholder — here should be an image of the Tashol Tengyur School"
              loading="lazy"
              width="940"
              height="650"
            />
          </div>
        </div>
      </section>

      <section className="section section--sage">
        <div className="container mission-grid">
          <div className="mission-page__img">
            <img
              src={images.mission.studying}
              alt="Placeholder — here should be an image of students studying"
              loading="lazy"
              width="940"
              height="650"
            />
          </div>
          <div>
            <h2>
              <Sprout size={22} aria-hidden="true" /> How your stay helps
            </h2>
            <ul className="mission-list">
              <li>Your room rate funds teachers, books and classroom materials.</li>
              <li>Every restaurant meal supports the school's daily meal program.</li>
              <li>The building itself is shared — guests and pupils under one roof.</li>
            </ul>
            <p className="lede">
              [Replace these points with the foundation's actual programs and
              allocation of proceeds.]
            </p>
          </div>
        </div>
      </section>

      <section className="section text-center">
        <div className="container">
          <h2>Stay, dine, and give back</h2>
          <p className="lede" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            The simplest way to support the school is to enjoy what the house
            offers.
          </p>
          <Link to="/stay" className="btn btn--primary">
            Book a room
          </Link>{" "}
          <Link to="/restaurant" className="btn btn--ghost">
            Reserve a table
          </Link>
        </div>
      </section>
    </>
  );
}
