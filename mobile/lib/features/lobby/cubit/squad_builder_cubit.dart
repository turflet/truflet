import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/json.dart';
import '../../../data/repositories/lobby_repository.dart';

class SquadBuilderState {
  final SquadArgs args;
  final int capacity;

  /// `{tag: known|guest, name, initials, user_id?}` — the host is not in this list.
  final List<Json> friends;
  final bool isPublic;
  final List<Json> recent;
  final bool busy;
  final int splitFee;

  const SquadBuilderState({
    required this.args,
    required this.capacity,
    this.friends = const [],
    this.isPublic = true,
    this.recent = const [],
    this.busy = false,
    this.splitFee = 0,
  });

  int get maxPlayers => (args.sport['max_players'] as int?) ?? 16;
  int get squad => 1 + friends.length;
  int get openSpots => (capacity - squad).clamp(0, 99);
  int get namedGuests => friends.where((f) => f['tag'] == 'guest').length;

  /// Open spots are listed for solo players (the host left "Open to solo players" on and the squad isn't full).
  bool get openToSolo => isPublic && openSpots > 0;

  /// The host always pays the whole turf up front (the hold adds the booking's convenience fee + GST);
  /// friends the host adds play free.
  int get hostPaysNow => args.turfPrice;

  /// Each solo player's share, paid back to the host once the host accepts them.
  int get share => (args.turfPrice / capacity).ceil();
  int get perHead => openToSolo ? share + splitFee : 0;

  /// What the host gets back if every open spot is filled by a paying solo player.
  int get recoverUpTo => openToSolo ? share * openSpots : 0;

  String get dateLabel => DateFormat('EEE, d MMM').format(args.date);

  SquadBuilderState copyWith({int? capacity, List<Json>? friends, bool? isPublic, List<Json>? recent, bool? busy}) =>
      SquadBuilderState(
        args: args,
        capacity: capacity ?? this.capacity,
        friends: friends ?? this.friends,
        isPublic: isPublic ?? this.isPublic,
        recent: recent ?? this.recent,
        busy: busy ?? this.busy,
        splitFee: splitFee,
      );
}

/// 4 · Squad Builder: capacity, friends tagged Known / Guest and open to solo players. The host pays the
/// whole turf right away (within 15 minutes); solo players who are accepted pay a share back.
class SquadBuilderCubit extends Cubit<SquadBuilderState> {
  final LobbyRepository _repo;

  SquadBuilderCubit({required SquadArgs args, required LobbyRepository repository, int splitFee = 0})
    : _repo = repository,
      super(
        SquadBuilderState(args: args, capacity: (((args.sport['max_players'] as int?) ?? 10).clamp(2, 10)), splitFee: splitFee),
      );

  Future<void> loadRecent() async {
    try {
      final r = await _repo.recentPlayers();
      _emit(state.copyWith(recent: asList(r['recent'])));
    } catch (_) {}
  }

  void setCapacity(int n) => _emit(state.copyWith(capacity: n.clamp(state.squad.clamp(2, 99), state.maxPlayers)));
  void setPublic(bool v) => _emit(state.copyWith(isPublic: v));

  /// Returns an error message, or null when added.
  String? addKnown(Json player) {
    if (state.friends.any((f) => f['user_id'] == player['id'])) return '${player['name']} is already in your squad.';
    if (state.squad >= state.maxPlayers) return 'The squad is at the ${state.maxPlayers}-player limit.';
    _add({'tag': 'known', 'user_id': player['id'], 'name': player['name'], 'initials': player['initials']});
    return null;
  }

  String? addGuest(String name) {
    final n = name.trim();
    if (n.isEmpty) return 'Give your guest a name.';
    if (state.squad >= state.maxPlayers) return 'The squad is at the ${state.maxPlayers}-player limit.';
    _add({'tag': 'guest', 'name': n, 'initials': n.substring(0, 1).toUpperCase()});
    return null;
  }

  void _add(Json f) {
    final friends = [...state.friends, f];
    final capacity = state.capacity < 1 + friends.length ? 1 + friends.length : state.capacity;
    _emit(state.copyWith(friends: friends, capacity: capacity));
  }

  void remove(int i) => _emit(state.copyWith(friends: [...state.friends]..removeAt(i)));

  /// Finds a Turflet player by email / mobile / referral code. Throws ApiError.
  Future<Json> lookup(String contact) async => asMap((await _repo.lookup(contact.trim()))['player']);

  /// Creates the match and holds the slot for 15 minutes. Returns it with `checkout_booking` (the held
  /// booking the host pays now). Throws ApiError.
  Future<Json> create() async {
    _emit(state.copyWith(busy: true));
    try {
      final a = state.args;
      return await _repo.create({
        'venue': a.venue['id'],
        'court': a.court['id'],
        'sport': a.sport['sport_id'],
        'date': DateFormat('yyyy-MM-dd').format(a.date),
        'start_hour': a.startHour,
        'duration': a.duration,
        'capacity': state.capacity,
        'is_public': state.openToSolo,
        'friends': [
          for (final f in state.friends)
            f['tag'] == 'guest' ? {'tag': 'guest', 'name': f['name']} : {'tag': 'known', 'user_id': f['user_id']},
        ],
      });
    } finally {
      _emit(state.copyWith(busy: false));
    }
  }

  void _emit(SquadBuilderState s) {
    if (!isClosed) emit(s);
  }
}
