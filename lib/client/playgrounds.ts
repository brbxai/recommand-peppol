import { rc } from "@recommand/lib/client";
import type { Playgrounds } from "@peppol/api/playgrounds";
import type { InferResponseType } from 'hono/client';
import { useEffect, useState } from "react";
import { useUserStore } from "@core/lib/user-store";

export const client = rc<Playgrounds>("v1");

type GetPlaygroundSuccess = Extract<
  InferResponseType<typeof client[":teamId"]["playground"]["$get"]>,
  { success: true }
>;

export type PlaygroundType = GetPlaygroundSuccess["playground"];

export async function createPlayground(name: string) {
  const res = await client.playgrounds.$post({
    json: { name },
  });
  return res.json();
}

let getPlaygroundCache: Map<string, PlaygroundType | null> = new Map();
let getPlaygroundPromiseCache: Map<string, Promise<PlaygroundType | null>> = new Map();

/**
 * Get the playground for the given team id
 * @param teamId The id of the team
 * @returns The extended team information or null if it does not exist as a playground
 */
export async function getPlayground(teamId: string): Promise<PlaygroundType | null> {
  // Return from cache if available
  if (getPlaygroundCache.has(teamId)) {
    return getPlaygroundCache.get(teamId)!;
  }

  // Check if there's already a request in flight for this teamId
  if (getPlaygroundPromiseCache.has(teamId)) {
    return getPlaygroundPromiseCache.get(teamId)!;
  }

  // Create a new promise for this request
  const promise = (async () => {
    try {
      const res = await client[":teamId"].playground.$get({
        param: { teamId },
      });
      const response = await res.json();
      const result = response.success ? response.playground as PlaygroundType : null;
      getPlaygroundCache.set(teamId, result);
      return result;
    } catch (error) {
      getPlaygroundCache.set(teamId, null);
      return null;
    } finally {
      // Clean up the promise cache after the request is complete
      getPlaygroundPromiseCache.delete(teamId);
    }
  })();

  // Store the promise in the cache
  getPlaygroundPromiseCache.set(teamId, promise);
  return promise;
}

export function useIsPlayground() {
  const { activeTeam } = useUserStore(x => x);
  const [isPlayground, setIsPlayground] = useState(false);

  useEffect(() => {
    if (activeTeam) {
      getPlayground(activeTeam.id).then(playground => {
        setIsPlayground(playground?.isPlayground ?? false);
      });
    }
  }, [activeTeam]);

  return isPlayground;
}
