/** Player routes that aren't loaded up front (code-split from the first screen). */
import { Navigate, Route, Routes } from 'react-router-dom';
import VenueDetails from './features/venue/VenueDetails';
import SlotBooking from './features/booking/SlotBooking';
import Payment from './features/booking/Payment';
import BookingConfirmed from './features/booking/BookingConfirmed';
import Ticket from './features/booking/Ticket';
import MyBookings from './features/booking/MyBookings';
import Notifications from './features/notifications/Notifications';
import Profile from './features/profile/Profile';
import Saved from './features/saved/Saved';
import Help from './features/support/Help';
import Policy from './features/support/Policy';
import MyMatches from './features/lobby/MyMatches';
import Lobbies from './features/lobby/Lobbies';
import SquadBuilder from './features/lobby/SquadBuilder';
import MatchRoom from './features/lobby/MatchRoom';
import RequestThread from './features/lobby/RequestThread';

export default function Pages() {
  return (
    <Routes>
      <Route path="venues/:venueId" element={<VenueDetails />} />
      <Route path="book" element={<SlotBooking />} />
      <Route path="payment/:bookingId" element={<Payment />} />
      <Route path="booking-confirmed/:bookingId" element={<BookingConfirmed />} />
      <Route path="tickets/:bookingId" element={<Ticket />} />
      <Route path="bookings" element={<MyBookings />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="profile" element={<Profile />} />
      <Route path="saved" element={<Saved />} />
      <Route path="help" element={<Help />} />
      <Route path="policy" element={<Policy />} />
      <Route path="matches" element={<MyMatches />} />
      <Route path="lobbies" element={<Lobbies />} />
      <Route path="squad" element={<SquadBuilder />} />
      <Route path="matches/:lobbyId" element={<MatchRoom />} />
      <Route path="matches/:lobbyId/requests/:requestId" element={<RequestThread />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
