import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../app/router/app_navigation.dart';
import '../../app/session/app_cubit.dart';
import '../../app/session/app_state.dart';
import '../theme/theme.dart';
import 'design_icons.dart';

// Redesign building blocks: the dark header band, the circular section tabs, the green panel under them,
// white underline tabs, "SECTION ——" rules and the soft icon discs. Mirrors web/src/ui/brand.jsx.

const _bandBtnFill = Color(0x14FFFFFF); // rgba(255,255,255,.08)
const _bandBtnEdge = Color(0x24FFFFFF); // rgba(255,255,255,.14)

/// Light status-bar icons for screens that start with the dark band.
class LightStatusBar extends StatelessWidget {
  final Widget child;
  const LightStatusBar({super.key, required this.child});
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
    child: child,
  );
}

/// Round translucent button on the dark band (back, share…).
class BandButton extends StatelessWidget {
  final Object icon; // IconData or DI
  final String label;
  final VoidCallback? onTap;
  const BandButton({super.key, this.icon = DIcons.back, this.label = 'Back', this.onTap});
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    child: Material(
      color: _bandBtnFill,
      shape: const CircleBorder(side: BorderSide(color: _bandBtnEdge)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap ?? () => Navigator.of(context).maybePop(),
        child: SizedBox(width: 44, height: 44, child: Center(child: glyph(icon, size: 22, color: Colors.white))),
      ),
    ),
  );
}

