import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/booking_repository.dart';
import '../cubit/payment_cubit.dart';
import 'upi_checkout_sheet.dart';

/// 7 · Review & pay
class PaymentScreen extends StatelessWidget {
  final Json booking;
  const PaymentScreen({super.key, required this.booking});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => PaymentCubit(booking: booking, repository: c.read<BookingRepository>(), app: c.read<AppCubit>()),
    child: const _PaymentView(),
  );
}

class _PaymentView extends StatefulWidget {
  const _PaymentView();
  @override
  State<_PaymentView> createState() => _PaymentViewState();
}

/// Text fields are view state; everything else lives in [PaymentCubit].
class _PaymentViewState extends State<_PaymentView> {
  late final code = TextEditingController(text: context.read<PaymentCubit>().state.booking['coupon'] ?? '');

  PaymentCubit get _cubit => context.read<PaymentCubit>();

  Future<void> _coupon() async {
    final removed = await _cubit.toggleCoupon(code.text);
    if (removed) code.clear();
  }

  Future<void> _pay() async {
    final r = await _cubit.pay('');
    if (!mounted) return;
    if (r.error != null) {
      toast(context, r.error!);
      return;
    }
    var booking = r.booking;
    if (r.checkout != null) {
      // UPI via the gateway checkout: wait until the server has confirmed the money
      booking = await showUpiCheckout(context, payment: r.checkout!, poll: _cubit.paymentStatus);
      if (!mounted || booking == null) return;
      context.read<AppCubit>().refreshMe();
    }
    context.replaceWithBookingConfirmed(booking!);
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<PaymentCubit, PaymentState>(builder: _build);

  final _billKey = GlobalKey();

  Widget _build(BuildContext context, PaymentState st) {
    final b = st.booking, left = st.left, busy = st.busy, couponBusy = st.couponBusy, couponError = st.couponError;
    final applied = st.couponApplied;
    final mm = left.inMinutes.toString().padLeft(2, '0');
    final ss = (left.inSeconds % 60).toString().padLeft(2, '0');
    final peak = (b['peak_hours'] ?? 0) > 0;
    final venue = asMap(b['venue']), sport = asMap(b['sport']), court = asMap(b['court']);
    final gst = (context.read<AppCubit>().state.config['gst_percent'] ?? 18).round();
    Widget bill(String k, String v, {bool green = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              k,
              style: t(14, w: green ? FontWeight.w800 : FontWeight.w600, c: green ? C.green700 : C.ink),
            ),
          ),
          Text(
            v,
            style: t(14, w: green ? FontWeight.w800 : FontWeight.w600, c: green ? C.green700 : C.ink),
          ),
        ],
      ),
    );

    return LightStatusBar(
      child: Scaffold(
        body: ListView(
          padding: EdgeInsets.zero,
          children: [
            Band(
              title: 'Review & pay',
              onBack: () => Navigator.of(context).maybePop(),
              actions: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: left == Duration.zero ? C.coralSoft : C.sun,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    children: [
                      const DIcon(DIcons.clock, size: 15, color: C.ink),
                      const SizedBox(width: 6),
                      Text(
                        left == Duration.zero ? 'Hold expired' : 'Held $mm:$ss',
                        style: t(12.5, w: FontWeight.w800, h: 1.2),
                      ),
                    ],
                  ),
                ),
              ],
              children: [
                Panel(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                  gap: 14,
                  children: [
                    Row(
                      children: [
                        Img(venue['image'], width: 64, height: 64, radius: BorderRadius.circular(16)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${venue['name']}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: t(17, w: FontWeight.w800, c: Colors.white),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${venue['area']}, ${venue['city']}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: t(12.5, w: FontWeight.w600, c: C.panelInk),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    PanelTile(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${court['name']} · ${sport['name']}',
                                  style: t(15, w: FontWeight.w800, c: Colors.white),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${b['date_label']} · ${b['time_short']} · ${b['duration']} hr${b['duration'] == 1 ? '' : 's'}',
                                  style: t(13, w: FontWeight.w600, c: C.panelInk),
                                ),
                                const SizedBox(height: 4),
                                GestureDetector(
                                  onTap: () => Navigator.of(context).maybePop(),
                                  child: Text(
                                    'Change slot',
                                    style: t(12.5, w: FontWeight.w800, c: C.sun),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            inr(b['slot_amount']),
                            style: t(16, w: FontWeight.w800, c: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 22, 16, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (applied)
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F8F5),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: C.green700, width: 1.5),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: const BoxDecoration(color: C.green700, shape: BoxShape.circle),
                            child: const DIcon(DIcons.check, size: 20, color: Colors.white),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${b['coupon']} applied · ${inr(b['discount'])} saved',
                                  style: t(14, w: FontWeight.w800),
                                ),
                                Text(
                                  'Taken off your total below',
                                  style: t(12, w: FontWeight.w600, c: C.muted),
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: couponBusy ? null : _coupon,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: couponBusy
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFB4401F)),
                                    )
                                  : Text(
                                      'Remove',
                                      style: t(13, w: FontWeight.w800, c: const Color(0xFFB4401F)),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    DashedBorderBox(
                      radius: 18,
                      color: C.chipLine,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const DIcon(DIcons.tag, size: 20, color: C.green700),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextField(
                                    controller: code,
                                    textCapitalization: TextCapitalization.characters,
                                    style: t(14, w: FontWeight.w700),
                                    onChanged: (_) => setState(() {}),
                                    decoration: InputDecoration(
                                      border: InputBorder.none,
                                      isDense: true,
                                      hintText: 'Have a coupon code?',
                                      hintStyle: t(14, w: FontWeight.w600, c: C.muted),
                                    ),
                                  ),
                                ),
                                Material(
                                  color: code.text.trim().isEmpty ? C.chip : C.brand,
                                  borderRadius: BorderRadius.circular(12),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: couponBusy || code.text.trim().isEmpty ? null : _coupon,
                                    child: Container(
                                      height: 40,
                                      padding: const EdgeInsets.symmetric(horizontal: 16),
                                      alignment: Alignment.center,
                                      child: couponBusy
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                            )
                                          : Text(
                                              'Apply',
                                              style: t(
                                                13,
                                                w: FontWeight.w800,
                                                c: code.text.trim().isEmpty ? C.muted : Colors.white,
                                              ),
                                            ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (couponError != null) ...[
                              const SizedBox(height: 8),
                              Text(couponError, style: t(12, c: C.warnInk)),
                            ],
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 22),
                  Rule('Bill details', key: _billKey),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: C.hair),
                    ),
                    child: Column(
                      children: [
                        bill(
                          'Court fee (${b['duration']} × ${inr(b['rate'])}${peak ? ' peak' : ''})',
                          inr(b['slot_amount']),
                        ),
                        bill('Convenience fee', inr(b['convenience_fee'])),
                        bill('GST on fee ($gst%)', inr(b['gst'])),
                        if (applied) bill('Coupon ${b['coupon']}', '−${inr(b['discount'])}', green: true),
                        const Divider(height: 8, color: C.hair),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: Text('To pay', style: t(16, w: FontWeight.w800)),
                            ),
                            Text(inr(b['total']), style: t(16, w: FontWeight.w800)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 1),
                        child: DIcon(DIcons.shield, size: 18, color: C.green700),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          "Secure UPI payment. Not ready? Pay later from My bookings before the hold ends. Refunds follow the venue's cancellation policy.",
                          style: t(12.5, c: C.muted, h: 1.5),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: StickyBar(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(inr(b['total']), style: d(19, ls: -0.4)),
                GestureDetector(
                  onTap: () {
                    final ctx = _billKey.currentContext;
                    if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300));
                  },
                  child: Text(
                    'View bill',
                    style: t(12, w: FontWeight.w800, c: C.green700),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: GoButton('Pay ${inr(b['total'])}', loading: busy, onTap: _pay),
            ),
          ],
        ),
      ),
    );
  }
}
