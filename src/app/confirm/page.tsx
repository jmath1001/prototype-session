// app/confirm/page.tsx

import ConfirmClient from "./ConfirmClient";

export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <ConfirmClient token={searchParams.token} />;
}