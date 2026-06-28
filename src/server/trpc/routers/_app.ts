import { router } from "../trpc";
import { billingRouter } from "./billing";
import { membersRouter } from "./members";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
  workspace: workspaceRouter,
  members: membersRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
