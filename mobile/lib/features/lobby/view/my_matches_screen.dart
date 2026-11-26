import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/art.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/lobby_repository.dart';
import '../cubit/lobbies_cubit.dart';
import '../widgets/lobby_widgets.dart';
import 'lobbies_screen.dart';
import '../../../core/bloc/data_cubit.dart';
import '../../auth/view/sign_in_prompt.dart';

/// Matches section (redesign): Open lobbies in the city, and My matches (hosting / playing, requests, past).
class MyMatchesScreen extends StatelessWidget {
  const MyMatchesScreen({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      BlocProvider(
        create: (c) {
          final cubit = MyMatchesCubit(repository: c.read<LobbyRepository>());
          if (c.read<AppCubit>().loggedIn) cubit.load();
          return cubit;
        },
      ),
      BlocProvider(
        create: (c) =>
            OpenLobbiesCubit(repository: c.read<LobbyRepository>(), areaId: () => c.read<AppCubit>().state.areaId)
              ..load(),
      ),
    ],
    // refresh whenever the player switches to this section
    child: BlocListener<AppCubit, AppState>(
      listenWhen: (prev, cur) => cur.tab == AppTab.matches && prev.tab != AppTab.matches,
      listener: (context, _) {
        if (context.read<AppCubit>().loggedIn) context.read<MyMatchesCubit>().reload();
        context.read<OpenLobbiesCubit>().reload();
      },
      child: const _MyMatchesView(),
    ),
  );
}

class _MyMatchesView extends StatefulWidget {
  const _MyMatchesView();
  @override
  State<_MyMatchesView> createState() => _MyMatchesViewState();
}

class _MyMatchesViewState extends State<_MyMatchesView> {
  bool mine = false;
  int tab = 0;
  int sportIdx = 0;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppCubit>();
    final s = app.state;
    final my = context.watch<MyMatchesCubit>().state;
    final open = context.watch<OpenLobbiesCubit>().state;
    final lists = [asList(my.data?['upcoming']), asList(my.data?['requests']), asList(my.data?['past'])];
    final myCount = lists[0].length + lists[1].length;
    final live = open.data?.length ?? 0;
    final mineTabs = ['UPCOMING · ${lists[0].length}', 'REQUESTS · ${lists[1].length}', 'PAST'];
    final sportTabs = ['ALL', for (final sp in s.sports) '${sp['name']}'.toUpperCase()];

    Future<void> refresh() async {
      if (mine) {
        if (app.loggedIn) await context.read<MyMatchesCubit>().load();
      } else {
        await context.read<OpenLobbiesCubit>().load();
      }
    }

