import { registerArtistHandlers } from "./artists";
import { registerTrackHandlers } from "./tracks";
import { registerLibraryHandlers } from "./library";
import { registerPlayerHandlers } from "./player";
import { registerSearchHandlers } from "./search";
import { registerWindowHandlers } from "./window";
import { registerTrayHandlers } from "./tray";
import { registerPlaylistHandlers } from "./playlists";
import { registerEnhanceHandlers } from "./enhance";
import { registerLastfmHandlers } from "./lastfm";
import { registerUpdateHandlers } from "./update";
import { registerProfileHandlers } from "./profile";

export function registerAllHandlers(mainWindow, db) {
  registerArtistHandlers(db);
  registerTrackHandlers(mainWindow, db);
  registerLibraryHandlers(mainWindow, db);
  registerPlayerHandlers(mainWindow, db);
  registerSearchHandlers(mainWindow, db);
  registerWindowHandlers(mainWindow);
  registerTrayHandlers(mainWindow);
  registerPlaylistHandlers(mainWindow, db);
  registerEnhanceHandlers(mainWindow, db);
  registerLastfmHandlers();
  registerUpdateHandlers(mainWindow);
  registerProfileHandlers(mainWindow, db);
}
