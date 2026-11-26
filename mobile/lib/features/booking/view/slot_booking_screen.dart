import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/router/app_routes.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/booking_repository.dart';
import '../../../data/repositories/venue_repository.dart';
import '../../auth/auth_guard.dart';
import '../cubit/slot_booking_cubit.dart';
import '../cubit/slot_booking_state.dart';

/// 2 · Venue & Slot Matrix: horizontal date strip and a slot grid tagged Available / Open lobby / Booked.
/// After picking a slot the player chooses a play mode: Join solo (open lobbies on that slot) or
/// Create a group (Squad Builder). Also reschedules an existing booking when [SlotBookingArgs.reschedule] is given.
class SlotBookingScreen extends StatelessWidget {
  final SlotBookingArgs args;
  const SlotBookingScreen({super.key, required this.args});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => SlotBookingCubit(args: args, venues: c.read<VenueRepository>(), bookings: c.read<BookingRepository>()),
    child: const _SlotBookingView(),
  );
}

class _SlotBookingView extends StatefulWidget {
  const _SlotBookingView();
  @override
  State<_SlotBookingView> createState() => _SlotBookingViewState();
}

class _SlotBookingViewState extends State<_SlotBookingView> {
  SlotBookingCubit get _cubit => context.read<SlotBookingCubit>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final error = await _cubit.load();
    if (error != null && mounted) toast(context, error);
  }

  Future<void> _reschedule() async {
    if (!await requireProfile(context)) return;
    _cubit.setBusy(true);
    try {
      await _cubit.reschedule();
      if (!mounted) return;
      toast(context, 'Booking rescheduled');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) toast(context, e.toString());
      _load();
    } finally {
      _cubit.setBusy(false);
    }
  }

  /// Play mode: Create a group → Squad Builder.
  Future<void> _createGroup() async {
    if (!await requireProfile(context) || !mounted) return;
    await context.pushSquadBuilder(_cubit.squadArgs());
    _load();
  }

  /// Play mode: Join solo → open lobbies on this slot.
  Future<void> _joinSolo() async {
    await context.pushLobbies(_cubit.lobbiesArgs());
    _load();
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<SlotBookingCubit, SlotBookingState>(builder: _build);

  Widget _build(BuildContext context, SlotBookingState st) {
    final venue = st.venue, sports = st.sports;
    final today = st.today, date = st.date, day = st.day, dur = st.dur, start = st.start;
    final loading = st.loading, busy = st.busy, isReschedule = st.isReschedule, sportIdx = st.sportIdx, courtIdx = st.courtIdx;
    if (sports.isEmpty || st.courts.isEmpty) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BackSquare(),
                const Spacer(),
                Center(
                  child: Text(
                    '${venue['name']} has no bookable courts yet. Please try another venue.',
                    textAlign: TextAlign.center,
                    style: t(15, c: C.muted, h: 1.5),
                  ),
                ),
                const Spacer(flex: 2),
              ],
            ),
          ),
        ),
      );
    }
    final c = st.check;
    final sport = st.sport, court = st.court, courts = st.courts;
    final dateLabel = '${DateFormat('EEE').format(date)}, ${date.day} ${DateFormat('MMM').format(date)}';
    final hrs = '$dur ${dur == 1 ? 'hr' : 'hrs'}';
    final total = c.valid ? inr(c.total) : '₹—';
    final cartLine = start == null
        ? dateLabel
        : '${day == 0 ? 'Today' : DateFormat('EEE d').format(date)} · ${fmtTime(start)} · $hrs';
    const maxDur = 4;
    Widget panelChip(String label, bool on, VoidCallback onTap) => Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: on ? Colors.white : const Color(0x0FFFFFFF),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: on ? Colors.white : const Color(0x1FFFFFFF)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            child: Text(
              label,
              style: t(13, w: FontWeight.w800, c: on ? C.brand : Colors.white),
            ),
          ),
        ),
      ),
    );
    Widget stepBtn(String label, String semantics, bool enabled, bool light, VoidCallback onTap) => Semantics(
      button: true,
      label: semantics,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        child: Material(
          color: light ? Colors.white : const Color(0x1FFFFFFF),
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: enabled ? onTap : null,
            child: SizedBox(
              width: 36,
              height: 36,
              child: Center(
                child: Text(
                  label,
                  style: t(18, w: FontWeight.w800, c: light ? C.brand : Colors.white, h: 1),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    // One screen (redesign): green panel with sport, day, court and duration, then the slot grid and a cart bar.
    return LightStatusBar(
      child: Scaffold(
        body: ListView(
          padding: EdgeInsets.zero,
          children: [
            Band(
              title: '${isReschedule ? 'Reschedule · ' : ''}${venue['name']}',
              subtitle: '${court?['name'] ?? ''} · ${sport['name']}',
              onBack: () => Navigator.of(context).maybePop(),
              leading: Img(venue['image'], width: 44, height: 44, radius: BorderRadius.circular(12)),
              children: [
                Panel(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                  gap: 16,
                  children: [
                    if (sports.length > 1 && !isReschedule)
                      SizedBox(
                        height: 38,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            for (var i = 0; i < sports.length; i++)
                              panelChip('${sports[i]['name']}', i == sportIdx, () {
                                _cubit.selectSport(i);
                                _load();
                              }),
                          ],
                        ),
                      ),
                    Text(
                      'PICK A DAY · ${DateFormat('MMMM').format(date).toUpperCase()}',
                      style: t(12, w: FontWeight.w800, c: C.panelInk, ls: 1.4),
                    ),
                    SizedBox(
                      height: 72,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: 14,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final dd = today.add(Duration(days: i));
                          final on = i == day;
                          return Semantics(
                            button: true,
                            selected: on,
                            child: GestureDetector(
                              onTap: () {
                                _cubit.selectDay(i);
                                _load();
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                width: 52,
                                decoration: BoxDecoration(
                                  color: on ? Colors.white : const Color(0x0FFFFFFF),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: on ? Colors.white : const Color(0x1FFFFFFF)),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      i == 0 ? 'TODAY' : DateFormat('EEE').format(dd).toUpperCase(),
                                      style: t(10.5, w: FontWeight.w800, c: on ? C.green700 : C.bandInk, ls: 0.6),
                                    ),
                                    const SizedBox(height: 2),
                                    Text('${dd.day}', style: d(21, c: on ? C.brand : Colors.white, ls: -0.5)),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    if (courts.length > 1)
                      SizedBox(
                        height: 38,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            for (var i = 0; i < courts.length; i++)
                              panelChip('${courts[i]['name']}', i == courtIdx, () {
                                _cubit.selectCourt(i);
                                _load();
                              }),
                          ],
                        ),
                      ),
                    if (!isReschedule)
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
                        decoration: BoxDecoration(color: C.green900, borderRadius: BorderRadius.circular(18)),
                        child: Row(
                          children: [
                            const DIcon(DIcons.clock, size: 22, color: C.sun),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Duration',
                                style: t(14, w: FontWeight.w800, c: Colors.white),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                color: const Color(0x14FFFFFF),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  stepBtn('−', 'Shorter', dur > 1, false, () => _cubit.setDuration(dur - 1)),
                                  SizedBox(
                                    width: 62,
                                    child: Text(
                                      hrs,
                                      textAlign: TextAlign.center,
                                      style: t(14, w: FontWeight.w800, c: Colors.white),
                                    ),
                                  ),
                                  stepBtn('+', 'Longer', dur < maxDur, true, () => _cubit.setDuration(dur + 1)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 14,
                    runSpacing: 8,
                    children: [
                      _legend(_box(Colors.white, border: C.chipLine), 'Free'),
                      _legend(
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(color: C.coral, shape: BoxShape.circle),
                        ),
                        'Peak',
                      ),
                      _legend(_box(C.mint, border: C.green700), 'Open lobby'),
                      _legend(_box(C.chip), 'Booked'),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (loading) const SlotGridSkeleton() else ..._groups(st, c.valid),
                  if (!c.valid && !loading && start != null && (isReschedule || st.lobbiesAtStart == 0))
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: C.warnBg, borderRadius: BorderRadius.circular(12)),
                      child: Text(c.error, style: t(13, c: C.warnInk, h: 1.4)),
                    ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: Container(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 20 + MediaQuery.of(context).padding.bottom),
          color: Colors.white,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!isReschedule && st.lobbiesAtStart > 0) ...[
                Material(
                  color: C.mint,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: C.green700, width: 1.5),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: loading ? null : _joinSolo,
                    child: SizedBox(
                      height: 44,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(LucideIcons.userPlus, size: 17, color: C.brand),
                          const SizedBox(width: 8),
                          Text(
                            'Join solo · ${st.lobbiesAtStart} open ${st.lobbiesAtStart == 1 ? 'lobby' : 'lobbies'}',
                            style: t(14, w: FontWeight.w800, c: C.brand),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: c.valid
                      ? const [BoxShadow(color: Color(0x4D143D2B), blurRadius: 24, offset: Offset(0, 10))]
                      : null,
                ),
                child: Material(
                  color: c.valid ? C.brand : C.line,
                  borderRadius: BorderRadius.circular(20),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: !c.valid || loading || busy ? null : (isReschedule ? _reschedule : _createGroup),
                    child: Container(
                      height: 62,
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  cartLine,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: t(12, w: FontWeight.w700, c: c.valid ? C.panelInk : C.muted),
                                ),
                                Text.rich(
                                  TextSpan(
                                    text: isReschedule ? 'New slot' : '$total ',
                                    children: [
                                      if (!isReschedule)
                                        TextSpan(
                                          text: 'turf for the squad',
                                          style: t(12, w: FontWeight.w600, c: c.valid ? C.panelInk : C.muted),
                                        ),
                                    ],
                                  ),
                                  style: d(18, c: c.valid ? Colors.white : const Color(0xFF57625A), ls: -0.3),
                                ),
                              ],
                            ),
                          ),
                          if (busy)
                            const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                            )
                          else ...[
                            Text(
                              isReschedule ? 'Confirm' : 'Continue',
                              style: t(16, w: FontWeight.w800, c: c.valid ? Colors.white : const Color(0xFF57625A)),
                            ),
                            if (c.valid) ...[
                              const SizedBox(width: 6),
                              const DIcon(DIcons.chevR, size: 18, color: C.sun),
                            ],
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _box(Color bg, {Color? border}) => Container(
    width: 12,
    height: 12,
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(4),
      border: border == null ? null : Border.all(color: border, width: 1.5),
    ),
  );

  Widget _legend(Widget box, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      box,
      const SizedBox(width: 6),
      Text(
        label,
        style: t(12, w: FontWeight.w700, c: C.mutedInk),
      ),
    ],
  );

  List<Widget> _groups(SlotBookingState st, bool valid) {
    final slots = st.slots;
    const defs = [('Morning', 0, 11), ('Afternoon', 12, 15), ('Evening', 16, 19), ('Night', 20, 23)];
    final out = <Widget>[];
    for (final g in defs) {
      final hs = slots.where((s) => (s['hour'] as int) >= g.$2 && (s['hour'] as int) <= g.$3).toList();
      if (hs.isEmpty) continue;
      final free = hs.where((s) => s['status'] == 'free').length;
      final peak = hs.any((s) => s['peak'] == true);
      out.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Rule(g.$1, extra: '$free of ${hs.length} free${peak ? ' · peak' : ''}'),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                mainAxisExtent: 56,
                children: [for (final s in hs) _slotTile(st, s, valid)],
              ),
            ],
          ),
        ),
      );
    }
    return out;
  }

  Widget _slotTile(SlotBookingState st, Json s, bool valid) {
    final start = st.start, dur = st.dur;
    final h = s['hour'] as int;
    final past = s['status'] == 'past', booked = s['status'] == 'booked';
    final lobbies = past ? 0 : ((s['lobbies'] as int?) ?? 0);
    final picked = start != null && h >= start && h < start + dur;
    final sel = valid && picked;
    final lobbyPick = !valid && h == start && lobbies > 0 && !st.isReschedule;
    final clash = !valid && h == start && !lobbyPick;
    Color bg = Colors.white, fg = C.ink, edge = C.hair;
    double edgeW = 1.5;
    if (past) {
      fg = const Color(0xFF8A948D);
    } else if (lobbyPick) {
      bg = C.green700;
      fg = Colors.white;
      edge = C.green700;
    } else if (booked && lobbies == 0) {
      bg = C.chip;
      fg = C.muted;
      edge = C.chip;
    } else if (sel) {
      bg = C.brand;
      fg = Colors.white;
      edge = C.brand;
    } else if (clash) {
      fg = C.warnInk;
      edge = const Color(0xFFB45309);
      edgeW = 2;
    } else if (lobbies > 0) {
      bg = C.mint;
      fg = C.brand;
      edge = C.green700;
    }
    final tappable = !past && (!booked || (lobbies > 0 && !st.isReschedule));
    final spots = (s['lobby_spots'] as int?) ?? 0;
    final peak = s['peak'] == true && !past && !booked && lobbies == 0;
    final note = past
        ? 'Past'
        : sel
        ? 'Selected'
        : lobbies > 0
        ? '$spots spot${spots == 1 ? '' : 's'} left'
        : booked
        ? 'Booked'
        : inr(s['price']);
    return Semantics(
      button: true,
      enabled: tappable,
      selected: sel || lobbyPick,
      label:
          '${s['label']}${past
              ? ', past'
              : lobbies > 0
              ? ', open lobby, $spots spots left'
              : booked
              ? ', booked'
              : ', ${inr(s['price'])}${s['peak'] == true ? ', peak price' : ''}'}',
      child: GestureDetector(
        onTap: tappable ? () => _cubit.pickStart(h) : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: edge, width: edgeW),
          ),
          child: Stack(
            children: [
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      s['label'],
                      style: t(
                        14,
                        w: FontWeight.w800,
                        c: fg,
                        h: 1.2,
                        deco: booked && lobbies == 0 ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    Text(
                      note,
                      style: t(10.5, w: FontWeight.w700, c: fg.withValues(alpha: 0.85), h: 1.2),
                    ),
                  ],
                ),
              ),
              if (peak)
                Positioned(
                  top: 7,
                  right: 8,
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(color: sel ? C.sun : C.coral, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