/// Ticket icon → My bookings, with the coral stub from the logo.
class BookingsButton extends StatelessWidget {
  const BookingsButton({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'My bookings',
    child: Material(
      color: _bandBtnFill,
      shape: const CircleBorder(side: BorderSide(color: _bandBtnEdge)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.read<AppCubit>().setTab(AppTab.bookings),
        child: SizedBox(
          width: 44,
          height: 44,
          child: const Center(child: DIcon(DIcons.ticket, size: 22, color: Colors.white)),
        ),
      ),
    ),
  );
}

/// Coral initials disc → Profile (or sign in).
class ProfileButton extends StatelessWidget {
  const ProfileButton({super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppCubit>();
    final u = app.state.user;
    final initials = (u?['initials'] as String?) ?? '?';
    return Semantics(
      button: true,
      label: app.loggedIn ? 'Profile' : 'Sign in',
      child: Material(
        color: C.coral,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => app.loggedIn ? app.setTab(AppTab.profile) : context.pushLogin(),
          child: SizedBox(
            width: 44,
            height: 44,
            child: Center(
              child: Text(
                app.loggedIn ? initials : '?',
                style: t(14, w: FontWeight.w800, c: Colors.white),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Dark band at the top of a screen: [title] in white, optional [subtitle]; [onTitle] makes the title a button with a
/// chevron (the location picker). [onBack] adds a round back button. [actions] sit at the end of the row.
/// [children] go below the row (section tabs, the green panel).
class Band extends StatelessWidget {
  final String title;
  final String? subtitle;
  final VoidCallback? onTitle, onBack;
  final List<Widget> actions;
  final List<Widget> children;
  final Widget? leading;
  const Band({
    super.key,
    required this.title,
    this.subtitle,
    this.onTitle,
    this.onBack,
    this.actions = const [],
    this.children = const [],
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final head = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: d(24, c: Colors.white, ls: -0.6, h: 1.15),
              ),
            ),
            if (onTitle != null) const DIcon(DIcons.chevR, size: 22, color: Colors.white),
          ],
        ),
        if (subtitle != null)
          Text(
            subtitle!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t(13, c: C.bandInk),
          ),
      ],
    );
    return Container(
      color: C.brandDark,
      padding: EdgeInsets.only(top: top),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
            child: Row(
              children: [
                if (onBack != null) ...[BandButton(onTap: onBack), const SizedBox(width: 12)],
                if (leading != null) ...[leading!, const SizedBox(width: 12)],
                Expanded(
                  child: onTitle == null
                      ? head
                      : GestureDetector(onTap: onTitle, behavior: HitTestBehavior.opaque, child: head),
                ),
                for (final a in actions) ...[const SizedBox(width: 10), a],
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

/// The big circular section tabs (Turfs · Matches) that replace the bottom nav. [badge] sits under Matches.
class SectionTabs extends StatelessWidget {
  final int active;
  final String? badge;
  const SectionTabs({super.key, required this.active, this.badge});

  static const _items = [('Turfs', 'assets/images/tab-turfs.png'), ('Matches', 'assets/images/tab-matches.png')];

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
    child: LayoutBuilder(
      builder: (context, box) {
        final w = (box.maxWidth - 12) / 4;
        return SizedBox(
          height: 124,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // inactive first so the active shape paints over its neighbour's edge
              for (final i in [
                for (var k = 0; k < _items.length; k++)
                  if (k != active) k,
                active,
              ])
                Positioned(left: i * (w + 4), top: 0, width: w, height: 124, child: _tab(context, i, w)),
            ],
          ),
        );
      },
    ),
  );

  Widget _tab(BuildContext context, int i, double w) {
    final on = i == active;
    return Semantics(
      button: true,
      selected: on,
      label: _items[i].$1,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.read<AppCubit>().setTab(i),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            Positioned(left: -12, right: -12, top: 0, bottom: 0, child: CustomPaint(painter: _TabShape(on))),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Transform.translate(
                    offset: Offset(0, on ? -4 : 0),
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 66,
                          height: 66,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              center: const Alignment(-0.3, -0.4),
                              radius: 0.8,
                              colors: on
                                  ? const [Colors.white, Color(0xFFDCEBE0), Color(0xFFB9D3C1)]
                                  : const [Color(0x38FFFFFF), Color(0x14FFFFFF)],
                              stops: on ? const [0, 0.7, 1] : const [0, 0.7],
                            ),
                            border: on ? null : Border.all(color: const Color(0x1FFFFFFF)),
                            boxShadow: on
                                ? const [BoxShadow(color: Color(0x59000000), blurRadius: 22, offset: Offset(0, 10))]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Image.asset(_items[i].$2, width: 60, height: 60, fit: BoxFit.contain),
                        ),
                        if (i == 1 && badge != null)
                          Positioned(
                            bottom: -9,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF2563EB),
                                borderRadius: BorderRadius.circular(7),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x732563EB), blurRadius: 6, offset: Offset(0, 2)),
                                ],
                              ),
                              child: Text(
                                badge!,
                                style: t(10.5, w: FontWeight.w800, c: Colors.white, h: 1.2),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _items[i].$1,
                    style: t(
                      14,
                      w: on ? FontWeight.w800 : FontWeight.w700,
                      c: on ? Colors.white : const Color(0xFFC9D8CE),
                      ls: -0.1,
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
}

/// The tab's rounded "folder" shape flaring into the panel below (viewBox 112×124).
class _TabShape extends CustomPainter {
  final bool on;
  _TabShape(this.on);
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 112, sy = size.height / 124;
    final p = Path()
      ..moveTo(0, 124 * sy)
      ..cubicTo(10 * sx, 124 * sy, 12 * sx, 118 * sy, 12 * sx, 106 * sy)
      ..lineTo(12 * sx, 30 * sy)
      ..cubicTo(12 * sx, 15 * sy, 22 * sx, 4 * sy, 38 * sx, 4 * sy)
      ..lineTo(74 * sx, 4 * sy)
      ..cubicTo(90 * sx, 4 * sy, 100 * sx, 15 * sy, 100 * sx, 30 * sy)
      ..lineTo(100 * sx, 106 * sy)
      ..cubicTo(100 * sx, 118 * sy, 102 * sx, 124 * sy, 112 * sx, 124 * sy)
      ..close();
    canvas.drawPath(p, Paint()..color = on ? C.brand : const Color(0x0BFFFFFF));
    if (!on) {
      canvas.drawPath(
        p,
        Paint()
          ..style = PaintingStyle.stroke
          ..color = const Color(0x14FFFFFF),
      );
    }
  }

  @override
  bool shouldRepaint(_TabShape old) => old.on != on;
}

/// The green panel under the band. [flat] = straight top (sits right under the section tabs).
class Panel extends StatelessWidget {
  final List<Widget> children;
  final bool flat;
  final double gap;
  final EdgeInsets padding;
  const Panel({
    super.key,
    required this.children,
    this.flat = false,
    this.gap = 18,
    this.padding = const EdgeInsets.fromLTRB(16, 20, 16, 22),
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: C.brand,
      borderRadius: flat
          ? const BorderRadius.vertical(bottom: Radius.circular(32))
          : const BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
              bottomLeft: Radius.circular(32),
              bottomRight: Radius.circular(32),
            ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
      ],
    ),
  );
}

/// Big centred white headline with an italic sun-yellow [script] word: "Game on, *Arjun!*".
class PanelHeadline extends StatelessWidget {
  final String lead, script;
  final double size;
  const PanelHeadline(this.lead, this.script, {super.key, this.size = 30});
  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      text: lead,
      children: [
        TextSpan(
          text: script,
          style: d(size, c: C.sun, ls: -1, h: 1.05).copyWith(fontStyle: FontStyle.italic),
        ),
      ],
    ),
    textAlign: TextAlign.center,
    style: d(size, c: Colors.white, ls: -1, h: 1.05),
  );
}

/// White-underline tabs on the green panel (NEARBY · TOP RATED, UPCOMING · COMPLETED …).
class UnderlineTabs extends StatelessWidget {
  final List<String> labels;
  final List<Object>? icons; // IconData or DI
  final int index;
  final ValueChanged<int> onChange;
  const UnderlineTabs({super.key, required this.labels, required this.index, required this.onChange, this.icons});

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: Color(0x24FFFFFF))),
    ),
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Semantics(
              selected: i == index,
              button: true,
              child: InkWell(
                onTap: () => onChange(i),
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: i == index ? Colors.white : Colors.transparent, width: 3)),
                  ),
                  child: Row(
                    children: [
                      if (icons != null) ...[
                        glyph(icons![i], size: 16, color: i == index ? Colors.white : const Color(0xBDFFFFFF)),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        labels[i],
                        style: t(
                          13,
                          w: FontWeight.w800,
                          c: i == index ? Colors.white : const Color(0xBDFFFFFF),
                          ls: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

/// White pill toggle on the panel (Open lobbies | My matches).
class PanelSwitch extends StatelessWidget {
  final List<String> labels;
  final int index;
  final ValueChanged<int> onChange;
  const PanelSwitch({super.key, required this.labels, required this.index, required this.onChange});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(color: const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(16)),
    child: Row(
      children: [
        for (var i = 0; i < labels.length; i++)
          Expanded(
            child: Semantics(
              selected: i == index,
              button: true,
              child: GestureDetector(
                onTap: () => onChange(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == index ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    labels[i],
                    style: t(
                      14,
                      w: i == index ? FontWeight.w800 : FontWeight.w700,
                      c: i == index ? C.brand : C.panelInk,
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

/// "AMENITIES ——————" section heading.
class Rule extends StatelessWidget {
  final String text;
  final String? extra;
  const Rule(this.text, {super.key, this.extra});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(
        text.toUpperCase(),
        style: t(12, w: FontWeight.w800, c: C.muted, ls: 1.4),
      ),
      if (extra != null) ...[
        const SizedBox(width: 10),
        Text(
          extra!,
          style: t(12, w: FontWeight.w600, c: C.muted),
        ),
      ],
      const SizedBox(width: 12),
      const Expanded(child: Divider(height: 1, thickness: 1, color: C.hair)),
    ],
  );
}

/// Soft mint disc holding a line icon (amenities, pay methods, menu rows).
class Disc extends StatelessWidget {
  final Object? icon; // IconData or DI
  final double size;
  final double? iconSize;
  final Widget? child;
  const Disc({super.key, this.icon, this.size = 44, this.iconSize, this.child});
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: const RadialGradient(center: Alignment(-0.3, -0.4), radius: 0.75, colors: [Colors.white, C.mint]),
      border: Border.all(color: C.discLine),
    ),
    alignment: Alignment.center,
    child: child ?? glyph(icon!, size: iconSize ?? size * 0.5, color: C.brand),
  );
}

/// Dark-green tile inside the panel (deals, stats, promo cards).
class PanelTile extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final double radius;
  const PanelTile({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(14, 12, 14, 12),
    this.onTap,
    this.radius = 18,
  });
  @override
  Widget build(BuildContext context) => Material(
    color: C.green900,
    borderRadius: BorderRadius.circular(radius),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

/// Green rating badge with a white star.
class RatingBadge extends StatelessWidget {
  final Object? value;
  const RatingBadge(this.value, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: C.green700, borderRadius: BorderRadius.circular(8)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$value',
          style: t(13, w: FontWeight.w800, c: Colors.white, h: 1.1),
        ),
        const SizedBox(width: 4),
        const DIcon(DIcons.star, size: 12, color: Colors.white),
      ],
    ),
  );
}

/// Bottom bar holding the main action (use as Scaffold.bottomNavigationBar).
class StickyBar extends StatelessWidget {
  final List<Widget> children;
  final bool border;
  const StickyBar({super.key, required this.children, this.border = true});
  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 20 + bottom),
      decoration: BoxDecoration(
        color: Colors.white,
        border: border ? const Border(top: BorderSide(color: C.hair)) : null,
      ),
      child: Row(children: children),
    );
  }
}

/// Primary forest-green CTA with the sun chevron.
class GoButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final double height;
  const GoButton(this.label, {super.key, this.onTap, this.loading = false, this.height = 56});
  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        boxShadow: onTap == null
            ? null
            : const [BoxShadow(color: Color(0x47143D2B), blurRadius: 24, offset: Offset(0, 10))],
      ),
      child: Material(
        color: onTap == null ? C.line : C.brand,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: t(16, w: FontWeight.w800, c: onTap == null ? const Color(0xFF57625A) : Colors.white),
                        ),
                      ),
                      if (onTap != null) ...[
                        const SizedBox(width: 8),
                        const DIcon(DIcons.chevR, size: 18, color: C.sun),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Thin dashed rule (card dividers).
class DashedLine extends StatelessWidget {
  final Color color;
  final double thickness;
  const DashedLine({super.key, this.color = C.chipLine, this.thickness = 1.5});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: thickness,
    width: double.infinity,
    child: CustomPaint(painter: _DashPainter(color, thickness)),
  );
}

class _DashPainter extends CustomPainter {
  final Color color;
  final double thickness;
  _DashPainter(this.color, this.thickness);
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = thickness;
    for (double x = 0; x < size.width; x += 8) {
      canvas.drawLine(Offset(x, thickness / 2), Offset((x + 4).clamp(0, size.width), thickness / 2), p);
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}
