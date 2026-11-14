import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SiteLayout } from "./layouts/SiteLayout";
import HomePage from "./pages/HomePage";
import RoomsPage from "./pages/RoomsPage";
import BookingPage from "./pages/BookingPage";
import TawangPage from "./pages/TawangPage";
import CoffeeHousePage from "./pages/CoffeeHousePage";
import MissionPage from "./pages/MissionPage";
import GalleryPage from "./pages/GalleryPage";
import ContactPage from "./pages/ContactPage";
import ManageBookingPage from "./pages/ManageBookingPage";
import StaffLoginPage from "./pages/StaffLoginPage";
import StaffDashboardPage from "./pages/StaffDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/stay" element={<RoomsPage />} />
        <Route path="/stay/:slug" element={<OldRoomLink />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/tawang" element={<TawangPage />} />
        <Route path="/dharma-coffee-house" element={<CoffeeHousePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/our-mission" element={<MissionPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/manage-booking" element={<ManageBookingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/staff" element={<StaffLoginPage />} />
      <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
    </Routes>
  );
}

/** Rooms no longer have their own pages: old links jump to the room on /stay. */
function OldRoomLink() {
  const { slug = "" } = useParams();
  return <Navigate to={`/stay#${encodeURIComponent(slug)}`} replace />;
}
