import { Link } from "react-router-dom";
import { ArrowRight, HeartHandshake, UtensilsCrossed } from "lucide-react";
import { BookingWidget } from "../components/BookingWidget";
import { images } from "../data/images";
import { rooms } from "../data/rooms";
import { site } from "../data/site";
import { formatMoney } from "../utils/format";
import "./HomePage.css";
export default function HomePage() {
  return (
    <>
      {/* ---------- Full-screen hero ---------- */}
      <section className="hero" aria-label="Welcome">
        <picture>
          <source media="(max-width: 760px)" srcSet={`${images.hero}?w=900`} />
          <img
            src={images.hero}
            alt="Dharma Retreat House lit up in the evening"
            className="hero__img"
            fetchPriority="high"
          />
        </picture>
        <div className="hero__overlay" aria-hidden="true" />
        <div className="hero__content container">
          <p className="hero__eyebrow animate-fade-up">
            Hotel · Restaurant · Charity
          </p>
          <h1 className="hero__title animate-fade-up">
            A peaceful stay.
            <br />
            A purpose beyond it.
          </h1>
          <p className="hero__lede animate-fade-up">
            Enjoy a welcoming place to stay and dine, while supporting a
            meaningful cause — every night here helps {site.charityName} thrive.
          </p>
          <div className="animate-fade-up">
            <BookingWidget variant="hero" />
          </div>
        </div>
      </section>

      {/* ---------- Intro ---------- */}
      <section className="section" aria-labelledby="intro-title">
        <div className="container intro">
          <div className="section-head">
            <span className="eyebrow">Welcome</span>
            <h2 id="intro-title">A house with heart</h2>
            <p className="lede">
              {site.name} is a small hotel and restaurant inside the building of{" "}
              {site.charityName}. Guests enjoy quiet rooms, honest food and
              mountain air — and every aspect of your stay supports the school's
              work.
            </p>
            <Link to="/our-mission" className="btn btn--ghost">
              Our mission <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="blob blob--water drifting intro__blob" aria-hidden="true" />
        </div>
      </section>

      {/* ---------- Featured rooms ---------- */}
      <section className="section section--sage" aria-labelledby="rooms-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Stay with us</span>
            <h2 id="rooms-title">Rooms &amp; suites</h2>
            <p className="lede">
              Simple, warm and quiet — three room types to choose from, each one
              resting the whole building's charitable purpose.
            </p>
          </div>
          <div className="home-rooms">
            {rooms.map((room) => (
              <Link
                key={room.slug}
                to={`/stay/${room.slug}`}
                className="card card--hover home-room"
              >
                <div className="home-room__img">
                  <img
                    src={room.photos[0]}
                    alt={room.name}
                    loading="lazy"
                    width="940"
                    height="650"
                  />
                </div>
                <div className="home-room__body">
                  <h3>{room.name}</h3>
                  <p className="lede">{room.shortDescription}</p>
                  <p className="home-room__price">
                    from {formatMoney(room.basePrice, room.currency)} / night
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link to="/stay" className="btn btn--primary">
              See all rooms <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Restaurant overview ---------- */}
      <section className="section" aria-labelledby="rest-title">
        <div className="container rest-overview">
          <div className="rest-overview__img">
            <img
              src={images.restaurant.tableSetting}
              alt="A warmly lit restaurant table set with candles"
              loading="lazy"
              width="940"
              height="650"
            />
          </div>
          <div className="rest-overview__body">
            <span className="eyebrow">Dine</span>
            <h2 id="rest-title">
              <UtensilsCrossed size={22} aria-hidden="true" /> The restaurant
            </h2>
            <p className="lede">
              Seasonal, locally sourced cooking served in a relaxed dining room.
              Lunch from noon, dinner from six — reservations recommended, and
              every meal supports the school.
            </p>
            <Link to="/restaurant" className="btn btn--primary">
              Reserve a table <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Mission teaser ---------- */}
      <section className="section section--sage" aria-labelledby="mission-title">
        <div className="container mission-teaser">
          <div>
            <span className="eyebrow">Why it matters</span>
            <h2 id="mission-title">
              <HeartHandshake size={22} aria-hidden="true" /> Your stay teaches a
              classroom
            </h2>
            <p className="lede">
              {site.charityNote} Rooms, meals, a cup of tea in the garden — it
              all adds up to teachers, books and bright classrooms.
            </p>
            <Link to="/our-mission" className="btn btn--primary">
              Read about the school <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mission-teaser__img">
            <img
              src={images.mission.classroom}
              alt="Students learning in the Tashol Tengyur School"
              loading="lazy"
              width="940"
              height="650"
            />
          </div>
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      <section className="section" aria-labelledby="quotes-title">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">Guest words</span>
            <h2 id="quotes-title">What guests say</h2>
            <p className="lede">
              Placeholder testimonials — replace with real guest feedback.
            </p>
          </div>
          <div className="quotes">
            <figure className="card card--hover quote">
              <blockquote>
                "The calmest place we've stayed in years — and knowing our stay
                supports the school made it special."
              </blockquote>
              <figcaption>A. &amp; M., Germany</figcaption>
            </figure>
            <figure className="card card--hover quote">
              <blockquote>
                "Wonderful food, kind people and a view I'll never forget."
              </blockquote>
              <figcaption>S., Nepal</figcaption>
            </figure>
            <figure className="card card--hover quote">
              <blockquote>
                "Booking was simple, the room was spotless, breakfast was
                generous. We'll be back."
              </blockquote>
              <figcaption>J., United Kingdom</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---------- Contact CTA ---------- */}
      <section className="section section--sage" aria-labelledby="cta-title">
        <div className="container text-center">
          <h2 id="cta-title">Come and stay</h2>
          <p className="lede" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            Questions about rooms, the restaurant or the school? We're happy to
            help.
          </p>
          <Link to="/contact" className="btn btn--primary">
            Contact us
          </Link>
        </div>
      </section>
    </>
  );
}
