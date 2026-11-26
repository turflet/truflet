import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/art.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/lobby_repository.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../../data/repositories/venue_repository.dart';
import '../../auth/auth_guard.dart';
import '../cubit/explore_cubit.dart';
import '../cubit/explore_state.dart';

/// 1 · Home / Discovery
class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => ExploreCubit(
      venues: c.read<VenueRepository>(),
      notifications: c.read<NotificationRepository>(),
      lobbies: c.read<LobbyRepository>(),
      app: c.read<AppCubit>(),
    )..load(),
    // refresh whenever the player switches back to this tab
    child: BlocListener<AppCubit, AppState>(
      listenWhen: (prev, cur) => cur.tab == AppTab.explore && prev.tab != AppTab.explore,
      listener: (context, _) => context.read<ExploreCubit>().reload(),
      child: const _ExploreView(),
    ),
  );
}

class _ExploreView extends StatelessWidget {
  const _ExploreView();

  Future<void> _toggleFav(BuildContext context, Json v) async {
    if (!await requireLogin(context)) return;
    if (!context.mounted) return;
    final error = await context.read<ExploreCubit>().toggleFavourite(v);
    if (error != null && context.mounted) toast(context, error);
  }

  void _filters(BuildContext context) {
    final cubit = context.read<ExploreCubit>();
    var f = cubit.state.filters;
    sheet(
      context,
      (ctx) => StatefulBuilder(
        builder: (ctx, set) {
          final sort = cubit.state.sort;
          final amenities = cubit.state.amenities;
          final lo = (f.priceMin ?? priceFloor).toDouble(), hi = (f.priceMax ?? priceCeiling).toDouble();
          void update(ExploreFilters next) => set(() => f = next);
          Widget chip(String label, bool on, VoidCallback onTap) => Choice(
            selected: on,
            height: 40,
            radius: 12,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            onTap: onTap,
            child: Text(label, style: t(13, w: FontWeight.w600, c: on ? Colors.white : C.ink)),
          );
          final today = DateTime.now();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('Sort & filter', style: d(22))),
                  if (f.count > 0)
                    GestureDetector(
                      onTap: () => update(const ExploreFilters()),
                      child: Text('Clear all', style: t(13, w: FontWeight.w700, c: C.brand)),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Text('Sort by', style: t(13, w: FontWeight.w600)),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final k in exploreSortOrder) ...[
                    Expanded(
                      child: Choice(
                        selected: sort == k,
                        onTap: () {
                          cubit.setSort(k);
                          set(() {});
                        },
                        child: Text(
                          exploreSortLabels[k]!,
                          style: t(13, w: FontWeight.w700, c: sort == k ? Colors.white : C.ink),
                        ),
                      ),
                    ),
                    if (k != 'rating') const SizedBox(width: 8),
                  ],
                ],
              ),
              const SizedBox(height: 18),
              Text('Free slot on', style: t(13, w: FontWeight.w600)),
              const SizedBox(height: 8),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (var i = 0; i < 7; i++) ...[
                      chip(
                        i == 0 ? 'Today' : i == 1 ? 'Tomorrow' : DateFormat('EEE d').format(today.add(Duration(days: i))),
                        f.dayOffset == i,
                        () => update(f.copyWith(dayOffset: f.dayOffset == i ? null : i)),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final (i, w) in timeWindows.indexed)
                    chip(
                      '${w.$1} · ${fmtHour(w.$2)}–${fmtHour(w.$3)}',
                      f.window == i,
                      () => update(f.copyWith(window: f.window == i ? null : i)),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: Text('Price per hour', style: t(13, w: FontWeight.w600))),
                  Text(
                    '${inr(lo)} – ${hi >= priceCeiling ? '${inr(priceCeiling)}+' : inr(hi)}',
                    style: t(13, w: FontWeight.w700, c: C.brand),
                  ),
                ],
              ),
              RangeSlider(
                values: RangeValues(lo, hi),
                min: priceFloor.toDouble(),
                max: priceCeiling.toDouble(),
                divisions: 30,
                activeColor: C.brand,
                inactiveColor: C.segment,
                onChanged: (v) => update(
                  f.copyWith(
                    priceMin: v.start <= priceFloor ? null : v.start.round(),
                    priceMax: v.end >= priceCeiling ? null : v.end.round(),
                  ),
                ),
              ),
              if (amenities.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text('Amenities', style: t(13, w: FontWeight.w600)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final a in amenities)
                      chip(
                        a['name'],
                        f.amenities.contains(a['icon']),
                        () => update(
                          f.copyWith(
                            amenities: f.amenities.contains(a['icon'])
                                ? ({...f.amenities}..remove(a['icon']))
                                : {...f.amenities, a['icon'] as String},
                          ),
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 22),
              PrimaryButton(
                'Show results',
                onTap: () {
                  Navigator.pop(ctx);
                  cubit.setFilters(f);
                  cubit.load();
                },
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<ExploreCubit, ExploreState>(builder: _build);

  static const _sortTabs = {'near': 'NEARBY', 'price': 'BUDGET', 'rating': 'TOP RATED'};
  static const _sortIcons = {
    'near': DIcons.pin,
    'price': DIcons.tag,
    'rating': DIcons.star,
  };

  Widget _build(BuildContext context, ExploreState st) {
    final cubit = context.read<ExploreCubit>();
    final app = context.watch<AppCubit>();
    final s = app.state;
    final venues = st.venues, error = st.error, sort = st.sort;
    final offer = asMap(s.config['offer']);
    final first = '${s.user?['name'] ?? ''}'.trim().split(' ').first;
    final night = st.filters.amenities.contains('floodlights');
    final live = st.cityLobbies.length;
    final sortKeys = exploreSortOrder.toList();
    final topRated = venues != null && venues.length >= 3
        ? ([
            ...venues,
          ]..sort((a, b) => ((b['rating'] ?? 0) as num).compareTo((a['rating'] ?? 0) as num))).take(6).toList()
        : <Json>[];

    Future<void> pickLocation() async {
      final changed = await context.pushLocation();
      if (changed == true) cubit.load();
    }

    void toggleNight() {
      final f = st.filters;
      cubit.setFilters(
        f.copyWith(amenities: night ? ({...f.amenities}..remove('floodlights')) : {...f.amenities, 'floodlights'}),
      );
      cubit.load();
    }

    return RefreshIndicator(
      color: C.brand,
      onRefresh: cubit.load,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Band(
            title: s.areaName.isNotEmpty ? s.areaName : (s.cityName.isNotEmpty ? s.cityName : 'Choose location'),
            subtitle: s.areaName.isNotEmpty && s.cityName.isNotEmpty ? s.cityName : 'Tap to pick your area',
            onTitle: pickLocation,
            actions: [if (app.loggedIn) const BookingsButton(), const ProfileButton()],
            children: [
              SectionTabs(active: AppTab.explore, badge: live > 0 ? '$live LIVE' : null),
              Panel(
                flat: true,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 56,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                          child: Row(
                            children: [
                              const DIcon(DIcons.search, size: 22, color: C.mutedInk),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  style: t(15),
                                  textInputAction: TextInputAction.search,
                                  onChanged: cubit.searchChanged,
                                  decoration: InputDecoration(
                                    border: InputBorder.none,
                                    isDense: true,
                                    hintText: 'Search turfs, courts, venues',
                                    hintStyle: t(15, c: C.muted),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Semantics(
                        button: true,
                        toggled: night,
                        label: 'Floodlit venues only',
                        child: GestureDetector(
                          onTap: toggleNight,
                          child: Container(
                            width: 66,
                            height: 56,
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'NIGHT',
                                  style: t(11, w: FontWeight.w800, c: C.mutedInk, ls: 0.6, h: 1),
                                ),
                                const SizedBox(height: 4),
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 160),
                                  width: 34,
                                  height: 18,
                                  padding: const EdgeInsets.all(2),
                                  alignment: night ? Alignment.centerRight : Alignment.centerLeft,
                                  decoration: BoxDecoration(
                                    color: night ? C.green700 : C.dotOff,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  UnderlineTabs(
                    labels: [for (final k in sortKeys) _sortTabs[k] ?? k.toUpperCase()],
                    icons: [for (final k in sortKeys) _sortIcons[k] ?? LucideIcons.listFilter],
                    index: sortKeys.indexOf(sort).clamp(0, sortKeys.length - 1),
                    onChange: (i) {
                      cubit.setSort(sortKeys[i]);
                      cubit.load();
                    },
                  ),
                  PanelHeadline(
                    first.isNotEmpty ? 'Game on, ' : 'Ready to ',
                    first.isNotEmpty ? '$first!' : 'play?',
                    size: 34,
                  ),
                  _promoGrid(context, offer['enabled'] == true ? offer : null, live),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (s.sports.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Rule(first.isNotEmpty ? '$first, what are we playing?' : 'What are we playing?'),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 16,
                crossAxisSpacing: 8,
                childAspectRatio: 0.78,
                children: [
                  for (final sp in s.sports)
                    _sportDisc(
                      context,
                      sp['name'],
                      Art.sportThumb(sp['name']) ?? sp['image'],
                      st.sportId == sp['id'],
                      () => cubit.selectSport(st.sportId == sp['id'] ? null : sp['id']),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 28),
          ],
          if (topRated.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('Top rated near you', style: d(19, ls: -0.4)),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 232,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: topRated.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) => _railCard(context, topRated[i]),
              ),
            ),
            const SizedBox(height: 28),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Rule(
              venues == null
                  ? 'All venues around you'
                  : '${venues.length} venue${venues.length == 1 ? '' : 's'} around you',
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _chipButton(
                  on: st.filters.count > 0,
                  onTap: () => _filters(context),
                  children: [
                    const DIcon(DIcons.sliders, size: 16, color: C.brand),
                    const SizedBox(width: 6),
                    Text(
                      'Filters${st.filters.count > 0 ? ' · ${st.filters.count}' : ''}',
                      style: t(13, w: FontWeight.w700),
                    ),
                  ],
                ),
                _chipButton(
                  onTap: cubit.cycleSort,
                  children: [
                    Text(exploreSortLabels[sort]!, style: t(13, w: FontWeight.w700)),
                    const DIcon(DIcons.chevD, size: 16),
                  ],
                ),
                if (st.filters.count > 0)
                  _chipButton(
                    onTap: cubit.clearFilters,
                    children: [Text('Clear filters', style: t(13, w: FontWeight.w700))],
                  ),
                if (st.radiusLabel.isNotEmpty)
                  _chipButton(
                    on: true,
                    children: [
                      const Icon(LucideIcons.radar, size: 15, color: C.brand),
                      const SizedBox(width: 6),
                      Text(
                        st.radiusLabel,
                        style: t(13, w: FontWeight.w700, c: C.brand),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (st.notice.isNotEmpty && venues != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: C.blueSoft, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  const Icon(LucideIcons.locateFixed, size: 16, color: C.blue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(st.notice, style: t(13, c: C.blueInk)),
                  ),
                ],
              ),
            ),
          if (error != null) ErrorRetry(error, onRetry: cubit.load),
          if (venues == null && error == null) const VenueCardsSkeleton(),
          if (venues != null && venues.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                'No arenas match. Try another sport, time or fewer filters.',
                textAlign: TextAlign.center,
                style: t(14, c: C.muted),
              ),
            ),
          for (final v in venues ?? <Json>[])
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              child: VenueCard(v: v, onFav: () => _toggleFav(context, v)),
            ),
          Padding(
            padding: EdgeInsets.fromLTRB(20, 28, 20, 40 + MediaQuery.of(context).padding.bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Play more,\nwait less.', style: d(40, c: const Color(0xFFD9DED8), h: 1, ls: -1.6)),
                const SizedBox(height: 8),
                Text(
                  'Made for weekend warriors${s.cityName.isNotEmpty ? ' in ${s.cityName}' : ''}',
                  style: t(12.5, w: FontWeight.w600, c: C.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chipButton({required List<Widget> children, VoidCallback? onTap, bool on = false}) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Material(
      color: on ? C.mint : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: on ? C.brand : C.chipLine),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(mainAxisSize: MainAxisSize.min, children: children),
        ),
      ),
    ),
  );

  /// Dark-green promo tiles in the panel: the admin offer (big), live lobbies and squad split.
  Widget _promoGrid(BuildContext context, Json? offer, int live) {
    Widget round(String asset) => Positioned(
      right: -8,
      bottom: -8,
      child: Container(
        width: 74,
        height: 74,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: C.brand, width: 3),
        ),
        child: ClipOval(child: Image.asset(asset, fit: BoxFit.cover)),
      ),
    );
    Widget tile(String title, String sub, String asset) => SizedBox(
      height: 138,
      child: PanelTile(
        radius: 22,
        padding: EdgeInsets.zero,
        onTap: () => context.read<AppCubit>().setTab(AppTab.matches),
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: d(16, c: C.sun, h: 1.1, ls: -0.3)),
                  ),
                  const SizedBox(height: 2),
                  SizedBox(
                    width: 90,
                    child: Text(
                      sub,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: t(12, w: FontWeight.w600, c: C.panelInk),
                    ),
                  ),
                ],
              ),
            ),
            round(asset),
          ],
        ),
      ),
    );
    final lobbies = tile(
      live > 0 ? '$live open lobbies' : 'Open lobbies',
      'Join solo, pay your share',
      Art.indoor,
    );
    final squad = tile('Split with squad', 'Pay only your share', Art.training);
    if (offer == null) {
      return Row(
        children: [
          Expanded(child: lobbies),
          const SizedBox(width: 10),
          Expanded(child: squad),
        ],
      );
    }
    return SizedBox(
      height: 286,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Container(
                color: C.green900,
                child: Stack(
                  children: [
                    Positioned(
                      left: 34,
                      right: -10,
                      bottom: -10,
                      height: 150,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.only(topLeft: Radius.circular(22)),
                        child: Img(offer['image'] ?? Art.floodlit),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if ('${offer['tag'] ?? ''}'.isNotEmpty)
                            Text(
                              '${offer['tag']}'.toUpperCase(),
                              style: t(11, w: FontWeight.w800, c: C.panelInk, ls: 1.2),
                            ),
                          Text('${offer['title'] ?? ''}', maxLines: 3, overflow: TextOverflow.ellipsis, style: d(22, c: C.sun, h: 1.05, ls: -0.6)),
                          const SizedBox(height: 4),
                          Text(
                            '${offer['subtitle'] ?? ''}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: t(13, w: FontWeight.w600, c: C.panelInk),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(children: [lobbies, const SizedBox(height: 10), squad])),
        ],
      ),
    );
  }

  /// Round sport photo with a forest ring when picked.
  Widget _sportDisc(BuildContext context, String label, String? img, bool on, VoidCallback onTap) => Semantics(
    selected: on,
    button: true,
    label: label,
    child: GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: on ? const [BoxShadow(color: C.brand, spreadRadius: 3)] : null,
            ),
            child: ClipOval(child: Img(img)),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t(12.5, w: on ? FontWeight.w800 : FontWeight.w700, c: on ? C.ink : C.mutedInk),
          ),
        ],
      ),
    ),
  );

  Widget _railCard(BuildContext context, Json v) {
    final km = v['distance_km'];
    final tag = '${v['highlight'] ?? ''}'.isNotEmpty
        ? '${v['highlight']}'
        : (v['is_fast_filling'] == true ? 'Fast filling' : '');
    return GestureDetector(
      onTap: () => context.pushVenue(v['id']),
      child: SizedBox(
        width: 152,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                width: 152,
                height: 152,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Img(v['image']),
                    if (tag.isNotEmpty)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(10, 22, 10, 8),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x000C2419), Color(0xE00C2419)],
                            ),
                          ),
                          child: Text(
                            tag,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: t(13, w: FontWeight.w800, c: Colors.white),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${v['name']}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: t(15, w: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                Container(
                  width: 17,
                  height: 17,
                  decoration: const BoxDecoration(color: C.green700, shape: BoxShape.circle),
                  child: const DIcon(DIcons.star, size: 11, color: Colors.white),
                ),
                const SizedBox(width: 4),
                Text(
                  '${v['rating']}${km != null ? ' · ${(km as num).toStringAsFixed(1)} km' : ''}',
                  style: t(13, w: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              asList(v['sports']).map((x) => x['name']).join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: t(12.5, c: C.muted),
            ),
          ],
        ),
      ),
    );
  }
}

