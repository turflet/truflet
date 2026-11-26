/// The redesign's photography, bundled in assets/images. Sport discs use the square sport renders; wide cards
/// (lobbies, a venue's sports) use the scene photos. Real venue photos from the API are never replaced.
/// Mirrors web/src/lib/art.js.
abstract final class Art {
  static const floodlit = 'assets/images/turf-night.jpg';
  static const training = 'assets/images/training.jpg';
  static const indoor = 'assets/images/indoor-court.jpg';

  static const _thumbs = ['football', 'cricket', 'badminton', 'tennis', 'pickleball', 'basketball', 'swimming', 'volleyball'];
  static const _scenes = {
    'football': 'pitch-7v7',
    'cricket': 'box-cricket',
    'badminton': 'indoor-court',
    'tennis': 'clay-court',
    'pickleball': 'clay-court',
  };

  static String? _kind(Object? name) {
    final n = '${name ?? ''}'.toLowerCase();
    for (final k in _thumbs) {
      if (n.contains(k)) return k;
    }
    return n.contains('soccer') || n.contains('futsal') ? 'football' : null;
  }

  /// Asset path of the round sport render for [name], or null (then use the API image).
  static String? sportThumb(Object? name) {
    final k = _kind(name);
    return k == null ? null : 'assets/images/sport-$k.jpg';
  }

  /// Wide scene photo for a sport.
  static String sportScene(Object? name) => 'assets/images/${_scenes[_kind(name)] ?? 'training'}.jpg';
}
