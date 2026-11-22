/** Public privacy policy (/privacy) — the Play Store listing and the app's "Read the full privacy policy" link here.
 *  Contact details and the last-updated date come from the backend (GET /legal/). */
import { Link } from 'react-router-dom';
import { api, asMap } from '../../lib/api';
import { useData } from '../../ui/hooks';
import { LegalLayout } from './LegalLayout';

const TOC = [
  ['collect', 'Data we collect'],
  ['use', 'How we use your data'],
  ['visible', 'What other users can see'],
  ['share', 'Who we share data with'],
  ['permissions', 'Device permissions'],
  ['retention', 'How long we keep data'],
  ['rights', 'Your choices and rights'],
  ['delete', 'Deleting your account'],
  ['security', 'Security'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
];

const SHARING = [
  ['Venues you book', 'Your name, contact number (if added), booking and check-in details', 'To honour your booking and check you in'],
  ['Other players', 'As described in section 3', 'To organise and play matches'],
  ['Payment partner', 'Amount, booking reference, and payment details you enter with them', 'To process payments, split payments and refunds'],
  ['Cloud hosting and database providers', 'All app data, stored on our behalf', 'To run the service'],
  ['Google Firebase Cloud Messaging', 'Push token, notification title and text', 'To deliver push notifications'],
  ['Email delivery provider', 'Email address, sign-in codes and booking emails', 'To send sign-in codes and confirmations'],
  ['Image hosting provider', 'Venue and sport images (not your personal data)', 'To show pictures in the app'],
  ['Authorities', 'Data required by law', 'When required by law, court order, or to protect users’ safety and rights'],
];

const H = ({ id, n, children }) => (
  <h2 id={id}>
    {n}. {children}
  </h2>
);

export default function Privacy() {
  const { data } = useData(async () => asMap(await api.get('/legal/')));
  const email = data?.email || 'support@turflet.app';
  const updated = data?.privacy_updated ? new Date(data.privacy_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const mail = (subject) => `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

  return (
    <LegalLayout title="Privacy Policy" sub={updated ? `Last updated ${updated}` : ' '}>
      <p>
        This policy explains what personal data the <strong>Turflet</strong> mobile app, website and its services (“Turflet”, “we”, “us”) collect, why we collect it, who we share it with and
        the choices you have. Turflet lets you discover sports venues, book turf and court slots, organise or join matches with other players, chat with your squad and split payments.
      </p>
      <p>By using Turflet you agree to this policy. If you do not agree, please do not use the app.</p>

      <nav className="toc">
        {TOC.map(([id, label], i) => (
          <a key={id} href={`#${id}`}>
            {i + 1}. {label}
          </a>
        ))}
      </nav>

      <H id="collect" n={1}>Data we collect</H>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account:</strong> your email address, used to sign in with a one-time code and to send booking confirmations.</li>
        <li><strong>Profile:</strong> your name, and if you choose to add them, your mobile number, address, a public handle, the sports you play and your skill level in each.</li>
        <li><strong>Bookings and payments:</strong> the venues, courts and slots you book, amounts paid, refunds, coupons, wallet balance and referral codes. Card, UPI and bank details are entered with our payment partner; Turflet does not store them.</li>
        <li><strong>Matches and chat:</strong> matches you create or join, invitations, join requests, the short note you send with a request, and messages you post in match or request chats.</li>
        <li><strong>Reviews and support:</strong> ratings you give venues and messages you send to our support team.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Location:</strong> if you allow it, your device’s location is used to find your city and show nearby venues and matches. We save your city/area and the coordinates you were at when you set it on your profile. You can pick a city by hand instead.</li>
        <li><strong>Push notification token:</strong> an identifier issued by Google Firebase Cloud Messaging so we can send notifications to your device, together with the device platform (for example “android”).</li>
        <li><strong>Activity:</strong> check-ins at venues and attendance at matches, used to show a player’s reliability to hosts.</li>
        <li><strong>Technical data:</strong> our servers record standard request information such as IP address, time of request and error details, used for security and to fix problems.</li>
      </ul>
      <p className="muted">We do not use advertising identifiers, show third-party ads, or collect your contacts, photos, camera, microphone or files.</p>

      <H id="use" n={2}>How we use your data</H>
      <ul>
        <li>To create and secure your account and sign you in.</li>
        <li>To book, reschedule, cancel and refund slots, and to produce the QR ticket the venue scans at check-in.</li>
        <li>To run matches: invites, join requests, host approvals, squad chat, cost splitting, payment reminders and payouts to hosts.</li>
        <li>To show venues, matches and players near you.</li>
        <li>To send in-app and push notifications about your bookings, matches, invites, payments and refunds.</li>
        <li>To provide customer support and resolve disputes.</li>
        <li>To prevent fraud and abuse, keep the service secure and meet legal, tax and accounting obligations.</li>
        <li>To understand and improve how the app works.</li>
      </ul>
      <p>We process your data to provide the service you asked for, with your consent (for example location and notifications), to meet legal obligations, and for our legitimate interest in keeping Turflet safe and working.</p>

      <H id="visible" n={3}>What other users can see</H>
      <ul>
        <li><strong>In public matches:</strong> your first name, initials, and the match you are hosting, including its venue and time, are shown to players browsing matches.</li>
        <li><strong>To a host when you ask to join:</strong> your name, handle, sports and levels, reliability and the note you send.</li>
        <li><strong>To players in the same match:</strong> your name, initials, payment status for your share, and the messages you post in that match’s chat.</li>
        <li><strong>Nearby players:</strong> if “show me to nearby players” is on in your profile, players searching to invite friends can find you by name or handle. You can turn this off.</li>
      </ul>
      <p>Your email address, mobile number and address are not shown to other players.</p>

      <H id="share" n={4}>Who we share data with</H>
      <p>We <strong>do not sell</strong> your personal data. We share it only as follows:</p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Who</th><th>What</th><th>Why</th></tr>
          </thead>
          <tbody>
            {SHARING.map(([who, what, why]) => (
              <tr key={who}><td>{who}</td><td>{what}</td><td>{why}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Our service providers may only use your data to provide their service to us. Some of them may store data on servers outside your country; we use providers that apply appropriate safeguards. If Turflet is involved in a merger or sale, your data may transfer to the new owner under this policy.</p>

      <H id="permissions" n={5}>Device permissions</H>
      <ul>
        <li><strong>Location</strong> (approximate and precise): to find your city and show what is nearby. Optional; you can choose a city by hand.</li>
        <li><strong>Notifications:</strong> to alert you about bookings, invites and payments. Optional.</li>
        <li><strong>Internet:</strong> required for the app to work.</li>
      </ul>
      <p>You can change permissions at any time in your phone’s or browser’s settings.</p>

      <H id="retention" n={6}>How long we keep data</H>
      <ul>
        <li>Account and profile data: while your account is active, and deleted when you delete your account.</li>
        <li>Booking, payment and refund records: kept for as long as tax and accounting laws require, even after account deletion.</li>
        <li>Match chats and requests: kept while the match is relevant to its players, then removed or anonymised along with your account.</li>
        <li>Sign-in codes expire within minutes. Push tokens are removed when you sign out or uninstall the app.</li>
        <li>Server logs: kept for a short period for security and debugging.</li>
      </ul>

      <H id="rights" n={7}>Your choices and rights</H>
      <ul>
        <li><strong>Access and correct:</strong> view and edit your name, mobile, address, handle and sports in the Profile tab.</li>
        <li><strong>Notifications:</strong> switch booking and match notifications off in the Profile tab or in phone settings.</li>
        <li><strong>Visibility:</strong> turn off “show me to nearby players”.</li>
        <li><strong>Location:</strong> deny or revoke location permission and pick your city by hand.</li>
        <li><strong>Copy, deletion, withdrawal of consent, or a complaint:</strong> email us at the address below. Under applicable law, including India’s Digital Personal Data Protection Act, 2023, you may also nominate someone to exercise your rights and raise a grievance with us or the relevant authority.</li>
      </ul>

      <H id="delete" n={8}>Deleting your account</H>
      <p>
        To delete your account and personal data, submit a request at <Link to="/delete-account">our account deletion page</Link>, or email <a href={mail('Delete my Turflet account')}>{email}</a> from the email address you sign in with, with the subject “Delete my Turflet account”. We will confirm and delete your account within 30 days. Records we must keep by law (such as payment and tax records) are retained only for that purpose, and your chat messages are anonymised.
      </p>

      <H id="security" n={9}>Security</H>
      <p>Data is encrypted in transit using HTTPS. Access to personal data is limited to people and systems that need it. Sign-in uses one-time codes rather than passwords, and sessions use short-lived tokens. No system is perfectly secure, so please contact us immediately if you suspect misuse of your account.</p>

      <H id="children" n={10}>Children</H>
      <p>Turflet is intended for users aged 18 and over. Players under 18 may only use Turflet with the consent and supervision of a parent or guardian. We do not knowingly collect data from children without such consent; if you believe a child has given us data, contact us and we will delete it.</p>

      <H id="changes" n={11}>Changes to this policy</H>
      <p>We may update this policy as the app changes. We will change the “last updated” date above and, for significant changes, notify you in the app.</p>

      <H id="contact" n={12}>Contact us</H>
      <p>
        Questions, requests or complaints (including our grievance officer):
        <br />
        Email: <a href={mail()}>{email}</a>
        {data?.phone && (
          <>
            <br />
            Phone: {data.phone}
          </>
        )}
      </p>
    </LegalLayout>
  );
}
