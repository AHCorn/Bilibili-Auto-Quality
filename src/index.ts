import "./env";
import { state } from "./settings";
import { applyVisibilityHijack } from "./visibility";
import { applyUnlockEnvironment } from "./unlock-env";
import { applyStyles } from "./styles";
import "./quality-vocab";
import "./panel-chrome";
import { registerMenuCommands } from "./menu";
import { installSettingsSync } from "./settings-sync";
import { installLifecycle } from "./lifecycle";

applyVisibilityHijack(state.preventBackgroundDegrade);
applyUnlockEnvironment();
applyStyles();
registerMenuCommands();
installSettingsSync();
installLifecycle();
