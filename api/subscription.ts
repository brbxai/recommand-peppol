import { zodValidator } from "@recommand/lib/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import {
  cancelSubscription,
  getActiveSubscription,
  startSubscription,
} from "@peppol/data/subscriptions";
import { availablePlans } from "@peppol/data/plans";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { requireTeamAccess } from "@core/lib/auth-middleware";

const server = new Server();

const _getActiveSubscription = server.get(
  "/:teamId/subscription",
  requireTeamAccess(),
  zodValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    const subscription = await getActiveSubscription(c.var.team.id);
    return c.json(actionSuccess({ subscription }));
  }
);

const _startSubscription = server.post(
  "/:teamId/subscription",
  requireTeamAccess(),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator(
    "json",
    z.object({
      planId: z.string(),
    })
  ),
  async (c) => {
    const planId = c.req.valid("json").planId;

    // Get plan
    const plan = availablePlans.find((p) => p.id === planId);
    if (!plan) {
      return c.json(actionFailure("Plan not found"), 404);
    }

    const subscription = await startSubscription(
      c.var.team.id,
      planId,
      plan.name,
      plan
    );

    return c.json(actionSuccess({ subscription }));
  }
);

const _cancelSubscription = server.post(
  "/:teamId/subscription/cancel",
  requireTeamAccess(),
  zodValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    await cancelSubscription(c.var.team.id);
    return c.json(actionSuccess());
  }
);

export type Subscription = typeof _getActiveSubscription | typeof _startSubscription | typeof _cancelSubscription;

export default server;
