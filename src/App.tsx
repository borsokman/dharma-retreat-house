import { Routes, Route } from "react-router-dom";
import { BookingProvider } from "./hooks/useBookingSearch";
import { SiteLayout } from "./layouts/SiteLayout";
import HomePage from "./pages/HomePage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailsPage from "./pages/RoomDetailsPage";
import RestaurantPage from "./pages/RestaurantPage";
import TawangPage from "./pages/TawangPage";
import MissionPage from "./pages/MissionPage";
import GalleryPage from "./pages/GalleryPage";
import ContactPage from "./pages/ContactPage";
import ManageBookingPage from "./pages/ManageBookingPage";
import StaffLoginPage from "./pages/StaffLoginPage";
import StaffDashboardPage from "./pages/StaffDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BookingProvider>
      <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/stay" element={<RoomsPage />} />
        <Route path="/stay/:slug" element={<RoomDetailsPage />} />
        <Route path="/restaurant" element={<RestaurantPage />} />
        <Route path="/tawang" element={<TawangPage />} />
        <Route path="/our-mission" element={<MissionPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/manage-booking" element={<ManageBookingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/staff" element={<StaffLoginPage />} />
      <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
      </Routes>
    </BookingProvider>
  );
}
