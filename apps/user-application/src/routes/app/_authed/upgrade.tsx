import { createFileRoute } from '@tanstack/react-router'
import {UpgradePage} from "@/components/payments";

export const Route = createFileRoute('/app/_authed/upgrade')({
  component: RouteComponent,
})

function RouteComponent() {
  // return <div>Hello "/app/_authed/upgrade"!</div>
  return <UpgradePage />
}
