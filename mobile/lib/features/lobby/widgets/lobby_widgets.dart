import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/art.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';

/// "Turf locked" (already paid) vs "Crowdfunding" (pool still filling, turf not booked yet).
class SlotStatePill extends StatelessWidget {
  final Json lobby;
  final double size;
  const SlotStatePill(this.lobby, {super.key, this.size = 11});

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg, icon) = switch (lobby['status']) {
      'locked' => ('Turf locked', C.mint, C.green700, LucideIcons.lock),
      'crowdfunding' => ('Crowdfunding', C.amberSoft, C.amber, LucideIcons.piggyBank),
      'draft' => ('Awaiting payment', C.chip, C.mutedInk, LucideIcons.hourglass),
      'completed' => ('Played', C.chip, C.mutedInk, LucideIcons.circleCheck),
      'cancelled' => ('Cancelled', C.redSoft, C.redInk, LucideIcons.x),
      _ => ('Expired', C.chip, C.muted, LucideIcons.x),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: size + 1, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: t(size, w: FontWeight.w700, c: fg),
          ),
        ],
      ),
    );
  }
}

/// Filled vs open spots (7/10).
class FillBar extends StatelessWidget {
  final int taken, capacity;
  final double height;
  const FillBar({super.key, required this.taken, required this.capacity, this.height = 6});

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(999),
    child: LinearProgressIndicator(
      value: capacity == 0 ? 0 : (taken / capacity).clamp(0, 1).toDouble(),
      minHeight: height,
      backgroundColor: C.chip,
      color: C.green700,
    ),
  );
}

class AvatarStack extends StatelessWidget {
  final List<String> initials;
  final double size;
  final int max;
  const AvatarStack(this.initials, {super.key, this.size = 26, this.max = 5});

  @override
  Widget build(BuildContext context) {
    final n = initials.length.clamp(0, max);
    if (n == 0) return const SizedBox.shrink();
    final step = size * 0.62;
    return SizedBox(
      width: size + step * (n - 1),
      height: size,
      child: Stack(
        children: [
          for (var k = 0; k < n; k++)
            Positioned(
              left: k * step,
              child: Avatar(initials[k], index: k, size: size, ring: true),
            ),
        ],
      ),
    );
  }
}

/// Rebuilds every second with the time left until [until] (never negative).
class Countdown extends StatefulWidget {
  final DateTime until;
  final Widget Function(BuildContext context, Duration left) builder;
  const Countdown({super.key, required this.until, required this.builder});

  @override
  State<Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<Countdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.until.difference(DateTime.now());
    return widget.builder(context, d.isNegative ? Duration.zero : d);
  }
}

String mmss(Duration d) => '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

/// Host reliability, e.g. "96% reliable · 12 hosted" or "New host".
String reliability(Json host) {
  final r = host['reliability'];
  if (r == null) return 'New host';
  return '$r% reliable · ${host['hosted']} hosted';
}

/// Per-head line: "₹265 /player" or "Free · host covers".
Widget perHead(Json lobby, {double size = 18}) {
  final amount = (lobby['per_head'] as int?) ?? 0;
  if (amount == 0) {
    return Text(
      'Free · host pays',
      style: t(13, w: FontWeight.w700, c: C.brand),
    );
  }
  return Text.rich(
    TextSpan(
      children: [
        TextSpan(
          text: inr(amount),
          style: d(size, c: C.brand),
        ),
        TextSpan(
          text: ' /player',
          style: t(12, c: C.muted),
        ),
      ],
    ),
  );
}

/// Lobby card (redesign): sport photo header with the slot state, host + reliability, fill bar, per-head share and a
/// role-aware action (Request to join / Accept invite / Requested / Open room).
class LobbyCard extends StatelessWidget {
  final Json lobby;
  final VoidCallback? onAction;
  final VoidCallback? onTap;
  final bool showVenue;
  const LobbyCard({super.key, required this.lobby, this.onAction, this.onTap, this.showVenue = true});

