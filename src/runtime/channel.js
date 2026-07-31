import {
  CHANNEL_ACCOUNT_ID,
  CHANNEL_ID,
} from "../constants.js";
import { buildChannelOutboundSessionRoute } from "openclaw/plugin-sdk/channel-core";
import {
  createKitchenChannelDelivery,
  kitchenChannelAccount,
  kitchenPromptGuidance,
  normalizeKitchenTarget,
} from "../scenarios.js";

export function buildKitchenChannel() {
  return {
    id: CHANNEL_ID,
    meta: {
      id: CHANNEL_ID,
      label: "Kitchen Sink",
      selectionLabel: "Kitchen Sink",
      docsPath: "/plugins/kitchen-sink",
      docsLabel: "Kitchen Sink",
      blurb: "Credential-free channel fixture for deterministic Kitchen Sink conversations.",
      aliases: ["kitchen", "kitchen-sink"],
      exposure: { configured: true, setup: true, docs: true },
      showConfigured: true,
      showInSetup: true,
    },
    capabilities: {
      chatTypes: ["direct", "group", "channel"],
      media: true,
      nativeCommands: true,
      reply: true,
      threads: true,
    },
    config: {
      listAccountIds: () => [CHANNEL_ACCOUNT_ID],
      defaultAccountId: () => CHANNEL_ACCOUNT_ID,
      resolveAccount: (cfg, accountId) => kitchenChannelAccount(accountId || CHANNEL_ACCOUNT_ID, cfg),
      isEnabled: (cfg) => cfg?.disabled !== true,
      isConfigured: (cfg) => cfg?.configured !== false,
      describeAccount: (account) => kitchenChannelAccount(account.accountId, account),
      resolveDefaultTo: () => "kitchen",
    },
    status: {
      defaultRuntime: kitchenChannelAccount(),
      probeAccount: async ({ account }) => ({
        ok: true,
        accountId: account.accountId,
        scenarioId: "channel.probe",
      }),
      buildAccountSnapshot: ({ account }) => kitchenChannelAccount(account.accountId),
    },
    outbound: {
      deliveryMode: "direct",
      textChunkLimit: 2000,
      sendText: async (ctx) =>
        createKitchenChannelDelivery({ kind: "text", text: ctx?.text, to: ctx?.to }),
      sendMedia: async (ctx) =>
        createKitchenChannelDelivery({ kind: "media", text: ctx?.mediaUrl || ctx?.text, to: ctx?.to }),
    },
    messaging: {
      normalizeTarget: (raw) => normalizeKitchenTarget(raw),
      targetResolver: {
        looksLikeId: (raw) => String(raw ?? "").trim().length > 0,
        hint: "<target>",
      },
      parseExplicitTarget: ({ raw }) => ({
        to: normalizeKitchenTarget(raw),
        chatType: "direct",
      }),
      inferTargetChatType: () => "direct",
      resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target, threadId }) => {
        const to = normalizeKitchenTarget(target);
        return buildChannelOutboundSessionRoute({
          cfg,
          agentId,
          channel: CHANNEL_ID,
          accountId,
          recipientSessionExact: true,
          peer: { kind: "direct", id: to },
          chatType: "direct",
          from: `${CHANNEL_ID}:${accountId || CHANNEL_ACCOUNT_ID}`,
          to,
          threadId: threadId || undefined,
        });
      },
    },
    agentPrompt: {
      messageToolHints: () => kitchenPromptGuidance(),
      messageToolCapabilities: () => [
        "Kitchen Sink channel accepts deterministic dry messages prefixed with kitchen.",
        "Kitchen Sink channel can deliver text and media without external credentials.",
      ],
    },
  };
}
