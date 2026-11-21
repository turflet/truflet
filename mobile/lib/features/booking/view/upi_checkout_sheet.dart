import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';

/// Opens the YOUPI checkout for a pending UPI [payment] and waits for the backend to confirm it.
///
/// The booking is confirmed by the server (signed gateway webhook or its own status check), never by the app:
/// this sheet only polls [poll] and closes with its latest result once [done] says so (default: the booking is
/// confirmed). Returns null when the player leaves.
Future<Json?> showUpiCheckout(
  BuildContext context, {
  required Json payment,
  required Future<Json> Function() poll,
  bool Function(Json r)? done,
}) =>
    showModalBottomSheet<Json>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _UpiCheckoutSheet(payment: payment, poll: poll, done: done ?? (r) => r['status'] == 'confirmed'),
    );

class _UpiCheckoutSheet extends StatefulWidget {
  final Json payment;
  final Future<Json> Function() poll;
  final bool Function(Json r) done;
  const _UpiCheckoutSheet({required this.payment, required this.poll, required this.done});

  @override
  State<_UpiCheckoutSheet> createState() => _UpiCheckoutSheetState();
}

class _UpiCheckoutSheetState extends State<_UpiCheckoutSheet> with WidgetsBindingObserver {
  static const _every = Duration(seconds: 3);
  static const _giveUpAfter = Duration(minutes: 15);
  static const _failed = {
    'failed': 'The payment did not go through. No money was taken for this booking.',
    'expired': 'The payment window ran out. If money left your account it will be matched or refunded.',
    'cancelled': 'The payment was cancelled.',
  };

  Timer? _timer;
  bool _checking = false;
  String? _error;
  late final DateTime _started = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _open();
    _timer = Timer.periodic(_every, (_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed) _check(); // back from the UPI app: look right away
  }

  Future<void> _open() async {
    final uri = Uri.tryParse(widget.payment['checkout_url'] ?? '');
    if (uri == null) return;
    // In-app browser (Chrome Custom Tab / Safari view) keeps the player in Turflet, and the checkout's
    // UPI app buttons can still hand off to GPay, PhonePe, Paytm and the rest.
    final ok = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    if (!ok) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _closeBrowser() async {
    try {
      await closeInAppWebView(); // brings the player back from the checkout tab where the platform allows it
    } catch (_) {}
  }

  Future<void> _check() async {
    if (_checking || _error != null || !mounted) return;
    _checking = true;
    try {
      final r = await widget.poll();
      if (!mounted) return;
      final status = (r['payment'] is Map) ? r['payment']['status'] : null;
      if (widget.done(r)) {
        _timer?.cancel();
        await _closeBrowser();
        if (mounted) Navigator.of(context).pop(r);
      } else if (_failed.containsKey(status)) {
        _timer?.cancel();
        await _closeBrowser();
        setState(() => _error = _failed[status]);
      } else if (DateTime.now().difference(_started) > _giveUpAfter) {
        _timer?.cancel();
        setState(
          () => _error =
              "We haven't heard from your bank yet. If you paid, the booking "
              'will confirm on its own: check My Bookings in a few minutes.',
        );
      }
    } catch (_) {
      // network blip: the next tick tries again
    } finally {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final failed = _error != null;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 22, 20, 20 + MediaQuery.of(context).padding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: failed
                ? const Icon(LucideIcons.circleAlert, size: 40, color: C.muted)
                : const SizedBox(
                    width: 36,
                    height: 36,
                    child: CircularProgressIndicator(strokeWidth: 3, color: C.brand),
                  ),
          ),
          const SizedBox(height: 16),
          Text(failed ? 'Payment not completed' : 'Complete the payment', textAlign: TextAlign.center, style: d(20)),
          const SizedBox(height: 8),
          Text(
            failed
                ? _error!
                : 'Pay ${inr(widget.payment['amount'])} in your UPI app. This screen updates by itself '
                      'once your bank confirms — usually within a minute.',
            textAlign: TextAlign.center,
            style: t(14, c: C.muted, h: 1.4),
          ),
          const SizedBox(height: 20),
          if (!failed) ...[PrimaryButton('Open payment page', onTap: _open, height: 52), const SizedBox(height: 10)],
          GhostButton(failed ? 'Close' : "I'll pay later", onTap: () => Navigator.of(context).pop()),
        ],
      ),
    );
  }
}
