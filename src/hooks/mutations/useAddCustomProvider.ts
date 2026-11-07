import { useMutation, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js/dist/module.full.no-external.js";

import { analyticsProperties, detailedAnalyticsProperties } from "@/lib/analytics";
import { desktop } from "@/lib/desktop";
import { qk } from "@/lib/queryKeys";
import { useOpenCodeClient } from "@/providers/OpenCodeClientProvider";

export interface CustomProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

/**
 * Registers a custom OpenAI-compatible provider by writing its configuration
 * into OpenCode's config file via the desktop bridge and connecting its API key.
 *
 * OpenCode registers a provider (exposed as an integration) from its JSON config
 * under the top-level `providers` key. Once written, a location reload makes the
 * new provider available so the key can be connected to it.
 */
export function useAddCustomProvider() {
  const { client } = useOpenCodeClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, baseUrl, apiKey, modelId }: CustomProviderInput) => {
      if (!client) throw new Error("No client");

      // Generate a unique provider ID from the name.
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) throw new Error("Use letters or numbers in the provider name.");
      const providerID = `custom-${slug}`;

      // Write the custom provider into OpenCode's config via the desktop bridge.
      // The main process merges this patch into opencode.json.
      await desktop.patchOpenCodeConfig({
        providers: {
          [providerID]: {
            name,
            package: "@opencode/ai/providers/openai-compatible",
            settings: {
              baseURL: baseUrl.trim().replace(/\/+$/, ""),
            },
            models: {
              [modelId]: {
                name: modelId,
              },
            },
          },
        },
      });

      // Reload so OpenCode registers the provider before its key is connected.
      await client.instance.dispose({}, { throwOnError: true });

      // OpenCode's location reload is asynchronous. The first request after the
      // reload waits for the server to reinitialize and may return stale data, so
      // warm it up before trying to connect the newly-created integration.
      await client.provider.list({}, { throwOnError: true });

      // Set the API key for the custom provider.
      await client.auth.set(
        { providerID, auth: { type: "api", key: apiKey } },
        { throwOnError: true },
      );

      // Refresh provider list
      try {
        const [provRes, authRes] = await Promise.all([
          client.provider.list({}, { throwOnError: true }),
          client.provider.auth({}, { throwOnError: true }).catch(() => ({ data: undefined })),
        ]);
        if (!provRes.data) throw new Error("No provider data after adding custom provider");
        const merged = authRes.data ? { ...provRes.data, authMethods: authRes.data } : provRes.data;
        queryClient.setQueryData(qk.providers, merged);
      } catch {
        await queryClient.invalidateQueries({ queryKey: qk.providers });
      }

      posthog.capture(
        "provider_connected",
        analyticsProperties("providers", {
          outcome: "success",
          method: "custom_endpoint",
          ...detailedAnalyticsProperties({ provider: providerID }),
        }),
      );

      return providerID;
    },
  });
}
