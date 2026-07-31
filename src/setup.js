import { defineSetupPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { buildKitchenChannel } from "./runtime/channel.js";

export default defineSetupPluginEntry(buildKitchenChannel());
