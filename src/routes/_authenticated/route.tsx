import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { guardWithHoldingPage } from "@/lib/site-hold";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    guardWithHoldingPage(location);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: undefined } });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
