"use client";

import { useEffect, useState } from "react";

export default function ConfirmClient({ token }: { token?: string }) {
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    if (!token) {
      setStatus("Invalid or missing token.");
      return;
    }

    async function confirm() {
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus(data.error || "Confirmation failed.");
        } else {
          setStatus("Session confirmed successfully!");
        }
      } catch {
        setStatus("Something went wrong.");
      }
    }

    confirm();
  }, [token]);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Session Confirmation</h1>
      <p>{status}</p>
    </div>
  );
}