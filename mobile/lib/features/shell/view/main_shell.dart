import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/session/app_cubit.dart';
import '../../../app/session/app_state.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/view/sign_in_prompt.dart';
import '../../booking/view/my_bookings_screen.dart';
import '../../explore/view/explore_screen.dart';
import '../../lobby/view/my_matches_screen.dart';
import '../../profile/view/profile_screen.dart';

/// Main sections (indexes in [AppTab]). No bottom nav: Turfs and Matches switch from the circular tabs in each
/// screen's dark header; Bookings and Profile open from the header's ticket and avatar buttons, and Back returns
/// to Turfs.
class MainShell extends StatelessWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppCubit>();
    final s = app.state;
    // Keyed by player id so each section starts fresh after signing in as someone else.
    final pages = [
      const ExploreScreen(),
      MyMatchesScreen(key: ValueKey('mt${s.user?['id']}')),
      _Gate(
        key: const ValueKey('b'),
        title: 'My bookings',
        child: MyBookingsScreen(key: ValueKey('bk${s.user?['id']}')),
      ),
      _Gate(
        key: const ValueKey('pr'),
        title: 'Profile',
        child: ProfileScreen(key: ValueKey('pf${s.user?['id']}')),
      ),
    ];
    return PopScope(
      canPop: s.tab == AppTab.explore,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) app.setTab(AppTab.explore);
      },
      child: LightStatusBar(
        child: Scaffold(
          body: IndexedStack(index: s.tab, children: pages),
        ),
      ),
    );
  }
}

/// Sections that need an account show a sign-in prompt (under the dark band) until the player verifies their email.
class _Gate extends StatelessWidget {
  final Widget child;
  final String title;
  const _Gate({super.key, required this.child, required this.title});
  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppCubit>();
    if (app.loggedIn) return child;
    return Column(
      children: [
        Band(title: title, onBack: () => app.setTab(AppTab.explore)),
        Expanded(child: SignInPrompt(onDone: () {})),
      ],
    );
  }
}
