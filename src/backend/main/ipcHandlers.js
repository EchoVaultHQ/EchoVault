import { registerArtistHandlers } from "./artists"
import { registerTrackHandlers } from "./tracks"
import { registerLibraryHandlers } from "./library"
import { registerPlayerHandlers } from "./player"
import { registerSearchHandlers } from "./search"
import { registerWindowHandlers } from "./window"
import { registerPlaylistHandlers } from "./playlists"
import { registerEnhanceHandlers } from "./enhance"

export function registerAllHandlers(mainWindow, db) {
  registerArtistHandlers(db)
  registerTrackHandlers(mainWindow, db)
  registerLibraryHandlers(mainWindow, db)
  registerPlayerHandlers(mainWindow, db)
  registerSearchHandlers(mainWindow, db)
  registerWindowHandlers(mainWindow)
  registerPlaylistHandlers(mainWindow, db)
  registerEnhanceHandlers(mainWindow, db)
}
