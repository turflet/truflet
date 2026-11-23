import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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

  Widget _build(BuildContext context, PaymentState st) {
    final b = st.booking, left = st.left, busy = st.busy, couponBusy = st.couponBusy, couponError = st.couponError;
    final top = MediaQuery.of(context).padding.top;
    final applied = st.couponApplied;
    final mm = left.inMinutes.toString().padLeft(2, '0');
    final ss = (left.inSeconds % 60).toString().padLeft(2, '0');
    final peak = (b['peak_hours'] ?? 0) > 0;
    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(20, top + 8, 20, 12),
            child: Row(
              children: [
                const BackSquare(),
                const SizedBox(width: 12),
                Text('Review & pay', style: d(20)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: C.warnBg, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.clock, size: 14, color: C.warnInk),
                      const SizedBox(width: 6),
                      Text(
                        left == Duration.zero ? 'Hold expired' : 'Slot held $mm:$ss',
                        style: t(12, w: FontWeight.w600, c: C.warnInk),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                Container(
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: shadowCard),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Img(b['venue']['image'], width: 72, height: 72, radius: BorderRadius.circular(16)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(b['venue']['name'], style: d(17)),
                                  const SizedBox(height: 4),
                                  Text('${b['venue']['area']}, ${b['venue']['city']}', style: t(13, c: C.muted)),
                                  const SizedBox(height: 4),
                                  SportPill(b['sport'], label: '${b['sport']['name']} · ${b['court']['name']}'),
                                ],
                              ),
                            ),
                            GestureDetector(
                              onTap: () => Navigator.of(context).pop(),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text(
                                  'Edit',
                                  style: t(13, w: FontWeight.w600, c: C.brand),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                        decoration: const BoxDecoration(
                          color: C.ground,
                          border: Border(top: BorderSide(color: C.dashed)),
                        ),
                        child: Row(
                          children: [
                            Expanded(child: KV('Date', b['date_label'].toString().replaceFirst('Today, ', 'Today, '), vSize: 13)),
                            Expanded(child: KV('Time', b['time_short'], vSize: 13)),
                            Expanded(child: KV('Duration', '${b['duration']} ${b['duration'] == 1 ? 'hr' : 'hrs'}', vSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: C.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Have a coupon?', style: t(13, w: FontWeight.w600)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              decoration: BoxDecoration(
                                color: C.ground,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: C.line),
                              ),
                              child: TextField(
                                controller: code,
                                enabled: !applied,
                                textCapitalization: TextCapitalization.characters,
                                style: t(14),
                                decoration: InputDecoration(
                                  border: InputBorder.none,
                                  hintText: 'Enter code',
                                  hintStyle: t(14, c: C.muted),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 48,
                            child: Material(
                              color: applied ? C.mint : C.brand,
                              borderRadius: BorderRadius.circular(12),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: couponBusy ? null : _coupon,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 18),
                                  child: Center(
                                    child: Text(
                                      applied ? 'Remove' : 'Apply',
                                      style: t(14, w: FontWeight.w700, c: applied ? C.brand : Colors.white),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (couponError != null)
                        Text(couponError, style: t(12, c: C.warnInk))
                      else if (applied)
                        Text(
                          '${b['coupon']} applied — you save ${inr(b['discount'])}',
                          style: t(13, w: FontWeight.w600, c: C.brand),
                        )
                      else
                        Text.rich(
                          TextSpan(
                            style: t(12, c: C.muted),
                            children: [
                              const TextSpan(text: 'Try '),
                              TextSpan(
                                text: 'PLAY100',
                                style: t(12, w: FontWeight.w700),
                              ),
                              const TextSpan(text: ' for ₹100 off your first booking'),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: C.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const H2('Price details', size: 16),
                      const SizedBox(height: 14),
                      PriceRow(
                        'Slot charges (${b['duration']} × ${inr(b['rate'])}${peak ? ' peak' : ''})',
                        inr(b['slot_amount']),
                      ),
                      const SizedBox(height: 10),
                      PriceRow('Convenience fee', inr(b['convenience_fee'])),
                      const SizedBox(height: 10),
                      PriceRow(
                        'GST on fee (${(context.read<AppCubit>().state.config['gst_percent'] ?? 18).round()}%)',
                        inr(b['gst']),
                      ),
                      if (applied) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Coupon discount',
                                style: t(14, w: FontWeight.w600, c: C.brand),
                              ),
                            ),
                            Text(
                              '−${inr(b['discount'])}',
                              style: t(14, w: FontWeight.w600, c: C.brand),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 10),
                      PriceRow('To pay', inr(b['total']), bold: true, top: true, size: 16),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(LucideIcons.shieldCheck, size: 14, color: C.muted),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text('100% secure payments · Free cancellation up to 6 hrs before', style: t(12, c: C.muted)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Not ready? Go back and pay later from My Bookings before the hold ends.',
                  textAlign: TextAlign.center,
                  style: t(12, c: C.muted),
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 14, 20, 14 + MediaQuery.of(context).padding.bottom),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: C.line)),
            ),
            child: Container(
              height: 56,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: shadowBrand),
              child: Material(
                color: C.brand,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: busy ? null : _pay,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: busy
                        ? const Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.4),
                            ),
                          )
                        : Row(
                            children: [
                              Text(
                                'Pay ${inr(b['total'])}',
                                style: t(16, w: FontWeight.w700, c: Colors.white),
                              ),
                              const Spacer(),
                              const Icon(LucideIcons.arrowRight, size: 18, color: Colors.white),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
