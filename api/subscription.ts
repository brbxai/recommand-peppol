import { zValidator } from "@hono/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import {
  cancelSubscription,
  getActiveSubscription,
  startSubscription,
} from "@peppol/data/subscriptions";
import { allPlans } from "@peppol/data/plans";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";

const server = new Server();

const _getActiveSubscription = server.get(
  "/:teamId/subscription",
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    // TODO: Perform authentication and authorization

    const teamId = c.req.param("teamId");

    const subscription = await getActiveSubscription(teamId);

    return c.json(actionSuccess({ subscription }));
  }
);

const _startSubscription = server.post(
  "/:teamId/subscription",
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator(
    "json",
    z.object({
      planId: z.string(),
    })
  ),
  async (c) => {
    // TODO: Perform authentication and authorization

    const teamId = c.req.param("teamId");
    const planId = c.req.valid("json").planId;

    // Get plan
    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) {
      return c.json(actionFailure("Plan not found"), 404);
    }

    const subscription = await startSubscription(
      teamId,
      planId,
      plan.name,
      plan
    );

    return c.json(actionSuccess({ subscription }));
  }
);

const _cancelSubscription = server.post(
  "/:teamId/subscription/cancel",
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    // TODO: Perform authentication and authorization

    const teamId = c.req.param("teamId");

    await cancelSubscription(teamId);

    return c.json(actionSuccess());
  }
);

export type Subscription = typeof _getActiveSubscription | typeof _startSubscription | typeof _cancelSubscription;

export default server;
