/** 12 · Help & support: FAQ search, contact, and a support ticket about a booking. `?booking=ID` pre-selects it. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Mail, MessageCircle, Phone, Receipt, Search, Shield } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes, useBack, useRequireLogin } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { bookingRepo, supportRepo } from '../../lib/repos';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, Img, Label, PrimaryButton } from '../../ui/kit';

export default function Help() {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack(routes.profile);
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const requireLogin = useRequireLogin();
  const [params] = useSearchParams();
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(0);
  const [upcoming, setUpcoming] = useState(null);
  const debounce = useRef(undefined);
  const sup = asMap(app.config.support);

  const search = (q) => supportRepo.faqs(q).then(setFaqs, () => undefined);
  useEffect(() => {
    search('');
    const bid = params.get('booking');
    if (bid) bookingRepo.details(Number(bid)).then(setUpcoming, () => undefined);
    else if (app.loggedIn)
      bookingRepo.list('upcoming').then(
        (r) => setUpcoming(asList(r.items)[0] ?? null),
        () => undefined,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chat = () =>
    sheet((close) => (
      <ChatSheet
        replyTime={sup.reply_time ?? ''}
        onSend={async (msg) => {
          if (!requireLogin()) return close();
          try {
            await supportRepo.createTicket(upcoming ? `Help with ${upcoming.code}` : 'Help request', msg, upcoming?.id);
            close();
            toast("Message sent. We'll reply shortly.");
          } catch (e) {
            toast(errText(e));
          }
        }}
      />
    ));

  const contacts = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      <Contact icon={MessageCircle} bg={C.mint} fg={C.green700} title="Chat" sub={sup.chat_hours ?? '24 × 7'} onClick={chat} />
      <Contact icon={Phone} bg={C.blueSoft} fg={C.blue} title="Call" sub={sup.call_hours ?? ''} onClick={() => (window.location.href = `tel:${sup.phone ?? ''}`)} />
      <Contact
        icon={Mail}
        bg={C.purpleSoft}
        fg={C.purple}
        title="Email"
        sub={sup.email_sla ?? ''}
        onClick={() => (window.location.href = `mailto:${sup.email ?? ''}?subject=Turflet%20help`)}
      />
    </div>
  );

  const faqList = (
    <CardBox padding={0} style={{ overflow: 'hidden' }}>
      {faqs.map((f, i) => (
        <div key={i} style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${C.divider}` : undefined }}>
          <button
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? -1 : i)}
            style={{ width: '100%', minHeight: 56, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
          >
            <span style={{ flex: 1, padding: '12px 0', ...t(14, { w: 600, h: 1.35 }) }}>{f.q}</span>
            <ChevronDown size={18} color={C.muted} style={{ transform: open === i ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
          </button>
          {open === i && <div style={{ padding: '0 16px 14px', ...t(13, { c: C.muted, h: 1.6 }) }}>{f.a}</div>}
        </div>
      ))}
      {faqs.length === 0 && <div style={{ padding: 16, ...t(14, { c: C.muted }) }}>No matching questions.</div>}
    </CardBox>
  );

  const policies = (
    <CardBox padding={0} style={{ overflow: 'hidden' }}>
      <PolicyRow
        icon={Receipt}
        bg={C.orangeSoft}
        fg={C.orange}
        title="Refund & cancellation policy"
        sub="Refund timelines and charges"
        onClick={() => nav('/policy?tab=0')}
        border
      />
      <PolicyRow icon={Shield} bg={C.tealSoft} fg={C.teal} title="Privacy policy" sub="How we handle your data" onClick={() => nav('/policy?tab=1')} border />
      <PolicyRow icon={FileText} bg={C.chip} fg={C.muted} title="Terms of use" sub="Rules for players & venues" onClick={() => nav('/policy?tab=2')} />
    </CardBox>
  );

  const upcomingCard = upcoming && (
    <button
      className="tap"
      onClick={() => nav(routes.ticket(upcoming.id))}
      style={{ width: '100%', padding: 12, borderRadius: 20, background: '#fff', boxShadow: shadow.soft, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
    >
      <span style={{ width: 56, height: 56, flex: 'none' }}>
        <Img url={upcoming.venue?.image} radius={14} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', ...t(11, { w: 700, c: C.green700, ls: 0.4 }) }}>HELP WITH UPCOMING BOOKING</span>
        <span style={{ display: 'block', marginTop: 2, ...t(14, { w: 700 }) }}>{upcoming.venue?.name}</span>
        <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>
          {upcoming.date_label} · {upcoming.time_short} · {upcoming.code}
        </span>
      </span>
      <ChevronRight size={18} color={C.muted} />
    </button>
  );

  const hero = (
    <div style={{ padding: desktop ? '36px 40px 32px' : 'calc(var(--safe-top) + 8px) 20px 26px', borderRadius: desktop ? 32 : '0 0 28px 28px', background: C.limeSoft }}>
      <button onClick={back} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', ...t(13, { w: 600, c: C.brandDark }) }}>
        <ChevronLeft size={16} color={C.brandDark} /> Back
      </button>
      <h1 style={{ margin: '6px 0 0', ...d(desktop ? 40 : 28, { ls: -0.5 }) }}>Help & support</h1>
      <div style={{ marginTop: 6, ...t(14, { c: C.mutedInk }) }}>{sup.reply_time ?? 'We usually reply in under 5 minutes.'}</div>
      <div
        style={{
          marginTop: 18,
          maxWidth: desktop ? 560 : undefined,
          height: 50,
          padding: '0 14px',
          borderRadius: 16,
          background: '#fff',
          boxShadow: shadow.card,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Search size={18} color={C.muted} />
        <input
          placeholder="Search e.g. refund, reschedule"
          onChange={(e) => {
            window.clearTimeout(debounce.current);
            const v = e.target.value.trim();
            debounce.current = window.setTimeout(() => search(v), 300);
          }}
          style={t(15)}
        />
      </div>
    </div>
  );

  const footer = (
    <div style={{ marginTop: 18, textAlign: 'center', ...t(12, { c: C.muted }) }}>Turflet v{app.config.app_version ?? '1.1'} · Bookings are linked to your verified email</div>
  );

  if (desktop) {
    return (
      <Shell nav>
        {hero}
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>
          <div>
            <Label style={{ padding: '0 0 10px' }}>Popular questions</Label>
            {faqList}
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {upcomingCard}
            <div>
              <Label style={{ padding: '0 0 10px' }}>Contact us</Label>
              {contacts}
            </div>
            <div>
              <Label style={{ padding: '0 0 10px' }}>Policies</Label>
              {policies}
            </div>
          </div>
        </div>
        {footer}
      </Shell>
    );
  }

  return (
    <Shell nav>
      <div style={{ paddingBottom: 24 }}>
        {hero}
        {upcomingCard && <div style={{ padding: '18px 20px 0' }}>{upcomingCard}</div>}
        <Label style={{ padding: '22px 20px 10px' }}>Contact us</Label>
        <div style={{ padding: '0 20px' }}>{contacts}</div>
        <Label style={{ padding: '22px 20px 10px' }}>Popular questions</Label>
        <div style={{ padding: '0 20px' }}>{faqList}</div>
        <Label style={{ padding: '22px 20px 10px' }}>Policies</Label>
        <div style={{ padding: '0 20px' }}>{policies}</div>
        <div style={{ padding: '0 20px' }}>{footer}</div>
      </div>
    </Shell>
  );
}

function ChatSheet({ replyTime, onSend }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div style={d(22)}>Message support</div>
      <div style={{ margin: '6px 0 14px', ...t(13, { c: C.muted }) }}>{replyTime}</div>
      <div style={{ padding: '10px 14px', borderRadius: 14, background: C.ground, border: `1px solid ${C.line}` }}>
        <textarea autoFocus rows={4} value={msg} placeholder="How can we help?" onChange={(e) => setMsg(e.target.value)} style={{ ...t(15), resize: 'none' }} />
      </div>
      <div style={{ height: 14 }} />
      <PrimaryButton
        height={52}
        loading={busy}
        onClick={async () => {
          if (!msg.trim()) return;
          setBusy(true);
          await onSend(msg.trim());
          setBusy(false);
        }}
      >
        Send
      </PrimaryButton>
    </div>
  );
}

const Contact = ({ icon: I, bg, fg, title, sub, onClick }) => (
  <button
    className="tap lift"
    onClick={onClick}
    style={{ height: 96, borderRadius: 18, background: '#fff', boxShadow: shadow.soft, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
  >
    <span style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'grid', placeItems: 'center' }}>
      <I size={20} color={fg} />
    </span>
    <span style={{ marginTop: 6, ...t(13, { w: 600 }) }}>{title}</span>
    <span style={t(11, { c: C.muted })}>{sub}</span>
  </button>
);

const PolicyRow = ({ icon: I, bg, fg, title, sub, onClick, border }) => (
  <button
    className="tap"
    onClick={onClick}
    style={{
      width: '100%',
      minHeight: 60,
      padding: '0 16px',
      background: '#fff',
      borderBottom: border ? `1px solid ${C.divider}` : undefined,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textAlign: 'left',
    }}
  >
    <span style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'grid', placeItems: 'center' }}>
      <I size={18} color={fg} />
    </span>
    <span style={{ flex: 1 }}>
      <span style={{ display: 'block', ...t(14, { w: 600 }) }}>{title}</span>
      <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{sub}</span>
    </span>
    <ChevronRight size={18} color={C.muted} />
  </button>
);