    return RefreshIndicator(
      color: C.brand,
      onRefresh: refresh,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Band(
            title: 'Matches',
            subtitle: s.cityName.isNotEmpty
                ? 'Near ${s.cityName} · $live ${live == 1 ? 'lobby' : 'lobbies'} live'
                : 'Lobbies near you',
            actions: [if (app.loggedIn) const BookingsButton(), const ProfileButton()],
            children: [
              SectionTabs(active: AppTab.matches, badge: live > 0 ? '$live LIVE' : null),
              Panel(
                flat: true,
                children: [
                  PanelSwitch(
                    labels: ['Open lobbies', 'My matches${myCount > 0 ? ' · $myCount' : ''}'],
                    index: mine ? 1 : 0,
                    onChange: (i) => setState(() => mine = i == 1),
                  ),
                  if (mine) ...[
                    const PanelHeadline('Your ', 'games'),
                    UnderlineTabs(labels: mineTabs, index: tab, onChange: (i) => setState(() => tab = i)),
                  ] else ...[
                    const PanelHeadline('Short a few ', 'players?'),
                    _squadCard(context),
                    if (s.sports.isNotEmpty)
                      UnderlineTabs(
                        labels: sportTabs,
                        index: sportIdx,
                        onChange: (i) {
                          setState(() => sportIdx = i);
                          context.read<OpenLobbiesCubit>().setSport(i == 0 ? null : s.sports[i - 1]['id'] as int?);
                        },
                      ),
                  ],
                ],
              ),
            ],
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 32 + MediaQuery.of(context).padding.bottom),
            child: mine ? _mine(context, app.loggedIn, my, lists) : _open(context, s, open),
          ),
        ],
      ),
    );
  }

  Widget _squadCard(BuildContext context) => SizedBox(
    height: 170,
    child: PanelTile(
      radius: 22,
      padding: EdgeInsets.zero,
      onTap: () {
        toast(context, 'Pick a venue and a slot, then choose “Create a group”');
        context.read<AppCubit>().setTab(AppTab.explore);
      },
      child: Stack(
        children: [
          Positioned(
            right: -10,
            bottom: -10,
            width: 180,
            height: 160,
            child: ClipRRect(
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(22)),
              child: Image.asset(Art.training, fit: BoxFit.cover),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SQUAD BUILDER',
                  maxLines: 1,
                  style: t(11, w: FontWeight.w800, c: C.panelInk, ls: 1.2),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  width: 150,
                  child: Text(
                    'Got friends? Fill the rest.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: d(22, c: C.sun, h: 1.1, ls: -0.6),
                  ),
                ),
                const Spacer(),
                Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'CREATE LOBBY',
                        style: t(12.5, w: FontWeight.w800, c: C.brand),
                      ),
                      const SizedBox(width: 6),
                      const DIcon(DIcons.chevR, size: 14, color: C.brand),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _open(BuildContext context, AppState s, DataState<List<Json>> open) {
    final cubit = context.read<OpenLobbiesCubit>();
    if (open.error != null && open.data == null) return ErrorRetry(open.error!, onRetry: cubit.retry);
    final items = open.data;
    if (items == null) return const BookingCardsSkeleton();
    if (items.isEmpty) {
      return s.areaId == null
          ? EmptyNote(
              icon: LucideIcons.mapPin,
              title: 'Pick your area first',
              body: 'Choose where you play to see groups looking for players nearby.',
              action: PrimaryButton(
                'Choose area',
                height: 48,
                onTap: () async {
                  final changed = await context.pushLocation();
                  if (changed == true) cubit.reload();
                },
              ),
            )
          : const EmptyNote(
              icon: LucideIcons.userPlus,
              title: 'No open lobbies right now',
              body: 'Check back soon, or book a slot and open it to solo players.',
            );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Rule('${items.length} ${items.length == 1 ? 'lobby needs' : 'lobbies need'} players'),
        const SizedBox(height: 18),
        for (final g in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: LobbyCard(
              lobby: g,
              onTap: () => openLobby(context, g, onChanged: cubit.load),
              onAction: () => openLobby(context, g, onChanged: cubit.load),
            ),
          ),
      ],
    );
  }

  Widget _mine(BuildContext context, bool loggedIn, DataState<Json> my, List<List<Json>> lists) {
    if (!loggedIn) return SignInPrompt(onDone: () => context.read<MyMatchesCubit>().reload());
    final cubit = context.read<MyMatchesCubit>();
    if (my.error != null && my.data == null) return ErrorRetry(my.error!, onRetry: cubit.retry);
    if (my.data == null) return const BookingCardsSkeleton();
    final items = lists[tab];
    if (items.isEmpty) return _empty(context);
    return Column(
      children: [
        for (final g in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: _MatchTile(
              lobby: g,
              onTap: () async {
                await openLobby(context, g, onChanged: cubit.load);
                cubit.load();
              },
            ),
          ),
      ],
    );
  }

  Widget _empty(BuildContext context) => switch (tab) {
    1 => const EmptyNote(
      icon: LucideIcons.messagesSquare,
      title: 'No invites or requests',
      body: 'Friends\' invites to their matches, and your requests to join open lobbies, show up here.',
    ),
    2 => const EmptyNote(icon: LucideIcons.history, title: 'No past matches', body: 'Matches you played show up here.'),
    _ => EmptyNote(
      icon: LucideIcons.usersRound,
      title: 'No matches yet',
      body: 'Pick a slot at any venue, then create a group or join a lobby solo.',
      action: PrimaryButton('Explore venues', height: 48, onTap: () => context.read<AppCubit>().setTab(AppTab.explore)),
    ),
  };
}

class _MatchTile extends StatelessWidget {
  final Json lobby;
  final VoidCallback onTap;
  const _MatchTile({required this.lobby, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final g = lobby;
    final role = g['my_role'];
    final (roleLabel, bg, fg) = switch (role) {
      'host' => ('Hosting', C.mint, C.green700),
      'member' => ('Playing', C.blueSoft, C.blue),
      'requested' => ('Requested', C.amberSoft, C.amber),
      'invited' => ('Invited you', C.coralSoft, C.orangeInk),
      _ => ('', C.chip, C.muted),
    };
    final alert = role == 'host' && (g['alert'] ?? '').toString().isNotEmpty;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: alert ? C.orange : C.hair, width: alert ? 1.5 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (roleLabel.isNotEmpty) ...[Pill(roleLabel, bg: bg, fg: fg), const SizedBox(width: 6)],
                  SlotStatePill(g),
                  const Spacer(),
                  Text(
                    g['own_squad'] == true ? 'Squad of ${g['capacity']}' : '${g['paid_count']}/${g['capacity']} paid',
                    style: t(12, w: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text('${g['date_label']} · ${g['time_label']}', style: d(17)),
              Text(
                '${g['sport']['name']} · ${g['venue']['name']} · ${g['court']['name']}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: t(13, c: C.muted),
              ),
              const SizedBox(height: 10),
              FillBar(taken: (g['taken'] ?? 0) as int, capacity: (g['capacity'] ?? 1) as int, height: 8),
              if (alert) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(LucideIcons.triangleAlert, size: 14, color: C.orange),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        g['alert'] == 'slot_taken'
                            ? 'Your slot was booked by another group — action needed'
                            : 'Kickoff soon and the pool is short — action needed',
                        style: t(12, w: FontWeight.w600, c: C.orangeInk),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
