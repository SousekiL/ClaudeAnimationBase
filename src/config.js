// config.js: project settings.
//   duration: the video's length in seconds.
//   bpm:      the rhythm that bounces, dances and pulse() follow. Clawd always moves to some beat; if the video has music,
//             set this to the song's tempo, and set offset to the time in seconds of its first downbeat.
//   fills:    false imitates p5.brush's watercolour fills with layered washes. Use it on machines without a GPU, where
//             software WebGL spends ~1.5 s on every watercolour fill.
const PROJECT = { duration: 15, bpm: 100, offset: 0, fills: false };
