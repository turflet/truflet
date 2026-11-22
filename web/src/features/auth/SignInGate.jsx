/** Tabs that need an account show this until the player verifies their email. */

import { Mail } from 'lucide-react';
import { useSession } from '../../app/session';
import { useRequireLogin } from '../../app/nav';
import { Empty, PrimaryButton } from '../../ui/kit';

export function SignInGate({ children }) {
  const { loggedIn } = useSession();
  const requireLogin = useRequireLogin();
  if (loggedIn) return <>{children}</>;
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <Empty
        icon={Mail}
        title="Sign in to continue"
        body="Your bookings are linked to your email. We send a one-time code — no password."
        action={<PrimaryButton onClick={requireLogin}>Continue with email</PrimaryButton>}
      />
    </div>
  );
}
