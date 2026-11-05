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
 * into OpenCode's config file via the desktop bridge and setting the API key
 * through the auth endpoint.
 *
 * OpenCode supports custom providers via its JSON config under the `provider` key.
 * We write the provider definition there via patchOpenCodeConfig, then set the API key via auth.set.
 */
export function useAddCustomProvider() {
  const { client } = useOpenCodeClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, baseUrl, apiKey, modelId }: CustomProviderInput) => {
      if (!client) throw new Error("No client");

      // Generate a unique provider ID from the name
      const providerID = `custom-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;

      // Write the custom provider into OpenCode's config via the desktop bridge.
      // The main process merges this patch into opencode.json and reloads.
      await desktop.patchOpenCodeConfig({
        provider: {
          [providerID]: {
            name,
            api: {
              id: "openai",
              url: baseUrl,
              npm: "@ai-sdk/openai",
            },
            models: {
              [modelId]: {
                id: modelId,
                name: modelId,
              },
            },
          },
        },
      });

      // Set the API key for the custom provider
      await client.auth.set(
        { providerID, auth: { type: "api", key: apiKey } },
        { throwOnError: true },
      );

      // Refresh provider list
      try {
        await client.instance.dispose({}, { throwOnError: true });
        await client.provider.list({}, { throwOnError: true });
        const [provRes, authRes] = await Promise.all([
          client.provider.list({}, { throwOnError: true }),
          client.provider
            .auth({}, { throwOnError: true })
            .catch(() => ({ data: undefined })),
        ]);
        if (!provRes.data)
          throw new Error("No provider data after adding custom provider");
        const merged = authRes.data
          ? { ...provRes.data, authMethods: authRes.data }
          : provRes.data;
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