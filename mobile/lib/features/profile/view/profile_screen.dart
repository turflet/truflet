import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/router/app_navigation.dart';
import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/network/json.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/art.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/repositories/user_repository.dart';
import '../../auth/view/profile_form.dart';
import '../cubit/profile_cubit.dart';

/// 19 · My profile
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (c) => ProfileCubit(users: c.read<UserRepository>(), app: c.read<AppCubit>()),
    // refresh the profile whenever the player switches to this tab
    child: BlocListener<AppCubit, AppState>(
      listenWhen: (prev, cur) => cur.tab == AppTab.profile && prev.tab != AppTab.profile,
      listener: (context, _) => context.read<ProfileCubit>().refresh(),
      child: const _ProfileView(),
    ),
  );
}

class _ProfileView extends StatefulWidget {
  const _ProfileView();
  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

const _levels = [
  ('Beginner', 0.3, C.teal, C.tealSoft),
  ('Intermediate', 0.6, C.amber, C.amberSoft),
  ('Advanced', 0.9, C.green700, C.mint),
];

/// "Editing" (level buttons visible) is view-only state.
class _ProfileViewState extends State<_ProfileView> {
  bool editing = false;

  Future<void> _setSports(List<Json> sports) async {
    final error = await context.read<ProfileCubit>().setSports(sports);
    if (error != null && mounted) toast(context, error);
  }

  Future<void> _editDetails() async {
    await sheet(
      context,
      (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Edit details', style: d(22)),
          const SizedBox(height: 16),
          ProfileForm(
            submitLabel: 'Save details',
            showHandle: true,
            onSaved: () {
              Navigator.pop(ctx);
              toast(context, 'Profile updated');
            },
          ),
        ],
      ),
    );
  }