  @override
  Widget build(BuildContext context) {
    final g = lobby;
    final host = asMap(g['host']);
    final sport = asMap(g['sport']);
    final taken = (g['taken'] as int?) ?? 0, capacity = (g['capacity'] as int?) ?? 0;
    final left = (g['spots_left'] as int?) ?? 0;
    final role = g['my_role'];
    final (label, bg, fg) = switch (role) {
      'host' => ('Your match', C.chip, C.mutedInk),
      'member' => ('Open room', C.mint, C.green700),
      'requested' => ('Requested', C.amberSoft, C.amber),
      'invited' => ('Accept invite', C.coral, Colors.white),
      'declined' => (
        left == 0 ? 'Full' : 'Request again',
        left == 0 ? C.chip : C.brand,
        left == 0 ? C.muted : Colors.white,
      ),
      _ => (left == 0 ? 'Full' : 'Request to join', left == 0 ? C.chip : C.brand, left == 0 ? C.muted : Colors.white),
    };
    final photo = Art.sportScene(sport['name']);
    final locked = g['status'] == 'locked';
    final where = showVenue ? '${g['venue']?['name'] ?? ''}' : '${g['court']?['name'] ?? ''}';
    final perHeadAmount = (g['per_head'] as int?) ?? 0;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF0EEE8)),
        boxShadow: const [
          BoxShadow(color: Color(0x0D0C2419), blurRadius: 2, offset: Offset(0, 1)),
          BoxShadow(color: Color(0x120C2419), blurRadius: 20, offset: Offset(0, 6)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 120,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Img(photo),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: [0.3, 1],
                          colors: [Color(0x000C2419), Color(0xD90C2419)],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                        decoration: BoxDecoration(
                          color: locked ? C.mint : C.coralSoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(color: locked ? C.green700 : C.coral, shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              locked
                                  ? 'Turf locked'
                                  : (g['status'] == 'crowdfunding'
                                        ? 'Crowdfunding'
                                        : '${g['status_label'] ?? g['status']}'),
                              style: t(11, w: FontWeight.w800, c: locked ? C.brand : C.orangeInk, h: 1.2),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 14,
                      right: 14,
                      bottom: 10,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${sport['name'] ?? ''}${where.isNotEmpty ? ' · $where' : ''}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: d(17, c: Colors.white, ls: -0.3),
                          ),
                          Text(
                            '${g['date_label']} · ${g['time_label']}${showVenue && g['venue']?['area'] != null ? ' · ${g['venue']['area']}' : ''}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: t(12.5, w: FontWeight.w600, c: C.mint),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Avatar(host['initials'] ?? '', size: 38),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                role == 'invited'
                                    ? '${host['name'] ?? ''} invited you'
                                    : '${host['name'] ?? ''} is hosting',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: t(14, w: FontWeight.w800, c: role == 'invited' ? C.orangeInk : C.ink),
                              ),
                              Row(
                                children: [
                                  host['reliability'] == null
                                    ? const Icon(LucideIcons.sparkles, size: 12, color: C.green700)
                                    : const DIcon(DIcons.shield, size: 12, color: C.green700),
                                  const SizedBox(width: 4),
                                  Text(
                                    reliability(host),
                                    style: t(12, w: FontWeight.w600, c: C.muted),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        AvatarStack((g['avatars'] as List? ?? const []).cast<String>(), size: 24, max: 4),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text('$taken of $capacity joined', style: t(12.5, w: FontWeight.w700)),
                        ),
                        Text(
                          left == 0 ? 'Full' : '$left spot${left == 1 ? '' : 's'} left',
                          style: t(12.5, w: FontWeight.w700, c: left == 0 ? C.muted : C.orangeInk),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    FillBar(taken: taken, capacity: capacity, height: 8),
                    const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: DashedLine()),
                    Row(
                      children: [
                        Expanded(
                          child: perHeadAmount > 0
                              ? Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(inr(perHeadAmount), style: d(18, ls: -0.4)),
                                    Text(
                                      'per player · held in escrow',
                                      style: t(11.5, w: FontWeight.w600, c: C.muted),
                                    ),
                                  ],
                                )
                              : Text(
                                  'Free · host pays',
                                  style: t(13, w: FontWeight.w800, c: C.brand),
                                ),
                        ),
                        if (onAction != null)
                          GhostButton(
                            label,
                            height: 44,
                            radius: 14,
                            fontSize: 14,
                            bg: bg,
                            fg: fg,
                            border: Colors.transparent,
                            onTap: (role == null || role == 'declined') && left == 0 ? null : onAction,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Empty / info card with an icon.
class EmptyNote extends StatelessWidget {
  final IconData icon;
  final String title, body;
  final Widget? action;
  const EmptyNote({super.key, required this.icon, required this.title, required this.body, this.action});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 12),
    child: Column(
      children: [
        Icon(icon, size: 40, color: C.muted),
        const SizedBox(height: 12),
        Text(title, style: d(18), textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(
          body,
          textAlign: TextAlign.center,
          style: t(14, c: C.muted, h: 1.5),
        ),
        if (action != null) ...[const SizedBox(height: 16), action!],
      ],
    ),
  );
}
