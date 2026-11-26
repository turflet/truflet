import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/booking_repository.dart';
import '../../../data/repositories/venue_repository.dart';
import '../cubit/my_bookings_cubit.dart';
import '../open_slot_booking.dart';

/// 9 · My bookings
class MyBookingsScreen extends StatelessWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => MyBookingsCubit(bookings: c.read<BookingRepository>(), venues: c.read<VenueRepository>())..load(),
    // refresh whenever the player switches to this tab
    child: BlocListener<AppCubit, AppState>(
      listenWhen: (prev, cur) => cur.tab == AppTab.bookings && prev.tab != AppTab.bookings,
      listener: (context, _) => context.read<MyBookingsCubit>().reload(),
      child: const _MyBookingsView(),
    ),
  );
}

class _MyBookingsView extends StatelessWidget {
  const _MyBookingsView();

  Future<void> _rate(BuildContext context, Json b) async {
    var stars = 5;
    final ok = await sheet<bool>(
      context,
      (ctx) => StatefulBuilder(
        builder: (ctx, set) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Rate ${b['venue']['name']}', style: d(20)),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 1; i <= 5; i++)
                    IconButton(
                      iconSize: 40,
                      onPressed: () => set(() => stars = i),
                      icon: DIcon(i <= stars ? DIcons.star : DIcons.starLine, size: 40, color: C.star),
                      tooltip: '$i stars',
                    ),
                ],
              ),
              const SizedBox(height: 16),
              PrimaryButton('Submit', height: 52, onTap: () => Navigator.pop(ctx, true)),
            ],
          );
        },
      ),
    );
    if (ok != true) return;
    if (!context.mounted) return;
    try {
      await context.read<MyBookingsCubit>().rate(b, stars);
      if (context.mounted) toast(context, 'Thanks for rating!');
    } catch (e) {
      if (context.mounted) toast(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<MyBookingsCubit, MyBookingsState>(builder: _build);

  Widget _build(BuildContext context, MyBookingsState st) {
    final cubit = context.read<MyBookingsCubit>();
    final app = context.watch<AppCubit>();
    final data = st.data, error = st.error, tab = st.tab;
    final counts = asMap(data?['counts']);
    final items = asList(data?['items']);
    final showNext = tab == 0 && items.isNotEmpty;
    final listed = showNext ? items.skip(1).toList() : items;
    final labels = [
      'UPCOMING · ${counts['upcoming'] ?? 0}',
      'COMPLETED · ${counts['completed'] ?? 0}',
      'CANCELLED · ${counts['cancelled'] ?? 0}',
    ];
    return RefreshIndicator(
      color: C.brand,
      onRefresh: cubit.load,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Band(
            title: 'My bookings',
            subtitle: data == null ? null : '${counts['upcoming'] ?? 0} upcoming · ${counts['completed'] ?? 0} played',
            onBack: () => app.setTab(AppTab.explore),
            actions: const [ProfileButton()],
            children: [
              Panel(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 22),
                children: [
                  UnderlineTabs(labels: labels, index: tab, onChange: cubit.selectTab),
                  if (showNext) _upNext(context, items.first),
                  if (tab > 0 && data != null)
                    PanelHeadline(
                      tab == 1 ? '${counts['completed'] ?? 0} games ' : '${counts['cancelled'] ?? 0} ',
                      tab == 1 ? 'played' : 'cancelled',
                      size: 28,
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (error != null) ErrorRetry(error, onRetry: cubit.load),
          if (data == null && error == null) const BookingCardsSkeleton(),
          if (data != null && items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  const Icon(LucideIcons.calendar, size: 40, color: C.muted),
                  const SizedBox(height: 12),
                  Text(
                    ['No upcoming games. Book a slot!', 'No completed games yet.', 'No cancellations.'][tab],
                    style: t(14, c: C.muted),
                    textAlign: TextAlign.center,
                  ),
                  if (tab == 0) ...[
                    const SizedBox(height: 16),
                    PrimaryButton('Explore turfs', height: 48, onTap: () => app.setTab(AppTab.explore)),
                  ],
                ],
              ),
            ),
          if (showNext && listed.isNotEmpty)
            const Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 16), child: Rule('Also coming up')),
          for (final b in listed) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: _card(context, b)),
          SizedBox(height: 16 + MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  /// "KICK-OFF IN 2 DAYS" — or hours when it's today.
  String _kickoff(Json b) {
    final h = ((b['hours_left'] ?? 0) as num).toDouble();
    if (h <= 0) return 'ON NOW';
    if (h < 1) return 'KICK-OFF SOON';
    if (h < 24) return 'KICK-OFF IN ${h.round()} HR${h.round() == 1 ? '' : 'S'}';
    final days = (h / 24).round();
    return 'KICK-OFF IN $days DAY${days == 1 ? '' : 'S'}';
  }

  /// The next game as a white ticket inside the green panel.
  Widget _upNext(BuildContext context, Json b) {
    final venue = asMap(b['venue']), sport = asMap(b['sport']), court = asMap(b['court']);
    final held = b['status'] == 'held';
    Future<void> open() async {
      if (held) {
        await context.pushPayment(b);
      } else {
        await context.pushTicket(b['id']);
      }
      if (context.mounted) context.read<MyBookingsCubit>().load();
    }

    final quick = [
      (
        DIcons.directions,
        'Directions',
        () => openMaps(venue['lat'], venue['lng'], '${venue['name']} ${venue['address'] ?? ''}'),
      ),
      if ('${venue['phone'] ?? ''}'.isNotEmpty) (DIcons.phone, 'Call', () => callNumber('${venue['phone']}')),
      (LucideIcons.qrCode, held ? 'Pay now' : 'Pass', open),
    ];
    final pin = '${b['checkin_pin'] ?? ''}';
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Material(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: open,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: 140,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Img(venue['image']),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x1A0C2419), Color(0xD90C2419)],
                            ),
                          ),
                        ),
                        Positioned(
                          top: 12,
                          right: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: C.sun, borderRadius: BorderRadius.circular(999)),
                            child: Text(held ? 'Payment due' : 'Show pass', style: t(12, w: FontWeight.w800, h: 1.2)),
                          ),
                        ),
                        Positioned(
                          left: 16,
                          bottom: 12,
                          right: 16,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _kickoff(b),
                                style: t(12, w: FontWeight.w800, c: C.sun, ls: 1),
                              ),
                              Text('${b['date_label']} · ${b['time_short']}', style: d(18, c: Colors.white, ls: -0.4)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${venue['name']}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: t(16, w: FontWeight.w800),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${court['name']} · ${sport['name']} · ${b['duration']} hr${b['duration'] == 1 ? '' : 's'}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: t(12.5, w: FontWeight.w600, c: C.mutedInk),
                              ),
                              const SizedBox(height: 2),
                              Text('ID ${b['code']}${pin.isNotEmpty ? ' · PIN $pin' : ''}', style: t(12.5, c: C.muted)),
                            ],
                          ),
                        ),
                        Text(inr(b['my_paid'] ?? b['total']), style: t(15, w: FontWeight.w800)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: C.hair)),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < quick.length; i++)
                    Expanded(
                      child: InkWell(
                        onTap: quick[i].$3,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: i < quick.length - 1 ? const Border(right: BorderSide(color: C.hair)) : null,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              glyph(quick[i].$1, size: 16, color: C.brand),
                              const SizedBox(width: 6),
                              Text(
                                quick[i].$2,
                                style: t(12.5, w: FontWeight.w800, c: C.brand),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(BuildContext context, Json b) {
    final status = b['status'];
    final (label, bg, fg) = switch (status) {
      'held' => ('PAYMENT DUE', C.coralSoft, C.orangeInk),
      'confirmed' => ('CONFIRMED', C.mint, C.brand),
      'completed' => ('PLAYED', C.mint, C.brand),
      'cancelled' => (
        ((b['refund_amount'] ?? 0) as num) > 0 ? 'REFUNDED ${inr(b['refund_amount'])}' : 'CANCELLED',
        C.coralSoft,
        C.orangeInk,
      ),
      _ => ('$status'.toUpperCase(), C.chip, C.muted),
    };
    final venue = asMap(b['venue']), sport = asMap(b['sport']), court = asMap(b['court']);
    Future<void> reload() async {
      if (context.mounted) context.read<MyBookingsCubit>().load();
    }

    Future<void> open() async {
      await context.pushTicket(b['id']);
      await reload();
    }

    Widget cta(String text, VoidCallback onTap, {bool filled = true, IconData? icon}) => Material(
      color: filled ? C.brand : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: filled ? BorderSide.none : const BorderSide(color: C.brand, width: 1.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 15, color: filled ? Colors.white : C.brand),
                const SizedBox(width: 6),
              ],
              Text(
                text,
                style: t(13, w: FontWeight.w800, c: filled ? Colors.white : C.brand),
              ),
            ],
          ),
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: C.hair),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: open,
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                ClipOval(child: Img(venue['image'], width: 52, height: 52)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${venue['name']}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: t(15, w: FontWeight.w800),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${b['date_label']} · ${b['time_short']} · ${sport['name']} · ${court['name']}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: t(12.5, w: FontWeight.w600, c: C.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    label,
                    style: t(11, w: FontWeight.w800, c: fg, h: 1.2),
                  ),
                ),
              ],
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: DashedLine()),
          Row(
            children: [
              Expanded(
                child: status == 'completed' && b['can_review'] == true
                    ? GestureDetector(
                        onTap: () => _rate(context, b),
                        child: Row(
                          children: [
                            Text(
                              'Rate ',
                              style: t(12.5, w: FontWeight.w700, c: C.mutedInk),
                            ),
                            for (var i = 0; i < 5; i++)
                              const DIcon(DIcons.star, size: 17, color: Color(0xFFDDD9CE)),
                          ],
                        ),
                      )
                    : Text(
                        '${b['note'] ?? ''}'.isNotEmpty
                            ? '${b['note']}'
                            : '${inr(status == 'cancelled' ? b['refund_amount'] : (b['my_paid'] ?? b['total']))} paid',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: t(12.5, w: FontWeight.w700, c: C.mutedInk),
                      ),
              ),
              const SizedBox(width: 10),
              if (status == 'confirmed') cta('Ticket', open, icon: LucideIcons.qrCode),
              if (status == 'held')
                cta('Pay now', () async {
                  await context.pushPayment(b);
                  await reload();
                }),
              if (status == 'completed' || status == 'cancelled')
                cta('Book again', () async {
                  await openSlotBooking(context, venue['id'], sportId: sport['id']);
                  await reload();
                }, filled: false),
            ],
          ),
        ],
      ),
    );
  }
}