/// Venue card (redesign): photo with open-lobby / fast-filling pill and heart, name + rating badge, sports, distance,
/// rating count and price.
class VenueCard extends StatelessWidget {
  final Json v;
  final VoidCallback onFav;
  const VenueCard({super.key, required this.v, required this.onFav});

  @override
  Widget build(BuildContext context) {
    final fav = context.select<AppCubit, bool>((c) => c.state.saved.contains(v['id']));
    final km = v['distance_km'];
    final lobbies = (v['open_lobbies'] ?? 0) as int;
    final sports = asList(v['sports']).map((x) => x['name']).join(' · ');
    final highlight = '${v['highlight'] ?? ''}';
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
          onTap: () => context.pushVenue(v['id']),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 190,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Img(v['image']),
                    if (highlight.isNotEmpty)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(16, 30, 16, 12),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x000C2419), Color(0xE00C2419)],
                            ),
                          ),
                          child: Text(
                            highlight,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: d(20, c: Colors.white, ls: -0.5),
                          ),
                        ),
                      ),
                    if (lobbies > 0 || v['is_fast_filling'] == true)
                      Positioned(
                        top: 12,
                        left: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: C.coral,
                                  shape: BoxShape.circle,
                                  boxShadow: [BoxShadow(color: Color(0x99F2552C), blurRadius: 5)],
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                lobbies > 0 ? '$lobbies open ${lobbies == 1 ? 'lobby' : 'lobbies'}' : 'Fast filling',
                                style: t(11.5, w: FontWeight.w800, h: 1.2),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Semantics(
                        button: true,
                        label: fav ? 'Remove ${v['name']} from saved' : 'Save ${v['name']}',
                        child: Material(
                          color: const Color(0xF2FFFFFF),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: onFav,
                            child: SizedBox(
                              width: 36,
                              height: 36,
                              child: DIcon(
                                fav ? DIcons.heartSolid : DIcons.heart,
                                size: 19,
                                color: fav ? C.coral : C.brand,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${v['name']}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: d(18, ls: -0.4),
                          ),
                        ),
                        const SizedBox(width: 10),
                        RatingBadge(v['rating']),
                      ],
                    ),
                    if (sports.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        sports,
                        style: t(13.5, w: FontWeight.w600, c: C.mutedInk),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const DIcon(DIcons.pin, size: 15, color: C.muted),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${km != null ? '${(km as num).toStringAsFixed(1)} km · ' : ''}${v['area']}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: t(13, c: C.muted),
                          ),
                        ),
                      ],
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(0, 10, 0, 8),
                      child: DashedLine(color: C.hair),
                    ),
                    Row(
                      children: [
                        const DIcon(DIcons.bolt, size: 16, color: C.coral),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${compact(v['review_count'])} ratings',
                            style: t(13, w: FontWeight.w700, c: C.green700),
                          ),
                        ),
                        Text.rich(
                          TextSpan(
                            text: 'from ${inr(v['price_from'])}',
                            children: [
                              TextSpan(
                                text: '/hr',
                                style: t(12, w: FontWeight.w600, c: C.muted),
                              ),
                            ],
                          ),
                          style: t(14, w: FontWeight.w800),
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
