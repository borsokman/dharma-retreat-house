import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  Info,
  Ruler,
  Search,
  Users,
  X,
} from "lucide-react";
import { api, isMockMode } from "../api/client";
import type {
  HotelBooking,
  RoomAvailability,
  StayDates,
  StayQuote,
} from "../api/types";
import { useAsync } from "../hooks/useAsync";
import {
  ContactFields,
  emptyContact,
  isContactComplete,
} from "../components/ContactFields";
import {
  MAX_GUESTS_PER_ROOM,
  TOTAL_ROOMS,
  rooms as roomCatalog,
} from "../data/rooms";
import { policies } from "../data/site";
import {
  formatDateLong,
  formatMoney,
  formatStatus,
  pluralize,
  range,
  todayISO,
} from "../utils/format";
import "../styles/forms.css";
import "./BookingPage.css";

interface Search extends StayDates {
  guests: number;
  rooms: number;
}

const MAX_GUESTS = MAX_GUESTS_PER_ROOM * TOTAL_ROOMS;

/** Every room needs at least one guest and holds at most MAX_GUESTS_PER_ROOM. */
function roomRange(guests: number) {
  return {
    min: Math.ceil(guests / MAX_GUESTS_PER_ROOM),
    max: Math.min(guests, TOTAL_ROOMS),
  };
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Guests per room, fullest first: 3 guests in 2 rooms → [2, 1]. */
function splitGuests(guests: number, rooms: number): number[] {
  const base = Math.floor(guests / rooms);
  const extra = guests % rooms;
  return range(rooms).map((_, i) => base + (i < extra ? 1 : 0));
}

function searchFromParams(params: URLSearchParams): Search {
  const num = (key: string, fallback: number) => {
    const n = Number.parseInt(params.get(key) ?? "", 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const guests = clamp(num("guests", 2), 1, MAX_GUESTS);
  const { min, max } = roomRange(guests);
  const today = todayISO();
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  return {
    checkIn: checkIn >= today ? checkIn : "",
    checkOut: checkOut > checkIn && checkIn >= today ? checkOut : "",
    guests,
    rooms: clamp(num("rooms", min), min, max),
  };
}

const steps = ["Dates & guests", "Rooms", "Your details"];

export default function BookingPage() {
  const [params, setParams] = useSearchParams();
  // Set by a room page's "Book this room": that room type goes into room 1.
  const [preferredSlug, setPreferredSlug] = useState(() => {
    const slug = params.get("room");
    return roomCatalog.some((r) => r.slug === slug) ? slug : null;
  });
  const preferredRoom = roomCatalog.find((r) => r.slug === preferredSlug);
  const [form, setForm] = useState<Search>(() => searchFromParams(params));
  const [search, setSearch] = useState<Search | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const availability = useAsync<RoomAvailability[]>();
  const [choices, setChoices] = useState<(string | null)[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(0);

  const quote = useAsync<StayQuote>();
  const booking = useAsync<HotelBooking>();
  const [contact, setContact] = useState(emptyContact);
  const [requests, setRequests] = useState("");

  const roomsRef = useRef<HTMLElement>(null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const detailsRef = useRef<HTMLElement>(null);

  const results =
    availability.state.kind === "done" ? availability.state.data : null;
  const split = search ? splitGuests(search.guests, search.rooms) : [];
  const allChosen = choices.length > 0 && choices.every(Boolean);
  const step = !results ? 0 : allChosen ? 2 : 1;

  function runSearch(next: Search) {
    setSearch(next);
    setChoices(Array<string | null>(next.rooms).fill(null));
    setActiveSlot(0);
    quote.reset();
    void availability.run(() => api.getAvailability(next));
  }

  // A shared link (or a room page's "Book this room") may already carry the dates.
  useEffect(() => {
    if (form.checkIn && form.checkOut) runSearch(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Any change to the search hides the old results: they no longer apply. */
  function changeForm(patch: Partial<Search>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      const { min, max } = roomRange(next.guests);
      // A new party size starts from the fewest rooms it needs.
      next.rooms =
        patch.guests !== undefined ? min : clamp(next.rooms, min, max);
      if (next.checkOut && next.checkOut <= next.checkIn) next.checkOut = "";
      return next;
    });
    setFormError(null);
    if (search) {
      setSearch(null);
      availability.reset();
      quote.reset();
    }
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (!form.checkIn || !form.checkOut) {
      setFormError("Please choose your check-in and check-out dates.");
      return;
    }
    const next = new URLSearchParams({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guests: String(form.guests),
      rooms: String(form.rooms),
    });
    if (preferredSlug) next.set("room", preferredSlug);
    setParams(next, { replace: true });
    runSearch(form);
  }

  // Once rooms are shown: bring them into view and pre-select the room the
  // guest came from, when it is free.
  useEffect(() => {
    if (!results || !search) return;
    roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const preferred = results.find((r) => r.room.slug === preferredSlug);
    if (preferred && preferred.roomsLeft > 0) choose(0, preferred.room.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  function clearPreferred() {
    setPreferredSlug(null);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("room");
        return next;
      },
      { replace: true },
    );
  }

  /** Rooms of a type still free once the OTHER slots' choices are counted. */
  function roomsLeftFor(option: RoomAvailability, slot: number) {
    const taken = choices.filter(
      (slug, i) => i !== slot && slug === option.room.slug,
    ).length;
    return option.roomsLeft - taken;
  }

  function choose(slot: number, slug: string) {
    const next = choices.map((c, i) => (i === slot ? slug : c));
    setChoices(next);
    // Continue with the next empty room, wrapping around; none left → details.
    const nextEmpty = Array.from(
      { length: next.length },
      (_, k) => (slot + 1 + k) % next.length,
    ).find((i) => !next[i]);
    setActiveSlot(nextEmpty ?? null);
    if (nextEmpty === undefined && search) {
      void quote.run(() =>
        api.quoteStay({
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          rooms: next.map((s, i) => ({ roomSlug: s!, guests: split[i]! })),
        }),
      );
      requestAnimationFrame(() =>
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    } else {
      requestAnimationFrame(() =>
        stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  function editSlot(slot: number) {
    setActiveSlot(slot);
    quote.reset();
    requestAnimationFrame(() =>
      stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function submitBooking(e: FormEvent) {
    e.preventDefault();
    if (!search || !allChosen || !isContactComplete(contact)) return;
    if (booking.state.kind === "loading") return;
    void booking
      .run(() =>
        api.createHotelBooking({
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          rooms: choices.map((s, i) => ({ roomSlug: s!, guests: split[i]! })),
          contact,
          specialRequests: requests.trim() || undefined,
        }),
      )
      .then((done) => done && window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  if (booking.state.kind === "done") {
    return <BookingConfirmation booking={booking.state.data} />;
  }

  const today = todayISO();
  const { min: minRooms, max: maxRooms } = roomRange(form.guests);
  const freeRooms = results?.reduce((sum, r) => sum + r.roomsLeft, 0) ?? 0;
  const preferred = results?.find((r) => r.room.slug === preferredSlug);
  const nameOf = (slug: string | null) =>
    results?.find((r) => r.room.slug === slug)?.room.name ?? "";

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Book your stay</span>
          <h1>Reserve your rooms</h1>
          <p className="lede">
            Choose your dates and party, then pick a room for everyone — up to{" "}
            {MAX_GUESTS_PER_ROOM} guests per room.
          </p>
          <ol className="book-progress" aria-label="Booking steps">
            {steps.map((label, i) => (
              <li
                key={label}
                className={
                  i < step ? "is-done" : i === step ? "is-current" : undefined
                }
                aria-current={i === step ? "step" : undefined}
              >
                <span className="book-progress__dot" aria-hidden="true">
                  {i < step ? <Check size={14} /> : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- 1. Dates, guests, rooms ---------- */}
      <section className="section book-section">
        <div className="container">
          <form
            className="card book-search"
            onSubmit={submitSearch}
            role="search"
            aria-label="Search room availability"
            noValidate
          >
            <div className="book-search__fields">
              <div className="field">
                <label htmlFor="b-checkin">Check-in</label>
                <span className="book-input">
                  <CalendarDays size={17} aria-hidden="true" />
                  <input
                    id="b-checkin"
                    className="input"
                    type="date"
                    min={today}
                    value={form.checkIn}
                    onChange={(e) => changeForm({ checkIn: e.target.value })}
                  />
                </span>
              </div>
              <div className="field">
                <label htmlFor="b-checkout">Check-out</label>
                <span className="book-input">
                  <CalendarDays size={17} aria-hidden="true" />
                  <input
                    id="b-checkout"
                    className="input"
                    type="date"
                    min={form.checkIn || today}
                    value={form.checkOut}
                    onChange={(e) => changeForm({ checkOut: e.target.value })}
                  />
                </span>
              </div>
              <div className="field">
                <label htmlFor="b-guests">Guests</label>
                <span className="book-input">
                  <Users size={17} aria-hidden="true" />
                  <select
                    id="b-guests"
                    className="select"
                    value={form.guests}
                    onChange={(e) =>
                      changeForm({ guests: Number(e.target.value) })
                    }
                  >
                    {range(MAX_GUESTS).map((n) => (
                      <option key={n} value={n}>
                        {pluralize(n, "guest")}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="field">
                <label htmlFor="b-rooms">Rooms</label>
                <span className="book-input">
                  <BedDouble size={17} aria-hidden="true" />
                  <select
                    id="b-rooms"
                    className="select"
                    value={form.rooms}
                    onChange={(e) =>
                      changeForm({ rooms: Number(e.target.value) })
                    }
                    aria-describedby="b-rooms-hint"
                  >
                    {range(maxRooms - minRooms + 1).map((k) => {
                      const n = minRooms + k - 1;
                      return (
                        <option key={n} value={n}>
                          {pluralize(n, "room")}
                        </option>
                      );
                    })}
                  </select>
                </span>
              </div>
              <button
                type="submit"
                className="btn btn--primary book-search__submit"
              >
                <Search size={18} aria-hidden="true" /> Show available rooms
              </button>
            </div>
            {preferredRoom && (
              <div className="book-preferred">
                <img
                  src={preferredRoom.photos[0]}
                  alt=""
                  width="96"
                  height="64"
                />
                <p>
                  <strong>{preferredRoom.name}</strong>
                  <span>
                    Pre-selected for room 1 — we'll hold it for you if it's free
                    on your dates.
                  </span>
                </p>
                <button
                  type="button"
                  className="book-preferred__remove"
                  onClick={clearPreferred}
                  aria-label={`Don't pre-select the ${preferredRoom.name}`}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            )}
            <p id="b-rooms-hint" className="book-search__hint">
              <Info size={15} aria-hidden="true" />
              {roomHint(form.guests, minRooms, maxRooms)}
            </p>
            {formError && (
              <p className="error-text" role="alert">
                {formError}
              </p>
            )}
          </form>
        </div>
      </section>

      {/* ---------- 2. Rooms, one at a time ---------- */}
      {search && (
        <section
          ref={roomsRef}
          className="section book-section book-anchor"
          aria-labelledby="choose-title"
        >
          <div className="container">
            {availability.state.kind === "loading" && (
              <div className="book-status" role="status">
                <span className="spinner" aria-hidden="true" /> Checking
                availability…
              </div>
            )}

            {availability.state.kind === "error" && (
              <div className="card text-center" role="alert">
                <h3>We couldn't check availability</h3>
                <p className="lede">{availability.state.message}</p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => runSearch(search)}
                >
                  Try again
                </button>
              </div>
            )}

            {results && (
              <>
                <div className="book-choose__head">
                  <h2 id="choose-title">
                    {search.rooms === 1
                      ? "Select your room"
                      : `Select ${search.rooms} rooms`}
                  </h2>
                  <p className="lede">
                    {formatDateLong(search.checkIn)} →{" "}
                    {formatDateLong(search.checkOut)} ·{" "}
                    {pluralize(search.guests, "guest")}
                    {search.rooms > 1 &&
                      ` in ${search.rooms} rooms (${split.join(" + ")})`}
                  </p>
                  {isMockMode && (
                    <p className="badge badge--clay" role="note">
                      Preview mode — availability and prices are simulated
                    </p>
                  )}
                </div>

                {freeRooms < search.rooms ? (
                  <div className="card book-notice" role="alert">
                    <h3>
                      {freeRooms === 0
                        ? "We're fully booked for these dates"
                        : `Only ${pluralize(freeRooms, "room")} ${freeRooms === 1 ? "is" : "are"} free for these dates`}
                    </h3>
                    <p className="lede">
                      {freeRooms > 0 &&
                      search.guests <= freeRooms * MAX_GUESTS_PER_ROOM
                        ? `Try ${pluralize(freeRooms, "room")} for your ${pluralize(search.guests, "guest")}, or other dates.`
                        : "Please try other dates, or message us and we'll help you find a solution."}
                    </p>
                  </div>
                ) : (
                  <>
                    <ol className="book-slots" aria-label="Your rooms">
                      {choices.map((slug, i) => {
                        const active = i === activeSlot;
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              className={`book-slot${active ? " is-active" : ""}${slug ? " is-filled" : ""}`}
                              onClick={() => editSlot(i)}
                              aria-current={active ? "step" : undefined}
                              aria-label={`Room ${i + 1} for ${pluralize(split[i]!, "guest")}: ${
                                slug
                                  ? `${nameOf(slug)}, change`
                                  : "choose a room"
                              }`}
                            >
                              <span className="book-slot__num">
                                {slug && !active ? (
                                  <Check size={15} aria-hidden="true" />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <span className="book-slot__text">
                                <span className="book-slot__title">
                                  Room {i + 1} · {pluralize(split[i]!, "guest")}
                                </span>
                                <span className="book-slot__choice">
                                  {slug
                                    ? nameOf(slug)
                                    : active
                                      ? "Choose below"
                                      : "Not chosen yet"}
                                </span>
                                {slug && !active && (
                                  <span className="book-slot__edit">
                                    Change
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    {activeSlot !== null && (
                      <>
                        <h3
                          ref={stepRef}
                          className="book-step-title book-anchor"
                        >
                          {search.rooms > 1
                            ? `Room ${activeSlot + 1} of ${search.rooms}`
                            : "Choose a room"}
                          <span>
                            {" "}
                            — for {pluralize(split[activeSlot]!, "guest")}
                          </span>
                        </h3>
                        {preferredSlug &&
                          preferred &&
                          preferred.roomsLeft === 0 && (
                            <p className="book-preferred-note">
                              <Info size={16} aria-hidden="true" />
                              The {preferred.room.name} is fully booked for
                              these dates — here are the other rooms.
                            </p>
                          )}
                        <div className="book-options">
                          {[...results]
                            .sort(
                              (a, b) =>
                                Number(roomsLeftFor(b, activeSlot) > 0) -
                                Number(roomsLeftFor(a, activeSlot) > 0),
                            )
                            .map((option) => (
                              <RoomOption
                                key={option.room.slug}
                                option={option}
                                left={roomsLeftFor(option, activeSlot)}
                                guests={split[activeSlot]!}
                                selected={
                                  choices[activeSlot] === option.room.slug
                                }
                                actionLabel={
                                  search.rooms > 1
                                    ? `Select for room ${activeSlot + 1}`
                                    : "Select this room"
                                }
                                onSelect={() =>
                                  choose(activeSlot, option.room.slug)
                                }
                              />
                            ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ---------- 3. Summary and guest details ---------- */}
      {search && results && allChosen && activeSlot === null && (
        <section
          ref={detailsRef}
          className="section section--sage book-anchor"
          aria-labelledby="details-title"
        >
          <div className="container book-details">
            <div className="card book-summary">
              <h2 id="details-title">Your stay</h2>
              <StaySummary
                search={search}
                quote={quote.state.kind === "done" ? quote.state.data : null}
              />
              {quote.state.kind === "loading" && (
                <p className="book-status" role="status">
                  <span className="spinner" aria-hidden="true" /> Calculating
                  your price…
                </p>
              )}
              {quote.state.kind === "error" && (
                <p className="error-text" role="alert">
                  {quote.state.message}
                </p>
              )}
            </div>

            <form className="card" onSubmit={submitBooking} noValidate>
              <h2>Your details</h2>
              <ContactFields
                idPrefix="bk"
                contact={contact}
                onContactChange={setContact}
                requests={requests}
                onRequestsChange={setRequests}
              />
              <p className="confirm-note">
                Free cancellation up to 48 hours before check-in.{" "}
                {policies.checkIn}, {policies.checkOut.toLowerCase()}. A
                home-style breakfast is included.
              </p>
              {booking.state.kind === "error" && (
                <p className="error-text" role="alert">
                  {booking.state.message}
                </p>
              )}
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={
                  !isContactComplete(contact) ||
                  booking.state.kind === "loading" ||
                  quote.state.kind !== "done"
                }
              >
                {booking.state.kind === "loading" ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Sending…
                  </>
                ) : isMockMode ? (
                  "Request booking (preview)"
                ) : (
                  "Continue to payment"
                )}
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}

function roomHint(guests: number, min: number, max: number): string {
  const perRoom = `Up to ${MAX_GUESTS_PER_ROOM} guests per room`;
  if (min === max) {
    return `${perRoom}: ${pluralize(guests, "guest")} ${guests === 1 ? "needs" : "need"} ${pluralize(min, "room")}.`;
  }
  return `${perRoom}: ${pluralize(guests, "guest")} can take ${min} to ${max} rooms.`;
}

function RoomOption({
  option,
  left,
  guests,
  selected,
  actionLabel,
  onSelect,
}: {
  option: RoomAvailability;
  left: number;
  guests: number;
  selected: boolean;
  actionLabel: string;
  onSelect: () => void;
}) {
  const { room, stayPrice, currency, nights } = option;
  const fits = room.maxGuests >= guests;
  const free = left > 0 && fits;
  return (
    <article
      className={`card book-option${free ? "" : " book-option--off"}${selected ? " book-option--selected" : ""}`}
      aria-label={`${room.name}, ${free ? "available" : "not available"}`}
    >
      <img
        className="book-option__img"
        src={room.photos[0]}
        alt=""
        loading="lazy"
        width="940"
        height="650"
      />
      <div className="book-option__body">
        <h4>
          <Link to={`/stay#${room.slug}`}>{room.name}</Link>
        </h4>
        <ul className="book-option__meta" aria-label="Room facts">
          <li>
            <BedDouble size={15} aria-hidden="true" /> {room.bedType}
          </li>
          <li>
            <Users size={15} aria-hidden="true" /> Up to {room.maxGuests}
          </li>
          <li>
            <Ruler size={15} aria-hidden="true" /> {room.sizeSqm} m²
          </li>
        </ul>
        <p className={`book-option__left${left === 1 ? " is-last" : ""}`}>
          {!fits
            ? `Sleeps up to ${room.maxGuests}`
            : left <= 0
              ? option.roomsLeft > 0
                ? "All free rooms already selected"
                : "Fully booked for these dates"
              : left === 1
                ? "Last room of this type"
                : `${left} rooms left`}
        </p>
      </div>
      <div className="book-option__buy">
        <p className="book-option__price">
          {formatMoney(stayPrice, currency)}
          <span>per room · {pluralize(nights, "night")}</span>
        </p>
        <button
          type="button"
          className={`btn btn--sm ${selected ? "btn--ghost" : "btn--primary"}`}
          disabled={!free}
          onClick={onSelect}
        >
          {selected ? (
            <>
              <Check size={16} aria-hidden="true" /> Selected
            </>
          ) : free ? (
            actionLabel
          ) : (
            "Not available"
          )}
        </button>
      </div>
    </article>
  );
}

function StaySummary({
  search,
  quote,
}: {
  search: Search;
  quote: StayQuote | null;
}) {
  return (
    <dl className="confirm-summary book-summary__list">
      <div>
        <dt>Dates</dt>
        <dd>
          {formatDateLong(search.checkIn)} → {formatDateLong(search.checkOut)}
          {quote && ` (${pluralize(quote.nights, "night")})`}
        </dd>
      </div>
      <div>
        <dt>Guests</dt>
        <dd>
          {pluralize(search.guests, "guest")} ·{" "}
          {pluralize(search.rooms, "room")}
        </dd>
      </div>
      {quote && (
        <>
          {quote.lines.map((line, i) => (
            <div key={i}>
              <dt>
                Room {i + 1}
                <span className="book-summary__sub">
                  {line.roomName} · {pluralize(line.guests, "guest")}
                </span>
              </dt>
              <dd>{formatMoney(line.amount, quote.currency)}</dd>
            </div>
          ))}
          {quote.discount && (
            <div>
              <dt>{quote.discount.label}</dt>
              <dd>−{formatMoney(quote.discount.amount, quote.currency)}</dd>
            </div>
          )}
          {quote.taxesAndFees.map((t) => (
            <div key={t.label}>
              <dt>{t.label}</dt>
              <dd>{formatMoney(t.amount, quote.currency)}</dd>
            </div>
          ))}
          <div className="book-summary__total">
            <dt>Total</dt>
            <dd>{formatMoney(quote.totalPrice, quote.currency)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}

function BookingConfirmation({ booking }: { booking: HotelBooking }) {
  const held = booking.status === "pending_payment";
  return (
    <section className="page-head">
      <div className="container">
        <div className="card book-done text-center">
          <CheckCircle2 size={48} color="var(--forest)" aria-hidden="true" />
          <h1 className="mt-2">
            {held ? "Your rooms are held" : "Booking confirmed"}
          </h1>
          {isMockMode && (
            <p className="badge badge--clay" role="note">
              Preview mode — this booking is simulated
            </p>
          )}
          <dl className="confirm-summary">
            <div>
              <dt>Reference</dt>
              <dd>
                <strong>{booking.reference}</strong>
              </dd>
            </div>
            {booking.rooms.map((room, i) => (
              <div key={i}>
                <dt>{booking.rooms.length > 1 ? `Room ${i + 1}` : "Room"}</dt>
                <dd>
                  {room.roomName} · {pluralize(room.guests, "guest")}
                </dd>
              </div>
            ))}
            <div>
              <dt>Dates</dt>
              <dd>
                {formatDateLong(booking.checkIn)} →{" "}
                {formatDateLong(booking.checkOut)}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {formatMoney(booking.totalPrice, booking.currency)} (
                {formatStatus(booking.status)})
              </dd>
            </div>
          </dl>
          <p className="lede">
            Cancellation deadline:{" "}
            {formatDateLong(booking.cancellationDeadline)}.
            {/* the real backend sends no emails yet: it shows the code below */}
            {!booking.manageToken && " A confirmation email is on its way."}
          </p>
          {booking.paymentUrl && (
            <a
              href={booking.paymentUrl}
              className="btn btn--primary btn--block"
            >
              Continue to payment
            </a>
          )}
          {booking.manageToken ? (
            <p className="mt-2">
              Your booking code is <strong>{booking.manageToken}</strong>. Keep
              it with your reference to{" "}
              <Link
                to={`/manage-booking?${new URLSearchParams({
                  ref: booking.reference,
                  token: booking.manageToken,
                })}`}
              >
                manage this booking
              </Link>{" "}
              later.
            </p>
          ) : (
            <p className="mt-2">
              Keep your reference safe, or{" "}
              <Link to="/manage-booking">manage this booking</Link> later.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