  Future<void> _addSport(Json u) async {
    final s = context.read<AppCubit>().state;
    final have = asList(u['sports']).map((x) => x['sport_id']).toSet();
    final options = s.sports.where((x) => !have.contains(x['id'])).toList();
    if (options.isEmpty) return;
    final picked = await sheet<Json>(
      context,
      (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Add a sport', style: d(22)),
          const SizedBox(height: 14),
          for (final o in options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Img(o['image'], width: 40, height: 40, radius: BorderRadius.circular(12)),
              title: Text(o['name'], style: t(15, w: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, o),
            ),
        ],
      ),
    );
    if (picked == null) return;
    await _setSports([
      ...asList(u['sports']),
      {'sport_id': picked['id'], 'level': 0},
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppCubit>();
    final s = app.state;
    final u = s.user;
    if (u == null || context.watch<ProfileCubit>().state) return const ProfileSkeleton();
    final stats = asMap(u['stats']);
    final sports = asList(u['sports']);
    final name = '${u['name'] ?? ''}'.trim();
    final parts = name.split(' ');
    final first = parts.first, last = parts.skip(1).join(' ');
    final reward = s.config['referral_reward'] ?? 50;
    final badge = sports.isEmpty ? null : Art.sportThumb(sports.first['name']) ?? sports.first['image'] as String?;
    final box = BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: C.hair),
    );

    return RefreshIndicator(
      color: C.brand,
      onRefresh: () => context.read<ProfileCubit>().refresh(),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Band(
            title: 'Profile',
            onBack: () => app.setTab(AppTab.explore),
            actions: [
              Material(
                color: const Color(0x14FFFFFF),
                shape: const StadiumBorder(side: BorderSide(color: Color(0x24FFFFFF))),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => setState(() => editing = !editing),
                  child: Container(
                    height: 40,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    alignment: Alignment.center,
                    child: Text(
                      editing ? 'Done' : 'Edit',
                      style: t(13, w: FontWeight.w800, c: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
            children: [
              Panel(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 20),
                children: [
                  GestureDetector(
                    onTap: _editDetails,
                    child: Column(
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 88,
                              height: 88,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: RadialGradient(
                                  center: Alignment(-0.3, -0.4),
                                  colors: [Color(0xFFFF8A65), C.coral, Color(0xFFC23E1C)],
                                  stops: [0, 0.6, 1],
                                ),
                                boxShadow: [BoxShadow(color: Color(0x59000000), blurRadius: 22, offset: Offset(0, 10))],
                              ),
                              child: Text('${u['initials'] ?? 'ME'}', style: d(30, c: Colors.white, h: 1)),
                            ),
                            Positioned(
                              right: -4,
                              bottom: -2,
                              child: Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: C.brand, width: 3),
                                ),
                                child: ClipOval(
                                  child: badge != null
                                      ? Img(badge)
                                      : const Icon(LucideIcons.pencil, size: 14, color: C.brand),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        name.isEmpty
                            ? Text('Add your name', style: d(26, c: Colors.white, ls: -0.8))
                            : Text.rich(
                                TextSpan(
                                  text: last.isEmpty ? first : '$first ',
                                  children: [
                                    if (last.isNotEmpty)
                                      TextSpan(
                                        text: last,
                                        style: d(26, c: C.sun, ls: -0.8).copyWith(fontStyle: FontStyle.italic),
                                      ),
                                  ],
                                ),
                                textAlign: TextAlign.center,
                                style: d(26, c: Colors.white, ls: -0.8),
                              ),
                        const SizedBox(height: 2),
                        Text(
                          '${u['email'] ?? ''}${'${u['phone'] ?? ''}'.isNotEmpty ? ' · ${u['phone']}' : ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: t(13, w: FontWeight.w600, c: C.panelInk),
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      _stat('${stats['games'] ?? 0}', 'Games played'),
                      const SizedBox(width: 10),
                      _stat('${stats['hours'] ?? 0}h', 'On the turf'),
                      const SizedBox(width: 10),
                      _stat('${s.saved.length}', 'Saved venues'),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                    child: Row(
                      children: [
                        const Disc(icon: DIcons.wallet, size: 46),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Turflet wallet',
                                style: t(12, w: FontWeight.w700, c: C.muted),
                              ),
                              Text(inr(u['wallet_balance']), style: d(22, ls: -0.6)),
                            ],
                          ),
                        ),
                        GhostButton(
                          'History',
                          height: 40,
                          radius: 12,
                          fontSize: 13,
                          bg: C.brand,
                          fg: Colors.white,
                          border: Colors.transparent,
                          onTap: () => app.setTab(AppTab.bookings),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 28 + MediaQuery.of(context).padding.bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Rule('Your sports', extra: editing ? 'tap to change level' : null),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.66,
                  children: [
                    for (var i = 0; i < sports.length; i++) _sportDisc(sports, i),
                    if (sports.length < s.sports.length)
                      GestureDetector(
                        onTap: () => _addSport(u),
                        child: Column(
                          children: [
                            const Disc(icon: LucideIcons.plus, size: 64),
                            const SizedBox(height: 6),
                            Text(
                              'Add',
                              style: t(12.5, w: FontWeight.w700, c: C.mutedInk),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 22),
                const Rule('Your details'),
                const SizedBox(height: 12),
                Container(
                  decoration: box,
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _detail(LucideIcons.user, 'Name', u['name'], 'Add your name'),
                      _detail(DIcons.phone, 'Mobile', u['phone'], 'Add mobile number'),
                      _detail(DIcons.pin, 'Address', u['address'], 'Add address (optional)', last: true),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const Rule('Your stuff'),
                const SizedBox(height: 12),
                Container(
                  decoration: box,
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _menu(
                        DIcons.ticket,
                        'My bookings',
                        'Upcoming, played and refunds',
                        () => app.setTab(AppTab.bookings),
                      ),
                      _menu(
                        DIcons.heart,
                        'Saved venues',
                        '${s.saved.length} favourite${s.saved.length == 1 ? '' : 's'}',
                        () => context.pushSaved(),
                      ),
                      _menu(
                        DIcons.card,
                        'Payments & refunds',
                        'Wallet ${inr(u['wallet_balance'])}',
                        () => app.setTab(AppTab.bookings),
                      ),
                      _menu(
                        DIcons.bell,
                        'Notifications',
                        'Lobby invites, reminders, offers',
                        () => context.pushNotifications(),
                      ),
                      _menu(
                        LucideIcons.bellRing,
                        'Booking & slot alerts',
                        u['notifications_on'] == true ? 'On' : 'Off',
                        () => app.updateMe({'notifications_on': !(u['notifications_on'] == true)}),
                        trailing: Toggle(u['notifications_on'] == true),
                      ),
                      _menu(
                        LucideIcons.userPlus,
                        'Invite friends',
                        'Code ${u['referral_code']} · ₹$reward each',
                        () => SharePlus.instance.share(
                          ShareParams(
                            text: 'Join me on Turflet! Use my code ${u['referral_code']} and we both get ₹$reward off.',
                          ),
                        ),
                        last: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const Rule('Support'),
                const SizedBox(height: 12),
                Container(
                  decoration: box,
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _menu(
                        DIcons.help,
                        'Help & support',
                        'FAQs, chat with us, call',
                        () => context.pushHelp(),
                      ),
                      _menu(
                        DIcons.policy,
                        'Policies',
                        'Terms, privacy, refunds',
                        () => context.pushPolicy(),
                        last: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                Material(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: C.hair),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () async {
                      await app.logout();
                      app.setTab(AppTab.explore);
                    },
                    child: SizedBox(
                      height: 50,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const DIcon(DIcons.logout, size: 20, color: C.redInk),
                          const SizedBox(width: 8),
                          Text(
                            'Log out',
                            style: t(14.5, w: FontWeight.w800, c: C.redInk),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Turflet v${s.config['app_version'] ?? '1.1'}',
                  textAlign: TextAlign.center,
                  style: t(12, c: C.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detail(Object icon, String label, dynamic value, String placeholder, {bool last = false}) {
    final empty = (value ?? '').toString().trim().isEmpty;
    return InkWell(
      onTap: _editDetails,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: last
            ? null
            : const BoxDecoration(
                border: Border(bottom: BorderSide(color: C.hair)),
              ),
        child: Row(
          children: [
            Disc(icon: icon, size: 42, iconSize: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: t(12, w: FontWeight.w600, c: C.muted),
                  ),
                  Text(
                    empty ? placeholder : value.toString(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: t(14.5, w: FontWeight.w800, c: empty ? C.brand : C.ink),
                  ),
                ],
              ),
            ),
            const DIcon(DIcons.chevR, size: 18, color: C.radioOff),
          ],
        ),
      ),
    );
  }

  Widget _stat(String v, String l) => Expanded(
    child: PanelTile(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
      child: Column(
        children: [
          Text(v, style: d(21, c: C.sun, ls: -0.5)),
          const SizedBox(height: 2),
          Text(
            l,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t(11.5, w: FontWeight.w700, c: C.panelInk),
          ),
        ],
      ),
    ),
  );

  Widget _sportDisc(List<Json> sports, int i) {
    final sp = sports[i];
    final lv = _levels[(sp['level'] as int).clamp(0, 2)];
    return GestureDetector(
      onTap: editing
          ? () {
              final next = [...sports.map((x) => Map<String, dynamic>.from(x))];
              next[i]['level'] = ((sp['level'] as int) + 1) % 3;
              _setSports(next);
            }
          : null,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: i == 0 ? const [BoxShadow(color: C.brand, spreadRadius: 3)] : null,
            ),
            child: ClipOval(child: Img(Art.sportThumb(sp['name']) ?? sp['image'])),
          ),
          const SizedBox(height: 6),
          Text(
            '${sp['name']}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t(12.5, w: FontWeight.w700, c: C.mutedInk),
          ),
          Text(
            lv.$1.toUpperCase(),
            maxLines: 1,
            style: t(10, w: FontWeight.w800, c: lv.$3, ls: 0.3),
          ),
        ],
      ),
    );
  }

  Widget _menu(Object icon, String label, String sub, VoidCallback onTap, {bool last = false, Widget? trailing}) =>
      InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: last
              ? null
              : const BoxDecoration(
                  border: Border(bottom: BorderSide(color: C.hair)),
                ),
          child: Row(
            children: [
              Disc(icon: icon, size: 42, iconSize: 21),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: t(14.5, w: FontWeight.w800)),
                    Text(
                      sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: t(12, w: FontWeight.w600, c: C.muted),
                    ),
                  ],
                ),
              ),
              trailing ?? const DIcon(DIcons.chevR, size: 18, color: C.radioOff),
            ],
          ),
        ),
      );
}
