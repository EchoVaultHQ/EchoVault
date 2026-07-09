// 10-band graphic EQ frequencies, matching the common Apple Music / Spotify-style layout.
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

// Each preset is an array of 10 dB values (-12..12), aligned index-for-index to EQ_BANDS.
export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Booster": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Bass Reducer": [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
  "Treble Booster": [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  "Treble Reducer": [0, 0, 0, 0, 0, -1, -2, -4, -5, -6],
  "Vocal Booster": [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Rock: [4, 3, 2, 0, -1, 0, 2, 3, 4, 4],
  Pop: [-1, 1, 3, 3, 1, -1, -1, 1, 2, 2],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5],
  Acoustic: [3, 3, 2, 1, 1, 2, 3, 3, 2, 2],
}

export const PRESET_NAMES = Object.keys(EQ_PRESETS)
