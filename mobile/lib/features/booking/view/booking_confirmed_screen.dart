import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';

/// 8 · Booking confirmed
class BookingConfirmedScreen extends StatefulWidget {
  final Json booking;
  const BookingConfirmedScreen({super.key, required this.booking});
  @override
  State<BookingConfirmedScreen> createState() => _BookingConfirmedScreenState();
}

class _BookingConfirmedScreenState extends State<BookingConfirmedScreen> with SingleTickerProviderStateMixin {
  late final pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 500))..forward();

  @override
  void dispose() {
    pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.booking;
    final top = MediaQuery.of(context).padding.top;
    final venue = asMap(b['venue']), sport = asMap(b['sport']), court = asMap(b['court']);
    final first = '${context.watch<AppCubit>().state.user?['name'] ?? ''}'.trim().split(' ').first;
    final pin = '${b['checkin_pin'] ?? ''}'.split('').where((x) => x.isNotEmpty).toList();
    final quick = [
      (
        DIcons.directions,
        'Directions',
        () => openMaps(venue['lat'], venue['lng'], '${venue['name']} ${venue['address'] ?? ''}'),
      ),
      '${venue['phone'] ?? ''}'.isNotEmpty
          ? (DIcons.phone, 'Call venue', () => callNumber('${venue['phone']}'))
          : (LucideIcons.qrCode, 'Full ticket', () => context.replaceWithTicket(b['id'])),
      (DIcons.calendarAdd, 'Add to calendar', () => addToCalendar(b)),
    ];
    return LightStatusBar(
      child: Scaffold(
        body: ListView(
          padding: EdgeInsets.zero,
          children: [
            Container(
              color: C.brandDark,
              child: Container(
                padding: EdgeInsets.fromLTRB(16, top + 30, 16, 76),
                decoration: const BoxDecoration(
                  color: C.brand,
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.topCenter,
                  children: [
                    Positioned(
                      top: -top - 30,
                      left: -16,
                      right: -16,
                      height: 180,
                      child: CustomPaint(painter: _Confetti()),
                    ),
                    Column(
                      children: [
                        ScaleTransition(
                          scale: CurvedAnimation(parent: pop, curve: Curves.elasticOut),
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Container(
                                width: 112,
                                height: 112,
                                alignment: Alignment.center,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    center: Alignment(-0.3, -0.4),
                                    colors: [Colors.white, Color(0xFFDCEBE0), Color(0xFFB9D3C1)],
                                    stops: [0, 0.7, 1],
                                  ),
                                  boxShadow: [
                                    BoxShadow(color: Color(0x59000000), blurRadius: 26, offset: Offset(0, 12)),
                                  ],
                                ),
                                child: Image.asset(
                                  'assets/images/trophy.png',
                                  width: 92,
                                  height: 92,
                                  fit: BoxFit.contain,
                                ),
                              ),
                              Positioned(
                                right: -2,
                                bottom: 4,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: C.green700,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: C.brand, width: 3),
                                  ),
                                  child: const DIcon(DIcons.check, size: 18, color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        PanelHeadline(
                          first.isNotEmpty ? "You're on, " : "You're on",
                          first.isNotEmpty ? '$first!' : '!',
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Booking confirmed · ${inr(b['total'])} paid${'${b['payment_method_label'] ?? ''}'.isNotEmpty ? ' with ${b['payment_method_label']}' : ''}',
                          textAlign: TextAlign.center,
                          style: t(14, w: FontWeight.w600, c: C.panelInk),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -56),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: const [
                    BoxShadow(color: Color(0x140C2419), blurRadius: 2, offset: Offset(0, 1)),
                    BoxShadow(color: Color(0x290C2419), blurRadius: 34, offset: Offset(0, 14)),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 96,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Img(venue['image']),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(colors: [Color(0xD90B2A1D), Color(0x330B2A1D)]),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 18),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${venue['name']}', style: d(18, c: Colors.white, ls: -0.4)),
                                Text(
                                  '${court['name']} · ${sport['name']}',
                                  style: t(12.5, w: FontWeight.w600, c: C.panelInk),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      onTap: () => context.replaceWithTicket(b['id']),
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: C.hair),
                              ),
                              child: QrImageView(
                                data: '${b['qr_payload'] ?? b['code']}',
                                size: 105,
                                padding: EdgeInsets.zero,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'BOOKING ID',
                                    style: t(11, w: FontWeight.w800, c: C.muted, ls: 1),
                                  ),
                                  Text('${b['code']}', style: t(16, w: FontWeight.w800, ls: 0.5)),
                                  if (pin.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'CHECK-IN PIN',
                                      style: t(11, w: FontWeight.w800, c: C.muted, ls: 1),
                                    ),
                                    const SizedBox(height: 3),
                                    Row(
                                      children: [
                                        for (final x in pin)
                                          Container(
                                            width: 26,
                                            height: 32,
                                            margin: const EdgeInsets.only(right: 4),
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              color: C.mint,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              x,
                                              style: t(17, w: FontWeight.w800, c: C.brand, h: 1),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 18), child: DashedLine(thickness: 1)),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                      child: Column(
                        children: [
                          for (final (i, r) in [
                            (
                              DIcons.calendar,
                              '${b['date_long']} · ${b['time_long']}',
                              'Reach 10 minutes early to check in',
                            ),
                            (
                              DIcons.pin,
                              '${venue['address'] ?? ''}'.isNotEmpty
                                  ? '${venue['address']}'
                                  : '${venue['area']}, ${venue['city']}',
                              '${venue['area']}, ${venue['city']}',
                            ),
                          ].indexed) ...[
                            if (i > 0) const SizedBox(height: 12),
                            Row(
                              children: [
                                Disc(icon: r.$1, size: 40, iconSize: 20),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        r.$2,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: t(14.5, w: FontWeight.w800),
                                      ),
                                      Text(
                                        r.$3,
                                        style: t(12.5, w: FontWeight.w600, c: C.muted),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -34),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    for (final q in quick)
                      Expanded(
                        child: GestureDetector(
                          onTap: q.$3,
                          child: Column(
                            children: [
                              Disc(icon: q.$1, size: 60, iconSize: 24),
                              const SizedBox(height: 8),
                              Text(
                                q.$2,
                                textAlign: TextAlign.center,
                                style: t(12.5, w: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 22 + MediaQuery.of(context).padding.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              b['lobby'] != null
                  ? GoButton('Open Match Room', onTap: () => context.replaceWithMatch(b['lobby']['id']))
                  : GoButton('Invite your squad', onTap: () => inviteTeam(b)),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () => context.goTab(AppTab.explore),
                style: TextButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(
                  'Back to home',
                  style: t(15, w: FontWeight.w800, c: C.brand),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sun and coral confetti over the hero (viewBox 390×180).
class _Confetti extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 390, sy = size.height / 180;
    final sun = Paint()..color = C.sun, coral = Paint()..color = C.coral;
    void bit(double x, double y, double w, double h, double deg, Paint p) {
      canvas.save();
      canvas.translate(x * sx, y * sy);
      canvas.rotate(deg * 3.14159 / 180);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: h), Radius.circular(h / 2)),
        p,
      );
      canvas.restore();
    }

    bit(57, 42, 10, 5, 30, sun);
    bit(326, 60, 12, 5, -25, sun);
    canvas.drawCircle(Offset(300 * sx, 28 * sy), 4, sun);
    canvas.drawCircle(Offset(86 * sx, 104 * sy), 3.5, coral);
    bit(274, 120, 9, 4, 50, coral);
    bit(41, 138, 10, 4, -40, coral);
    canvas.drawCircle(Offset(352 * sx, 140 * sy), 3, coral);
  }

  @override
  bool shouldRepaint(_Confetti old) => false;
}
