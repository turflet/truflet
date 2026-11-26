import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/session/app_cubit.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/art.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/venue_repository.dart';
import '../../auth/auth_guard.dart';
import '../../../app/router/app_navigation.dart';
import '../../../app/router/app_routes.dart';
import '../cubit/venue_details_cubit.dart';

const amenityIcons = {
  'parking': DIcons.parking,
  'floodlights': DIcons.floodlights,
  'covered': LucideIcons.umbrella,
  'washroom': LucideIcons.bath,
  'water': LucideIcons.droplet,
  'changing': DIcons.changing,
  'equipment': LucideIcons.dumbbell,
  'wifi': LucideIcons.wifi,
  'cafe': DIcons.cafe,
  'first_aid': LucideIcons.cross,
  'seating': LucideIcons.armchair,
};

/// 2 · Venue profile: photos, dimensions, surface, rules, amenities and cancellation policy → slot matrix
class VenueDetailsScreen extends StatelessWidget {
  final int venueId;
  const VenueDetailsScreen({super.key, required this.venueId});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => VenueDetailsCubit(venueId: venueId, repository: c.read<VenueRepository>(), app: c.read<AppCubit>())..load(),
    child: const _VenueDetailsView(),
  );
}

class _VenueDetailsView extends StatefulWidget {
  const _VenueDetailsView();
  @override
  State<_VenueDetailsView> createState() => _VenueDetailsViewState();
}

/// Photo and sport selection are view-only state.
class _VenueDetailsViewState extends State<_VenueDetailsView> {
  int photo = 0;
  int sportIdx = 0;

  Future<void> _fav(Json v) async {
    if (!await requireLogin(context)) return;
    if (!mounted) return;
    final error = await context.read<VenueDetailsCubit>().toggleFavourite(v);
    if (error != null && mounted) toast(context, error);
  }

  @override
  Widget build(BuildContext context) {
    return LightStatusBar(
      child: Scaffold(
        body: DataBuilder<VenueDetailsCubit, Json>(
          skeleton: const VenueDetailsSkeleton(),
          builder: (context, v) => _body(v),
        ),
      ),
    );
  }

  Widget _body(Json v) {
    final s = context.watch<AppCubit>().state;
    final photos = (v['photos'] as List).cast<String?>();
    final sports = asList(v['venue_sports']);
    final cur = sports.isEmpty ? null : sports[sportIdx.clamp(0, sports.length - 1)];
    final fav = s.saved.contains(v['id']);
    final top = MediaQuery.of(context).padding.top;
    final hero = photos.isEmpty ? v['image'] : photos[photo.clamp(0, photos.length - 1)];
    final lobbies = (v['open_lobbies'] ?? 0) as int;
    final amenities = asList(v['amenities']);
    final rules = asList(v['rules']);
    final policy = asList(v['cancellation_policy']);
    final km = v['distance_km'];

    Future<void> openSlots(Json sp) async {
      final cubit = context.read<VenueDetailsCubit>();
      await context.pushSlotBooking(SlotBookingArgs(venue: v, initialSportId: sp['sport_id']));
      if (!cubit.isClosed) cubit.load();
    }

    Future<void> openLobbies() async {
      final cubit = context.read<VenueDetailsCubit>();
      await context.pushLobbies(LobbiesArgs(venue: v, subtitle: '${v['name']} · ${v['area']}'));
      if (!cubit.isClosed) cubit.load();
    }

    Widget round(Object icon, String label, VoidCallback onTap, {Color color = C.ink, bool filled = false}) =>
        Semantics(
          button: true,
          label: label,
          child: Material(
            color: const Color(0xF2FFFFFF),
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: SizedBox(width: 44, height: 44, child: Center(child: glyph(icon, size: 20, color: color))),
            ),
          ),
        );

