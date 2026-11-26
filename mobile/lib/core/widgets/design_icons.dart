import 'package:flutter/widgets.dart';
import 'package:path_parsing/path_parsing.dart';

import '../theme/theme.dart';

/// One icon from the redesign's own set: a 24×24 SVG path, drawn as a line icon unless [solid].
/// [accent] is an extra shape filled coral (the logo's ball). Mirrors web/src/ui/icons.jsx.
class DI {
  final String d;
  final String? accent;
  final bool solid;
  final double stroke;
  const DI(this.d, {this.accent, this.solid = false, this.stroke = 1.8});
}

/// The design canvas's icons, by meaning.
abstract final class DIcons {
  static const back = DI('M15 5l-7 7 7 7', stroke: 2.2);
  static const chevR = DI('M10 7l5 5-5 5', stroke: 2.6);
  static const chevD = DI('M7 10l5 5 5-5', stroke: 2.4);
  static const pin = DI('M12 21c-4-4.2-7-7.9-7-11.2A7 7 0 0 1 19 9.8c0 3.3-3 7-7 11.2zM12 7.3a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z');
  static const search = DI('M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM20 20l-4.6-4.6', stroke: 2);
  static const star = DI('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z', solid: true);
  static const starLine = DI('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z');
  static const sliders = DI(
    'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4zM9 14.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z',
    stroke: 2,
  );
  static const heart = DI('M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z');
  static const heartSolid = DI('M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z', solid: true);
  static const bolt = DI('M13.5 2.5L5.5 13.5H11l-1 8 8-11h-5.5z', solid: true);
  static const ticket = DI(
    'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4zM14.5 6v2M14.5 11v2M14.5 16v2',
    accent: 'M8 10.5h3v3H8z',
  );
  static const clock = DI('M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17zM12 7.5V12l3 2');
  static const share = DI(
    'M8.5 10.7l7-4.2M8.5 13.3l7 4.2M6 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM18 3.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM18 15.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
  );
  static const floodlights = DI('M7 21V11M17 21V11M4.5 4h5v6h-5zM14.5 4h5v6h-5z', stroke: 1.7);
  static const parking = DI(
    'M6.5 3.5h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3',
    stroke: 1.7,
  );
  static const changing = DI('M8 4.5l4 2 4-2 3.5 3-2 3-1.5-1V19.5h-8V9.5l-1.5 1-2-3z', stroke: 1.7);
  static const cafe = DI('M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v3M11.5 3.5v3', stroke: 1.7);
  static const wallet = DI(
    'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v10A2.5 2.5 0 0 0 6.5 20H20V8H6.5A2.5 2.5 0 0 1 4 7.5zM16 12.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4z',
  );
  static const card = DI('M4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6zM3 10h18M6 14.5h4');
  static const calendar = DI('M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4');
  static const calendarAdd = DI(
    'M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4M12 12.5v5M9.5 15h5',
  );
  static const directions = DI('M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM9.5 14.5v-3h4M12 9l2.5 2.5L12 14');
  static const phone = DI('M5 4.5h3.5l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16 16 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5z');
  static const check = DI('M5 12.5l4.5 4.5L19 7.5', stroke: 2.4);
  static const shield = DI('M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2 2 4-4');
  static const bell = DI('M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0');
  static const help = DI('M4.5 5.5h15a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H10l-4.5 3.5V17h-1a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z');
  static const policy = DI('M7 3.5h7l4.5 4.5v12.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4.5M9 13h6M9 16.5h4');
  static const logout = DI('M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5', stroke: 2);
  static const tag = DI('M4 12.5V5h7.5l8.5 8.5-7.5 7.5zM8 8.5a.5.5 0 1 1 0 .1');
}

/// Draws a [DI] at [size] in [color].
class DIcon extends StatelessWidget {
  final DI icon;
  final double size;
  final Color color;
  final double? stroke;
  const DIcon(this.icon, {super.key, this.size = 24, this.color = C.ink, this.stroke});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: CustomPaint(painter: _DIPainter(icon, color, stroke ?? icon.stroke)),
  );
}

/// An [IconData] (Lucide / Material) or a design [DI], as a widget.
Widget glyph(Object icon, {double size = 24, Color color = C.ink}) =>
    icon is DI ? DIcon(icon, size: size, color: color) : Icon(icon as IconData, size: size, color: color);

final _cache = <String, Path>{};

Path _parse(String d) => _cache.putIfAbsent(d, () {
  final b = _PathBuilder();
  writeSvgPathDataToPath(d, b);
  return b.path;
});

class _PathBuilder extends PathProxy {
  final path = Path();
  @override
  void moveTo(double x, double y) => path.moveTo(x, y);
  @override
  void lineTo(double x, double y) => path.lineTo(x, y);
  @override
  void cubicTo(double x1, double y1, double x2, double y2, double x3, double y3) => path.cubicTo(x1, y1, x2, y2, x3, y3);
  @override
  void close() => path.close();
}

class _DIPainter extends CustomPainter {
  final DI icon;
  final Color color;
  final double stroke;
  _DIPainter(this.icon, this.color, this.stroke);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);
    final p = Paint()
      ..color = color
      ..isAntiAlias = true;
    if (icon.solid) {
      canvas.drawPath(_parse(icon.d), p..style = PaintingStyle.fill);
    } else {
      canvas.drawPath(
        _parse(icon.d),
        p
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }
    if (icon.accent != null) canvas.drawPath(_parse(icon.accent!), Paint()..color = C.coral);
  }

  @override
  bool shouldRepaint(_DIPainter old) => old.icon != icon || old.color != color || old.stroke != stroke;
}