    Widget section(String title, Widget child) => Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [Rule(title), const SizedBox(height: 12), child],
      ),
    );

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: 300 + top,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(color: C.brandDark),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 250),
                      child: Img(hero, key: ValueKey(hero)),
                    ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: [0, 0.34, 0.6, 1],
                          colors: [Color(0x8C0B2A1D), Color(0x000B2A1D), Color(0x000B2A1D), Color(0xE60B2A1D)],
                        ),
                      ),
                    ),
                    Positioned(
                      top: top + 18,
                      left: 16,
                      right: 16,
                      child: Row(
                        children: [
                          round(DIcons.back, 'Back', () => Navigator.of(context).maybePop()),
                          const Spacer(),
                          round(
                            DIcons.share,
                            'Share venue',
                            () => SharePlus.instance.share(
                              ShareParams(text: '${v['name']} on Turflet — ${v['address']}'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Semantics(
                            button: true,
                            label: fav ? 'Remove from saved' : 'Save venue',
                            child: Material(
                              color: const Color(0xF2FFFFFF),
                              shape: const CircleBorder(),
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                onTap: () => _fav(v),
                                child: SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: DIcon(
                                    fav ? DIcons.heartSolid : DIcons.heart,
                                    size: 20,
                                    color: fav ? C.coral : C.ink,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 50,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (lobbies > 0 || v['is_fast_filling'] == true)
                            GestureDetector(
                              onTap: lobbies > 0 ? openLobbies : null,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 7,
                                      height: 7,
                                      decoration: const BoxDecoration(color: C.coral, shape: BoxShape.circle),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      lobbies > 0
                                          ? '$lobbies open ${lobbies == 1 ? 'lobby' : 'lobbies'}'
                                          : 'Fast filling',
                                      style: t(11.5, w: FontWeight.w800, h: 1.2),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          const Spacer(),
                          if (photos.length > 1)
                            GestureDetector(
                              onTap: () => setState(() => photo = (photo + 1) % photos.length),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xBF0C2419),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  '${photo + 1} / ${photos.length} photos',
                                  style: t(12, w: FontWeight.w700, c: Colors.white, h: 1.2),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -28),
                child: Panel(
                  padding: const EdgeInsets.fromLTRB(18, 22, 18, 20),
                  gap: 14,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${v['name']}', style: d(28, c: Colors.white, ls: -0.9, h: 1.1)),
                              const SizedBox(height: 4),
                              Text(
                                sports.map((x) => x['name']).join(' · '),
                                style: t(13.5, w: FontWeight.w600, c: C.panelInk),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            color: Colors.white,
                            child: Column(
                              children: [
                                Container(
                                  color: C.green700,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        '${v['rating']}',
                                        style: t(14, w: FontWeight.w800, c: Colors.white, h: 1.2),
                                      ),
                                      const SizedBox(width: 3),
                                      const DIcon(DIcons.star, size: 13, color: Colors.white),
                                    ],
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  child: Text(
                                    '${compact(v['review_count'])} ratings',
                                    style: t(10.5, w: FontWeight.w700, c: C.mutedInk, h: 1.2),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.only(top: 12),
                      decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: Color(0x24FFFFFF))),
                      ),
                      child: Column(
                        children: [
                          GestureDetector(
                            onTap: () => openMaps(v['lat'], v['lng'], '${v['name']} ${v['address']}'),
                            child: Row(
                              children: [
                                const DIcon(DIcons.pin, size: 18, color: C.sun),
                                const SizedBox(width: 8),
                                if (km != null) ...[
                                  Text(
                                    '$km km',
                                    style: t(13.5, w: FontWeight.w800, c: Colors.white),
                                  ),
                                  const SizedBox(width: 4),
                                ],
                                Expanded(
                                  child: Text(
                                    '${km != null ? '· ' : ''}${'${v['address'] ?? ''}'.isNotEmpty ? v['address'] : v['area']}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: t(13.5, c: C.panelInk),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const DIcon(DIcons.clock, size: 18, color: C.sun),
                              const SizedBox(width: 8),
                              Text(
                                'Open',
                                style: t(13.5, w: FontWeight.w800, c: Colors.white),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text('· ${v['hours_label'] ?? ''}', style: t(13.5, c: C.panelInk)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        for (final (i, f) in [
                          ('${v['surface'] ?? ''}', 'SURFACE'),
                          '${v['size'] ?? ''}'.isNotEmpty
                              ? ('${v['size']}', 'SIZE')
                              : ('${v['court_count']} courts', 'COURTS'),
                        ].where((f) => f.$1.isNotEmpty).indexed) ...[
                          if (i > 0) const SizedBox(width: 10),
                          Expanded(
                            child: PanelTile(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    f.$1,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: d(16, c: C.sun, ls: -0.3),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    f.$2,
                                    style: t(11.5, w: FontWeight.w700, c: C.panelInk, ls: 0.3),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (amenities.isNotEmpty)
                      section(
                        'Amenities',
                        GridView.count(
                          crossAxisCount: 4,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 14,
                          crossAxisSpacing: 10,
                          childAspectRatio: 0.78,
                          children: [
                            for (final a in amenities)
                              Column(
                                children: [
                                  Disc(icon: amenityIcons[a['icon']] ?? DIcons.check, size: 60, iconSize: 26),
                                  const SizedBox(height: 8),
                                  Text(
                                    '${a['name']}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    textAlign: TextAlign.center,
                                    style: t(12, w: FontWeight.w700, c: C.mutedInk),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    if (sports.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 26),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Rule('Pick a sport'),
                            for (var i = 0; i < sports.length; i++)
                              _sportRow(sports[i], i == sportIdx, () {
                                setState(() => sportIdx = i);
                                openSlots(sports[i]);
                              }),
                          ],
                        ),
                      ),
                    if ('${v['about'] ?? ''}'.isNotEmpty)
                      section('About', Text('${v['about']}', style: t(14, c: C.muted, h: 1.6))),
                    if (rules.isNotEmpty)
                      section(
                        'Venue rules',
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final r in rules)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('•  ', style: t(14, c: C.mutedInk, h: 1.6)),
                                    Expanded(
                                      child: Text('$r', style: t(14, c: C.mutedInk, h: 1.6)),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    if (policy.isNotEmpty)
                      section(
                        'Cancellation',
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: C.hair),
                          ),
                          child: Column(
                            children: [
                              for (final (i, r) in policy.indexed)
                                Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: i < policy.length - 1
                                      ? const BoxDecoration(
                                          border: Border(bottom: BorderSide(color: C.hair)),
                                        )
                                      : null,
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 48,
                                        padding: const EdgeInsets.symmetric(vertical: 6),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: ((r['percent'] ?? 0) as num) > 0 ? C.mint : C.redSoft,
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Text(
                                          '${r['percent']}%',
                                          style: t(
                                            13,
                                            w: FontWeight.w800,
                                            c: ((r['percent'] ?? 0) as num) > 0 ? C.brand : C.redInk,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text('${r['title'] ?? ''}', style: t(14, w: FontWeight.w700)),
                                            Text('${r['subtitle'] ?? ''}', style: t(12, c: C.muted)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        StickyBar(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cur == null ? 'Starts at' : '${cur['name']} from',
                  style: t(12, w: FontWeight.w600, c: C.muted),
                ),
                Text.rich(
                  TextSpan(
                    text: inr(cur?['price'] ?? v['price_from']),
                    children: [
                      TextSpan(
                        text: '/hr',
                        style: t(13, w: FontWeight.w600, c: C.muted),
                      ),
                    ],
                  ),
                  style: d(19, ls: -0.4),
                ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(child: GoButton('See free slots', onTap: cur == null ? null : () => openSlots(cur))),
          ],
        ),
      ],
    );
  }

  /// One sport at the venue: name, price + peak surcharge, notes, photo with a SELECT button.
  Widget _sportRow(Json sp, bool on, VoidCallback onSelect) => Container(
    padding: const EdgeInsets.symmetric(vertical: 18),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: C.hair)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (on)
                Container(
                  margin: const EdgeInsets.only(bottom: 5),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: C.mint, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    'SELECTED',
                    style: t(11, w: FontWeight.w800, c: C.brand, h: 1.2),
                  ),
                ),
              Text('${sp['name']}', style: d(17, ls: -0.3)),
              const SizedBox(height: 5),
              Text.rich(
                TextSpan(
                  text: '${inr(sp['price'])}/hr ',
                  children: [
                    if (((sp['peak_surcharge'] ?? 0) as num) > 0)
                      TextSpan(
                        text: '+${inr(sp['peak_surcharge'])} peak',
                        style: t(12.5, w: FontWeight.w600, c: C.muted),
                      ),
                  ],
                ),
                style: t(15, w: FontWeight.w800),
              ),
              if ('${sp['meta'] ?? ''}'.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text('${sp['meta']}', style: t(13, c: C.muted, h: 1.45)),
              ],
              if (sp['max_players'] != null) ...[
                const SizedBox(height: 5),
                Text(
                  'Up to ${sp['max_players']} players',
                  style: t(12.5, w: FontWeight.w600, c: C.mutedInk),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 14),
        SizedBox(
          width: 128,
          height: 140,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Img(Art.sportScene(sp['name']), width: 128, height: 122, radius: BorderRadius.circular(18)),
              Positioned(
                left: 12,
                right: 12,
                bottom: 0,
                child: Material(
                  color: Colors.white,
                  elevation: 3,
                  shadowColor: const Color(0x330C2419),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: C.hair),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: onSelect,
                    child: SizedBox(
                      height: 38,
                      child: Center(
                        child: Text(
                          'SELECT',
                          style: t(14, w: FontWeight.w800, c: C.brand, ls: 0.5),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
